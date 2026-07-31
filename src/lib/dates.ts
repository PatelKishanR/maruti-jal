import { intlLocale, type Locale } from "@/i18n/config";

/**
 * Business dates are `'YYYY-MM-DD'` STRINGS end to end — never `Date`.
 *
 * The whole point: an order placed on 14 Aug in Ahmedabad must read as 14 Aug
 * for everyone, forever. A `Date` is an instant in time, so the moment it is
 * serialised, stored, or read in another timezone it can shift by a day. That
 * bug is silent, arrives at month end, and puts revenue in the wrong month.
 *
 * The arithmetic below is deliberately string-based for the same reason —
 * `new Date(iso)` parses as UTC midnight, so adding days near a DST boundary
 * or reading it back east of UTC can land on the wrong date.
 *
 * See .claude/ARCHITECTURE.md §9.2
 */

export const IST_TIMEZONE = "Asia/Kolkata";

/** Today in IST as `'YYYY-MM-DD'`. */
export function todayIST(): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isBusinessDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ];
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Add (or subtract) whole days. Pure string arithmetic — no Date involved. */
export function addDays(iso: string, days: number): string {
  let [y, m, d] = iso.split("-").map(Number);
  d += days;

  while (d > daysInMonth(y, m)) {
    d -= daysInMonth(y, m);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  while (d < 1) {
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
    d += daysInMonth(y, m);
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Every date from `from` to `to` inclusive.
 *
 * This is what generates a party order's schedule, so an off-by-one here is a
 * delivery that does or doesn't happen.
 */
export function eachDay(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cursor = from;
  // Bounded so a malformed input can't spin forever — 2 years of daily
  // deliveries is already far beyond any real event.
  for (let i = 0; cursor <= to && i < 800; i += 1) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** Whole days between two business dates. Negative if `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.UTC(...split(to)) - Date.UTC(...split(from));
  return Math.round(ms / 86_400_000);
}

function split(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

/** How many days ago, for ageing badges. */
export function daysAgo(iso: string): number {
  return daysBetween(iso, todayIST());
}

/** `14 Aug 2026`. Latin digits in both languages. */
export function formatDate(iso: string, locale: Locale): string {
  if (!isBusinessDate(iso)) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * `Today` / `Yesterday`, else the full date.
 *
 * Worth the branch: most rows the owner looks at are from the last two days,
 * and "Today" is read faster than a date that has to be compared with today's.
 */
export function formatDateRelative(
  iso: string,
  locale: Locale,
  labels: { today: string; yesterday: string },
): string {
  const diff = daysAgo(iso);
  if (diff === 0) return labels.today;
  if (diff === 1) return labels.yesterday;
  return formatDate(iso, locale);
}

/** `14 Aug 2026, 6:05 pm` in IST. */
export function formatDateTime(value: Date | string, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST_TIMEZONE,
  })
    .format(date)
    .replace(/\bAM\b/, "am")
    .replace(/\bPM\b/, "pm");
}

/** `6:05 pm` in IST. */
export function formatTime(value: Date | string, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST_TIMEZONE,
  })
    .format(date)
    .replace(/\bAM\b/, "am")
    .replace(/\bPM\b/, "pm");
}

/** `14–16 Aug 2026` — collapses the parts both ends share. */
export function formatDateRange(from: string, to: string, locale: Locale): string {
  if (from === to) return formatDate(from, locale);
  if (!isBusinessDate(from) || !isBusinessDate(to)) return "—";

  const [fy, fm] = from.split("-");
  const [ty, tm] = to.split("-");
  const fd = Number(from.slice(8));
  const td = Number(to.slice(8));

  if (fy === ty && fm === tm) {
    const tail = formatDate(to, locale);
    return `${fd}–${tail}`;
  }
  if (fy === ty) {
    const head = new Intl.DateTimeFormat(intlLocale(locale), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${from}T00:00:00Z`));
    return `${head} – ${formatDate(to, locale)}`;
  }
  return `${formatDate(from, locale)} – ${formatDate(to, locale)}`;
}

/** First and last day of a month, as business dates. */
export function monthBounds(iso: string): { from: string; to: string } {
  const [y, m] = iso.split("-").map(Number);
  return {
    from: `${y}-${String(m).padStart(2, "0")}-01`,
    to: `${y}-${String(m).padStart(2, "0")}-${daysInMonth(y, m)}`,
  };
}
