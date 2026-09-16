"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { PinIcon } from "@components/ui/icons";
import { LOCATE_EVENT, markGovDecided, setGovCookie } from "@lib/gov";
import type { Ref } from "@lib/types";

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-brand-600">
      <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Header governorate menu styled like the rest of the site (the native select looked foreign and clipped). */
export function GovernoratePicker({ governorates, current }: { governorates: Ref[]; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const currentName = governorates.find((g) => g.slug === current)?.name ?? "كل سوريا";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const pick = (slug: string) => {
    setOpen(false);
    if (slug === current) return;
    markGovDecided();
    setGovCookie(slug);
    startTransition(() => router.refresh());
  };

  const options = [{ slug: "", name: "كل سوريا" }, ...governorates];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`المحافظة: ${currentName}`}
        className={`flex h-10 items-center gap-1.5 rounded-full border bg-surface ps-3 pe-2.5 text-sm font-medium transition hover:border-brand-200 ${open ? "border-brand-300 ring-4 ring-brand-100" : "border-line"} ${pending ? "opacity-60" : ""}`}
      >
        <PinIcon size={16} className="shrink-0 text-brand-600" />
        <span className="max-w-[6.5rem] truncate">{currentName}</span>
        <svg className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute end-0 top-12 z-50 w-56 overflow-hidden rounded-2xl bg-surface p-1.5 text-ink shadow-xl ring-1 ring-line">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(LOCATE_EVENT));
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-bold text-brand-700 transition hover:bg-brand-50"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50">
              <PinIcon size={15} />
            </span>
            حدد محافظتي من موقعي
          </button>
          <div className="mx-2 my-1 h-px bg-line" />
          <ul id={listId} role="listbox" aria-label="المحافظة" className="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain">
            {options.map((g) => {
              const selected = g.slug === current;
              return (
                <li key={g.slug || "all"} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => pick(g.slug)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start text-sm transition hover:bg-sand ${selected ? "bg-sand/70 font-bold" : ""}`}
                  >
                    <span className={g.slug ? "" : "text-muted"}>{g.name}</span>
                    {selected && <Check />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
