"use client";

import Link from "next/link";
import { useFavorites } from "@lib/favorites";
import { ProductCard } from "@components/catalog/ProductCard";
import { EmptyState } from "@components/ui/Section";

export default function FavoritesPage() {
  const favorites = useFavorites();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">المفضلة</h1>
      <p className="mt-2 text-muted">سجّل الدخول لتحفظ مفضلتك في حسابك، ويصلك إشعار إذا انخفض سعر منتج أو توفر من جديد.</p>

      <div className="mt-6">
        {favorites.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {favorites.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState icon="🤍" title="لسا ما حفظت أي منتج">
            اضغط على القلب فوق أي منتج ليوصل لهون، وارجع له وقت ما بدك.
            <div className="mt-4">
              <Link href="/search" className="font-medium text-brand-700 underline">تصفّح المنتجات</Link>
            </div>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
