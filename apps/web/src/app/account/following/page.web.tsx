"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@lib/session";
import type { StoreCardData } from "@lib/types";
import { StoreCard } from "@components/catalog/StoreCard";
import { EmptyState } from "@components/ui/Section";
import { useInterfaceSession } from "@components/notifications/useInterfaceSession";

export default function FollowingPage() {
  const { user } = useInterfaceSession();
  const [stores, setStores] = useState<StoreCardData[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    apiRequest<StoreCardData[]>("/me/following", { audience: "web" })
      .then(setStores)
      .catch((e: Error) => setError(e.message));
  }, [user]);

  if (!user) return <div className="mx-auto h-[60vh] max-w-6xl animate-pulse px-4 py-10" aria-busy="true" />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
      <Link href="/account" className="text-sm text-muted hover:text-ink">→ حسابي</Link>
      <h1 className="mt-2 text-3xl font-bold">المتاجر التي أتابعها</h1>
      <p className="mt-2 text-muted">يصلك إشعار عندما تضيف هذه المتاجر منتجات جديدة أو عروضاً.</p>

      {error && <p className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="mt-6">
        {!stores && !error && <div className="h-48 animate-pulse rounded-card bg-surface ring-1 ring-line" aria-busy="true" />}
        {stores?.length === 0 && (
          <EmptyState icon="🏪" title="لا تتابع أي متجر بعد">
            افتح صفحة أي متجر واضغط «تابع المتجر» ليصلك جديده وعروضه.
            <div className="mt-4">
              <Link href="/search?type=stores" className="font-medium text-brand-700 underline">تصفّح المتاجر</Link>
            </div>
          </EmptyState>
        )}
        {!!stores?.length && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
