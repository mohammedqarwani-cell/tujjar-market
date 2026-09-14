"use client";
import { useEffect, useState } from "react";
import { StoresService } from "@services/stores.service";
import StoreAvatar from "@components/common/store-avatar";

export default function StoresScroll() {
  const [stores, setStores] = useState<any[]>([]);
  useEffect(() => {
    StoresService.list(20, true)
      .then(setStores)
      .catch(() => setStores([]));
  }, []);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {stores.map((s) => (
        <a
          key={s.id}
          href={`/stores/${s.slug}`}
          className="flex flex-col items-center shrink-0"
          title={s.name}
        >
          <StoreAvatar name={s.name} imageUrl={s.imageUrl} />
          <div className="mt-2 w-20 truncate text-center text-xs text-gray-700">
            {s.name}
          </div>
        </a>
      ))}
      {stores.length === 0 && (
        <div className="text-gray-500">No stores yet</div>
      )}
    </div>
  );
}
