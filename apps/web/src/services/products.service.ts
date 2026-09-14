import { api } from "@lib/api";

export type Store = {
  id: string;
  name: string;
  slug: string;
  city?: string;
  market?: string;
  imageUrl?: string;
};
export type Product = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  category: string;
  status?: string;
  store: Store;
};
export type PageResp<T> = {
  items: T[];
  total: number;
  page: number;
  pages: number;
};

export const ProductsService = {
  list(params: Record<string, string | number> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    return api<PageResp<Product>>(`/products${qs ? `?${qs}` : ""}`);
  },
  featured(page = 1, pageSize = 12) {
    return api<PageResp<Product>>(
      `/products/featured?page=${page}&pageSize=${pageSize}`
    );
  },
  mine(page = 1, pageSize = 20) {
    return api<PageResp<Product>>(
      `/products/mine?page=${page}&pageSize=${pageSize}`,
      { auth: true }
    );
  },
  get(id: string) {
    return api<Product>(`/products/${id}`);
  },
  create(dto: any) {
    return api<Product>(`/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
      auth: true,
    });
  },
  update(id: string, dto: any) {
    return api<Product>(`/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
      auth: true,
    });
  },
  delete(id: string) {
    return api<{ ok: boolean }>(`/products/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
  setVisibility(id: string, status: "ACTIVE" | "HIDDEN") {
    return api<Product>(`/products/${id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      auth: true,
    });
  },
};
