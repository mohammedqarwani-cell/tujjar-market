"use client";

import { HeartIcon } from "@components/ui/icons";
import { toggleFavorite, useFavorites } from "@lib/favorites";
import type { ProductCardData } from "@lib/types";

export function FavoriteButton({ product, className = "" }: { product: ProductCardData; className?: string }) {
  const favorites = useFavorites();
  const active = favorites.some((f) => f.id === product.id);

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(product)}
      aria-pressed={active}
      aria-label={active ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 shadow-sm backdrop-blur transition hover:scale-105 ${active ? "text-danger" : "text-ink/70"} ${className}`}
    >
      <HeartIcon size={18} filled={active} />
    </button>
  );
}
