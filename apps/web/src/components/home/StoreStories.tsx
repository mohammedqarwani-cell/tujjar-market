import Link from "next/link";
import type { StoreCardData } from "@lib/types";
import { StoreAvatar } from "@components/catalog/StoreAvatar";

/**
 * Stores as story circles. Stores the platform team pinned come first with a ring and "مميز";
 * then (unless turned off) stores that added products recently, marked "جديد".
 */
export function StoreStories({
  stores,
  fresh,
  pinned = [],
  showAuto = true,
}: {
  stores: StoreCardData[];
  fresh: Set<string>;
  pinned?: StoreCardData[];
  showAuto?: boolean;
}) {
  const pinnedIds = new Set(pinned.map((s) => s.id));
  const auto = showAuto
    ? [...stores].filter((s) => !pinnedIds.has(s.id)).sort((a, b) => Number(fresh.has(b.slug)) - Number(fresh.has(a.slug)))
    : [];
  const ordered = [...pinned, ...auto];
  if (!ordered.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
      {ordered.map((s) => {
        const tag = pinnedIds.has(s.id) ? "مميز" : fresh.has(s.slug) ? "جديد" : null;
        return (
          <Link key={s.id} href={`/stores/${s.slug}`} className="press flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center">
            <span className={`relative rounded-full p-[2.5px] ${tag ? "story-ring" : "bg-line"}`}>
              <span className="block rounded-full bg-canvas p-[2px]">
                <StoreAvatar name={s.name} logoUrl={s.logoUrl ?? s.coverUrl} className="h-14 w-14 !rounded-full text-xl" />
              </span>
              {tag && (
                <span
                  className={`absolute -bottom-1 start-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[9px] font-bold leading-4 text-white ring-2 ring-canvas rtl:translate-x-1/2 ${tag === "مميز" ? "bg-brand-600" : "bg-danger"}`}
                >
                  {tag}
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
