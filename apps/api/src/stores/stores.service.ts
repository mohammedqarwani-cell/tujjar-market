import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { buildSearchText, normalizeArabic } from '../common/text/arabic';
import { normalizeSyrianMobile, normalizeSyrianPhone } from '../common/text/phone';
import { pageResult, paging } from '../common/pagination';
import { publicStoreWhere, storeCardSelect } from '../common/selects';
import { atLeast } from '../verification/verification.levels';
import { UpdateStoreDto } from './store.dto';
import { isValidSchedule, openState } from '../common/hours';
import { insideSyria } from '../common/geo';
import { SearchIndexService } from '../search/search-index.service';

@Injectable()
export class StoresService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private search: SearchIndexService,
  ) {}

  async list(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const where: Prisma.StoreWhereInput = { ...publicStoreWhere };
    if (query.gov) where.governorate = { status: 'ACTIVE', slug: query.gov };
    if (query.market) where.market = { slug: query.market };
    if (query.category) where.category = { slug: query.category };

    const ranked = query.q?.trim() ? this.search.rankStores(query.q) : null;
    if (ranked) {
      const matches = await this.prisma.store.findMany({ where: { ...where, id: { in: ranked.ids } }, select: { id: true } });
      matches.sort((a, b) => ranked.scores.get(b.id)! - ranked.scores.get(a.id)!);
      const pageIds = matches.slice(skip, skip + take).map((m) => m.id);
      const rows = await this.prisma.store.findMany({ where: { id: { in: pageIds } }, select: storeCardSelect });
      const items = pageIds.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
      return { ...pageResult(items, matches.length, page, pageSize), search: ranked.meta };
    }

    const terms = normalizeArabic(query.q).split(' ').filter((t) => t.length > 1).slice(0, 5);
    if (terms.length) where.AND = terms.map((t) => ({ searchText: { contains: t } }));

    if (query.open === '1') {
      // "Open now" depends on the clock, so it's filtered after loading the matching stores
      const all = await this.prisma.store.findMany({
        where,
        select: storeCardSelect,
        orderBy: [{ verificationLevel: 'desc' }, { contactsCount: 'desc' }, { createdAt: 'desc' }],
        take: 1000,
      });
      const open = all.filter((s) => openState(s.openingSchedule as never)?.open);
      return pageResult(open.slice(skip, skip + take), open.length, page, pageSize);
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        select: storeCardSelect,
        orderBy: [{ verificationLevel: 'desc' }, { contactsCount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.store.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async bySlug(slug: string) {
    const store = await this.prisma.store.findFirst({
      where: { slug, ...publicStoreWhere },
      select: {
        ...storeCardSelect,
        description: true,
        address: true,
        mapUrl: true,
        whatsapp: true,
        phone: true,
        openingHours: true,
        governorate: { select: { slug: true, name: true } },
        market: { select: { slug: true, name: true } },
      },
    });
    if (!store) throw new NotFoundException('المتجر غير موجود');

    const productCategories = await this.prisma.category.findMany({
      where: { products: { some: { storeId: store.id, status: 'ACTIVE' } } },
      select: { slug: true, name: true, icon: true },
      orderBy: { sortOrder: 'asc' },
    });
    return { ...store, productCategories };
  }

  async ownedBy(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId },
      include: {
        governorate: { select: { id: true, slug: true, name: true } },
        market: { select: { id: true, slug: true, name: true } },
        category: { select: { id: true, slug: true, name: true, icon: true } },
        _count: { select: { products: true } },
      },
    });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    const { searchText, badgeRestoredAt, ...rest } = store;
    return rest;
  }

  async update(userId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        governorateId: true,
        marketId: true,
        categoryId: true,
        earnedLevel: true,
        badgeSuspendedAt: true,
      },
    });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');

    if (dto.openingSchedule && !isValidSchedule(dto.openingSchedule)) {
      throw new BadRequestException('ساعات العمل غير صحيحة، راجع أوقات الفتح والإغلاق');
    }
    const hasPin = typeof dto.latitude === 'number' && typeof dto.longitude === 'number';
    if (hasPin && !insideSyria(dto.latitude!, dto.longitude!)) {
      throw new BadRequestException('موقع المحل على الخريطة خارج سوريا');
    }

    const whatsapp = normalizeSyrianMobile(dto.whatsapp);
    if (!whatsapp) throw new BadRequestException('رقم الواتساب غير صحيح، مثال: 0912345678');
    const phone = dto.phone ? normalizeSyrianPhone(dto.phone) : null;
    if (dto.phone && !phone) throw new BadRequestException('رقم الهاتف غير صحيح');

    const [governorate, market, category] = await Promise.all([
      this.prisma.governorate.findUnique({ where: { id: dto.governorateId } }),
      dto.marketId ? this.prisma.market.findUnique({ where: { id: dto.marketId } }) : null,
      dto.categoryId ? this.prisma.category.findUnique({ where: { id: dto.categoryId } }) : null,
    ]);
    if (!governorate) throw new BadRequestException('اختر المحافظة');
    if (dto.marketId && market?.governorateId !== governorate.id) {
      throw new BadRequestException('السوق لا يتبع المحافظة المختارة');
    }
    // A store can't move into a governorate that hasn't opened, or into a disabled market or category
    if (governorate.id !== store.governorateId && governorate.status !== 'ACTIVE') {
      throw new BadRequestException(`التسجيل في ${governorate.name} يفتح قريباً`);
    }
    if (market && market.id !== store.marketId && !market.isActive) {
      throw new BadRequestException('هذا السوق غير متاح حالياً');
    }
    if (category && category.id !== store.categoryId && !category.isActive) {
      throw new BadRequestException('هذا القسم غير متاح حالياً');
    }

    // Shop verification proves one sign in one market, so renaming or moving the store needs a new video
    const name = dto.name.trim();
    const movedOrRenamed =
      store.name !== name || store.governorateId !== governorate.id || store.marketId !== (market?.id ?? null);
    const resetShopVerification = movedOrRenamed && atLeast(store.earnedLevel, 'LOCATION');

    await this.prisma.store.update({
      where: { id: store.id },
      data: {
        name,
        tagline: dto.tagline?.trim() || null,
        description: dto.description?.trim() || null,
        governorateId: governorate.id,
        marketId: market?.id ?? null,
        categoryId: category?.id ?? null,
        address: dto.address?.trim() || null,
        mapUrl: dto.mapUrl || null,
        whatsapp,
        phone,
        openingHours: dto.openingHours?.trim() || null,
        ...(dto.openingSchedule !== undefined
          ? { openingSchedule: dto.openingSchedule ?? Prisma.DbNull }
          : {}),
        ...(dto.latitude !== undefined || dto.longitude !== undefined
          ? { latitude: hasPin ? dto.latitude : null, longitude: hasPin ? dto.longitude : null }
          : {}),
        logoUrl: dto.logoUrl || null,
        coverUrl: dto.coverUrl || null,
        hasDelivery: dto.hasDelivery,
        searchText: buildSearchText(
          dto.name, dto.tagline, dto.description, market?.name, governorate.name, category?.name,
        ),
        ...(resetShopVerification
          ? {
              earnedLevel: 'IDENTITY',
              verificationLevel: store.badgeSuspendedAt ? 'REGISTERED' : 'IDENTITY',
              verificationExpiresAt: null,
            }
          : {}),
      },
    });
    if (resetShopVerification) {
      await this.audit.log({
        actorId: userId,
        action: 'store.verification_reset',
        entityType: 'store',
        entityId: store.id,
        meta: { from: store.earnedLevel, reason: 'renamed_or_moved' },
      });
    }
    return this.ownedBy(userId);
  }
}
