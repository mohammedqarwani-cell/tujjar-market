"use client";
import { useEffect, useState } from "react";
import { MetaService, type MetaItem } from "@services/meta.service";
import {
  getBrowserLocation,
  guessNearestCity,
  SUPPORTED_CITIES,
} from "@lib/geo";

export type Filters = {
  q?: string;
  city?: string;
  market?: string;
  category?: string;
};

export default function FiltersBar({
  initial = {},
  onApply,
  onReset,
}: {
  initial?: Filters;
  onApply: (f: Filters) => void;
  onReset?: () => void;
}) {
  const [q, setQ] = useState(initial.q ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [market, setMarket] = useState(initial.market ?? "");
  const [category, setCategory] = useState(initial.category ?? "");

  const [cities, setCities] = useState<MetaItem[]>([]);
  const [markets, setMarkets] = useState<MetaItem[]>([]);
  const [categories, setCategories] = useState<MetaItem[]>([]);

  // ✅ حالة الاقتراح من الموقع
  const [geoSuggested, setGeoSuggested] = useState<{
    city: string;
    country: string;
  } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // تحميل القوائم الأساسية
  useEffect(() => {
    (async () => {
      try {
        const [cits, cats] = await Promise.all([
          MetaService.cities(100),
          MetaService.categories(30),
        ]);
        setCities(cits.filter((x) => x.name));
        setCategories(cats.filter((x) => x.name));
      } catch {
        setCities([]);
        setCategories([]);
      }
    })();
  }, []);

  // تحميل الأسواق (مع فلترة المدينة إن وُجدت)
  async function loadMarkets(selectedCity?: string) {
    try {
      const mrks = await MetaService.markets(100, selectedCity || undefined);
      setMarkets(mrks.filter((x) => x.name));
    } catch {
      setMarkets([]);
    }
  }

  // عندما يختار المستخدم مدينة يدويًا
  useEffect(() => {
    loadMarkets(city || undefined);
  }, [city]);

  // ✅ اكتشاف الموقع واقتراح مدينة
  useEffect(() => {
    (async () => {
      if (city) return; // لا تقترح لو المستخدم اختار مسبقًا
      setGeoLoading(true);
      const loc = await getBrowserLocation();
      setGeoLoading(false);
      if (!loc) return;
      const nearest = guessNearestCity(loc.lat, loc.lng, SUPPORTED_CITIES);
      if (nearest?.name)
        setGeoSuggested({ city: nearest.name, country: nearest.country });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply() {
    const f: Filters = {
      q: q || undefined,
      city: city || undefined,
      market: market || undefined,
      category: category || undefined,
    };
    const url = new URL(window.location.href);
    ["q", "city", "market", "category"].forEach((k) =>
      url.searchParams.delete(k)
    );
    Object.entries(f).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, String(v));
    });
    window.history.replaceState({}, "", url.toString());
    onApply(f);
  }

  function reset() {
    setQ("");
    setCity("");
    setMarket("");
    setCategory("");
    if (onReset) onReset();
    const url = new URL(window.location.href);
    ["q", "city", "market", "category"].forEach((k) =>
      url.searchParams.delete(k)
    );
    window.history.replaceState({}, "", url.toString());
    onApply({});
  }

  async function acceptGeoSuggestion() {
    if (!geoSuggested) return;
    setCity(geoSuggested.city);
    setMarket("");
    await loadMarkets(geoSuggested.city);
    requestAnimationFrame(apply);
  }

  return (
    <div className="space-y-2">
      {/* شريط اقتراح الموقع */}
      {geoSuggested && !city && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 p-2 text-sm">
          <span>
            رصدنا موقعك العام بالقرب من: <b>{geoSuggested.city}</b> (
            {geoSuggested.country}) . هل تريد استخدامها للفلاتر؟
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded bg-amber-600 text-white"
              onClick={acceptGeoSuggestion}
            >
              نعم
            </button>
            <button
              className="px-3 py-1 rounded bg-gray-200"
              onClick={() => setGeoSuggested(null)}
            >
              لاحقًا
            </button>
          </div>
        </div>
      )}

      {geoLoading && !city && (
        <div className="text-xs text-gray-500">جارٍ تحديد موقعك…</div>
      )}

      {/* نموذج الفلاتر */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white p-3 rounded-xl shadow"
      >
        <input
          className="border rounded-lg p-2 md:col-span-2"
          placeholder="ابحث عن منتج…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="border rounded-lg p-2"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">
            {cities.length ? "المدينة" : "...جارٍ التحميل"}
          </option>
          {cities.map((c) => (
            <option key={c.name!} value={c.name!}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>

        <select
          className="border rounded-lg p-2"
          value={market}
          onChange={(e) => setMarket(e.target.value)}
        >
          <option value="">
            {markets.length
              ? "السوق"
              : city
              ? "...جارٍ التحميل"
              : "اختر مدينة أولاً"}
          </option>
          {markets.map((m) => (
            <option key={m.name!} value={m.name!}>
              {m.name} ({m.count})
            </option>
          ))}
        </select>

        <select
          className="border rounded-lg p-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">
            {categories.length ? "الفئة" : "...جارٍ التحميل"}
          </option>
          {categories.map((cat) => (
            <option key={cat.name!} value={cat.name!}>
              {cat.name} ({cat.count})
            </option>
          ))}
        </select>

        <div className="md:col-span-5 flex gap-2">
          <button
            className="px-4 py-2 rounded bg-black text-white"
            type="submit"
          >
            تطبيق
          </button>
          <button
            className="px-4 py-2 rounded bg-gray-200"
            type="button"
            onClick={reset}
          >
            إعادة ضبط
          </button>
        </div>
      </form>
    </div>
  );
}
