import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HomeContentService } from '../home/home-content';
import { productCardSelect, publicProductWhere, publicStoreWhere, storeCardSelect } from '../common/selects';

const publicStores = { where: publicStoreWhere };

@Injectable()
export class DirectoryService {
  constructor(
    private prisma: PrismaService,
    private homeContent: HomeContentService,
  ) {}

  /** All governorates with their status, so the site can show which ones are "coming soon". */
  async governorates() {
    const rows = await this.prisma.governorate.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        latitude: true,
        longitude: true,
        _count: { select: { stores: publicStores } },
        markets: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, slug: true, name: true, latitude: true, longitude: true, _count: { select: { stores: publicStores } } },
        },
      },
    });
    return rows.map(({ _count, markets, ...g }) => ({
      ...g,
      storesCount: _count.stores,
      markets: markets.map(({ _count: c, ...m }) => ({ ...m, storesCount: c.stores })),
    }));
  }

  async categories() {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        icon: true,
        _count: { select: { products: { where: publicProductWhere } } },
      },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, productsCount: _count.products }));
  }

  async market(slug: string) {
    const market = await this.prisma.market.findFirst({
      where: { slug, isActive: true, governorate: { status: 'ACTIVE' } },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        latitude: true,
        longitude: true,
        radiusMeters: true,
        governorate: { select: { slug: true, name: true } },
        _count: { select: { stores: publicStores } },
      },
    });
    if (!market) throw new NotFoundException('السوق غير موجود');
    const { _count, ...rest } = market;
    return { ...rest, storesCount: _count.stores };
  }

  async home(govSlug?: string) {
    const storeScope: Prisma.StoreWhereInput = govSlug
      ? { ...publicStoreWhere, governorate: { status: 'ACTIVE', slug: govSlug } }
      : publicStoreWhere;
    const productScope: Prisma.ProductWhereInput = { ...publicProductWhere, store: storeScope };

    const [categories, governorates, featured, latest, stores, totals, content] = await Promise.all([
      this.categories(),
      this.governorates(),
      this.prisma.product.findMany({
        where: { ...productScope, isFeatured: true },
        select: productCardSelect,
        orderBy: [{ contactsCount: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      this.prisma.product.findMany({
        where: productScope,
        select: productCardSelect,
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.store.findMany({
        where: storeScope,
        select: storeCardSelect,
        orderBy: [{ verificationLevel: 'desc' }, { contactsCount: 'desc' }],
        take: 8,
      }),
      Promise.all([
        this.prisma.store.count({ where: publicStoreWhere }),
        this.prisma.product.count({ where: publicProductWhere }),
        this.prisma.market.count({ where: { isActive: true, governorate: { status: 'ACTIVE' } } }),
      ]),
      this.homeContent.publicContent(govSlug),
    ]);

    return {
      categories,
      governorates,
      featured,
      latest,
      stores,
      totals: { stores: totals[0], products: totals[1], markets: totals[2] },
      ...content,
    };
  }

  async sitemap() {
    const [stores, products, markets, categories] = await Promise.all([
      this.prisma.store.findMany({ where: publicStoreWhere, select: { slug: true, updatedAt: true }, take: 20_000 }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE', store: publicStoreWhere },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 40_000,
      }),
      this.prisma.market.findMany({ where: { isActive: true, governorate: { status: 'ACTIVE' } }, select: { slug: true } }),
      this.prisma.category.findMany({ where: { isActive: true }, select: { slug: true } }),
    ]);
    return { stores, products, markets, categories };
  }
}
