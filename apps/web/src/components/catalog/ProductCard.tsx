import Link from "next/link";
import type { ProductCardData } from "@lib/types";
import { discountPercent, storeLocation } from "@lib/format";
import { VerifiedIcon } from "@components/ui/icons";
import { ProductArt } from "./ProductArt";
import { PriceTag } from "./PriceTag";
import { FavoriteButton } from "./FavoriteButton";

export function ProductCard({ product: p }: { product: ProductCardData }) {
  const discount = discountPercent(p.price, p.oldPrice);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line/60 transition duration-200 hover:-translate-y-0.5 hover:ring-brand-200">
      <Link href={`/products/${p.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden bg-sand">
          {p.images[0] ? (
            <img
              src={p.images[0]}
              alt={p.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <ProductArt icon={p.category.icon} seed={p.category.slug} />
          )}

          <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
            {discount > 0 && (
              <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
                خصم {discount}٪
              </span>
            )}
            {p.condition === "USED" && (
              <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-white">مستعمل</span>
            )}
          </div>

          {!p.inStock && (
            <div className="absolute inset-x-0 bottom-0 bg-ink/70 py-1 text-center text-xs font-medium text-white">
              غير متوفر حالياً
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-[1.375rem] text-ink">
            {p.title}
          </h3>
          <PriceTag price={p.price} oldPrice={p.oldPrice} currency={p.currency} priceType={p.priceType} />
          <div className="mt-auto flex items-center gap-1 pt-1 text-xs text-muted">
            <span className="truncate font-medium text-ink/80">{p.store.name}</span>
            {p.store.isVerified && <VerifiedIcon size={14} className="shrink-0 text-olive-500" />}
          </div>
          <div className="truncate text-[11px] text-muted">{storeLocation(p.store)}</div>
        </div>
      </Link>

      <FavoriteButton product={p} className="absolute end-2 top-2" />
    </article>
  );
}
