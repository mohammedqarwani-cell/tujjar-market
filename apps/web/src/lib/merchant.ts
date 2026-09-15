"use client";

import { useCallback, useEffect, useState } from "react";
import { merchantFetch } from "./session";
import type {
  CategoryRef,
  Condition,
  Currency,
  PriceType,
  ProductCardData,
  ProductStatus,
  Ref,
  VerificationLevel,
} from "./types";

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
  verificationLevel: VerificationLevel;
  earnedLevel: VerificationLevel;
  verificationExpiresAt: string | null;
  badgeSuspendedAt: string | null;
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

export type VerificationKind = "IDENTITY" | "LOCATION";
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type VerificationRequestSummary = {
  id: string;
  kind: VerificationKind;
  status: VerificationStatus;
  rejectReason: string | null;
  geoCheck: "INSIDE" | "OUTSIDE" | "NO_GEOFENCE" | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type VerificationStep = { canSubmit: boolean; pending: boolean; reason: string | null };

export type MerchantVerification = {
  level: VerificationLevel;
  earnedLevel: VerificationLevel;
  badgeSuspended: boolean;
  expiresAt: string | null;
  productLimit: number | null;
  productCount: number;
  market: { name: string; hasGeofence: boolean } | null;
  identity: VerificationStep;
  location: VerificationStep;
  requests: VerificationRequestSummary[];
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
