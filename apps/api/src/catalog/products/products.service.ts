import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import type { ProductStatus, Prisma } from '@prisma/client';

type FindAllArgs = {
  q?: string;
  category?: string;
  city?: string;
  market?: string;
  storeSlug?: string;
  page: number;
  pageSize: number;
  statusScope?: 'PUBLIC' | 'MINE' | 'ALL';
  userId?: string;
  userRole?: 'ADMIN' | 'MERCHANT' | 'USER';
};

type CreateInput = {
  storeId: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(args: FindAllArgs) {
    const {
      q,
      category,
      city,
      market,
      storeSlug,
      page,
      pageSize,
      statusScope = 'PUBLIC',
      userId,
    } = args;

    // ✅ استخدم الأنواع الرسمية بدل any
    const where: Prisma.ProductWhereInput = {};
    if (statusScope === 'PUBLIC') {
      where.status = { in: ['ACTIVE'] as ProductStatus[] };
    }

    const storeWhere: Prisma.StoreWhereInput = {};
    if (city) storeWhere.city = { name: { equals: city } };
    if (market) storeWhere.market = { name: { equals: market } };

    if (storeSlug) storeWhere.slug = storeSlug;
    if (statusScope === 'MINE' && userId) storeWhere.ownerId = userId;

    if (q) where.name = { contains: q }; // مسموح هنا
    if (category) where.category = { equals: category }; // ⬅️ أزلنا mode

    const skip = (page - 1) * pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: {
          ...where,
          ...(Object.keys(storeWhere).length ? { store: storeWhere } : {}),
        },
        include: { store: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.product.count({
        where: {
          ...where,
          ...(Object.keys(storeWhere).length ? { store: storeWhere } : {}),
        },
      }),
    ]);

    return { items, page, pageSize, total, pages: Math.ceil(total / pageSize) };
  }

  async createForOwner(userId: string, data: CreateInput) {
    const store = await this.prisma.store.findUnique({
      where: { id: data.storeId },
    });
    if (!store || store.ownerId !== userId)
      throw new ForbiddenException('Not owner of this store');

    const { riskScore, status } = this.assessRisk(data);
    return this.prisma.product.create({ data: { ...data, riskScore, status } });
  }

  async updateForOwner(
    userId: string,
    productId: string,
    patch: Partial<CreateInput>,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: { select: { ownerId: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.store.ownerId !== userId)
      throw new ForbiddenException('Not owner');

    const { storeId, ...rest } = patch; // لا نسمح بتغيير المتجر
    return this.prisma.product.update({
      where: { id: productId },
      data: rest,
    });
  }

  async deleteForOwner(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: { select: { ownerId: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.store.ownerId !== userId)
      throw new ForbiddenException('Not owner');

    await this.prisma.product.delete({ where: { id: productId } });
    return { ok: true };
  }

  private assessRisk(p: CreateInput): {
    riskScore: number;
    status: ProductStatus;
  } {
    let score = 0;
    const banned = [/سلاح/i, /مخدر/i, /ممنوع/i, /firearm/i, /drug/i, /weapon/i];
    const text = `${p.name} ${p.category}`.toLowerCase();
    if (banned.some((re) => re.test(text)))
      return { riskScore: 100, status: 'HIDDEN' as ProductStatus };

    if (!p.imageUrl) score += 25;
    if (p.price <= 0) score += 40;
    if (p.price > 10_000_000) score += 15;

    const suspicious = [/clone/i, /fake/i, /replica/i, /مزيف/i, /تقليد/i];
    if (suspicious.some((re) => re.test(text))) score += 35;

    const riskyCategories = [/medical/i, /صيدل/i, /chemical/i, /adult/i];
    if (riskyCategories.some((re) => re.test(text))) score += 30;

    if (score >= 50)
      return { riskScore: score, status: 'UNDER_REVIEW' as ProductStatus };
    return { riskScore: score, status: 'ACTIVE' as ProductStatus };
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { store: { select: { id: true, name: true, slug: true } } },
    });
  }

  async setVisibilityForOwner(
    userId: string,
    productId: string,
    status: 'ACTIVE' | 'HIDDEN',
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: { select: { ownerId: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.store.ownerId !== userId)
      throw new ForbiddenException('Not owner');

    return this.prisma.product.update({
      where: { id: productId },
      data: { status },
    });
  }

  async findFeatured({ page, pageSize }: { page: number; pageSize: number }) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      isFeatured: true,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { store: true },
        orderBy: [{ discountPrice: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }
}
