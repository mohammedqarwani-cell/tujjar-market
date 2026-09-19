import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeArabic } from '../common/text/arabic';
import { publicProductWhere, publicStoreWhere } from '../common/selects';
import {
  EmbeddingsService,
  cosine,
  fromBytes,
  toBytes,
} from './embeddings.service';
import { Concept, ParsedQuery, Vocabulary, parseQuery } from './query';

type ProductDoc = {
  id: string;
  title: string;
  /** Title and description: matches here count fully */
  own: string;
  /** Everything searchable, including section, store and place names */
  text: string;
  embedText: string;
  hasOffer: boolean;
  condition: 'NEW' | 'USED';
  inStock: boolean;
  trust: number;
  popularity: number;
  vector: Float32Array | null;
  signature: string | null;
};

type StoreDoc = {
  id: string;
  name: string;
  text: string;
  trust: number;
  popularity: number;
};

export type SearchMeta = {
  mode: 'smart';
  /** Shown as "هل تقصد …؟" when a word was spelling-corrected */
  correctedQuery: string | null;
  /** Other words searched alongside the shopper's own (synonyms and described needs) */
  alsoSearched: string[];
  semantic: boolean;
};

export type Ranked = {
  ids: string[];
  scores: Map<string, number>;
  meta: SearchMeta;
};

const TRUST: Record<string, number> = {
  REGISTERED: 0,
  IDENTITY: 1,
  LOCATION: 2,
  PREMIUM: 3,
};
const CHECK_EVERY_MS = 20_000;
const MAX_CANDIDATES = 500;
const EMBED_BATCH = 16;
/** e5 cosine scores sit in a narrow band; this maps the useful part of it to 0..1 */
const SEM_FLOOR = 0.8;
const SEM_SPAN = 0.12;
const SEM_MIN = 0.35;

const levelRank = (level: string) => TRUST[level] ?? 0;
const semantic01 = (cos: number) =>
  Math.max(0, Math.min(1, (cos - SEM_FLOOR) / SEM_SPAN));

/**
 * In-memory search over the public catalogue. Reloads when the catalogue changes (checked every 20 s),
 * ranks with dialect-aware text matching, spelling correction and, when enabled, meaning-based vectors.
 * Sized for a city-by-city rollout (tens of thousands of listings); a larger catalogue moves to pgvector.
 */
