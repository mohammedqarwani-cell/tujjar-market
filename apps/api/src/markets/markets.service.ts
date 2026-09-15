import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GovernorateStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { distanceMeters, insideSyria } from '../common/geo';
import { pageResult, paging } from '../common/pagination';
import { buildSearchText } from '../common/text/arabic';
import { normalizeSyrianMobile } from '../common/text/phone';
import { slugify, withSuffix } from '../common/text/slug';
import {
  CreateCategoryDto,
  CreateMarketDto,
  GeofenceDto,
  InterestDto,
  UpdateCategoryDto,
  UpdateMarketDto,
} from './markets.dto';

/** A suggested geofence needs at least this many verified shops in the market */
const MIN_SUGGESTION_SAMPLES = 3;

const marketAdminSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
  geofenceStatus: true,
  governorate: { select: { id: true, slug: true, name: true, status: true } },
  _count: { select: { stores: true } },
} satisfies Prisma.MarketSelect;

const categoryAdminSelect = {
  id: true,
  slug: true,
  name: true,
  icon: true,
  sortOrder: true,
  isActive: true,
  _count: { select: { products: true, stores: true } },
} satisfies Prisma.CategorySelect;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

@Injectable()
export class MarketsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ---------- governorates ----------

  async governorates() {
    const rows = await this.prisma.governorate.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        _count: { select: { stores: true, markets: true, interests: { where: { contactedAt: null } } } },
      },
    });
    return rows.map(({ _count, ...g }) => ({
      ...g,
      storesCount: _count.stores,
      marketsCount: _count.markets,
      newInterests: _count.interests,
    }));
  }

  async setGovernorateStatus(actorId: string, id: string, status: GovernorateStatus, ip: string) {
    const governorate = await this.prisma.governorate.findUnique({ where: { id }, select: { id: true } });
    if (!governorate) throw new NotFoundException('المحافظة غير موجودة');
    const updated = await this.prisma.governorate.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, status: true },
    });
    await this.audit.log({ actorId, action: 'governorate.status_changed', entityType: 'governorate', entityId: id, meta: { status }, ip });
    return updated;
  }

  // ---------- markets ----------

  async markets(query: Record<string, string>) {
    const rows = await this.prisma.market.findMany({
      where: query.gov ? { governorate: { slug: query.gov } } : {},
      orderBy: [{ governorate: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: marketAdminSelect,
    });
    return rows.map(({ _count, ...m }) => ({ ...m, storesCount: _count.stores }));
  }

  private async marketOrThrow(id: string) {
    const market = await this.prisma.market.findUnique({
      where: { id },
      select: { id: true, name: true, governorateId: true, _count: { select: { stores: true } } },
    });
    if (!market) throw new NotFoundException('السوق غير موجود');
    return market;
  }

  async createMarket(actorId: string, dto: CreateMarketDto, ip: string) {
    const governorate = await this.prisma.governorate.findUnique({ where: { id: dto.governorateId }, select: { id: true } });
    if (!governorate) throw new BadRequestException('اختر المحافظة');
    const name = dto.name.trim();
    await this.assertMarketNameFree(governorate.id, name);

    const market = await this.prisma.market.create({
      data: {
        governorateId: governorate.id,
        name,
        slug: await this.uniqueSlug('market', dto.slug, name),
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
      select: marketAdminSelect,
    });
    await this.audit.log({ actorId, action: 'market.created', entityType: 'market', entityId: market.id, meta: { name }, ip });
    return market;
  }

  async updateMarket(actorId: string, id: string, dto: UpdateMarketDto, ip: string) {
    const market = await this.marketOrThrow(id);
    const data: Prisma.MarketUpdateInput = {};
    const name = dto.name?.trim();
    if (name !== undefined && name !== market.name) {
      await this.assertMarketNameFree(market.governorateId, name, id);
      data.name = name;
    }
    if (dto.slug !== undefined) data.slug = await this.uniqueSlug('market', dto.slug, '', id);
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.market.update({ where: { id }, data, select: marketAdminSelect });
    if (data.name) await this.reindex({ marketId: id });
    await this.audit.log({ actorId, action: 'market.updated', entityType: 'market', entityId: id, meta: { ...dto }, ip });
    return updated;
  }

  async deleteMarket(actorId: string, id: string, ip: string) {
    const market = await this.marketOrThrow(id);
    if (market._count.stores) throw new ConflictException('في هذا السوق متاجر، عطّله بدلاً من حذفه');
    await this.prisma.market.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'market.deleted', entityType: 'market', entityId: id, meta: { name: market.name }, ip });
  }

  private async assertMarketNameFree(governorateId: string, name: string, excludeId?: string) {
    const clash = await this.prisma.market.findFirst({
      where: { governorateId, name, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException('يوجد سوق بهذا الاسم في المحافظة');
  }

  async setGeofence(actorId: string, id: string, dto: GeofenceDto, ip: string) {
    await this.marketOrThrow(id);
    if (!insideSyria(dto.latitude, dto.longitude)) throw new BadRequestException('الإحداثيات خارج سوريا');
    const updated = await this.prisma.market.update({
      where: { id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusMeters: dto.radiusMeters,
        geofenceStatus: dto.status,
      },
      select: marketAdminSelect,
    });
    await this.audit.log({ actorId, action: 'market.geofence_set', entityType: 'market', entityId: id, meta: { ...dto }, ip });
    return updated;
  }

  async removeGeofence(actorId: string, id: string, ip: string) {
    await this.marketOrThrow(id);
    const updated = await this.prisma.market.update({
      where: { id },
      data: { latitude: null, longitude: null, radiusMeters: null, geofenceStatus: 'DRAFT' },
      select: marketAdminSelect,
    });
    await this.audit.log({ actorId, action: 'market.geofence_removed', entityType: 'market', entityId: id, ip });
    return updated;
  }

  /**
   * Suggests a boundary from the GPS of shops already verified in this market: the median point as
   * centre and a radius covering 90% of them with a margin. Real data instead of guesswork, at no cost.
   */
  async suggestGeofence(id: string) {
    await this.marketOrThrow(id);
    const stores = await this.prisma.store.findMany({
      where: { marketId: id, earnedLevel: { in: ['LOCATION', 'PREMIUM'] } },
      select: {
        verificationRequests: {
          where: { kind: 'LOCATION', status: 'APPROVED', latitude: { not: null }, longitude: { not: null } },
          orderBy: { reviewedAt: 'desc' },
          take: 1,
          select: { latitude: true, longitude: true },
        },
      },
    });
    const points = stores.flatMap((s) => s.verificationRequests).map((r) => ({ lat: r.latitude!, lng: r.longitude! }));
    if (points.length < MIN_SUGGESTION_SAMPLES) {
      return { samples: points.length, required: MIN_SUGGESTION_SAMPLES, suggestion: null };
    }

    const lat = median(points.map((p) => p.lat));
    const lng = median(points.map((p) => p.lng));
    const distances = points.map((p) => distanceMeters(lat, lng, p.lat, p.lng)).sort((a, b) => a - b);
    const p90 = distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.9))];
    const radiusMeters = Math.min(3000, Math.max(100, Math.ceil((p90 * 1.2 + 50) / 10) * 10));
    return {
      samples: points.length,
      required: MIN_SUGGESTION_SAMPLES,
      suggestion: { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)), radiusMeters },
    };
  }

  // ---------- categories ----------

  async categories() {
    const rows = await this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, select: categoryAdminSelect });
    return rows.map(({ _count, ...c }) => ({ ...c, productsCount: _count.products, storesCount: _count.stores }));
  }

  private async categoryOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id }, select: categoryAdminSelect });
    if (!category) throw new NotFoundException('القسم غير موجود');
    return category;
  }

  private async assertCategoryNameFree(name: string, excludeId?: string) {
    const clash = await this.prisma.category.findFirst({
      where: { name, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException('يوجد قسم بهذا الاسم');
  }

  async createCategory(actorId: string, dto: CreateCategoryDto, ip: string) {
    const name = dto.name.trim();
    await this.assertCategoryNameFree(name);
    const category = await this.prisma.category.create({
      data: {
        name,
        icon: dto.icon.trim(),
        slug: await this.uniqueSlug('category', dto.slug, name),
        sortOrder: dto.sortOrder ?? 0,
      },
      select: categoryAdminSelect,
    });
    await this.audit.log({ actorId, action: 'category.created', entityType: 'category', entityId: category.id, meta: { name }, ip });
    return category;
  }

  async updateCategory(actorId: string, id: string, dto: UpdateCategoryDto, ip: string) {
    const category = await this.categoryOrThrow(id);
    const data: Prisma.CategoryUpdateInput = {};
    const name = dto.name?.trim();
    if (name !== undefined && name !== category.name) {
      await this.assertCategoryNameFree(name, id);
      data.name = name;
    }
    if (dto.icon !== undefined) data.icon = dto.icon.trim();
    if (dto.slug !== undefined) data.slug = await this.uniqueSlug('category', dto.slug, '', id);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.category.update({ where: { id }, data, select: categoryAdminSelect });
    if (data.name) await this.reindex({ categoryId: id });
    await this.audit.log({ actorId, action: 'category.updated', entityType: 'category', entityId: id, meta: { ...dto }, ip });
    return updated;
  }

  async deleteCategory(actorId: string, id: string, ip: string) {
    const category = await this.categoryOrThrow(id);
    if (category._count.products || category._count.stores) {
      throw new ConflictException('في هذا القسم منتجات أو متاجر، عطّله بدلاً من حذفه');
    }
    await this.prisma.category.delete({ where: { id } });
    await this.audit.log({ actorId, action: 'category.deleted', entityType: 'category', entityId: id, meta: { name: category.name }, ip });
  }

  // ---------- merchant interest ----------

  /** Public: a merchant from a governorate that hasn't opened asks to be contacted at launch. */
  async createInterest(dto: InterestDto, ip: string) {
    const phone = normalizeSyrianMobile(dto.phone);
    if (!phone) throw new BadRequestException('رقم الموبايل غير صحيح، مثال: 0912345678');
    const governorate = await this.prisma.governorate.findUnique({
      where: { id: dto.governorateId },
      select: { id: true, name: true, status: true },
    });
    if (!governorate) throw new BadRequestException('اختر المحافظة');
    if (governorate.status === 'ACTIVE') {
      throw new BadRequestException(`التسجيل مفتوح في ${governorate.name}، افتح متجرك الآن`);
    }
    const category = dto.categoryId
      ? await this.prisma.category.findUnique({ where: { id: dto.categoryId }, select: { id: true } })
      : null;

    const details = { name: dto.name.trim(), storeName: dto.storeName?.trim() || null, categoryId: category?.id ?? null };
    // Repeating the request only refreshes the details, and never reveals whether the number was listed
    await this.prisma.merchantInterest.upsert({
      where: { governorateId_phone: { governorateId: governorate.id, phone } },
      create: { governorateId: governorate.id, phone, ...details },
      update: details,
    });
    await this.audit.log({ action: 'interest.created', entityType: 'governorate', entityId: governorate.id, ip });
  }

  async interests(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 100);
    const where: Prisma.MerchantInterestWhereInput = {};
    if (query.gov) where.governorate = { slug: query.gov };
    if (query.status === 'new') where.contactedAt = null;
    if (query.status === 'contacted') where.contactedAt = { not: null };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.merchantInterest.findMany({
        where,
        include: {
          governorate: { select: { slug: true, name: true } },
          category: { select: { name: true, icon: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.merchantInterest.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async setInterestContacted(actorId: string, id: string, contacted: boolean, ip: string) {
    const interest = await this.prisma.merchantInterest.findUnique({ where: { id }, select: { id: true } });
    if (!interest) throw new NotFoundException('الطلب غير موجود');
    const updated = await this.prisma.merchantInterest.update({
      where: { id },
      data: { contactedAt: contacted ? new Date() : null },
      select: { id: true, contactedAt: true },
    });
    await this.audit.log({ actorId, action: 'interest.contacted', entityType: 'interest', entityId: id, meta: { contacted }, ip });
    return updated;
  }

  // ---------- helpers ----------

  /** An explicit slug must be free; a generated one gets a random suffix when taken. */
  private async uniqueSlug(kind: 'market' | 'category', requested: string | undefined, name: string, excludeId?: string) {
    const taken = async (slug: string) => {
      const row =
        kind === 'market'
          ? await this.prisma.market.findUnique({ where: { slug }, select: { id: true } })
          : await this.prisma.category.findUnique({ where: { slug }, select: { id: true } });
      return !!row && row.id !== excludeId;
    };
    if (requested) {
      if (await taken(requested)) throw new ConflictException('الرابط المختصر مستخدم، اختر غيره');
      return requested;
    }
    const base = slugify(name);
    return (await taken(base)) ? withSuffix(base) : base;
  }

  /** Market and category names are part of the search text of their stores and products. */
  private async reindex(scope: { marketId: string } | { categoryId: string }) {
    const byMarket = 'marketId' in scope;
    const stores = await this.prisma.store.findMany({
      where: byMarket ? { marketId: scope.marketId } : { categoryId: scope.categoryId },
      select: {
        id: true,
        name: true,
        tagline: true,
        description: true,
        market: { select: { name: true } },
        governorate: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    for (const s of stores) {
      await this.prisma.store.update({
        where: { id: s.id },
        data: { searchText: buildSearchText(s.name, s.tagline, s.description, s.market?.name, s.governorate.name, s.category?.name) },
      });
    }

    const products = await this.prisma.product.findMany({
      where: byMarket ? { store: { marketId: scope.marketId } } : { categoryId: scope.categoryId },
      select: {
        id: true,
        title: true,
        description: true,
        category: { select: { name: true } },
        store: { select: { name: true, market: { select: { name: true } }, governorate: { select: { name: true } } } },
      },
    });
    for (const p of products) {
      await this.prisma.product.update({
        where: { id: p.id },
        data: {
          searchText: buildSearchText(p.title, p.description, p.category.name, p.store.name, p.store.market?.name, p.store.governorate.name),
        },
      });
    }
  }
}
