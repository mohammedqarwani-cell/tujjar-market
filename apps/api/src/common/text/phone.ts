import { toLatinDigits } from './arabic';

/**
 * Accepts Syrian mobile numbers in any common form (09xxxxxxxx, 9639xxxxxxxx,
 * +963 9xx xxx xxx, Arabic digits) and returns 9639xxxxxxxx, or null.
 */
export function normalizeSyrianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = toLatinDigits(raw).replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('00963')) local = local.slice(5);
  else if (local.startsWith('963')) local = local.slice(3);
  else if (local.startsWith('0')) local = local.slice(1);
  return /^9\d{8}$/.test(local) ? `963${local}` : null;
}

/** Any Syrian number (mobile or landline) kept as digits with country code. */
export function normalizeSyrianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const mobile = normalizeSyrianMobile(raw);
  if (mobile) return mobile;
  const digits = toLatinDigits(raw).replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('00963')) local = local.slice(5);
  else if (local.startsWith('963')) local = local.slice(3);
  else if (local.startsWith('0')) local = local.slice(1);
  return /^\d{7,9}$/.test(local) ? `963${local}` : null;
}
