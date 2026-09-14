export function paging(page?: string | number, pageSize?: string | number, max = 48) {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const s = Math.min(max, Math.max(1, Math.floor(Number(pageSize)) || 24));
  return { page: p, pageSize: s, skip: (p - 1) * s, take: s };
}

export function pageResult<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Today's date in Damascus time, as a UTC midnight Date for @db.Date columns. */
export function damascusDay(offsetDays = 0): Date {
  const d = new Date(Date.now() + 3 * 3600_000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}
