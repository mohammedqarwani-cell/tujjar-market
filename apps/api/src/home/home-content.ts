import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { Throttle } from '../common/throttle';
import { clientIp } from '../common/request';
import { publicStoreWhere, storeCardSelect } from '../common/selects';
import { env } from '../env';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

/* ------------------------------------------------------------------ layout */

export const SECTION_IDS = [
  'banners',
  'showcase',
  'categories',
  'offers',
  'openNow',
  'featured',
  'markets',
  'popular',
  'howItWorks',
  'recent',
  'latest',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type HomeLayout = {
  sections: { id: SectionId; enabled: boolean; title: string }[];
  /** Also show the banners the site builds by itself (offers count, open now, top category, verification) */
  autoBanners: boolean;
  offers: { countdown: 'midnight' | 'until' | 'none'; until: string | null };
  quickSearches: string[];
  greeting: boolean;
};

const LAYOUT_KEY = 'home.layout';

export const DEFAULT_LAYOUT: HomeLayout = {
  sections: SECTION_IDS.map((id) => ({ id, enabled: true, title: '' })),
  autoBanners: true,
  offers: { countdown: 'midnight', until: null },
  quickSearches: ['طاقة شمسية', 'موبايلات', 'بروكار', 'صابون غار', 'حلويات', 'لابتوب'],
  greeting: true,
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Accepts only the known shape: unknown sections are dropped, missing ones are appended
 * (so a section added in a later release shows up), strings are trimmed and capped.
 */
export function sanitizeLayout(raw: unknown): HomeLayout {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const seen = new Set<SectionId>();
  const sections: HomeLayout['sections'] = [];
  for (const s of Array.isArray(input.sections) ? input.sections : []) {
    const id = (s as { id?: unknown })?.id as SectionId;
    if (!SECTION_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, enabled: (s as { enabled?: unknown }).enabled !== false, title: str((s as { title?: unknown }).title, 60) });
  }
  for (const id of SECTION_IDS) if (!seen.has(id)) sections.push({ id, enabled: true, title: '' });

  const offers = (input.offers ?? {}) as Record<string, unknown>;
  const countdown = ['midnight', 'until', 'none'].includes(offers.countdown as string)
    ? (offers.countdown as HomeLayout['offers']['countdown'])
    : 'midnight';
  const untilDate = typeof offers.until === 'string' ? new Date(offers.until) : null;
  const until = untilDate && !Number.isNaN(untilDate.getTime()) ? untilDate.toISOString() : null;
  if (countdown === 'until' && !until) throw new BadRequestException('حدّد موعد انتهاء العروض');

  const quickSearches = [
    ...new Set((Array.isArray(input.quickSearches) ? input.quickSearches : []).map((q) => str(q, 30)).filter(Boolean)),
  ].slice(0, 10);

  return {
    sections,
    autoBanners: input.autoBanners !== false,
    offers: { countdown, until: countdown === 'until' ? until : null },
    quickSearches,
    greeting: input.greeting !== false,
  };
}

/* ----------------------------------------------------------------- banners */

export const TONES = ['brand', 'olive', 'ink', 'rose'] as const;

class BannerDto {
  @IsString() @MinLength(2, { message: 'العنوان قصير جداً' }) @MaxLength(70, { message: 'العنوان أطول من 70 حرفاً' }) title!: string;
  @IsString() @MaxLength(40, { message: 'السطر العلوي أطول من 40 حرفاً' }) eyebrow!: string;
  @IsString() @MinLength(2, { message: 'اكتب نص الزر' }) @MaxLength(24, { message: 'نص الزر أطول من 24 حرفاً' }) cta!: string;
  /** A page inside the buyer site only, banners never send people to other websites */
  @IsString()
  @MaxLength(300)
  @Matches(/^\/(?!\/)[^\s\\]*$/, { message: 'الرابط يجب أن يكون صفحة داخل الموقع ويبدأ بـ /' })
  href!: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string | null;
  @IsIn(TONES, { message: 'اختر لون البنر' }) tone!: (typeof TONES)[number];
  @IsOptional() @IsString() @MaxLength(40) governorateId?: string | null;
  @IsOptional() @Type(() => Date) @IsDate({ message: 'تاريخ البداية غير صالح' }) startsAt?: Date | null;
  @IsOptional() @Type(() => Date) @IsDate({ message: 'تاريخ النهاية غير صالح' }) endsAt?: Date | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class PromotionDto {
  @IsString() @MaxLength(40) storeId!: string;
  @IsString() @MinLength(2, { message: 'اكتب اسم الباقة' }) @MaxLength(40, { message: 'اسم الباقة أطول من 40 حرفاً' }) plan!: string;
  @IsOptional() @Type(() => Date) @IsDate({ message: 'تاريخ البداية غير صالح' }) startsAt?: Date | null;
  @IsOptional() @Type(() => Date) @IsDate({ message: 'تاريخ النهاية غير صالح' }) endsAt?: Date | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class MoveDto {
  @IsInt() @Min(-1) @Max(1) direction!: number;
}

class LayoutDto {
  // Validated by sanitizeLayout, which knows the full shape
  @IsOptional() sections?: unknown;
  @IsOptional() autoBanners?: unknown;
  @IsOptional() offers?: unknown;
  @IsOptional() quickSearches?: unknown;
  @IsOptional() greeting?: unknown;
}

const bannerSelect = {
  id: true,
  eyebrow: true,
  title: true,
  cta: true,
  href: true,
  imageUrl: true,
  tone: true,
} satisfies Prisma.HomeBannerSelect;

@Injectable()
export class HomeContentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async layout(): Promise<HomeLayout> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: LAYOUT_KEY } });
    if (!row) return DEFAULT_LAYOUT;
    try {
      return sanitizeLayout(JSON.parse(row.value));
    } catch {
      return DEFAULT_LAYOUT;
    }
  }

  /** What the homepage shows for one governorate right now. */
  async publicContent(govSlug?: string) {
    const layout = await this.layout();
    const now = new Date();
    const [banners, showcase] = await Promise.all([
      this.prisma.homeBanner.findMany({
        where: {
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            { OR: [{ governorateId: null }, ...(govSlug ? [{ governorate: { slug: govSlug } }] : [])] },
          ],
        },
        select: bannerSelect,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      this.prisma.storePromotion.findMany({
        where: {
          isActive: true,
          AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
          store: { ...publicStoreWhere, ...(govSlug ? { governorate: { status: 'ACTIVE' as const, slug: govSlug } } : {}) },
        },
        select: { id: true, store: { select: storeCardSelect } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 18,
      }),
    ]);
    return { layout, banners, showcase };
  }

  async saveLayout(actorId: string, raw: unknown, ip: string) {
    const layout = sanitizeLayout(raw);
    await this.prisma.appSetting.upsert({
      where: { key: LAYOUT_KEY },
      create: { key: LAYOUT_KEY, value: JSON.stringify(layout) },
      update: { value: JSON.stringify(layout) },
    });
    await this.audit.log({ actorId, action: 'home.layout.updated', entityType: 'setting', entityId: LAYOUT_KEY, ip });
    return layout;
  }

  async adminLayout() {
    return { layout: await this.layout() };
  }

  listBanners() {
    return this.prisma.homeBanner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { governorate: { select: { name: true, slug: true } } },
    });
  }

  private async clean(dto: BannerDto) {
    const imageUrl = dto.imageUrl?.trim() || null;
    // Only pictures uploaded to our own storage (the site's CSP blocks anything else anyway)
    if (imageUrl && !imageUrl.startsWith(`${env.minio.publicUrl}/`)) throw new BadRequestException('ارفع صورة البنر من هذه الصفحة');
    const governorateId = dto.governorateId || null;
    if (governorateId && !(await this.prisma.governorate.findUnique({ where: { id: governorateId }, select: { id: true } }))) {
      throw new BadRequestException('المحافظة غير موجودة');
    }
    const startsAt = dto.startsAt ?? null;
    const endsAt = dto.endsAt ?? null;
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException('موعد النهاية يجب أن يكون بعد البداية');
    return {
      title: dto.title.trim(),
      eyebrow: dto.eyebrow.trim(),
      cta: dto.cta.trim(),
      href: dto.href.trim(),
      imageUrl,
      tone: dto.tone,
      governorateId,
      startsAt,
      endsAt,
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }

  async createBanner(actorId: string, dto: BannerDto, ip: string) {
    const last = await this.prisma.homeBanner.aggregate({ _max: { sortOrder: true } });
    const banner = await this.prisma.homeBanner.create({
      data: { ...(await this.clean(dto)), sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
    await this.audit.log({ actorId, action: 'home.banner.created', entityType: 'banner', entityId: banner.id, meta: { title: banner.title }, ip });
    return banner;
  }

  async updateBanner(actorId: string, id: string, dto: BannerDto, ip: string) {
    await this.findBanner(id);
    const banner = await this.prisma.homeBanner.update({ where: { id }, data: await this.clean(dto) });
    await this.audit.log({ actorId, action: 'home.banner.updated', entityType: 'banner', entityId: id, meta: { title: banner.title, isActive: banner.isActive }, ip });
    return banner;
  }

  async moveBanner(id: string, direction: number) {
    const list = await this.prisma.homeBanner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], select: { id: true } });
    const from = list.findIndex((b) => b.id === id);
    if (from < 0) throw new NotFoundException('البنر غير موجود');
    const to = from + direction;
    if (to < 0 || to >= list.length) return { ok: true };
    [list[from], list[to]] = [list[to], list[from]];
    await this.prisma.$transaction(list.map((b, i) => this.prisma.homeBanner.update({ where: { id: b.id }, data: { sortOrder: i + 1 } })));
    return { ok: true };
  }

  async deleteBanner(actorId: string, id: string, ip: string) {
    const banner = await this.findBanner(id);
    await this.prisma.homeBanner.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'home.banner.deleted', entityType: 'banner', entityId: id, meta: { title: banner.title }, ip });
    return { ok: true };
  }

  listPromotions() {
    return this.prisma.storePromotion.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { store: { select: { id: true, name: true, slug: true, logoUrl: true, status: true, governorate: { select: { name: true, status: true } } } } },
    });
  }

  private async cleanPromotion(dto: PromotionDto) {
    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId }, select: { id: true, name: true } });
    if (!store) throw new BadRequestException('المتجر غير موجود');
    const startsAt = dto.startsAt ?? null;
    const endsAt = dto.endsAt ?? null;
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException('موعد النهاية يجب أن يكون بعد البداية');
    return { store, data: { storeId: store.id, plan: dto.plan.trim(), startsAt, endsAt, ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) } };
  }

  async createPromotion(actorId: string, dto: PromotionDto, ip: string) {
    const { store, data } = await this.cleanPromotion(dto);
    const last = await this.prisma.storePromotion.aggregate({ _max: { sortOrder: true } });
    const promo = await this.prisma.storePromotion.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await this.audit.log({ actorId, action: 'home.promotion.created', entityType: 'store', entityId: store.id, meta: { plan: promo.plan, endsAt: promo.endsAt }, ip });
    return promo;
  }

  async updatePromotion(actorId: string, id: string, dto: PromotionDto, ip: string) {
    if (!(await this.prisma.storePromotion.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('الاشتراك غير موجود');
    const { store, data } = await this.cleanPromotion(dto);
    const promo = await this.prisma.storePromotion.update({ where: { id }, data });
    await this.audit.log({ actorId, action: 'home.promotion.updated', entityType: 'store', entityId: store.id, meta: { plan: promo.plan, isActive: promo.isActive, endsAt: promo.endsAt }, ip });
    return promo;
  }

  async movePromotion(id: string, direction: number) {
    const list = await this.prisma.storePromotion.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
    const from = list.findIndex((b) => b.id === id);
    if (from < 0) throw new NotFoundException('الاشتراك غير موجود');
    const to = from + direction;
    if (to < 0 || to >= list.length) return { ok: true };
    [list[from], list[to]] = [list[to], list[from]];
    await this.prisma.$transaction(list.map((b, i) => this.prisma.storePromotion.update({ where: { id: b.id }, data: { sortOrder: i + 1 } })));
    return { ok: true };
  }

  async deletePromotion(actorId: string, id: string, ip: string) {
    const promo = await this.prisma.storePromotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('الاشتراك غير موجود');
    await this.prisma.storePromotion.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'home.promotion.deleted', entityType: 'store', entityId: promo.storeId, meta: { plan: promo.plan }, ip });
    return { ok: true };
  }

  async clickPromotion(id: string) {
    await this.prisma.storePromotion.updateMany({ where: { id, isActive: true }, data: { clicks: { increment: 1 } } });
  }

  async click(id: string) {
    await this.prisma.homeBanner.updateMany({ where: { id, isActive: true }, data: { clicks: { increment: 1 } } });
  }

  private async findBanner(id: string) {
    const banner = await this.prisma.homeBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('البنر غير موجود');
    return banner;
  }
}

