"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PUBLIC_API } from "@lib/api";
import { timeAgo } from "@lib/format";
import type { VerificationLevel } from "@lib/types";
import { Portal } from "@components/ui/Portal";
import { StoreAvatar } from "@components/catalog/StoreAvatar";
import { VerifiedMark } from "@components/catalog/VerificationBadge";
import { XIcon } from "@components/ui/icons";

type StoryStore = { slug: string; name: string; logoUrl: string | null; verificationLevel: VerificationLevel };
export type StoryItem = { id: string; text: string | null; images: string[]; videoUrl: string | null; createdAt: string; product: { id: string; title: string } | null };
export type StoryGroup = { store: StoryStore; items: StoryItem[] };

const SEEN_KEY = "tj_seen_stories";
const SLIDE_MS = 6000;

const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
};

/** Full-screen viewer: one shop's statuses, advancing on their own like any status feed. */
function Viewer({ groups, start, onClose }: { groups: StoryGroup[]; start: number; onClose: () => void }) {
  const [group, setGroup] = useState(start);
  const [index, setIndex] = useState(0);
  const current = groups[group];
  const item = current?.items[index];
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!item) return;
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), item.id])].slice(-300)));
    } catch {}
    fetch(`${PUBLIC_API}/feed/${item.id}/view`, { method: "POST", keepalive: true, credentials: "omit", headers: { "X-Client": "web" } }).catch(() => undefined);
  }, [item]);

  const next = () => {
    if (!current) return onClose();
    if (index + 1 < current.items.length) setIndex(index + 1);
    else if (group + 1 < groups.length) {
      setGroup(group + 1);
      setIndex(0);
    } else onClose();
  };

  const previous = () => {
    if (index > 0) setIndex(index - 1);
    else if (group > 0) {
      setGroup(group - 1);
      setIndex(0);
    }
  };

  // A picture moves on by itself; a video waits until it ends
  useEffect(() => {
    clearTimeout(timer.current);
    if (item && !item.videoUrl) timer.current = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") previous();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!current || !item) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex flex-col bg-ink">
        <div className="flex gap-1 p-2">
          {current.items.map((s, i) => (
            <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <span className={`block h-full bg-white ${i < index ? "w-full" : i === index ? "w-full animate-[story_6s_linear]" : "w-0"}`} />
            </span>
          ))}
        </div>

        <header className="flex items-center gap-3 px-3 pb-2 text-white">
          <StoreAvatar name={current.store.name} logoUrl={current.store.logoUrl} className="h-9 w-9 !rounded-full text-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link href={`/stores/${current.store.slug}`} className="truncate text-sm font-bold">{current.store.name}</Link>
              <VerifiedMark level={current.store.verificationLevel} size={13} />
            </div>
            <div className="text-[11px] text-white/70">{timeAgo(item.createdAt)}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="p-1 text-white/80">
            <XIcon size={22} />
          </button>
        </header>

        <div className="relative flex-1">
          {item.videoUrl ? (
            <video src={item.videoUrl} className="h-full w-full object-contain" autoPlay playsInline controls={false} onEnded={next} />
          ) : (
            <img src={item.images[0]} alt="" className="h-full w-full object-contain" />
          )}
          {/* Tap the sides to move, like every status viewer */}
          <button type="button" aria-label="السابق" onClick={previous} className="absolute inset-y-0 end-0 w-1/3" />
          <button type="button" aria-label="التالي" onClick={next} className="absolute inset-y-0 start-0 w-1/3" />
        </div>

        <footer className="space-y-2 p-4 text-white">
          {item.text && <p className="text-sm leading-7">{item.text}</p>}
          {item.product ? (
            <Link
              href={`/products/${item.product.id}`}
              onClick={() => fetch(`${PUBLIC_API}/feed/${item.id}/click`, { method: "POST", keepalive: true, credentials: "omit", headers: { "X-Client": "web" } }).catch(() => undefined)}
              className="press flex h-12 w-full items-center justify-center rounded-xl bg-white font-bold text-ink"
            >
              شوف المنتج واطلبه ←
            </Link>
          ) : (
            <Link href={`/stores/${current.store.slug}`} className="press flex h-12 w-full items-center justify-center rounded-xl bg-white/15 font-bold backdrop-blur">
              زُر المتجر ←
            </Link>
          )}
        </footer>
      </div>
    </Portal>
  );
}

/** The circles at the top: shops with a live status, unseen ones first. */
export function Stories({ groups }: { groups: StoryGroup[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => setSeen(readSeen()), [open]);

  if (!groups.length) return null;
  const isSeen = (g: StoryGroup) => g.items.every((i) => seen.includes(i.id));
  const ordered = [...groups].sort((a, b) => Number(isSeen(a)) - Number(isSeen(b)));

  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
        {ordered.map((group) => (
          <button
            key={group.store.slug}
            type="button"
            onClick={() => setOpen(groups.indexOf(group))}
            className="press flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center"
          >
            <span className={`relative rounded-full p-[2.5px] ${isSeen(group) ? "bg-line" : "story-ring"}`}>
              <span className="block rounded-full bg-canvas p-[2px]">
                <StoreAvatar name={group.store.name} logoUrl={group.store.logoUrl} className="h-14 w-14 !rounded-full text-xl" />
              </span>
            </span>
            <span className="line-clamp-2 text-[11px] font-medium leading-4 text-ink">{group.store.name}</span>
          </button>
        ))}
      </div>
      {open !== null && <Viewer groups={ordered} start={ordered.indexOf(groups[open])} onClose={() => setOpen(null)} />}
    </>
  );
}
