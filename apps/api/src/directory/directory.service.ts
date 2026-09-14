import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { productCardSelect, publicProductWhere, storeCardSelect } from '../common/selects';

const activeStores = { where: { status: 'ACTIVE' as const } };

@Injectable()
export class DirectoryService {
  constructor(private prisma: PrismaService) {}

  async governorates() {
    const rows = await this.prisma.governorate.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: { select: { stores: activeStores } },
        markets: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, slug: true, name: true, _count: { select: { stores: activeStores } } },
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
    const market = await this.prisma.market.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        governorate: { select: { slug: true, name: true } },
        _count: { select: { stores: activeStores } },
      },
    });
    if (!market) throw new NotFoundException('السوق غير موجود');
    const { _count, ...rest } = market;
    return { ...rest, storesCount: _count.stores };
  }

  async home(govSlug?: string) {
    const storeScope = { status: 'ACTIVE' as const, ...(govSlug ? { governorate: { slug: govSlug } } : {}) };
    const productScope = { ...publicProductWhere, store: storeScope };

    const [categories, governorates, featured, latest, stores, totals] = await Promise.all([
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
        orderBy: [{ isVerified: 'desc' }, { contactsCount: 'desc' }],
        take: 8,
      }),
      Promise.all([
        this.prisma.store.count({ where: { status: 'ACTIVE' } }),
        this.prisma.product.count({ where: publicProductWhere }),
        this.prisma.market.count(),
      ]),
    ]);

    return {
      categories,
      governorates,
      featured,
      latest,
      stores,
      totals: { stores: totals[0], products: totals[1], markets: totals[2] },
    };
  }
}
