import type { Currency, PriceType } from "./types";

const nf = new Intl.NumberFormat("en-US");
const rtf = new Intl.RelativeTimeFormat("ar-u-nu-latn", { numeric: "auto" });

export const formatNumber = (n: number) => nf.format(n);

export function formatAmount(amount: number, currency: Currency): string {
  return currency === "USD" ? `${nf.format(amount)}$` : `${nf.format(amount)} ل.س`;
}

export function priceLabel(p: { price: number | null; currency: Currency; priceType: PriceType }) {
  if (p.priceType === "ON_REQUEST" || p.price == null) {
    return { main: "السعر عند الطلب", note: undefined, onRequest: true };
  }
  return {
    main: formatAmount(p.price, p.currency),
    note: p.priceType === "NEGOTIABLE" ? "قابل للتفاوض" : undefined,
    onRequest: false,
  };
}

export function discountPercent(price: number | null, oldPrice: number | null): number {
  if (!price || !oldPrice || oldPrice <= price) return 0;
  return Math.round((1 - price / oldPrice) * 100);
}

/** 963912345678 -> 0912 345 678 */
export function displayPhone(e164: string): string {
  if (!e164.startsWith("963")) return e164;
  const local = `0${e164.slice(3)}`;
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : local;
}

export function timeAgo(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of steps) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "الآن";
}

export function storeLocation(s: { governorate: { name: string }; market: { name: string } | null }) {
  return s.market ? `${s.market.name}، ${s.governorate.name}` : s.governorate.name;
}
