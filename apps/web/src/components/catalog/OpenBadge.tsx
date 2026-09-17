"use client";

import { useEffect, useState } from "react";
import { openState, type OpenState, type WeekSchedule } from "@lib/hours";

/** "مفتوح الآن / مغلق", computed in the visitor's browser so cached pages stay correct. */
export function OpenBadge({ schedule, variant = "pill" }: { schedule: WeekSchedule | null | undefined; variant?: "pill" | "text" }) {
  const [state, setState] = useState<OpenState | null>(null);

  useEffect(() => {
    const update = () => setState(openState(schedule));
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [schedule]);

  if (!state) return null;
  const [status, detail] = state.label.split(" · ");

  if (variant === "text") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${state.open ? "text-olive-700" : "text-muted"}`}>
        <span className={`h-2 w-2 rounded-full ${state.open ? "bg-olive-500" : "bg-danger/70"}`} aria-hidden />
        {status}
        {detail && <span className="font-normal text-muted">· {detail}</span>}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${state.open ? "bg-olive-50 text-olive-700 ring-olive-100" : "bg-sand text-muted ring-line"}`}
    >
      <span className={`h-2 w-2 rounded-full ${state.open ? "animate-pulse bg-olive-500" : "bg-danger/70"}`} aria-hidden />
      {status}
      {detail && <span className="font-medium opacity-80">· {detail}</span>}
    </span>
  );
}
