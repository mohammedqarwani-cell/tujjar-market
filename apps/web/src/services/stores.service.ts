import { api } from "@lib/api";

export type Store = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  market?: string | null;
  imageUrl?: string | null;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string | null;
  store?: { slug?: string | null; name?: string | null } | null;
};

export const StoresService = {
  // عام مع بارامترات
  list(params: Record<string, string | number | boolean> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    return api<Store[]>(`/stores${qs ?` ${qs} `: ""}`);
  },

  // ملائمة سريعة
  byCity(city: string, limit = 24, withImage = true) {
    return this.list({ city, limit, hasImageOnly: withImage });
  },

  byCityMarket(city: string, market: string, limit = 24, withImage = true) {
    return this.list({ city, market, limit, hasImageOnly: withImage });
  },

  bySlug(slug: string) {
    return api<Store>(`/stores/${slug}`);
  },

  // ✅ المنتجات الخاصة بمتجر معيّن عبر الـ slug
  productsByStore(slug: string, page = 1, pageSize = 24) {
    const qs = new URLSearchParams({
      storeSlug: slug,
      page: String(page),
      pageSize: String(pageSize),
    }).toString();
    return api<{ items: Product[]; total?: number; page?: number; pages?: number }>(
     `/products?${qs}`
    );
  },
};