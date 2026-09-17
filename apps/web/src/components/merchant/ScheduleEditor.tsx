"use client";

import { formatTime, type DayHours, type WeekSchedule } from "@lib/hours";

/** Saturday first, the usual week in Syria (stored with index 0 = Sunday). */
const ORDER = [6, 0, 1, 2, 3, 4, 5];
const NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const all = (d: DayHours): WeekSchedule => ({ days: Array.from({ length: 7 }, () => ({ ...d })) });

export const DEFAULT_SCHEDULE: WeekSchedule = {
  days: all({ closed: false, open: "09:00", close: "21:00" }).days.map((d, i) => (i === 5 ? { closed: true, open: "09:00", close: "21:00" } : d)),
};

const timeInput = "h-10 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-brand-500 disabled:opacity-40";

export function ScheduleEditor({ value, onChange }: { value: WeekSchedule | null; onChange: (v: WeekSchedule | null) => void }) {
  if (!value) {
    return (
      <div className="rounded-xl bg-sand/60 p-4 text-sm">
        <p className="text-muted">حدد أيام وساعات الدوام ليظهر للزبائن «مفتوح الآن» أو «مغلق» على متجرك.</p>
        <button type="button" onClick={() => onChange(DEFAULT_SCHEDULE)} className="mt-3 rounded-full bg-ink px-4 py-2 font-bold text-canvas">
          تحديد ساعات العمل
        </button>
      </div>
    );
  }

  const setDay = (index: number, patch: Partial<DayHours>) =>
    onChange({ days: value.days.map((d, i) => (i === index ? { ...d, ...patch } : d)) });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="py-1.5 text-muted">جاهز:</span>
        {[
          { label: "كل الأيام 9 ص – 9 م", v: all({ closed: false, open: "09:00", close: "21:00" }) },
          { label: "مغلق الجمعة", v: DEFAULT_SCHEDULE },
          { label: "كل الأيام 10 ص – 11 م", v: all({ closed: false, open: "10:00", close: "23:00" }) },
        ].map((p) => (
          <button key={p.label} type="button" onClick={() => onChange(p.v)} className="rounded-full px-3 py-1.5 ring-1 ring-line hover:ring-brand-200">
            {p.label}
          </button>
        ))}
      </div>
      <div className="divide-y divide-line/60 rounded-xl ring-1 ring-line">
        {ORDER.map((i) => {
          const d = value.days[i];
          return (
            <div key={i} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="w-20 text-sm font-medium">{NAMES[i]}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={!d.closed} onChange={(e) => setDay(i, { closed: !e.target.checked })} className="h-4 w-4 accent-brand-600" />
                مفتوح
              </label>
              <input type="time" value={d.open} disabled={d.closed} onChange={(e) => setDay(i, { open: e.target.value })} className={timeInput} aria-label={`${NAMES[i]}: يفتح`} dir="ltr" />
              <span className="text-xs text-muted">إلى</span>
              <input type="time" value={d.close} disabled={d.closed} onChange={(e) => setDay(i, { close: e.target.value })} className={timeInput} aria-label={`${NAMES[i]}: يغلق`} dir="ltr" />
              {!d.closed && d.close < d.open && <span className="text-[11px] text-muted">(حتى بعد منتصف الليل)</span>}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => onChange(null)} className="text-xs text-muted hover:text-danger">
        إزالة ساعات العمل
      </button>
    </div>
  );
}

/** Read-only weekly hours, Saturday first. */
export function ScheduleTable({ schedule }: { schedule: WeekSchedule }) {
  const today = new Date(Date.now() + 3 * 3600_000).getUTCDay();
  return (
    <ul className="space-y-1 text-sm">
      {ORDER.map((i) => {
        const d = schedule.days[i];
        return (
          <li key={i} className={`flex justify-between gap-4 rounded-lg px-2 py-1 ${i === today ? "bg-sand font-bold" : ""}`}>
            <span>{NAMES[i]}</span>
            <span className={d.closed ? "text-muted" : ""}>{d.closed ? "مغلق" : `${formatTime(d.open)} – ${formatTime(d.close)}`}</span>
          </li>
        );
      })}
    </ul>
  );
}
