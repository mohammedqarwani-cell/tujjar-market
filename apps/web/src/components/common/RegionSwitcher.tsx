"use client";
import { useEffect, useState } from "react";
import {
  getBrowserLocation,
  guessNearestCity,
  SUPPORTED_CITIES,
} from "@lib/geo";

type Region = { code: string; name: string; cities: { name: string }[] };
const KEY = "user_region";

export default function RegionSwitcher() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(false);

  // تحميل المناطق من الـ API (مع حماية النوع)
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/regions`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRegions(data);
        else if (data && typeof data === "object")
          setRegions(Object.values(data));
        else setRegions([]);
      })
      .catch(() => setRegions([]));
  }, []);

  // تحميل الاختيار المخزّن
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      try {
        const obj = JSON.parse(saved);
        setCountry(obj.country || "");
        setCity(obj.city || "");
      } catch {}
    }

    // استمع لأحداث تغيير المنطقة
    const onChange = () => {
      const s = localStorage.getItem(KEY);
      if (s) {
        try {
          const o = JSON.parse(s);
          setCountry(o.country || "");
          setCity(o.city || "");
        } catch {}
      }
    };
    window.addEventListener("region-change", onChange);
    return () => window.removeEventListener("region-change", onChange);
  }, []);

  const currentCities = Array.isArray(regions)
    ? regions.find((r) => r.code === country)?.cities || []
    : [];

  function saveSelection() {
    localStorage.setItem(KEY, JSON.stringify({ country, city }));
    window.dispatchEvent(new CustomEvent("region-change"));
    setOpen(false);
  }

  async function useMyLocation() {
    const loc = await getBrowserLocation();
    if (!loc) return;
    const near = guessNearestCity(loc.lat, loc.lng, SUPPORTED_CITIES);
    if (!near) return;
    setCountry(near.country);
    setCity(near.name);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
      >
        {city || country
          ? `${city || ""} ${country ? `(${country})` : ""}`
          : "اختر المنطقة"}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded-2xl shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">اختيار الدولة والمدينة</div>
            <button
              onClick={useMyLocation}
              className="text-sm text-sky-600 underline"
            >
              استخدم موقعي
            </button>
          </div>

          <div className="space-y-3">
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setCity("");
              }}
              className="w-full border rounded-lg p-2"
            >
              <option value="">اختر الدولة</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>

            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!country}
              className="w-full border rounded-lg p-2"
            >
              <option value="">
                {country ? "اختر المدينة" : "اختر الدولة أولاً"}
              </option>
              {currentCities.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-3 py-1.5 rounded-lg bg-gray-100"
                onClick={() => setOpen(false)}
              >
                إلغاء
              </button>
              <button
                className="px-3 py-1.5 rounded-lg bg-black text-white"
                onClick={saveSelection}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
