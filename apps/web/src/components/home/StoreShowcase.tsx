"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PUBLIC_API } from "@lib/api";
import type { StoreCardData } from "@lib/types";
import { StoreAvatar } from "@components/catalog/StoreAvatar";
import { VerifiedMark } from "@components/catalog/VerificationBadge";
import { StarIcon } from "@components/ui/icons";

export type ShowcaseItem = { id: string; store: StoreCardData };

const GROUP = 3;
const EVERY_MS = 5500;

function countClick(id: string) {
  fetch(`${PUBLIC_API}/home/showcase/${id}/click`, { method: "POST", keepalive: true, credentials: "omit", headers: { "X-Client": "web" } }).catch(() => undefined);
}

function ShowcaseCard({ item, big, delay }: { item: ShowcaseItem; big: boolean; delay: number }) {
  const s = item.store;
  const place = [s.market?.name, s.governorate.name].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/stores/${s.slug}`}
      onClick={() => countClick(item.id)}
      style={{ animationDelay: `${delay}ms` }}
      className={`animate-showcase press group relative flex min-w-0 flex-col justify-end overflow-hidden rounded-card bg-olive-700 text-white shadow-card ring-1 ring-line ${big ? "row-span-2 min-h-[18rem] p-5 lg:min-h-[22rem]" : "min-h-[10.5rem] p-3.5"}`}
    >
      {s.coverUrl ? (
        <img src={s.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <div className="pattern-arches absolute inset-0 opacity-30 invert" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
      <div className="relative flex items-end gap-3">
        <StoreAvatar name={s.name} logoUrl={s.logoUrl} className={`shrink-0 !rounded-2xl ring-2 ring-white/80 ${big ? "h-16 w-16 text-2xl" : "h-11 w-11 text-lg"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`truncate font-bold ${big ? "text-2xl" : "text-base"}`}>{s.name}</span>
            <VerifiedMark level={s.verificationLevel} size={big ? 18 : 14} />
          </div>
          {big && s.tagline && <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/85">{s.tagline}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/80">
            {place && <span className="truncate">{place}</span>}
            {s.ratingCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <StarIcon size={12} className="text-brand-200" /> {s.ratingAvg.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      {big && (
        <span className="relative mt-4 inline-flex w-fit items-center gap-1 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-ink">
          زُر المتجر ←
        </span>
      )}
    </Link>
  );
}

/**
 * Stores on a paid visibility package, three cards at a time (one large, two small),
 * rotating together. Marked as sponsored so buyers know why they're here.
 */
export function StoreShowcase({ items, className = "" }: { items: ShowcaseItem[]; className?: string }) {
  const groups: ShowcaseItem[][] = [];
  for (let i = 0; i < items.length; i += GROUP) groups.push(items.slice(i, i + GROUP));
  // A short last group borrows from the first, so every turn shows three stores
  const last = groups[groups.length - 1];
  if (groups.length > 1 && last.length < GROUP) groups[groups.length - 1] = [...last, ...items.slice(0, GROUP - last.length)];

  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (groups.length < 2) return;
    const t = setInterval(() => {
      if (!paused.current && document.visibilityState === "visible") setIndex((i) => (i + 1) % groups.length);
    }, EVERY_MS);
    return () => clearInterval(t);
  }, [groups.length]);

  if (!items.length) return null;
  const group = groups[index % groups.length];

  return (
    <div
      className={className}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={() => (paused.current = true)}
      onTouchEnd={() => setTimeout(() => (paused.current = false), 4000)}
    >
      <div key={index} className={`grid gap-3 sm:gap-4 ${group.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {group.map((item, i) => (
          <ShowcaseCard key={item.id + i} item={item} big={i === 0 && group.length !== 2} delay={i * 120} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-muted">متاجر مُموَّلة</span>
        {groups.length > 1 && (
          <div className="flex gap-1.5">
            {groups.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`المجموعة ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-brand-600" : "w-1.5 bg-line"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
