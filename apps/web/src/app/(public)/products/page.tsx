"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string | null;
  store?: { slug?: string | null; name?: string | null } | null;
};
type City = { name: string };
type MarketMeta = { name: string; count: number };

type PageResp = {
  items: Product[];
  total: number;
  page: number;
  pages: number;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/+$/,
  ""
);
const apiUrl = (path: string) => {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${clean}` : clean;
};

export default function ProductsIndexPage() {
  // اقرأ الاستعلام مرة واحدة (آمن للـSSR)
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
  const initialCategory = initialQS.get("category") || "";
  const initialHasImage = initialQS.get("img") === "1";
  const initialPage = Math.max(1, Number(initialQS.get("page") || "1"));

  // الحالة
  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [market, setMarket] = useState(initialMarket);
  const [category, setCategory] = useState(initialCategory);
  const [hasImageOnly, setHasImageOnly] = useState(initialHasImage);
  const [page, setPage] = useState(initialPage);

  const [cities, setCities] = useState<City[]>([]);
  const [markets, setMarkets] = useState<MarketMeta[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);

  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 24;

  // مزامنة الرابط مع الفلاتر
  function syncQS() {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const setOrDel = (k: string, v: string) =>
      v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
    setOrDel("q", q);
    setOrDel("city", city);
    setOrDel("market", market);
    setOrDel("category", category);
    if (hasImageOnly) u.searchParams.set("img", "1");
    else u.searchParams.delete("img");
    u.searchParams.set("page", String(page));
    window.history.replaceState(
      null,
      "",
      `${u.pathname}?${u.searchParams.toString()}`
    );
  }

  // المدن
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(apiUrl("regions/cities"), { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((arr: City[]) => Array.isArray(arr) && setCities(arr))
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
    fetch(apiUrl(`regions/markets?city=${encodeURIComponent(city)}`), {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((arr: MarketMeta[]) =>
        setMarkets((arr || []).filter((m) => m?.name))
      )
      .catch(() => setMarkets([]))
      .finally(() => setLoadingMarkets(false));
    return () => ctrl.abort();
  }, [city]);

  // تحميل المنتجات
  async function loadProducts() {
    setLoading(true);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(q ? { q } : {}),
      ...(city ? { city } : {}),
      ...(market ? { market } : {}),
      ...(category ? { category } : {}),
      ...(hasImageOnly ? { hasImageOnly: "true" } : {}),
    });
    const ctrl = new AbortController();
    try {
      const r = await fetch(apiUrl(`products?${qs.toString()}`), {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      const resp = (await r.json()) as PageResp;
      setData(resp);
    } catch {
      setData({ items: [], total: 0, page: 1, pages: 1 });
    } finally {
      setLoading(false);
    }
    return () => ctrl.abort();
  }

  // أول تحميل + عند تغيّر الفلاتر/الصفحة
  useEffect(() => {
    const abort = loadProducts();
    return () => {
      if (typeof abort === "function") (abort as any)();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, market, category, hasImageOnly, page]);

  // مزامنة الاستعلام في الرابط
  useEffect(() => {
    syncQS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city, market, category, hasImageOnly, page]);

  // تغييرات الفلاتر
  function onCityChange(v: string) {
    setCity(v);
    setMarket("");
    setPage(1);
  }
  function onMarketChange(v: string) {
    setMarket(v);
    setPage(1);
  }
  function onCategoryChange(v: string) {
    setCategory(v);
    setPage(1);
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    loadProducts();
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-gray-500">
            تصفّح أحدث المنتجات من مختلف المتاجر أو رشّح حسب المدينة والسوق
            والفئة.
          </p>
        </header>

        {/* شريط الفلاتر */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border bg-white p-3 md:p-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* بحث */}
            <div className="md:col-span-4">
              <label className="block text-xs text-gray-500 mb-1">بحث</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن منتج…"
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
              />
            </div>

            {/* مدينة */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">
                المدينة
              </label>
              <input
                list="cities"
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                placeholder="اختر مدينة"
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
              />
              <datalist id="cities">
                {cities.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
            </div>

            {/* سوق */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">السوق</label>
              <input
                list="markets"
                value={market}
                onChange={(e) => onMarketChange(e.target.value)}
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

            {/* فئة */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">الفئة</label>
              <input
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                placeholder="مثال: Fashion / Electronics"
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
              />
            </div>

            {/* بصور فقط */}
            <div className="md:col-span-1 flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasImageOnly}
                  onChange={(e) => {
                    setHasImageOnly(e.target.checked);
                    setPage(1);
                  }}
                />
                بصور
              </label>
            </div>

            {/* زر تطبيق */}
            <div className="md:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-black text-white px-3 py-2"
              >
                ابحث
              </button>
            </div>
          </div>
        </form>

        {/* النتائج */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {city
                ? `منتجات ${city}${market ? ` • ${market}` : ""}${
                    category ? ` • ${category}` : ""
                  }`
                : "كل المنتجات"}
            </h2>
            <button
              onClick={loadProducts}
              className="text-sm underline text-sky-600"
            >
              تحديث
            </button>
          </div>

          {loading ? (
            <SkeletonGrid />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {(data?.items ?? []).map((p) => (
                  <a
                    key={p.id}
                    href={p.store?.slug ? `/stores/${p.store.slug}` : "#"}
                    className="rounded-2xl bg-white p-3 shadow hover:shadow-md transition"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-100">
                      {p.imageUrl && (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="font-semibold line-clamp-2">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.category}</div>
                      <div className="mt-1 font-bold">
                        {Number.isFinite(p.price)
                          ? Number(p.price).toLocaleString()
                          : p.price}{" "}
                        ل.س
                      </div>
                      {p.store?.name && (
                        <div className="mt-1 text-xs text-gray-500">
                          المتجر: {p.store.name}
                        </div>
                      )}
                    </div>
                  </a>
                ))}

                {(data?.items?.length ?? 0) === 0 && (
                  <div className="col-span-full rounded-xl border bg-white p-6 text-center text-gray-500">
                    لا توجد منتجات مطابقة للبحث/الفلاتر الحالية.
                  </div>
                )}
              </div>

              {(data?.pages ?? 1) > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {Array.from(
                    { length: data?.pages ?? 1 },
                    (_, i) => i + 1
                  ).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`px-3 py-1.5 rounded ${
                        page === n ? "bg-black text-white" : "bg-gray-100"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </>
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
          <div className="aspect-square w-full bg-gray-200 rounded-xl animate-pulse" />
          <div className="mt-3 h-4 bg-gray-200 rounded animate-pulse" />
          <div className="mt-2 h-3 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  );
}
