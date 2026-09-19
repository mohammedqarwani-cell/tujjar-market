"use client";

import { useSyncExternalStore } from "react";
import type { Currency, PriceType, ProductCardData } from "./types";

/** One basket per shop: an order goes to one shop, so the basket is split the same way. */
export type CartItem = {
  id: string;
  title: string;
  price: number | null;
  currency: Currency;
  priceType: PriceType;
  image: string | null;
  quantity: number;
};

export type StoreCart = {
  store: { slug: string; name: string; hasDelivery: boolean; governorate?: string };
  items: CartItem[];
};

const KEY = "tujjar_cart";
const EVENT = "tujjar-cart";
const EMPTY: StoreCart[] = [];
const MAX_ITEMS = 40;

let cachedRaw: string | null = null;
let cached: StoreCart[] = EMPTY;

function read(): StoreCart[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = raw ? (JSON.parse(raw) as StoreCart[]) : EMPTY;
    }
    return cached;
  } catch {
    return EMPTY;
  }
}

function write(next: StoreCart[]) {
  const clean = next.filter((c) => c.items.length);
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {}
  cachedRaw = null;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useCart(): StoreCart[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** How many pieces are waiting in every basket, for the badge. */
export function useCartCount(): number {
  const carts = useCart();
  return carts.reduce((sum, c) => sum + c.items.reduce((n, i) => n + i.quantity, 0), 0);
}

export function useStoreCart(slug: string): StoreCart | null {
  return useCart().find((c) => c.store.slug === slug) ?? null;
}

export function addToCart(product: ProductCardData, quantity = 1): StoreCart {
  const carts = read();
  const slug = product.store.slug;
  const existing = carts.find((c) => c.store.slug === slug);
  const line: CartItem = {
    id: product.id,
    title: product.title,
    price: product.price,
    currency: product.currency,
    priceType: product.priceType,
    image: product.images[0] ?? null,
    quantity,
  };
  const store = {
    slug,
    name: product.store.name,
    hasDelivery: product.store.hasDelivery,
    governorate: product.store.governorate?.name,
  };

  let updated: StoreCart;
  if (!existing) {
    updated = { store, items: [line] };
    write([updated, ...carts]);
  } else {
    const found = existing.items.find((i) => i.id === product.id);
    const items = found
      ? existing.items.map((i) => (i.id === product.id ? { ...i, quantity: Math.min(9999, i.quantity + quantity) } : i))
      : [...existing.items, line].slice(0, MAX_ITEMS);
    updated = { store, items };
    write(carts.map((c) => (c.store.slug === slug ? updated : c)));
  }
  return updated;
}

export function setQuantity(slug: string, productId: string, quantity: number) {
  const carts = read();
  write(
    carts.map((c) =>
      c.store.slug === slug
        ? { ...c, items: quantity <= 0 ? c.items.filter((i) => i.id !== productId) : c.items.map((i) => (i.id === productId ? { ...i, quantity: Math.min(9999, quantity) } : i)) }
        : c,
    ),
  );
}

export function removeFromCart(slug: string, productId: string) {
  setQuantity(slug, productId, 0);
}

export function clearStoreCart(slug: string) {
  write(read().filter((c) => c.store.slug !== slug));
}

export function cartTotal(items: CartItem[]): number | null {
  if (items.some((i) => i.priceType !== "FIXED" || i.price === null)) return null;
  return items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);
}

export function isInCart(slug: string, productId: string): boolean {
  return read().some((c) => c.store.slug === slug && c.items.some((i) => i.id === productId));
}
