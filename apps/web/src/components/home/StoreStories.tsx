import Link from "next/link";
import type { StoreCardData } from "@lib/types";
import { StoreAvatar } from "@components/catalog/StoreAvatar";

/** Stores as story circles; a coloured ring marks the ones that added products recently. */
export function StoreStories({ stores, fresh }: { stores: StoreCardData[]; fresh: Set<string> }) {
  const ordered = [...stores].sort((a, b) => Number(fresh.has(b.slug)) - Number(fresh.has(a.slug)));
  if (!ordered.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
      {ordered.map((s) => {
        const isFresh = fresh.has(s.slug);
        return (
          <Link key={s.id} href={`/stores/${s.slug}`} className="press flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center">
            <span className={`relative rounded-full p-[2.5px] ${isFresh ? "story-ring" : "bg-line"}`}>
              <span className="block rounded-full bg-canvas p-[2px]">
                <StoreAvatar name={s.name} logoUrl={s.logoUrl ?? s.coverUrl} className="h-14 w-14 !rounded-full text-xl" />
              </span>
              {isFresh && (
                <span className="absolute -bottom-1 start-1/2 -translate-x-1/2 rounded-full bg-danger px-1.5 text-[9px] font-bold leading-4 text-white ring-2 ring-canvas rtl:translate-x-1/2">
                  جديد
                </span>
              )}
            </span>
            <span className="line-clamp-2 text-[11px] font-medium leading-4 text-ink">{s.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
