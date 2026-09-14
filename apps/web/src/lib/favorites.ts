"use client";

import { useSyncExternalStore } from "react";
import type { ProductCardData } from "./types";

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

export function toggleFavorite(product: ProductCardData) {
  const list = read();
  const next = list.some((f) => f.id === product.id)
    ? list.filter((f) => f.id !== product.id)
    : [product, ...list].slice(0, 200);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
