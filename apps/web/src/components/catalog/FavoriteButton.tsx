"use client";

import { HeartIcon } from "@components/ui/icons";
import { toggleFavorite, useFavorites } from "@lib/favorites";
import { useSession } from "@lib/session";
import { useState } from "react";
import { haptic, toast } from "@lib/toast";
import type { ProductCardData } from "@lib/types";

export function FavoriteButton({ product, className = "" }: { product: ProductCardData; className?: string }) {
  const favorites = useFavorites();
  const { user } = useSession("web", { lazy: true });
  const active = favorites.some((f) => f.id === product.id);
  const [pop, setPop] = useState(0);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        toggleFavorite(product, !!user);
        haptic();
        setPop((n) => n + 1);
        toast(active ? "أُزيل من المفضلة" : "أُضيف إلى المفضلة", active ? "🤍" : "❤️");
      }}
      aria-pressed={active}
      aria-label={active ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 shadow-sm backdrop-blur transition hover:scale-105 ${active ? "text-danger" : "text-ink/70"} ${className}`}
    >
      <span key={pop} className={pop ? "animate-pop" : ""}>
        <HeartIcon size={18} filled={active} />
      </span>
    </button>
  );
}
