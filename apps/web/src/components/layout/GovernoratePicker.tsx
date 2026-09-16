"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PinIcon } from "@components/ui/icons";
import { LOCATE_EVENT, markGovDecided, setGovCookie } from "@lib/gov";
import type { Ref } from "@lib/types";

const LOCATE_OPTION = "__locate";

export function GovernoratePicker({ governorates, current }: { governorates: Ref[]; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={`relative flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface ps-3 pe-2 text-sm font-medium transition hover:border-brand-200 ${pending ? "opacity-60" : ""}`}
    >
      <PinIcon size={16} className="text-brand-600" />
      <span className="sr-only">المحافظة</span>
      <select
        value={current}
        onChange={(e) => {
          if (e.target.value === LOCATE_OPTION) {
            window.dispatchEvent(new Event(LOCATE_EVENT));
            return;
          }
          markGovDecided();
          setGovCookie(e.target.value);
          startTransition(() => router.refresh());
        }}
        className="max-w-[7.5rem] cursor-pointer appearance-none bg-transparent pe-4 outline-none"
      >
        <option value={LOCATE_OPTION}>📍 حسب موقعي</option>
        <option value="">كل سوريا</option>
        {governorates.map((g) => (
          <option key={g.slug} value={g.slug}>
            {g.name}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute end-2.5 text-muted" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </label>
  );
}
