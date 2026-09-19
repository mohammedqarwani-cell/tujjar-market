"use client";

import Link from "next/link";
import { useCartCount } from "@lib/cart";
import { CartIcon } from "@components/ui/icons";

/** The basket in the header, with how many pieces are waiting in it. */
export function CartLink() {
  const count = useCartCount();
  return (
    <Link
      href="/cart"
      aria-label={count ? `السلة، ${count} قطعة` : "السلة"}
      className="relative hidden rounded-full p-2 text-ink transition hover:bg-sand md:block"
    >
      <CartIcon size={20} />
      {count > 0 && (
        <span className="absolute -top-0.5 end-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-canvas">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
