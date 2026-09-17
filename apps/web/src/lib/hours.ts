/**
 * Weekly opening hours and "open now", in Damascus time.
 * Kept identical to apps/api/src/common/hours.ts so the site and the API always agree.
 */
export type DayHours = { closed: boolean; open: string; close: string };
/** Index 0 = Sunday … 6 = Saturday */
export type WeekSchedule = { days: DayHours[] };
export type OpenState = { open: boolean; label: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAMASCUS_OFFSET_MS = 3 * 3600_000;

export function isValidSchedule(value: unknown): value is WeekSchedule {
  if (!value || typeof value !== "object") return false;
  const days = (value as WeekSchedule).days;
  return (
    Array.isArray(days) &&
    days.length === 7 &&
    days.every(
      (d) =>
        d &&
        typeof d.closed === "boolean" &&
        typeof d.open === "string" &&
        typeof d.close === "string" &&
        (d.closed || (TIME.test(d.open) && TIME.test(d.close) && d.open !== d.close)),
    )
  );
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** "9 ص", "8:30 م", "12 م" */
export function formatTime(hhmm: string) {
  const [h, m] = [Number(hhmm.slice(0, 2)), hhmm.slice(3, 5)];
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m === "00" ? "" : `:${m}`} ${h < 12 ? "ص" : "م"}`;
}

/** Whether the store is open at `now`, with a short label such as "مفتوح الآن · يغلق 8 م". */
export function openState(schedule: WeekSchedule | null | undefined, now = new Date()): OpenState | null {
  if (!isValidSchedule(schedule)) return null;
  const local = new Date(now.getTime() + DAMASCUS_OFFSET_MS);
  const today = local.getUTCDay();
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const { days } = schedule;

  // Yesterday"s hours may run past midnight (e.g. 18:00–02:00)
  const y = days[(today + 6) % 7];
  if (!y.closed && minutes(y.close) < minutes(y.open) && nowMin < minutes(y.close)) {
    return { open: true, label: `مفتوح الآن · يغلق ${formatTime(y.close)}` };
  }
  const d = days[today];
  if (!d.closed) {
    const o = minutes(d.open);
    const c = minutes(d.close);
    const overnight = c < o;
    if (nowMin >= o && (overnight || nowMin < c)) return { open: true, label: `مفتوح الآن · يغلق ${formatTime(d.close)}` };
    if (nowMin < o) return { open: false, label: `مغلق · يفتح ${formatTime(d.open)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const next = days[(today + i) % 7];
    if (next.closed) continue;
    const when = i === 1 ? "غداً" : DAY_NAMES[(today + i) % 7];
    return { open: false, label: `مغلق · يفتح ${when} ${formatTime(next.open)}` };
  }
  return { open: false, label: "مغلق حالياً" };
}

/** schema.org openingHoursSpecification for search engines. */
export function openingHoursSpecification(schedule: WeekSchedule | null | undefined) {
  if (!isValidSchedule(schedule)) return undefined;
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return schedule.days.flatMap((d, i) =>
    d.closed ? [] : [{ "@type": "OpeningHoursSpecification", dayOfWeek: names[i], opens: d.open, closes: d.close }],
  );
}
