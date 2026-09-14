"use client";

import { useEffect, useMemo, useState } from "react";

type Store = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  market?: string | null;
  imageUrl?: string | null;
};
type City = { name: string };
type MarketMeta = { name: string; count: number };

const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default function StoresIndexPage() {
  // اقرأ الاستعلام مرة واحدة بطريقة آمنة للـSSR
  const initialQS = useMemo(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search
      ),
    []
  );
  const initialQ = initialQS.get("q") || "";
  const initialCity = initialQS.get("city") || "";
  const initialMarket = initialQS.get("market") || "";
  const initialHasImage = initialQS.get("img") === "1";

  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [market, setMarket] = useState(initialMarket);
  const [hasImageOnly, setHasImageOnly] = useState(initialHasImage);

  const [cities, setCities] = useState<City[]>([]);
  const [markets, setMarkets] = useState<MarketMeta[]>([]);

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMarkets, setLoadingMarkets] = useState(false);

  // helper: حدّث الـURL دون ريلود
  function pushQS(next: Partial<Record<string, string>>) {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    Object.entries(next).forEach(([k, v]) => {
      if (v && v.length) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    });
    if (hasImageOnly) u.searchParams.set("img", "1");
    else u.searchParams.delete("img");
    window.history.replaceState(
      null,
      "",
      `${u.pathname}?${u.searchParams.toString()}`
    );
  }

  // المدن
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API}/regions/cities`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: City[]) => {
        if (Array.isArray(data)) setCities(data);
      })
      .catch(() => setCities([]));
    return () => ctrl.abort();
  }, []);

  // الأسواق عند تغيير المدينة
  useEffect(() => {
    if (!city) {
      setMarkets([]);
      return;
    }
    const ctrl = new AbortController();
    setLoadingMarkets(true);
    fetch(`${API}/regions/markets?city=${encodeURIComponent(city)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MarketMeta[]) =>
        setMarkets((data || []).filter((m) => m?.name))
      )
      .catch(() => setMarkets([]))
      .finally(() => setLoadingMarkets(false));
    return () => ctrl.abort();
  }, [city]);

  // المتاجر
  async function loadStores() {
    setLoading(true);
    const qs = new URLSearchParams({
      limit: "24",
      hasImageOnly: hasImageOnly ? "true" : "false",
      ...(q ? { q } : {}),
      ...(city ? { city } : {}),
      ...(market ? { market } : {}),
    });
    try {
      const r = await fetch(`${API}/stores?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = (await r.json()) as Store[] | { items: Store[] };
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setStores(items);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, market, hasImageOnly]);

  useEffect(() => {
    pushQS({ q: q || "", city: city || "", market: market || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, market, hasImageOnly]);

  return (
    <div className="min-h-dvh bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">المتاجر</h1>
          <p className="text-gray-500">
            تصفّح المتاجر حسب المدينة والسوق أو بالبحث.
          </p>
        </header>

        {/* Filters */}
        <div className="rounded-2xl border bg-white p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="block text-xs text-gray-500 mb-1">بحث</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن متجر…"
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">
                المدينة
              </label>
              <input
                list="cities"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setMarket("");
                }}
                placeholder="اختر مدينة"
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
              />
              <datalist id="cities">
                {cities.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">السوق</label>
              <input
                list="markets"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder={
                  city
                    ? loadingMarkets
                      ? "…يُحمّل"
                      : "اختر سوق"
                    : "اختر مدينة أولاً"
                }
                disabled={!city || loadingMarkets}
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring disabled:opacity-50"
              />
              <datalist id="markets">
                {markets.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="md:col-span-1 flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasImageOnly}
                  onChange={(e) => setHasImageOnly(e.target.checked)}
                />
                بصور
              </label>
            </div>
          </div>
        </div>

        {/* Results */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {city
                ? `متاجر ${city}${market ? ` • ${market}` : ""}`
                : "كل المتاجر"}
            </h2>
            <button
              onClick={loadStores}
              className="text-sm underline text-sky-600"
            >
              تحديث
            </button>
          </div>

          {loading ? (
            <SkeletonGrid />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {stores.map((s) => (
                <a
                  key={s.id}
                  href={`/stores/${s.slug}`}
                  className="rounded-2xl bg-white p-3 shadow hover:shadow-md transition"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100">
                    {s.imageUrl && (
                      <img
                        src={s.imageUrl}
                        alt={s.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {s.city}
                      {s.market ? ` • ${s.market}` : ""}
                    </div>
                  </div>
                </a>
              ))}
              {stores.length === 0 && !loading && (
                <div className="col-span-full rounded-xl border bg-white p-6 text-center text-gray-500">
                  لا توجد متاجر مطابقة للبحث/الفلاتر الحالية.
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white p-3 shadow">
          <div className="aspect-[4/3] w-full bg-gray-200 rounded-xl animate-pulse" />
          <div className="mt-3 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="mt-2 h-3 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  );
}
