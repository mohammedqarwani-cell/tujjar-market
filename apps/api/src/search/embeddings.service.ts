import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { totalmem } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Meaning-based search with a small open-source multilingual model that runs inside the API
 * (no paid service, and product data never leaves the server).
 *
 * SEMANTIC_SEARCH=on|off|auto (default auto: on when the container has enough memory, since the
 * model needs roughly 300 MB). Without it, search still understands dialect, synonyms and typos.
 */
const MODEL = process.env.SEMANTIC_MODEL ?? 'Xenova/multilingual-e5-small';
const MIN_MEMORY_BYTES = 900 * 1024 * 1024;

function memoryLimit(): number {
  for (const file of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const raw = readFileSync(file, 'utf8').trim();
      const n = Number(raw);
      if (raw !== 'max' && Number.isFinite(n) && n > 0 && n < totalmem()) return n;
    } catch {}
  }
  return totalmem();
}

type TransformersModule = {
  env: { cacheDir: string };
  pipeline: (task: string, model: string, opts: { dtype: string }) => Promise<unknown>;
};

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>;

@Injectable()
export class EmbeddingsService {
  private readonly log = new Logger(EmbeddingsService.name);
  readonly enabled: boolean;
  readonly model = MODEL;
  private extractor: Promise<Extractor | null> | null = null;

  constructor() {
    const mode = (process.env.SEMANTIC_SEARCH ?? 'auto').toLowerCase();
    this.enabled = mode === 'on' || (mode === 'auto' && memoryLimit() >= MIN_MEMORY_BYTES);
    this.log.log(`Semantic search ${this.enabled ? `enabled (${MODEL})` : 'disabled'}`);
  }

  /** Identifies the model and the exact text, so edited products get a fresh vector. */
  signature(text: string) {
    return `${MODEL}:${createHash('sha1').update(text).digest('hex').slice(0, 16)}`;
  }

  private load(): Promise<Extractor | null> {
    this.extractor ??= (async () => {
      try {
        // ESM-only package, loaded lazily so the API starts fast and works without it
        // Optional dependency: without the package installed, search runs on text matching alone
        const tf = await (new Function('m', 'return import(m)') as (m: string) => Promise<TransformersModule>)('@huggingface/transformers');
        tf.env.cacheDir = process.env.MODEL_CACHE_DIR ?? join(process.cwd(), '.cache', 'models');
        const pipe = await tf.pipeline('feature-extraction', MODEL, { dtype: 'q8' });
        this.log.log('Embedding model loaded');
        return pipe as unknown as Extractor;
      } catch (e) {
        this.log.error(`Embedding model unavailable, using text search only: ${(e as Error).message}`);
        return null;
      }
    })();
    return this.extractor;
  }

  private async embed(texts: string[]): Promise<Float32Array[] | null> {
    if (!this.enabled || !texts.length) return null;
    const extractor = await this.load();
    if (!extractor) return null;
    const out = await extractor(texts, { pooling: 'mean', normalize: true });
    const dim = out.dims[out.dims.length - 1];
    return texts.map((_, i) => out.data.slice(i * dim, (i + 1) * dim));
  }

  /** e5 models expect these prefixes to separate what is searched from what is indexed. */
  embedPassages(texts: string[]) {
    return this.embed(texts.map((t) => `passage: ${t}`));
  }

  async embedQuery(text: string): Promise<Float32Array | null> {
    return (await this.embed([`query: ${text}`]))?.[0] ?? null;
  }

  ready() {
    return this.enabled && !!this.extractor;
  }
}

export const toBytes = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength);
export const fromBytes = (b: Uint8Array) => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

export function cosine(a: Float32Array, b: Float32Array) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
