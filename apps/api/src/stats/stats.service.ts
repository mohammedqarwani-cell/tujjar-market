import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { damascusDay } from '../common/pagination';

const DEDUPE_MS = 30 * 60_000;

@Injectable()
export class StatsService {
  /** ip+target -> last counted time; stops refreshes from inflating numbers */
  private seen = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  private firstTime(key: string): boolean {
    const now = Date.now();
    const last = this.seen.get(key);
    if (last && now - last < DEDUPE_MS) return false;
    this.seen.set(key, now);
    if (this.seen.size > 50_000) {
      for (const [k, t] of this.seen) if (now - t >= DEDUPE_MS) this.seen.delete(k);
    }
    return true;
  }

  private bumpDay(storeId: string, field: 'views' | 'whatsapp' | 'calls') {
    const day = damascusDay();
    return this.prisma.storeDailyStat.upsert({
      where: { storeId_day: { storeId, day } },
      create: { storeId, day, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  }

  async trackView(ip: string, dto: { storeSlug?: string; productId?: string }) {
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, storeId: true },
      });
      if (!product || !this.firstTime(`pv:${ip}:${product.id}`)) return;
      await this.prisma.$transaction([
        this.prisma.product.update({ where: { id: product.id }, data: { viewsCount: { increment: 1 } } }),
        this.bumpDay(product.storeId, 'views'),
      ]);
      return;
    }
    if (dto.storeSlug) {
      const store = await this.prisma.store.findUnique({ where: { slug: dto.storeSlug }, select: { id: true } });
      if (!store || !this.firstTime(`sv:${ip}:${store.id}`)) return;
      await this.prisma.$transaction([
        this.prisma.store.update({ where: { id: store.id }, data: { viewsCount: { increment: 1 } } }),
        this.bumpDay(store.id, 'views'),
      ]);
    }
  }

  async trackContact(ip: string, dto: { storeSlug: string; productId?: string; channel: 'WHATSAPP' | 'CALL' }) {
    const store = await this.prisma.store.findUnique({ where: { slug: dto.storeSlug }, select: { id: true } });
    if (!store) return;
    if (!this.firstTime(`c:${ip}:${store.id}:${dto.productId ?? ''}:${dto.channel}`)) return;

    const productOps = dto.productId
      ? [
          this.prisma.product.updateMany({
            where: { id: dto.productId, storeId: store.id },
            data: { contactsCount: { increment: 1 } },
          }),
        ]
      : [];
    await this.prisma.$transaction([
      this.prisma.store.update({ where: { id: store.id }, data: { contactsCount: { increment: 1 } } }),
      this.bumpDay(store.id, dto.channel === 'WHATSAPP' ? 'whatsapp' : 'calls'),
      ...productOps,
    ]);
  }

  async merchantOverview(userId: string, days: number) {
    const span = Math.min(90, Math.max(7, days));
    const store = await this.prisma.store.findFirst({ where: { ownerId: userId }, select: { id: true } });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');

    const from = damascusDay(-(span - 1));
    const [rows, productCounts, topProducts] = await Promise.all([
      this.prisma.storeDailyStat.findMany({
        where: { storeId: store.id, day: { gte: from } },
        orderBy: { day: 'asc' },
      }),
      this.prisma.product.groupBy({ by: ['status'], where: { storeId: store.id }, _count: true }),
      this.prisma.product.findMany({
        where: { storeId: store.id },
        select: { id: true, title: true, viewsCount: true, contactsCount: true, images: true },
        orderBy: [{ contactsCount: 'desc' }, { viewsCount: 'desc' }],
        take: 5,
      }),
    ]);

    const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));
    const series = Array.from({ length: span }, (_, i) => {
      const day = damascusDay(-(span - 1) + i).toISOString().slice(0, 10);
      const r = byDay.get(day);
      return { day, views: r?.views ?? 0, whatsapp: r?.whatsapp ?? 0, calls: r?.calls ?? 0 };
    });
    const totals = series.reduce(
      (t, d) => ({ views: t.views + d.views, whatsapp: t.whatsapp + d.whatsapp, calls: t.calls + d.calls }),
      { views: 0, whatsapp: 0, calls: 0 },
    );
    const products = Object.fromEntries(productCounts.map((p) => [p.status, p._count]));

    return {
      days: span,
      totals,
      series,
      products: {
        active: products.ACTIVE ?? 0,
        hidden: products.HIDDEN ?? 0,
        underReview: products.UNDER_REVIEW ?? 0,
      },
      topProducts,
    };
  }
}
