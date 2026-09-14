"use client";
import { useEffect, useState } from "react";
import { MetaService, type MetaItem } from "@services/meta.service";
import Skeleton from "@components/ui/skeleton";

export default function MarketsRow({ city }: { city?: string }) {
  const [data, setData] = useState<MetaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city) {
      setData([]);
      return;
    }
    setLoading(true);
    MetaService.markets(100, city)
      .then((m) => setData(m.filter((x) => x.name)))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [city]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">الأسواق القريبة</h2>
        <span className="text-sm text-gray-500">{city || "اختر مدينة"}</span>
      </div>

      {loading && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center shrink-0">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="mt-2 h-3 w-20 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {data.map((m) => (
            <a
              key={m.name!}
              href={`/?city=${encodeURIComponent(
                city || ""
              )}&market=${encodeURIComponent(m.name!)}`}
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
          {!data.length && city && (
            <div className="text-sm text-gray-500">لا توجد أسواق بعد</div>
          )}
          {!city && (
            <div className="text-sm text-gray-500">اختر مدينة لعرض الأسواق</div>
          )}
        </div>
      )}
    </section>
  );
}
