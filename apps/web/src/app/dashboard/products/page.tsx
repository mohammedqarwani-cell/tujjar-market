"use client";

import { useState } from "react";
import Link from "next/link";
import { toQuery } from "@lib/api";
import { formatNumber, priceLabel } from "@lib/format";
import { merchantFetch } from "@lib/session";
import { useAuthData, type MerchantProduct } from "@lib/merchant";
import type { Page } from "@lib/types";
import { ProductArt } from "@components/catalog/ProductArt";
import { EmptyState } from "@components/ui/Section";
import { FormError } from "@components/forms/fields";
import { EditIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon, WhatsAppIcon } from "@components/ui/icons";

const TABS = [
  { value: "", label: "الكل" },
  { value: "ACTIVE", label: "معروض" },
  { value: "HIDDEN", label: "مخفي" },
  { value: "UNDER_REVIEW", label: "قيد المراجعة" },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "معروض", className: "bg-olive-50 text-olive-700" },
  HIDDEN: { label: "مخفي", className: "bg-sand text-muted" },
  UNDER_REVIEW: { label: "قيد المراجعة", className: "bg-brand-50 text-brand-700" },
};

export default function MerchantProductsPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const { data, error, loading, reload } = useAuthData<Page<MerchantProduct>>(
    `/merchant/products${toQuery({ status, q: query, pageSize: 100 })}`,
  );

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setActionError("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "تعذّر تنفيذ العملية");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">منتجاتي</h1>
          {data && <p className="mt-1 text-sm text-muted">{formatNumber(data.total)} منتج</p>}
        </div>
        <Link
          href="/dashboard/products/new"
          className="flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-white hover:bg-brand-700"
        >
          <PlusIcon size={18} /> إضافة منتج
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-sand p-1 text-sm font-medium">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setStatus(t.value)}
              className={`shrink-0 rounded-lg px-3 py-1.5 ${status === t.value ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="ابحث في منتجاتك…"
            className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand-500 sm:w-60"
          />
        </form>
      </div>

      <div className="mt-4 space-y-3">
        <FormError message={error || actionError} />

        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-card bg-surface ring-1 ring-line" />)
        ) : data && data.items.length === 0 ? (
          <EmptyState icon="📦" title={query || status ? "لا توجد منتجات مطابقة" : "ابدأ بإضافة أول منتج"}>
            المتاجر اللي فيها 5 منتجات مع صور واضحة بتوصلها رسائل أكثر بكثير.
            <div className="mt-4">
              <Link href="/dashboard/products/new" className="font-bold text-brand-700 underline">إضافة منتج</Link>
            </div>
          </EmptyState>
        ) : (
          data?.items.map((p) => {
            const badge = STATUS_BADGE[p.status];
            return (
              <article
                key={p.id}
                className={`flex gap-3 rounded-card bg-surface p-3 ring-1 ring-line transition ${busy === p.id ? "opacity-50" : ""}`}
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ProductArt icon={p.category.icon} seed={p.category.slug} className="[&>span]:text-3xl" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-1 font-semibold">{p.title}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-brand-700">{priceLabel(p).main}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><EyeIcon size={13} />{formatNumber(p.viewsCount)}</span>
                    <span className="flex items-center gap-1"><WhatsAppIcon size={13} />{formatNumber(p.contactsCount)}</span>
                    {!p.images.length && <span className="text-brand-700">بدون صورة</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col justify-center gap-1 sm:flex-row sm:items-center">
                  <Link href={`/dashboard/products/${p.id}`} aria-label="تعديل" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sand">
                    <EditIcon size={18} />
                  </Link>
                  {p.status !== "UNDER_REVIEW" && (
                    <button
                      type="button"
                      aria-label={p.status === "ACTIVE" ? "إخفاء" : "إظهار"}
                      title={p.status === "ACTIVE" ? "إخفاء عن الزبائن" : "إظهار للزبائن"}
                      disabled={!!busy}
                      onClick={() =>
                        act(p.id, () =>
                          merchantFetch(`/merchant/products/${p.id}/status`, {
                            method: "PATCH",
                            body: { status: p.status === "ACTIVE" ? "HIDDEN" : "ACTIVE" },
                          }),
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sand"
                    >
                      {p.status === "ACTIVE" ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="حذف"
                    disabled={!!busy}
                    onClick={() => {
                      if (confirm(`حذف «${p.title}» نهائياً؟`)) {
                        act(p.id, () => merchantFetch(`/merchant/products/${p.id}`, { method: "DELETE" }));
                      }
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
