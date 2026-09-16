import { normalizeArabic } from '../common/text/arabic';
import { INTENTS, MODIFIERS, STOPWORDS, SYNONYM_GROUPS } from './synonyms';

export type Variant = { term: string; weight: number };
/** One thing the shopper asked for, with every spelling and synonym that satisfies it */
export type Concept = { word: string; corrected?: string; variants: Variant[] };

export type ParsedQuery = {
  normalized: string;
  concepts: Concept[];
  /** Terms added from described needs ("بلا كهربا" → batteries, solar); they help ranking, never exclude */
  intents: string[];
  wantsOffers: boolean;
  condition: 'NEW' | 'USED' | null;
  /** The query with spelling corrections applied, when any was needed */
  correctedText: string | null;
};

const norm = (s: string) => normalizeArabic(s);
const GROUPS = SYNONYM_GROUPS.map((g) => [...new Set(g.map(norm).filter(Boolean))]);
const STOP = new Set(STOPWORDS.map(norm));
const MOD = {
  offers: new Set(MODIFIERS.offers.map(norm)),
  used: new Set(MODIFIERS.used.map(norm)),
  new: new Set(MODIFIERS.new.map(norm)),
};
const INTENT_RULES = INTENTS.map((r) => ({ when: r.when.flat().map(norm), add: r.add.map(norm) }));

/** Word → the synonym groups it belongs to (single words and multi-word phrases). */
const GROUP_OF = new Map<string, number[]>();
GROUPS.forEach((g, i) => g.forEach((w) => GROUP_OF.set(w, [...(GROUP_OF.get(w) ?? []), i])));
const PHRASES = [...GROUP_OF.keys()].filter((w) => w.includes(' ')).sort((a, b) => b.length - a.length);

const PREFIXES = ['وبال', 'وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ب', 'ل'];
const SUFFIXES = ['ات', 'ين', 'ون', 'يه', 'ه'];

/** Arabic light stemming: drops attached conjunction/article prefixes and common plural endings. */
export function stems(word: string): string[] {
  const out = new Set<string>([word]);
  for (const p of PREFIXES) {
    if (word.startsWith(p) && word.length - p.length >= 3) out.add(word.slice(p.length));
  }
  for (const w of [...out]) {
    for (const s of SUFFIXES) {
      if (w.endsWith(s) && w.length - s.length >= 3) out.add(w.slice(0, -s.length));
    }
  }
  return [...out];
}

/** Letters people swap when typing dialect: ذ/ز, ث/س/ت, ظ/ض, ط/ت, ص/س, ق/ك/ء. */
const CONFUSABLE: Record<string, string> = { ذ: 'ز', ث: 'س', ظ: 'ض', ط: 'ت', ص: 'س', ق: 'ك' };
const soft = (c: string) => CONFUSABLE[c] ?? c;

/** Damerau-Levenshtein distance where confusable letters cost less than other substitutions. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : soft(a[i - 1]) === soft(b[j - 1]) ? 0.4 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

const allowedDistance = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

export interface Vocabulary {
  /** Whether the word (or a word containing it) appears in the catalogue */
  has(word: string): boolean;
  /** Candidate words for spelling correction, with how often they appear */
  words(): Iterable<[string, number]>;
}

function correct(word: string, vocab: Vocabulary): string | null {
  const max = allowedDistance(word.length);
  if (!max) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const [candidate, freq] of vocab.words()) {
    if (Math.abs(candidate.length - word.length) > max) continue;
    const dist = editDistance(word, candidate, max);
    if (dist > max) continue;
    const score = dist - Math.min(0.3, Math.log10(freq + 1) / 10);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function variantsFor(word: string, weight: number): Variant[] {
  const out = new Map<string, number>();
  const add = (term: string, w: number) => {
    if (term.length >= 2 && (out.get(term) ?? 0) < w) out.set(term, w);
  };
  for (const s of stems(word)) {
    add(s, s === word ? weight : weight * 0.95);
    for (const gi of GROUP_OF.get(s) ?? []) for (const syn of GROUPS[gi]) add(syn, weight * 0.9);
  }
  return [...out].map(([term, w]) => ({ term, weight: w }));
}

const MAX_CONCEPTS = 6;

export function parseQuery(raw: string, vocab: Vocabulary): ParsedQuery {
  let text = norm(raw.slice(0, 120));
  const normalized = text;

  const intents = new Set<string>();
  for (const rule of INTENT_RULES) {
    // The described need is replaced by what satisfies it, so its words don't also have to match literally
    const hit = rule.when.filter((w) => ` ${text} `.includes(` ${w} `)).sort((a, b) => b.length - a.length)[0];
    if (!hit) continue;
    rule.add.forEach((a) => intents.add(a));
    text = ` ${text} `.replace(` ${hit} `, ' ').trim();
  }

  let wantsOffers = false;
  let condition: ParsedQuery['condition'] = null;
  const concepts: Concept[] = [];
  const corrections: string[] = [];

  // Multi-word phrases first ("باور بانك", "طاقة شمسية") so they stay one concept
  for (const phrase of PHRASES) {
    if (` ${text} `.includes(` ${phrase} `)) {
      concepts.push({ word: phrase, variants: variantsFor(phrase, 1) });
      text = ` ${text} `.replace(` ${phrase} `, ' ').trim();
    }
  }

  for (const word of text.split(' ').filter(Boolean)) {
    if (STOP.has(word) || word.length < 2) continue;
    if (MOD.offers.has(word)) { wantsOffers = true; continue; }
    if (MOD.used.has(word)) { condition = 'USED'; continue; }
    if (MOD.new.has(word)) { condition = 'NEW'; continue; }

    const known = stems(word).some((s) => vocab.has(s) || GROUP_OF.has(s));
    if (known || /^\d+$/.test(word)) {
      concepts.push({ word, variants: variantsFor(word, 1) });
      corrections.push(word);
      continue;
    }
    const fixed = correct(word, vocab);
    if (fixed) {
      concepts.push({ word, corrected: fixed, variants: variantsFor(fixed, 0.85) });
      corrections.push(fixed);
    } else {
      concepts.push({ word, variants: variantsFor(word, 1) });
      corrections.push(word);
    }
  }

  const correctedText = concepts.some((c) => c.corrected) ? corrections.join(' ') : null;
  return {
    normalized,
    concepts: concepts.slice(0, MAX_CONCEPTS),
    intents: [...intents],
    wantsOffers,
    condition,
    correctedText,
  };
}
