"use client";
import { useEffect, useState } from "react";
import Skeleton from "@components/ui/skeleton";
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
      className="group w-56 shrink-0 rounded-2xl bg-white p-3 shadow hover:shadow-md transition"
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
        <h3 className="font-semibold truncate">{s.name}</h3>
        <p className="text-xs text-gray-500 truncate">
          {s.city}
          {s.market ? ` • ${s.market}` : ""}
        </p>
      </div>
    </a>
  );
}

export default function NearbyStoresRow({
  selectedCity,
}: {
  selectedCity?: string;
}) {
  const [city, setCity] = useState<string | undefined>(selectedCity);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCity) setCity(selectedCity);
  }, [selectedCity]);

  useEffect(() => {
    if (selectedCity) return;
    (async () => {
      const loc = await getBrowserLocation();
      if (!loc) return;
      const near = guessNearestCity(loc.lat, loc.lng, SUPPORTED_CITIES);
      if (near?.name) setCity(near.name);
    })();
  }, [selectedCity]);

  useEffect(() => {
    if (!city) {
      setStores([]);
      return;
    }
    setLoading(true);
    StoresService.byCity(city, 16, true)
      .then(setStores)
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, [city]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">متاجر بالقرب منك</h2>
        <span className="text-sm text-gray-500">{city || "حدد موقعك"}</span>
      </div>

      {loading && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-56 shrink-0">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <Skeleton className="mt-3 h-4 w-40 rounded" />
              <Skeleton className="mt-2 h-3 w-24 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && stores.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stores.map((s) => (
            <StoreCard key={s.id} s={s} />
          ))}
        </div>
      )}

      {!loading && stores.length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
          لا توجد متاجر في هذه المدينة حتى الآن.
        </div>
      )}
    </section>
  );
}
