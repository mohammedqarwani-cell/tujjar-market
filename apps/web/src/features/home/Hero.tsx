"use client";
import { useEffect, useState } from "react";
import {
  getBrowserLocation,
  guessNearestCity,
  SUPPORTED_CITIES,
} from "@lib/geo";

export default function Hero({
  initialCity,
  onSearch,
  onUseCity,
  onOpenStore,
}: {
  initialCity?: string;
  onSearch: (q: string) => void;
  onUseCity: (city: string) => void;
  onOpenStore: () => void;
}) {
  const [q, setQ] = useState("");
  const [suggested, setSuggested] = useState<string | null>(null);

  useEffect(() => {
    if (initialCity) return;
    (async () => {
      const loc = await getBrowserLocation();
      if (!loc) return;
      const near = guessNearestCity(loc.lat, loc.lng, SUPPORTED_CITIES);
      if (near?.name) setSuggested(near.name);
    })();
  }, [initialCity]);

  return (
    <section className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 text-white p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">تُجّار ماركت</h1>
          <p className="mt-2 text-gray-200">
            اكتشف أسواق ومدن ومتاجر حقيقية — وابدأ البيع اليوم.
          </p>
        </div>

        <div className="w-full md:w-[420px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(q.trim());
            }}
            className="flex rounded-xl overflow-hidden bg-white"
          >
            <input
              className="flex-1 px-3 py-2 text-gray-900 outline-none"
              placeholder="ابحث عن منتج أو متجر…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="px-4 py-2 bg-amber-500 text-black font-semibold"
              type="submit"
            >
              ابحث
            </button>
          </form>

          <div className="mt-2 flex items-center gap-2 text-sm">
            {initialCity && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                {initialCity}
              </span>
            )}
            {suggested && !initialCity && (
              <button
                onClick={() => onUseCity(suggested)}
                className="underline decoration-dotted hover:text-amber-300"
              >
                استخدام موقعك المقترح: {suggested}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href="/stores"
          className="rounded-xl bg-white text-gray-900 px-4 py-2 font-semibold"
        >
          تصفّح المتاجر
        </a>
        <button
          onClick={onOpenStore}
          className="rounded-xl bg-amber-500 text-black px-4 py-2 font-semibold"
        >
          افتح متجرك الآن
        </button>
      </div>
    </section>
  );
}
