"use client";

import { useSyncExternalStore } from "react";
import type { ProductCardData } from "./types";
import { apiRequest } from "./session";

const KEY = "tujjar_favorites";
const EVENT = "tujjar-favorites";
const EMPTY: ProductCardData[] = [];

let cachedRaw: string | null = null;
let cached: ProductCardData[] = EMPTY;

function read(): ProductCardData[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = raw ? (JSON.parse(raw) as ProductCardData[]) : EMPTY;
    }
    return cached;
  } catch {
    return EMPTY;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useFavorites(): ProductCardData[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

function write(next: ProductCardData[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Favorites live on the device; for a signed-in buyer each change is mirrored to the account
 * (`signedIn`), which is what lets price drops and restocks reach them.
 */
export function toggleFavorite(product: ProductCardData, signedIn = false) {
  const list = read();
  const removing = list.some((f) => f.id === product.id);
  write(removing ? list.filter((f) => f.id !== product.id) : [product, ...list].slice(0, 200));
  if (signedIn) {
    void apiRequest(`/me/favorites/${encodeURIComponent(product.id)}`, {
      audience: "web",
      method: removing ? "DELETE" : "PUT",
    }).catch(() => undefined);
  }
}

/** After signing in: uploads this device's favorites and adopts the account's merged list. */
export async function syncFavorites() {
  const merged = await apiRequest<ProductCardData[]>("/me/favorites/sync", {
    audience: "web",
    method: "POST",
    body: { ids: read().map((f) => f.id) },
  });
  write(merged);
}
