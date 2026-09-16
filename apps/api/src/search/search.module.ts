import { Controller, Get, Global, Injectable, Module, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Throttle } from '../common/throttle';
import { normalizeArabic } from '../common/text/arabic';
import { publicProductWhere, publicStoreWhere } from '../common/selects';
import { EmbeddingsService } from './embeddings.service';
import { SearchIndexService } from './search-index.service';

@Injectable()
export class SuggestService {
  constructor(
    private prisma: PrismaService,
    private index: SearchIndexService,
  ) {}

  /** As-you-type suggestions: best matching products and stores, matching categories, and a spelling fix. */
  async suggest(raw: string) {
    const q = (raw ?? '').trim().slice(0, 80);
    const empty = { products: [], stores: [], categories: [], correctedQuery: null, alsoSearched: [] };
    if (normalizeArabic(q).length < 2) return empty;

    const [products, stores] = await Promise.all([this.index.rankProducts(q), Promise.resolve(this.index.rankStores(q))]);
    const productIds = products?.ids.slice(0, 6) ?? [];
    const storeIds = stores?.ids.slice(0, 3) ?? [];
    const nq = normalizeArabic(q);

    const [productRows, storeRows, categories] = await Promise.all([
      productIds.length
        ? this.prisma.product.findMany({
            where: { id: { in: productIds }, ...publicProductWhere },
            select: { id: true, title: true, images: true, category: { select: { icon: true } } },
          })
        : [],
      storeIds.length
        ? this.prisma.store.findMany({ where: { id: { in: storeIds }, ...publicStoreWhere }, select: { id: true, slug: true, name: true, logoUrl: true } })
        : [],
      this.prisma.category.findMany({ where: { isActive: true }, select: { slug: true, name: true, icon: true } }),
    ]);

    const order = <T extends { id: string }>(rows: T[], ids: string[]) => ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is T => !!r);
    const terms = nq.split(' ').filter((t) => t.length >= 2);
    return {
      products: order(productRows, productIds).map((p) => ({ id: p.id, title: p.title, image: p.images[0] ?? null, icon: p.category.icon })),
      stores: order(storeRows, storeIds).map(({ id: _id, ...s }) => s),
      categories: categories.filter((c) => terms.some((t) => normalizeArabic(c.name).includes(t))).slice(0, 2),
      correctedQuery: products?.meta.correctedQuery ?? null,
      alsoSearched: products?.meta.alsoSearched ?? [],
    };
  }
}

@Controller('search')
export class SearchController {
  constructor(private suggestions: SuggestService) {}

  @Get('suggest')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  suggest(@Query('q') q: string) {
    return this.suggestions.suggest(q);
  }
}

/** Global so product and store listings share one index. */
@Global()
@Module({
  controllers: [SearchController],
  providers: [EmbeddingsService, SearchIndexService, SuggestService],
  exports: [SearchIndexService],
})
export class SearchModule {}
