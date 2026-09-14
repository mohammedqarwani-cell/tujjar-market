"use client";
import { useEffect, useState } from "react";
import { MetaService, type MetaItem } from "@services/meta.service";

export default function MarketsScroll({ city }: { city: string }) {
  const [markets, setMarkets] = useState<MetaItem[]>([]);
  useEffect(() => {
    if (!city) {
      setMarkets([]);
      return;
    }
    MetaService.markets(100, city)
      .then((m) => setMarkets(m.filter((x) => x.name)))
      .catch(() => setMarkets([]));
  }, [city]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {markets.map((m) => (
        <a
          key={m.name!}
          href={`/?city=${encodeURIComponent(city)}&market=${encodeURIComponent(
            m.name!
          )}`}
          className="flex flex-col items-center shrink-0"
          title={`${m.name} (${m.count})`}
        >
          <div className="size-16 rounded-full bg-gray-100 ring-1 ring-black/5 flex items-center justify-center text-sm font-semibold">
            {m.name!.slice(0, 2)}
          </div>
          <div className="mt-2 w-24 truncate text-center text-xs text-gray-700">
            {m.name}
          </div>
        </a>
      ))}
      {markets.length === 0 && (
        <div className="text-gray-500 text-sm">اختر مدينة لعرض أسواقها</div>
      )}
    </div>
  );
}
