import { api } from "@lib/api";
export type MetaItem = { name: string | null; count: number };

export const MetaService = {
  categories(limit = 20) {
    return api<MetaItem[]>(`/meta/categories?limit=${limit}`);
  },
  cities(limit = 50) {
    return api<MetaItem[]>(`/meta/cities?limit=${limit}`);
  },
  // ✅ أصبح يدعم city اختياريًا
  markets(limit = 50, city?: string) {
    const qs = new URLSearchParams({
      limit: String(limit),
      ...(city ? { city } : {}),
    }).toString();
    return api<MetaItem[]>(`/meta/markets?${qs}`);
  },
};