@Injectable()
export class SearchIndexService
  implements OnModuleInit, OnApplicationShutdown, Vocabulary
{
  private readonly log = new Logger(SearchIndexService.name);
  private products: ProductDoc[] = [];
  private stores: StoreDoc[] = [];
  private vocab = new Map<string, number>();
  private fingerprint = '';
  private loaded = false;
  private timer?: NodeJS.Timeout;
  private refreshing: Promise<void> | null = null;
  private embedding = false;

  constructor(
    private prisma: PrismaService,
    private embeddings: EmbeddingsService,
  ) {}

  onModuleInit() {
    const tick = () =>
      void this.refresh().catch((e) =>
        this.log.error('Search index refresh failed', (e as Error).stack),
      );
    setTimeout(tick, 2_000).unref();
    this.timer = setInterval(tick, CHECK_EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  get ready() {
    return this.loaded;
  }

  // ---------- Vocabulary ----------

  has(word: string) {
    if (this.vocab.has(word)) return true;
    for (const w of this.vocab.keys())
      if (w.length > word.length && w.includes(word)) return true;
    return false;
  }

  words() {
    return this.vocab.entries();
  }

  // ---------- loading ----------

  refresh(force = false): Promise<void> {
    this.refreshing ??= this.doRefresh(force).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(force: boolean) {
    const [p, s, g] = await Promise.all([
      this.prisma.product.aggregate({
        _count: true,
        _max: { updatedAt: true },
      }),
      this.prisma.store.aggregate({ _count: true, _max: { updatedAt: true } }),
      this.prisma.governorate.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      }),
    ]);
    const fingerprint = [
      p._count,
      p._max.updatedAt?.getTime(),
      s._count,
      s._max.updatedAt?.getTime(),
      g.map((x) => x.id).join(),
    ].join('|');
    if (!force && fingerprint === this.fingerprint) return;

    const [products, stores] = await Promise.all([
      this.prisma.product.findMany({
        where: publicProductWhere,
        select: {
          id: true,
          title: true,
          description: true,
          searchText: true,
          oldPrice: true,
          condition: true,
          inStock: true,
          contactsCount: true,
          embedding: true,
          embeddingSig: true,
          category: { select: { name: true } },
          store: { select: { verificationLevel: true } },
        },
      }),
      this.prisma.store.findMany({
        where: publicStoreWhere,
        select: {
          id: true,
          name: true,
          searchText: true,
          verificationLevel: true,
          contactsCount: true,
        },
      }),
    ]);

    const vocab = new Map<string, number>();
    const count = (text: string) => {
      for (const w of text.split(' '))
        if (w.length >= 3) vocab.set(w, (vocab.get(w) ?? 0) + 1);
    };
    this.products = products.map((x) => {
      count(x.searchText);
      const embedText = `${x.title}. ${x.category.name}. ${(x.description ?? '').slice(0, 300)}`;
      return {
        id: x.id,
        title: normalizeArabic(x.title),
        own: normalizeArabic(`${x.title} ${x.description ?? ''}`),
        text: x.searchText,
        embedText,
        hasOffer: !!x.oldPrice,
        condition: x.condition,
        inStock: x.inStock,
        trust: levelRank(x.store.verificationLevel),
        popularity: x.contactsCount,
        vector: x.embedding ? fromBytes(x.embedding) : null,
        signature: x.embeddingSig,
      };
    });
    this.stores = stores.map((x) => {
      count(x.searchText);
      return {
        id: x.id,
        name: normalizeArabic(x.name),
        text: x.searchText,
        trust: levelRank(x.verificationLevel),
        popularity: x.contactsCount,
      };
    });
    this.vocab = vocab;
    this.fingerprint = fingerprint;
    this.loaded = true;
    this.log.log(
      `Search index: ${this.products.length} products, ${this.stores.length} stores, ${vocab.size} words`,
    );
    void this.embedMissing();
  }

  /** Computes vectors for new or edited listings in the background, without touching updatedAt. */
  private async embedMissing() {
    if (!this.embeddings.enabled || this.embedding) return;
    this.embedding = true;
    try {
      const pending = this.products.filter(
        (p) => p.signature !== this.embeddings.signature(p.embedText),
      );
      for (let i = 0; i < pending.length; i += EMBED_BATCH) {
        const batch = pending.slice(i, i + EMBED_BATCH);
        const vectors = await this.embeddings.embedPassages(
          batch.map((p) => p.embedText),
        );
        if (!vectors) return;
        for (let j = 0; j < batch.length; j++) {
          const sig = this.embeddings.signature(batch[j].embedText);
          await this.prisma
            .$executeRaw`UPDATE "Product" SET "embedding" = ${toBytes(vectors[j])}, "embeddingSig" = ${sig} WHERE "id" = ${batch[j].id}`;
          batch[j].vector = vectors[j];
          batch[j].signature = sig;
        }
      }
      if (pending.length) this.log.log(`Embedded ${pending.length} products`);
    } catch (e) {
      this.log.error('Embedding products failed', (e as Error).stack);
    } finally {
      this.embedding = false;
    }
  }

  // ---------- ranking ----------

  parse(q: string) {
    return parseQuery(q, this);
  }

  private meta(parsed: ParsedQuery, semantic: boolean): SearchMeta {
    const own = new Set(
      parsed.concepts.flatMap((c) => [c.word, c.corrected ?? c.word]),
    );
    // Needs first: they explain results the shopper didn't literally type
    const also = new Set<string>(parsed.intents);
    for (const c of parsed.concepts)
      for (const v of c.variants)
        if (!own.has(v.term) && v.weight <= 0.9 && !/[a-z]/.test(v.term))
          also.add(v.term);
    return {
      mode: 'smart',
      correctedQuery: parsed.correctedText,
      alsoSearched: [...also].slice(0, 6),
      semantic,
    };
  }

  /** A word found only in the section, store or place name counts less than one in the listing itself. */
  private static conceptScore(
    concept: Concept,
    text: string,
    title: string,
    own = text,
  ) {
    let best = 0;
    let inTitle = false;
    for (const v of concept.variants) {
      const w = own.includes(v.term)
        ? v.weight
        : text.includes(v.term)
          ? v.weight * 0.6
          : 0;
      if (w > best) best = w;
      if (!inTitle && title.includes(v.term)) inTitle = true;
    }
    return { best, inTitle };
  }

  async rankProducts(q: string): Promise<Ranked | null> {
    if (!this.loaded) return null;
    const parsed = this.parse(q);
    if (!parsed.concepts.length && !parsed.intents.length) {
      return parsed.wantsOffers || parsed.condition
        ? this.modifierOnly(parsed)
        : { ids: [], scores: new Map(), meta: this.meta(parsed, false) };
    }

    let queryVector: Float32Array | null = null;
    if (this.embeddings.enabled && this.products.some((p) => p.vector)) {
      queryVector = await this.embeddings
        .embedQuery(parsed.normalized)
        .catch(() => null);
    }

    const needed =
      parsed.concepts.length <= 1
        ? parsed.concepts.length
        : Math.ceil(parsed.concepts.length * 0.6);
    const scores = new Map<string, number>();
    for (const p of this.products) {
      let matched = 0;
      let weight = 0;
      let title = 0;
      for (const c of parsed.concepts) {
        const { best, inTitle } = SearchIndexService.conceptScore(
          c,
          p.text,
          p.title,
          p.own,
        );
        if (best) matched++;
        weight += best;
        if (inTitle) title++;
      }
      const intentHits = parsed.intents.filter((t) =>
        p.text.includes(t),
      ).length;
      // A described need is best met by listings named after the solution ("باور بانك" in the title)
      const intentInTitle = parsed.intents.filter((t) =>
        p.title.includes(t),
      ).length;
      const sem =
        queryVector && p.vector ? semantic01(cosine(queryVector, p.vector)) : 0;

      const lexicalOk = parsed.concepts.length
        ? matched >= needed
        : intentHits > 0;
      const intentOk =
        intentHits > 0 && (!parsed.concepts.length || matched > 0);
      if (!lexicalOk && !intentOk && sem < SEM_MIN) continue;

      const coverage = parsed.concepts.length
        ? weight / parsed.concepts.length
        : 0;
      const score =
        coverage * 1.0 +
        (parsed.concepts.length ? (title / parsed.concepts.length) * 0.35 : 0) +
        Math.min(intentHits, 2) * 0.2 +
        Math.min(intentInTitle, 2) * 0.8 +
        sem * 0.9 +
        (parsed.wantsOffers && p.hasOffer ? 0.25 : 0) +
        (parsed.condition && p.condition === parsed.condition ? 0.25 : 0) +
        (p.inStock ? 0.05 : 0) +
        p.trust * 0.03 +
        Math.log10(p.popularity + 1) * 0.02;
      scores.set(p.id, score);
    }

    const ids = [...scores.keys()]
      .sort((a, b) => scores.get(b)! - scores.get(a)!)
      .slice(0, MAX_CANDIDATES);
    return { ids, scores, meta: this.meta(parsed, !!queryVector) };
  }

  private modifierOnly(parsed: ParsedQuery): Ranked {
    const scores = new Map<string, number>();
    for (const p of this.products) {
      if (parsed.wantsOffers && !p.hasOffer) continue;
      if (parsed.condition && p.condition !== parsed.condition) continue;
      scores.set(p.id, p.trust * 0.03 + Math.log10(p.popularity + 1) * 0.02);
    }
    const ids = [...scores.keys()]
      .sort((a, b) => scores.get(b)! - scores.get(a)!)
      .slice(0, MAX_CANDIDATES);
    return { ids, scores, meta: this.meta(parsed, false) };
  }

  rankStores(q: string): Ranked | null {
    if (!this.loaded) return null;
    const parsed = this.parse(q);
    const scores = new Map<string, number>();
    if (!parsed.concepts.length && !parsed.intents.length)
      return { ids: [], scores, meta: this.meta(parsed, false) };
    const needed =
      parsed.concepts.length <= 1
        ? parsed.concepts.length
        : Math.ceil(parsed.concepts.length * 0.6);
    for (const s of this.stores) {
      let matched = 0;
      let weight = 0;
      let inName = 0;
      for (const c of parsed.concepts) {
        const { best, inTitle } = SearchIndexService.conceptScore(
          c,
          s.text,
          s.name,
        );
        if (best) matched++;
        weight += best;
        if (inTitle) inName++;
      }
      const intentHits = parsed.intents.filter((t) =>
        s.text.includes(t),
      ).length;
      if (!(parsed.concepts.length ? matched >= needed : intentHits > 0))
        continue;
      const n = parsed.concepts.length || 1;
      scores.set(
        s.id,
        weight / n +
          (inName / n) * 0.5 +
          intentHits * 0.2 +
          s.trust * 0.05 +
          Math.log10(s.popularity + 1) * 0.02,
      );
    }
    const ids = [...scores.keys()]
      .sort((a, b) => scores.get(b)! - scores.get(a)!)
      .slice(0, MAX_CANDIDATES);
    return { ids, scores, meta: this.meta(parsed, false) };
  }
}
