import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Prisma, Role, UserStatus } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { clientIp } from '../common/request';
import { damascusDay, pageResult, paging } from '../common/pagination';
import { normalizeArabic, toLatinDigits } from '../common/text/arabic';
import { reporterCredibility } from '../reports/credibility';

const ROLES: Role[] = [
  'BUYER',
  'MERCHANT',
  'MODERATOR',
  'FIELD_AGENT',
  'ADMIN',
];
const DAY_MS = 86_400_000;

class UpdateUserDto {
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: UserStatus;
  /** Clears a temporary lock after failed sign-in attempts */
  @IsOptional() @IsBoolean() unlock?: boolean;
  /** Lets a paused reporter file reports again */
  @IsOptional() @IsBoolean() allowReporting?: boolean;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(
      query.page,
      query.pageSize,
      100,
    );
    const where: Prisma.UserWhereInput = {};
    if (ROLES.includes(query.role as Role)) where.role = query.role as Role;
    if (query.status === 'ACTIVE' || query.status === 'SUSPENDED')
      where.status = query.status;
    if (query.flag === 'locked') where.lockedUntil = { gt: new Date() };
    if (query.flag === 'reporting_blocked')
      where.reportingBlockedUntil = { gt: new Date() };
    const q = query.q?.trim();
    if (q) {
      const digits = toLatinDigits(q).replace(/\D/g, '');
      const phone = digits.startsWith('0') ? `963${digits.slice(1)}` : digits;
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        ...(phone.length >= 4 ? [{ phone: { contains: phone } }] : []),
        { stores: { some: { searchText: { contains: normalizeArabic(q) } } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          lockedUntil: true,
          reportingBlockedUntil: true,
          reportsConfirmed: true,
          reportsDismissed: true,
          totpEnabled: true,
          stores: {
            select: {
              slug: true,
              name: true,
              status: true,
              verificationLevel: true,
            },
            take: 1,
          },
          _count: {
            select: {
              reviews: true,
              reports: true,
              favorites: true,
              follows: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    const now = new Date();
    return pageResult(
      items.map(({ stores, ...u }) => ({
        ...u,
        store: stores[0] ?? null,
        locked: !!u.lockedUntil && u.lockedUntil > now,
        reportingBlocked:
          !!u.reportingBlockedUntil && u.reportingBlockedUntil > now,
        credibility: Math.round(
          reporterCredibility(u.reportsConfirmed, u.reportsDismissed) * 100,
        ),
      })),
      total,
      page,
      pageSize,
    );
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto, ip: string) {
    if (id === actor.id)
      throw new BadRequestException('لا يمكنك تعديل حسابك من هنا');
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    // Admin accounts are managed outside the console, so one compromised admin can't lock out the others
    if (user.role === 'ADMIN')
      throw new ForbiddenException(
        'لا يمكن تعديل حسابات المدراء من لوحة الإدارة',
      );

    const data: Prisma.UserUpdateInput = {};
    const actions: string[] = [];
    if (dto.status && dto.status !== user.status) {
      data.status = dto.status;
      actions.push(
        dto.status === 'SUSPENDED' ? 'user.suspended' : 'user.reactivated',
      );
    }
    if (dto.unlock) {
      data.lockedUntil = null;
      data.failedLogins = 0;
      actions.push('user.unlocked');
    }
    if (dto.allowReporting) {
      data.reportingBlockedUntil = null;
      actions.push('user.reporting_allowed');
    }
    if (!actions.length) throw new BadRequestException('لا يوجد تغيير');
    if (dto.status === 'SUSPENDED' && !dto.note?.trim())
      throw new BadRequestException('اكتب سبب الإيقاف');

    await this.prisma.user.update({ where: { id }, data });
    if (dto.status === 'SUSPENDED') {
      // Signs the account out everywhere right away
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    for (const action of actions) {
      await this.audit.log({
        actorId: actor.id,
        action,
        entityType: 'user',
        entityId: id,
        meta: { note: dto.note?.trim() || null },
        ip,
      });
    }
    return { id, updated: actions };
  }
}

@Injectable()
export class PlatformStatsService {
  constructor(private prisma: PrismaService) {}

  async stats(rawDays?: string) {
    const days = [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;
    const since = damascusDay(-(days - 1));
    const sinceTs = new Date(since.getTime() - 3 * 3600_000);

    const series = (table: 'User' | 'Store' | 'Product') =>
      this.prisma.$queryRaw<{ day: Date; n: bigint }[]>(
        Prisma.sql`SELECT date_trunc('day', "createdAt" + interval '3 hours') AS day, count(*)::bigint AS n
                   FROM ${Prisma.raw(`"${table}"`)} WHERE "createdAt" >= ${sinceTs} GROUP BY 1`,
      );

    const [
      usersByRole,
      storesByLevel,
      productsByStatus,
      newUsers,
      newStores,
      newProducts,
      engagement,
      topStoreRows,
      byGovernorate,
      byCategory,
      reviews,
      openReports,
      pushDevices,
      follows,
      favorites,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.store.groupBy({
        by: ['verificationLevel'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
      this.prisma.product.groupBy({ by: ['status'], _count: true }),
      series('User'),
      series('Store'),
      series('Product'),
      this.prisma.storeDailyStat.groupBy({
        by: ['day'],
        where: { day: { gte: since } },
        _sum: { views: true, whatsapp: true, calls: true },
      }),
      this.prisma.storeDailyStat.groupBy({
        by: ['storeId'],
        where: { day: { gte: since } },
        _sum: { views: true, whatsapp: true, calls: true },
        orderBy: { _sum: { whatsapp: 'desc' } },
        take: 5,
      }),
      this.prisma.governorate.findMany({
        where: { status: 'ACTIVE' },
        select: {
          name: true,
          _count: { select: { stores: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.category.findMany({
        select: {
          name: true,
          icon: true,
          _count: { select: { products: { where: { status: 'ACTIVE' } } } },
        },
      }),
      this.prisma.review.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.pushSubscription.count(),
      this.prisma.storeFollow.count(),
      this.prisma.favorite.count(),
    ]);

    const topStores = await this.prisma.store.findMany({
      where: { id: { in: topStoreRows.map((r) => r.storeId) } },
      select: { id: true, slug: true, name: true },
    });

    const key = (d: Date) => new Date(d).toISOString().slice(0, 10);
    const dayList = Array.from({ length: days }, (_, i) =>
      key(new Date(since.getTime() + i * DAY_MS)),
    );
    const fill = (rows: { day: Date; n: bigint }[]) => {
      const map = new Map(rows.map((r) => [key(r.day), Number(r.n)]));
      return dayList.map((d) => map.get(d) ?? 0);
    };
    const eng = new Map(engagement.map((r) => [key(r.day), r._sum]));
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const views = dayList.map((d) => eng.get(d)?.views ?? 0);
    const whatsapp = dayList.map((d) => eng.get(d)?.whatsapp ?? 0);
    const calls = dayList.map((d) => eng.get(d)?.calls ?? 0);

    return {
      days,
      dayList,
      totals: {
        users: Object.fromEntries(usersByRole.map((r) => [r.role, r._count])),
        storesByLevel: Object.fromEntries(
          storesByLevel.map((r) => [r.verificationLevel, r._count]),
        ),
        productsByStatus: Object.fromEntries(
          productsByStatus.map((r) => [r.status, r._count]),
        ),
        reviews,
        openReports,
        pushDevices,
        follows,
        favorites,
      },
      series: {
        newUsers: fill(newUsers),
        newStores: fill(newStores),
        newProducts: fill(newProducts),
        views,
        contacts: dayList.map((_, i) => whatsapp[i] + calls[i]),
      },
      period: {
        newUsers: sum(fill(newUsers)),
        newStores: sum(fill(newStores)),
        newProducts: sum(fill(newProducts)),
        views: sum(views),
        whatsapp: sum(whatsapp),
        calls: sum(calls),
      },
      topStores: topStoreRows.map((r) => {
        const s = topStores.find((x) => x.id === r.storeId);
        return {
          slug: s?.slug,
          name: s?.name,
          views: r._sum.views ?? 0,
          contacts: (r._sum.whatsapp ?? 0) + (r._sum.calls ?? 0),
        };
      }),
      byGovernorate: byGovernorate.map((g) => ({
        name: g.name,
        stores: g._count.stores,
      })),
      byCategory: byCategory
        .map((c) => ({
          name: c.name,
          icon: c.icon,
          products: c._count.products,
        }))
        .sort((a, b) => b.products - a.products)
        .slice(0, 8),
    };
  }
}

@Controller('admin')
@Auth('ADMIN', 'MODERATOR')
export class AdminUsersController {
  constructor(
    private users: AdminUsersService,
    private platform: PlatformStatsService,
  ) {}

  @Get('users')
  list(@Query() query: Record<string, string>) {
    return this.users.list(query);
  }

  /** Suspending, unlocking and lifting reporting pauses are for full admins only. */
  @Patch('users/:id')
  @Auth('ADMIN')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.users.update(actor, id, dto, clientIp(req));
  }

  @Get('stats')
  stats(@Query('days') days?: string) {
    return this.platform.stats(days);
  }
}
