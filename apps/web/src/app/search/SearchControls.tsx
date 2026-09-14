"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toQuery } from "@lib/api";
import type { MarketSummary } from "@lib/types";

type Params = Record<string, string>;

const selectClass =
  "h-10 cursor-pointer rounded-xl border border-line bg-surface px-3 text-sm outline-none transition focus:border-brand-500";

export function SearchControls({
  params,
  isStores,
  governorates,
}: {
  params: Params;
  isStores: boolean;
  governorates: { slug: string; name: string; markets: MarketSummary[] }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const markets = governorates.find((g) => g.slug === params.gov)?.markets ?? [];

  const update = (patch: Params) => {
    const next = { ...params, ...patch, page: "" };
    startTransition(() => router.push(`/search${toQuery(next)}`, { scroll: false }));
  };

  return (
    <div className={`mt-4 flex flex-wrap items-center gap-2 transition ${pending ? "opacity-60" : ""}`}>
      <select
        aria-label="المحافظة"
        className={selectClass}
        value={params.gov}
        onChange={(e) => update({ gov: e.target.value, market: "" })}
      >
        <option value="">كل سوريا</option>
        {governorates.map((g) => (
          <option key={g.slug} value={g.slug}>{g.name}</option>
        ))}
      </select>

      {markets.length > 0 && (
        <select
          aria-label="السوق"
          className={selectClass}
          value={params.market}
          onChange={(e) => update({ market: e.target.value })}
        >
          <option value="">كل الأسواق</option>
          {markets.map((m) => (
            <option key={m.slug} value={m.slug}>{m.name}</option>
          ))}
        </select>
      )}

      {!isStores && (
        <>
          <select aria-label="الترتيب" className={selectClass} value={params.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="">الأحدث</option>
            <option value="popular">الأكثر طلباً</option>
            <option value="price_asc">السعر: من الأقل</option>
            <option value="price_desc">السعر: من الأعلى</option>
          </select>

          <select aria-label="الحالة" className={selectClass} value={params.condition} onChange={(e) => update({ condition: e.target.value })}>
            <option value="">جديد ومستعمل</option>
            <option value="NEW">جديد فقط</option>
            <option value="USED">مستعمل فقط</option>
          </select>

          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm">
            <input
              type="checkbox"
              checked={params.offers === "1"}
              onChange={(e) => update({ offers: e.target.checked ? "1" : "" })}
              className="h-4 w-4 accent-brand-600"
            />
            عليها خصم
          </label>
        </>
      )}
    </div>
  );
}
