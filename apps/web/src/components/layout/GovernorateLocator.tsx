"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCATE_EVENT, govDecided, markGovDecided, nearestGovernorate, setGovCookie, type GovPoint } from "@lib/gov";
import { PinIcon, XIcon } from "@components/ui/icons";

type Phase =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "done"; message: string }
  | { kind: "choose"; reason: string };

/**
 * On a first visit, finds the visitor's governorate from the device location and filters the
 * site to it. The position never leaves the browser: only the chosen governorate is kept, in a cookie.
 */
export function GovernorateLocator({ governorates, current }: { governorates: GovPoint[]; current: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const active = governorates.filter((g) => g.status === "ACTIVE");

  const choose = useCallback(
    (slug: string, message?: string) => {
      markGovDecided();
      setGovCookie(slug);
      setPhase(message ? { kind: "done", message } : { kind: "idle" });
      startTransition(() => router.refresh());
    },
    [router],
  );

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setPhase({ kind: "choose", reason: "اختر محافظتك لنعرض لك المتاجر القريبة منك" });
      return;
    }
    setPhase({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = nearestGovernorate(pos.coords.latitude, pos.coords.longitude, governorates);
        if (!nearest) {
          setPhase({ kind: "choose", reason: "يبدو أنك خارج سوريا. اختر المحافظة التي تريد تصفّح متاجرها" });
        } else if (nearest.status === "ACTIVE") {
          choose(nearest.slug, `نعرض لك متاجر ${nearest.name} حسب موقعك`);
        } else {
          choose("", `${nearest.name} قريباً على تُجّار ماركت. نعرض لك متاجر كل سوريا حالياً`);
        }
      },
      () => setPhase({ kind: "choose", reason: "لم نتمكن من تحديد موقعك. اختر محافظتك لنعرض لك المتاجر القريبة منك" }),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 3_600_000 },
    );
  }, [governorates, choose]);

  useEffect(() => {
    const onLocate = () => locate();
    window.addEventListener(LOCATE_EVENT, onLocate);
    // First visit only: nothing chosen yet on this device
    const timer = !current && !govDecided() ? setTimeout(locate, 800) : undefined;
    return () => {
      window.removeEventListener(LOCATE_EVENT, onLocate);
      if (timer) clearTimeout(timer);
    };
  }, [current, locate]);

  useEffect(() => {
    if (phase.kind !== "done") return;
    const t = setTimeout(() => setPhase({ kind: "idle" }), 6000);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase.kind === "idle") return null;

  if (phase.kind === "locating" || phase.kind === "done") {
    return (
      <div role="status" className="fixed inset-x-0 top-20 z-50 flex justify-center px-4">
        <div className="flex max-w-md items-center gap-2.5 rounded-full bg-ink px-4 py-2.5 text-sm text-canvas shadow-lg">
          <PinIcon size={16} className={phase.kind === "locating" ? "animate-pulse text-brand-200" : "text-brand-200"} />
          <span>{phase.kind === "locating" ? "نحدد محافظتك لنعرض لك المتاجر القريبة…" : phase.message}</span>
          {phase.kind === "done" && (
            <button type="button" onClick={() => setPhase({ kind: "idle" })} aria-label="إغلاق" className="ms-1 text-canvas/70 hover:text-canvas">
              <XIcon size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-3 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="gov-chooser-title" className="w-full max-w-md rounded-card bg-surface p-5 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="gov-chooser-title" className="flex items-center gap-2 text-lg font-bold">
              <PinIcon size={20} className="text-brand-600" /> اختر محافظتك
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">{phase.reason}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              markGovDecided();
              setPhase({ kind: "idle" });
            }}
            aria-label="إغلاق"
            className="rounded-full p-1.5 text-muted hover:bg-sand hover:text-ink"
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="mt-4 grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
          {active.map((g) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => choose(g.slug)}
              className="rounded-xl px-3 py-3 text-sm font-medium ring-1 ring-line transition hover:bg-brand-50 hover:ring-brand-200"
            >
              {g.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => choose("")}
            className="col-span-2 rounded-xl px-3 py-3 text-sm font-medium text-muted ring-1 ring-line hover:text-ink"
          >
            كل سوريا
          </button>
        </div>
        <button type="button" onClick={locate} className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-brand-700 hover:underline">
          <PinIcon size={15} /> حاول تحديد موقعي مرة أخرى
        </button>
      </div>
    </div>
  );
}
