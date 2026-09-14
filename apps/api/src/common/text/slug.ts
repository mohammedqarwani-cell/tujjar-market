import { randomBytes } from 'crypto';
import { toLatinDigits } from './arabic';

const MAP: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'e', آ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h',
  خ: 'kh', د: 'd', ذ: 'th', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd',
  ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm',
  ن: 'n', ه: 'h', ة: 'a', و: 'w', ؤ: 'o', ي: 'y', ى: 'a', ئ: 'e', ء: '',
};

export function slugify(input: string): string {
  const latin = Array.from(toLatinDigits(input))
    .map((ch) => MAP[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return latin || `store-${randomBytes(3).toString('hex')}`;
}

export function withSuffix(slug: string): string {
  return `${slug.slice(0, 42)}-${randomBytes(2).toString('hex')}`;
}
