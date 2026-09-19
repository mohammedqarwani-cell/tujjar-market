"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart, useStoreCart } from "@lib/cart";
import { toast, haptic } from "@lib/toast";
import type { ProductCardData } from "@lib/types";
import { CheckoutDialog } from "./CheckoutDialog";

type Props = {
  product: ProductCardData;
  /** "compact" is the button inside a product card; "full" is the product page */
  variant?: "full" | "compact";
  className?: string;
};

/**
 * Puts a product in that shop's basket. On the product page it also offers to order straight
 * away, which opens the checkout with the basket as it stands.
 */
export function AddToCart({ product, variant = "full", className = "" }: Props) {
  const router = useRouter();
  const cart = useStoreCart(product.store.slug);
  const [checkout, setCheckout] = useState(false);
  const inCart = cart?.items.find((i) => i.id === product.id)?.quantity ?? 0;

  const add = () => {
    addToCart(product);
    haptic(12);
    toast(inCart ? `صار عندك ${inCart + 1} بالسلة` : "أضفناه للسلة", "🛒");
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={add}
        disabled={!product.inStock}
        className={`press w-full rounded-xl py-2 text-xs font-bold transition disabled:bg-sand disabled:text-muted ${inCart ? "bg-olive-500 text-white" : "bg-brand-600 text-white"} ${className}`}
      >
        {!product.inStock ? "غير متوفر" : inCart ? `بالسلة (${inCart}) — زد` : "🛒 أضف للسلة"}
      </button>
    );
  }

  return (
    <>
      <div className={`flex gap-2 ${className}`}>
        <button
          type="button"
          onClick={add}
          disabled={!product.inStock}
          className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:bg-sand disabled:text-muted"
        >
          {product.inStock ? (inCart ? `🛒 بالسلة (${inCart}) — زد واحد` : "🛒 أضف للسلة") : "غير متوفر حالياً"}
        </button>
        {product.inStock && (
          <button
            type="button"
            onClick={() => {
              if (!inCart) addToCart(product);
              setCheckout(true);
            }}
            className="press h-12 shrink-0 rounded-xl px-5 font-bold ring-1 ring-line transition hover:ring-brand-200"
          >
            اطلب الآن
          </button>
        )}
      </div>
      {inCart > 0 && (
        <button type="button" onClick={() => router.push("/cart")} className="mt-2 text-sm font-medium text-brand-700">
          افتح السلة ←
        </button>
      )}
      {checkout && cart && <CheckoutDialog cart={cart} onClose={() => setCheckout(false)} />}
    </>
  );
}
