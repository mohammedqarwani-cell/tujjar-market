"use client";
import { useEffect, useState } from "react";
import {
  ProductsService,
  type PageResp,
  type Product,
} from "@services/products.service";

export default function ProductsDashboardPage() {
  const [data, setData] = useState<PageResp<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  async function load(page = 1) {
    try {
      setLoading(true);
      setErr("");
      const r = await ProductsService.mine(page, 20);
      setData(r);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: string) {
    const ok = confirm("Delete this product?");
    if (!ok) return;
    await ProductsService.delete(id).catch(() => {});
    load(data?.page ?? 1);
  }

  async function onToggle(p: Product) {
    const to = p.status === "HIDDEN" ? "ACTIVE" : "HIDDEN";
    await ProductsService.setVisibility(p.id, to as any).catch(() => {});
    load(data?.page ?? 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Products</h2>
        <a
          href="/dashboard/products/new"
          className="px-3 py-2 rounded bg-black text-white"
        >
          Add Product
        </a>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Price</th>
                  <th className="text-left p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-lg overflow-hidden bg-gray-100">
                          {p.imageUrl && (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-gray-500">{p.store?.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3">{p.price.toLocaleString()} ل.س</td>
                    <td className="p-3">
                      <span
                        className={
                          p.status === "ACTIVE"
                            ? "text-green-600"
                            : p.status === "UNDER_REVIEW"
                            ? "text-amber-600"
                            : "text-gray-500"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <a
                        href={`/dashboard/products/${p.id}/edit`}
                        className="px-3 py-1.5 rounded bg-gray-900 text-white"
                      >
                        Edit
                      </a>
                      <button
                        onClick={() => onToggle(p)}
                        className="px-3 py-1.5 rounded bg-amber-600 text-white"
                      >
                        {p.status === "HIDDEN" ? "Show" : "Hide"}
                      </button>
                      <button
                        onClick={() => onDelete(p.id)}
                        className="px-3 py-1.5 rounded bg-red-600 text-white"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">
                      No products yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => load(n)}
                  className={`px-3 py-1.5 rounded ${
                    data.page === n ? "bg-black text-white" : "bg-gray-100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
