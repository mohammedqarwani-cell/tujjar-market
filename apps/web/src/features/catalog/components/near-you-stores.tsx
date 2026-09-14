"use client";
import { useEffect, useState } from "react";
import { StoresService, type Store } from "@services/stores.service";
import {
  getBrowserLocation,
  guessNearestCity,
  SUPPORTED_CITIES,
} from "@lib/geo";

function StoreCard({ s }: { s: Store }) {
  return (
    <a
      href={`/stores/${s.slug}`}
      className="group rounded-2xl bg-white p-3 shadow hover:shadow-md transition block"
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100">
        {s.imageUrl && (
          <img
            src={s.imageUrl}
            alt={s.name}
            className="h-full w-full object-cover group-hover:scale-[1.02] transition"
          />
        )}
      </div>
      <div className="mt-3">
        <h3 className="font-semibold">{s.name}</h3>
        <p className="text-xs text-gray-500">
          {s.city}
          {s.market ? ` • ${s.market}` : ""}
        </p>
      </div>
    </a>
  );
}

export default function NearYouStores({
  selectedCity,
}: {
  selectedCity?: string;
}) {
  const [city, setCity] = useState<string | undefined>(selectedCity);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  // إن ما في مدينة مختارة، جرّب تحديد الموقع
  useEffect(() => {
    if (selectedCity) return;
    (async () => {
      const loc = await getBrowserLocation();
      if (!loc) return;
      const near = guessNearestCity(loc.lat, loc.lng, SUPPORTED_CITIES);
      if (near?.name) setCity(near.name);
    })();
  }, [selectedCity]);

  // جلب المتاجر حسب المدينة
  useEffect(() => {
    const cty = selectedCity || city;
    if (!cty) {
      setStores([]);
      return;
    }
    setLoading(true);
    StoresService.byCity(cty, 12, true)
      .then(setStores)
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, [selectedCity, city]);

  if (!selectedCity && !city) {
    return (
      <div className="text-sm text-gray-500">
        اسمح بتحديد الموقع أو اختر مدينة من الفلاتر لعرض المتاجر القريبة.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">بالقرب منك</h2>
        {(selectedCity || city) && (
          <span className="text-sm text-gray-500">{selectedCity || city}</span>
        )}
      </div>
      {loading ? (
        <div className="text-gray-500">جارٍ التحميل…</div>
      ) : stores.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {stores.map((s) => (
            <StoreCard key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
          لا توجد متاجر بعد
        </div>
      )}
    </div>
  );
}
