const toLatin = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** Mirrors the API rule: returns 9639xxxxxxxx or null. */
export function normalizeSyrianMobile(raw: string): string | null {
  let d = toLatin(raw).replace(/\D/g, "");
  if (d.startsWith("00963")) d = d.slice(5);
  else if (d.startsWith("963")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^9\d{8}$/.test(d) ? `963${d}` : null;
}

/** "1,250,000" or "١٢٥٠٠٠٠" -> 1250000 */
export function parseAmount(raw: string): number | null {
  const digits = toLatin(raw).replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

export function groupDigits(raw: string): string {
  const n = parseAmount(raw);
  return n == null ? "" : new Intl.NumberFormat("en-US").format(n);
}

/** e164 -> 09xxxxxxxx for editing */
export function localPhone(e164: string | null | undefined): string {
  return e164?.startsWith("963") ? `0${e164.slice(3)}` : (e164 ?? "");
}
