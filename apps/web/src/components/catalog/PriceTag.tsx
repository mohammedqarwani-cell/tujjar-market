import { formatAmount, priceLabel } from "@lib/format";
import type { Currency, PriceType } from "@lib/types";

type Props = {
  price: number | null;
  oldPrice: number | null;
  currency: Currency;
  priceType: PriceType;
  size?: "sm" | "lg";
};

export function PriceTag({ price, oldPrice, currency, priceType, size = "sm" }: Props) {
  const label = priceLabel({ price, currency, priceType });
  const big = size === "lg";

  if (label.onRequest) {
    return (
      <span className={`font-bold text-olive-600 ${big ? "text-xl" : "text-sm"}`}>{label.main}</span>
    );
  }

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <bdi className={`font-bold text-brand-700 ${big ? "text-3xl" : "text-base"}`}>{label.main}</bdi>
      {oldPrice && price && oldPrice > price && (
        <bdi className={`text-muted line-through ${big ? "text-base" : "text-xs"}`}>
          {formatAmount(oldPrice, currency)}
        </bdi>
      )}
      {label.note && (
        <span className={`rounded-full bg-olive-50 px-2 py-0.5 font-medium text-olive-700 ${big ? "text-sm" : "text-[11px]"}`}>
          {label.note}
        </span>
      )}
    </span>
  );
}
