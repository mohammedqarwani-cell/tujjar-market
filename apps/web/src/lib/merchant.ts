"use client";

import { useCallback, useEffect, useState } from "react";
import { merchantFetch } from "./session";
import type { Currency, Condition, PriceType, ProductCardData, ProductStatus, Ref, CategoryRef } from "./types";

export type MerchantProduct = ProductCardData & {
  status: ProductStatus;
  viewsCount: number;
  contactsCount: number;
  updatedAt: string;
};

export type EditableProduct = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  priceType: PriceType;
  price: number | null;
  oldPrice: number | null;
  currency: Currency;
  condition: Condition;
  inStock: boolean;
  images: string[];
  status: ProductStatus;
};

export type MerchantStore = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  mapUrl: string | null;
  whatsapp: string;
  phone: string | null;
  openingHours: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  hasDelivery: boolean;
  isVerified: boolean;
  status: "ACTIVE" | "SUSPENDED";
  governorateId: string;
  marketId: string | null;
  categoryId: string | null;
  governorate: Ref & { id: string };
  market: (Ref & { id: string }) | null;
  category: (CategoryRef & { id: string }) | null;
  _count: { products: number };
};

export type MerchantStats = {
  days: number;
  totals: { views: number; whatsapp: number; calls: number };
  series: { day: string; views: number; whatsapp: number; calls: number }[];
  products: { active: number; hidden: number; underReview: number };
  topProducts: { id: string; title: string; viewsCount: number; contactsCount: number; images: string[] }[];
};

/** Loads an authenticated resource and exposes a reload function. */
export function useAuthData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError("");
    try {
      setData(await merchantFetch<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