/** Homepage content is editorial work: admins and moderators both manage it; every change is audited. */
@Controller('admin/home')
@Auth('ADMIN', 'MODERATOR')
export class AdminHomeController {
  constructor(private home: HomeContentService) {}

  @Get('layout')
  layout() {
    return this.home.adminLayout();
  }

  @Put('layout')
  saveLayout(@CurrentUser() user: AuthUser, @Body() body: LayoutDto, @Req() req: Request) {
    return this.home.saveLayout(user.id, body, clientIp(req));
  }

  @Get('banners')
  banners() {
    return this.home.listBanners();
  }

  @Post('banners')
  create(@CurrentUser() user: AuthUser, @Body() dto: BannerDto, @Req() req: Request) {
    return this.home.createBanner(user.id, dto, clientIp(req));
  }

  @Patch('banners/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BannerDto, @Req() req: Request) {
    return this.home.updateBanner(user.id, id, dto, clientIp(req));
  }

  @Post('banners/:id/move')
  move(@Param('id') id: string, @Body() dto: MoveDto) {
    return this.home.moveBanner(id, dto.direction);
  }

  @Get('promotions')
  promotions() {
    return this.home.listPromotions();
  }

  @Post('promotions')
  createPromotion(@CurrentUser() user: AuthUser, @Body() dto: PromotionDto, @Req() req: Request) {
    return this.home.createPromotion(user.id, dto, clientIp(req));
  }

