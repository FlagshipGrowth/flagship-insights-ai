/**
 * A plain "YYYY-MM-DD" date (no time/timezone) parsed via `new Date(iso)` is treated as UTC
 * midnight — formatting or comparing it directly then shifts by a day in any timezone behind
 * UTC (shows 9/19 for a stored 9/20 due date, for example). Parsing the Y/M/D parts into a
 * local Date instead avoids that round trip through UTC entirely.
 */
export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateOnly(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString();
}
