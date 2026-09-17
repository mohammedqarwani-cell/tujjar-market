"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { openState } from "@lib/hours";
import { useSession } from "@lib/session";
import type { ProductCardData, StoreCardData } from "@lib/types";
import { StoreAvatar } from "@components/catalog/StoreAvatar";
import { ProductCard } from "@components/catalog/ProductCard";

const damascusNow = () => new Date(Date.now() + 3 * 3600_000);

/** "صباح الخير، محمد" with the time of day in Damascus. */
export function Greeting({ place }: { place: string }) {
  const { user } = useSession("web", { lazy: true });
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(damascusNow().getUTCHours()), []);
  const hello = hour === null ? "أهلاً" : hour < 12 ? "صباح الخير" : hour < 18 ? "نهارك سعيد" : "مساء الخير";
  return (
    <div>
      <p className="text-sm text-muted">
        {hello}
        {user ? `، ${user.name.split(" ")[0]}` : ""} 👋
      </p>
      <h1 className="mt-0.5 text-2xl font-bold leading-snug">
        شو بدك من <span className="text-brand-600">أسواق {place}</span> اليوم؟
      </h1>
    </div>
  );
}

/** Countdown for today's offers: to midnight in Damascus, or to a time the platform team set. */
export function Countdown({ until }: { until?: string | null }) {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      let secs: number;
      if (until) {
        secs = Math.floor((new Date(until).getTime() - Date.now()) / 1000);
        if (secs <= 0) return setLeft(null);
      } else {
        const now = damascusNow();
        secs = 86400 - (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds());
      }
      const pad = (n: number) => String(n).padStart(2, "0");
      const days = Math.floor(secs / 86400);
      const clock = `${pad(Math.floor((secs % 86400) / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
      setLeft(days ? `${days}ي ${clock}` : clock);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!left) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger">
      ⏱ ينتهي خلال <bdi dir="ltr" className="tabular-nums">{left}</bdi>
    </span>
  );
}

/** Stores open right now, with a pulsing dot. Rendered only in the browser (it depends on the clock). */
export function OpenNowRail({ stores, title = "مفتوح الآن" }: { stores: StoreCardData[]; title?: string }) {
  const [open, setOpen] = useState<{ store: StoreCardData; label: string }[] | null>(null);
  useEffect(() => {
    setOpen(
      stores
        .map((s) => ({ store: s, state: openState(s.openingSchedule) }))
        .filter((x) => x.state?.open)
        .map((x) => ({ store: x.store, label: x.state!.label.split(" · ")[1] ?? "" })),
    );
  }, [stores]);
  if (!open?.length) return null;
  return (
    <section className="reveal mx-auto max-w-6xl px-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-olive-500" />
          </span>
          {title}
        </h2>
        <Link href="/search?type=stores&open=1" className="text-sm font-medium text-brand-700">الكل ←</Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {open.map(({ store: s, label }) => (
          <Link key={s.id} href={`/stores/${s.slug}`} className="press flex w-60 shrink-0 items-center gap-3 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-line/60">
            <StoreAvatar name={s.name} logoUrl={s.logoUrl} className="h-12 w-12 text-lg" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{s.name}</span>
              <span className="block truncate text-xs text-muted">{s.market?.name ?? s.governorate.name}</span>
              <span className="mt-0.5 block text-[11px] font-medium text-olive-700">{label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------- recently viewed ----------

const KEY = "tj_recent";
const EVENT = "tujjar-recent";
let cachedRaw: string | null = null;
let cached: ProductCardData[] = [];
const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = raw ? (JSON.parse(raw) as ProductCardData[]) : [];
    }
  } catch {}
  return cached;
};

/** Remembers a product page visit on this device. */
export function RememberViewed({ product }: { product: ProductCardData }) {
  useEffect(() => {
    try {
      const next = [product, ...read().filter((p) => p.id !== product.id)].slice(0, 12);
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {}
  }, [product]);
  return null;
}

export function RecentlyViewed({ title = "شاهدتها مؤخراً" }: { title?: string }) {
  const items = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => cached,
  );
  if (items.length < 2) return null;
  return (
    <section className="reveal mx-auto max-w-6xl px-4">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {items.map((p) => (
          <div key={p.id} className="w-40 shrink-0 sm:w-48">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
