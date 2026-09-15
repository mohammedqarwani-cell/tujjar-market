import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildSearchText, normalizeArabic } from '../common/text/arabic';
import { pageResult, paging } from '../common/pagination';
import { productCardSelect, publicProductWhere } from '../common/selects';
import { PRODUCT_LIMITS } from '../verification/verification.levels';
import { ProductInputDto } from './product.dto';

const SORTS: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  popular: [{ contactsCount: 'desc' }, { viewsCount: 'desc' }],
  price_asc: [{ price: { sort: 'asc', nulls: 'last' } }],
  price_desc: [{ price: { sort: 'desc', nulls: 'last' } }],
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize);
    const store: Prisma.StoreWhereInput = { status: 'ACTIVE' };
    if (query.gov) store.governorate = { slug: query.gov };
    if (query.market) store.market = { slug: query.market };
    if (query.store) store.slug = query.store;

    const where: Prisma.ProductWhereInput = { ...publicProductWhere, store };
    if (query.category) where.category = { slug: query.category };
    if (query.condition === 'NEW' || query.condition === 'USED') where.condition = query.condition;
    if (query.currency === 'SYP' || query.currency === 'USD') {
      where.currency = query.currency;
      const min = Number(query.minPrice);
      const max = Number(query.maxPrice);
      if (min > 0 || max > 0) {
        where.price = { ...(min > 0 ? { gte: min } : {}), ...(max > 0 ? { lte: max } : {}) };
      }
    }
    if (query.offers === '1') where.oldPrice = { not: null };
    const terms = normalizeArabic(query.q).split(' ').filter((t) => t.length > 1).slice(0, 5);
    if (terms.length) where.AND = terms.map((t) => ({ searchText: { contains: t } }));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: productCardSelect,
        orderBy: SORTS[query.sort] ?? SORTS.newest,
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async detail(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, ...publicProductWhere },
      select: {
        ...productCardSelect,
        description: true,
        viewsCount: true,
        category: { select: { id: true, slug: true, name: true, icon: true } },
        store: {
          select: {
            id: true,
            slug: true,
            name: true,
            tagline: true,
            logoUrl: true,
            verificationLevel: true,
            hasDelivery: true,
            whatsapp: true,
            phone: true,
            address: true,
            openingHours: true,
            governorate: { select: { slug: true, name: true } },
            market: { select: { slug: true, name: true } },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود أو لم يعد متاحاً');

    const [similar, fromStore] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...publicProductWhere, categoryId: product.category.id, id: { not: id } },
        select: productCardSelect,
        orderBy: [{ contactsCount: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.product.findMany({
        where: { ...publicProductWhere, storeId: product.store.id, id: { not: id } },
        select: productCardSelect,
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);
    return { ...product, similar, fromStore };
  }

  // ---------- merchant ----------

  private async storeOf(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        verificationLevel: true,
        governorate: { select: { name: true } },
        market: { select: { name: true } },
        _count: { select: { products: true } },
      },
    });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    return store;
  }

  async mine(userId: string, query: Record<string, string>) {
    const store = await this.storeOf(userId);
    const { page, pageSize, skip, take } = paging(query.page, query.pageSize, 100);
    const where: Prisma.ProductWhereInput = { storeId: store.id };
    if (['ACTIVE', 'HIDDEN', 'UNDER_REVIEW'].includes(query.status)) {
      where.status = query.status as ProductStatus;
    }
    const terms = normalizeArabic(query.q).split(' ').filter((t) => t.length > 1).slice(0, 5);
    if (terms.length) where.AND = terms.map((t) => ({ searchText: { contains: t } }));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: {
          ...productCardSelect,
          status: true,
          viewsCount: true,
          contactsCount: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);
    return pageResult(items, total, page, pageSize);
  }

  async ownedOne(userId: string, id: string) {
    const store = await this.storeOf(userId);
    const product = await this.prisma.product.findFirst({ where: { id, storeId: store.id } });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    const { searchText, riskScore, ...rest } = product;
    return rest;
  }

  async create(userId: string, dto: ProductInputDto) {
    const store = await this.storeOf(userId);
    this.assertBelowLimit(store);
    const data = await this.prepare(dto, store);
    const { riskScore, status } = this.assessRisk(dto);
    return this.prisma.product.create({
      data: { ...data, storeId: store.id, riskScore, status },
      select: { id: true, status: true },
    });
  }

  /** Higher verification levels unlock more listings (risk-based limits). */
  private assertBelowLimit(store: Awaited<ReturnType<ProductsService['storeOf']>>) {
    const limit = PRODUCT_LIMITS[store.verificationLevel];
    if (limit === null || store._count.products < limit) return;
    const message =
      store.verificationLevel === 'REGISTERED'
        ? `الحد الأقصى لمتجر غير موثّق ${limit} منتجات. وثّق هويتك من صفحة التوثيق لتضيف حتى ${PRODUCT_LIMITS.IDENTITY} منتجاً`
        : `الحد الأقصى لمتجر موثّق الهوية ${limit} منتجاً. وثّق محلك من صفحة التوثيق لتضيف منتجات بلا حدود`;
    throw new ForbiddenException({ statusCode: 403, message, code: 'PRODUCT_LIMIT' });
  }

  async update(userId: string, id: string, dto: ProductInputDto) {
    const store = await this.storeOf(userId);
    const existing = await this.prisma.product.findFirst({
      where: { id, storeId: store.id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('المنتج غير موجود');

    const data = await this.prepare(dto, store);
    const risk = this.assessRisk(dto);
    // Keep the merchant's hidden choice, but flag risky edits for review
    const status: ProductStatus =
      risk.status !== 'ACTIVE' ? risk.status : existing.status === 'UNDER_REVIEW' ? 'ACTIVE' : existing.status;
    return this.prisma.product.update({
      where: { id },
      data: { ...data, riskScore: risk.riskScore, status },
      select: { id: true, status: true },
    });
  }

  async setStatus(userId: string, id: string, status: 'ACTIVE' | 'HIDDEN') {
    const store = await this.storeOf(userId);
    const product = await this.prisma.product.findFirst({ where: { id, storeId: store.id } });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    if (product.status === 'UNDER_REVIEW') {
      throw new BadRequestException('المنتج قيد المراجعة من الإدارة');
    }
    return this.prisma.product.update({ where: { id }, data: { status }, select: { id: true, status: true } });
  }

  async remove(userId: string, id: string) {
    const store = await this.storeOf(userId);
    const { count } = await this.prisma.product.deleteMany({ where: { id, storeId: store.id } });
    if (!count) throw new NotFoundException('المنتج غير موجود');
    return { ok: true };
  }

  private async prepare(
    dto: ProductInputDto,
    store: { name: string; governorate: { name: string }; market: { name: string } | null },
  ) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('اختر تصنيف المنتج');

    const onRequest = dto.priceType === 'ON_REQUEST';
    if (!onRequest && !dto.price) throw new BadRequestException('أدخل السعر أو اختر "السعر عند الطلب"');
    const price = onRequest ? null : dto.price!;
    const oldPrice = !onRequest && dto.oldPrice && price && dto.oldPrice > price ? dto.oldPrice : null;

    return {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      categoryId: category.id,
      priceType: dto.priceType,
      price,
      oldPrice,
      currency: dto.currency,
      condition: dto.condition,
      inStock: dto.inStock,
      images: dto.images,
      searchText: buildSearchText(
        dto.title, dto.description, category.name, store.name, store.market?.name, store.governorate.name,
      ),
    };
  }

  private assessRisk(p: ProductInputDto): { riskScore: number; status: ProductStatus } {
    const text = normalizeArabic(`${p.title} ${p.description ?? ''}`);
    const banned = [/سلاح/, /مسدس/, /ذخير/, /مخدر/, /حشيش/, /كبتاغون/, /weapon/, /drug/];
    if (banned.some((re) => re.test(text))) return { riskScore: 100, status: 'UNDER_REVIEW' };

    let score = 0;
    if (!p.images.length) score += 10;
    if (/(تقليد|كوبي|نسخه طبق الاصل|replica|fake)/.test(text)) score += 40;
    if (/(دواء|ادويه|صيدل|هرمون)/.test(text)) score += 40;
    if (p.price && p.price > 1_500_000_000) score += 15;
    return { riskScore: score, status: score >= 50 ? 'UNDER_REVIEW' : 'ACTIVE' };
  }
}
