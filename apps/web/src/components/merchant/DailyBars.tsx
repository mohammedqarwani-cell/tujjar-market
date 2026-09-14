"use client";

import { useState } from "react";
import { formatNumber } from "@lib/format";

const dayLabel = new Intl.DateTimeFormat("ar-u-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });

/** Single-series daily bar chart with a per-bar hover/tap tooltip. */
export function DailyBars({
  title,
  unit,
  color,
  data,
}: {
  title: string;
  unit: string;
  color: string;
  data: { day: string; value: number }[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const current = active != null ? data[active] : null;

  return (
    <figure className="rounded-card bg-surface p-5 ring-1 ring-line">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted">
          {current ? (
            <>
              {dayLabel.format(new Date(current.day))}: <strong className="text-ink">{formatNumber(current.value)}</strong> {unit}
            </>
          ) : (
            <>
              المجموع <strong className="text-ink">{formatNumber(total)}</strong> {unit}
            </>
          )}
        </span>
      </figcaption>

      <div dir="ltr" className="relative mt-4 h-40" onMouseLeave={() => setActive(null)}>
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
        ))}
        <span className="absolute -top-2 right-0 bg-surface ps-1 text-[10px] text-muted">{formatNumber(max)}</span>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <button
              key={d.day}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${dayLabel.format(new Date(d.day))}: ${d.value} ${unit}`}
              className="flex h-full min-w-0 flex-1 items-end outline-none"
            >
              <span
                className="block w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: `${Math.max(d.value ? 3 : 0, (d.value / max) * 100)}%`,
                  background: color,
                  opacity: active == null || active === i ? 1 : 0.35,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <div dir="ltr" className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{data[0] && dayLabel.format(new Date(data[0].day))}</span>
        <span>{data.at(-1) && dayLabel.format(new Date(data.at(-1)!.day))}</span>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted">عرض كجدول</summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="w-full text-xs">
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-b border-line/60">
                  <td className="py-1">{dayLabel.format(new Date(d.day))}</td>
                  <td className="py-1 text-left font-medium">{formatNumber(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