  @Patch('promotions/:id')
  updatePromotion(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PromotionDto, @Req() req: Request) {
    return this.home.updatePromotion(user.id, id, dto, clientIp(req));
  }

  @Post('promotions/:id/move')
  movePromotion(@Param('id') id: string, @Body() dto: MoveDto) {
    return this.home.movePromotion(id, dto.direction);
  }

  @Delete('promotions/:id')
  removePromotion(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.home.deletePromotion(user.id, id, clientIp(req));
  }

  @Delete('banners/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.home.deleteBanner(user.id, id, clientIp(req));
  }
}

@Controller('home')
export class BannerClicksController {
  constructor(private home: HomeContentService) {}

  /** Counts taps so the team can see which banners work. */
  @Post('banners/:id/click')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async click(@Param('id') id: string) {
    if (/^[a-z0-9]{10,40}$/.test(id)) await this.home.click(id);
  }

  /** Taps on a paid showcase card, reported to the store as part of its package. */
  @Post('showcase/:id/click')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async showcaseClick(@Param('id') id: string) {
    if (/^[a-z0-9]{10,40}$/.test(id)) await this.home.clickPromotion(id);
  }
}

@Module({
  controllers: [AdminHomeController, BannerClicksController],
  providers: [HomeContentService],
  exports: [HomeContentService],
})
export class HomeContentModule {}
