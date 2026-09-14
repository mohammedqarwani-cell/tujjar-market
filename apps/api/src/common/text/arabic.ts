const ARABIC_DIGITS = /[٠-٩]/g;
const PERSIAN_DIGITS = /[۰-۹]/g;

export function toLatinDigits(input: string): string {
  return input
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Normalizes Arabic text so searches match common spelling variants:
 * hamza forms, taa marbuta, alef maqsura, diacritics and tatweel.
 */
export function normalizeArabic(input: string | null | undefined): string {
  if (!input) return '';
  return toLatinDigits(input)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchText(
  ...parts: Array<string | null | undefined>
): string {
  return normalizeArabic(parts.filter(Boolean).join(' '));
}
