"use client";
import { useEffect, useState } from "react";
import Skeleton from "@components/ui/skeleton";
import { ProductsService, type Product } from "@services/products.service";

function ProductCard({ p }: { p: Product }) {
  return (
    <a
      href={`/stores/${p.store?.slug ?? ""}`}
      className="group w-48 shrink-0 rounded-2xl bg-white p-3 shadow hover:shadow-md transition"
    >
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-100">
        {p.imageUrl && (
          <img
            src={p.imageUrl}
            alt={p.name}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition"
          />
        )}
      </div>
      <div className="mt-3">
        <div className="font-semibold truncate">{p.name}</div>
        <div className="text-xs text-gray-500 truncate">{p.category}</div>
        <div className="mt-1 font-bold">{p.price.toLocaleString()} ل.س</div>
      </div>
    </a>
  );
}

export default function ProductsRow({
  title,
  query,
  limit = 12,
}: {
  title: string;
  query?: { category?: string; city?: string; market?: string };
  limit?: number;
}) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const run = async () => {
      try {
        if (!query || Object.keys(query).length === 0) {
          const r = await ProductsService.featured(1, limit);
          setItems(r.items);
        } else {
          const r = await ProductsService.list({
            ...query,
            page: 1,
            pageSize: limit,
          });
          setItems(r.items);
        }
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [JSON.stringify(query), limit]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <a className="text-sm text-sky-600 underline" href={`/search`}>
          عرض الكل
        </a>
      </div>

      {loading && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-48 shrink-0">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="mt-3 h-4 w-36 rounded" />
              <Skeleton className="mt-2 h-3 w-20 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
          لا توجد منتجات لعرضها الآن.
        </div>
      )}
    </section>
  );
}
