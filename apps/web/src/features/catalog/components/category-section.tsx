"use client";
import { useEffect, useState } from "react";
import { ProductsService, type Product } from "@services/products.service";
import ProductsGrid from "./products-grid";

export default function CategorySection({ name }: { name: string }) {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => {
    ProductsService.list({ category: name, page: 1, pageSize: 8 })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [name]);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{name}</h2>
        <a
          href={`/?category=${encodeURIComponent(name)}`}
          className="text-sm text-sky-600 underline"
        >
          See more
        </a>
      </div>
      <ProductsGrid products={items} />
    </section>
  );
}
