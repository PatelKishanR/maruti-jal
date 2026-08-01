/**
 * Month arithmetic for the register's month selector.
 *
 * A PLAIN module, not a `"use client"` one: `page.tsx` is a server component
 * and `expenses-table.tsx` is a client one, and both need these. A server
 * component may render a client component but may never CALL an export of one,
 * so shared pure helpers have to live on this side of the boundary.
 * See .claude/MODULE-RECIPE.md §7
 *
 * String arithmetic throughout, like `lib/dates.ts`: `new Date('2026-08')`
 * parses as UTC midnight, so stepping back a month through a `Date` can land in
 * the wrong one when it is read east of UTC — which is where every user of this
 * app is. See .claude/ARCHITECTURE.md §9.2
 */

/** `Aug 2026 ▾` offers this many months back, per design §3.3. */
export const MONTH_OPTION_COUNT = 24;

/** The `YYYY-MM` a business date falls in. */
export function monthOf(businessDate: string): string {
  return businessDate.slice(0, 7);
}

export function previousMonth(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return index === 1
    ? `${year - 1}-12`
    : `${year}-${String(index - 1).padStart(2, "0")}`;
}

export function nextMonth(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return index === 12
    ? `${year + 1}-01`
    : `${year}-${String(index + 1).padStart(2, "0")}`;
}

/**
 * `latest` and the `count - 1` months before it, newest first.
 *
 * If the URL carries a month older than the window (a bookmark from two years
 * ago), it is prepended rather than dropped — a select whose current value is
 * missing from its own option list renders blank, which reads as a bug.
 */
export function recentMonths(
  latest: string,
  count: number = MONTH_OPTION_COUNT,
  include?: string,
): string[] {
  const months: string[] = [];
  let cursor = latest;
  for (let i = 0; i < count; i += 1) {
    months.push(cursor);
    cursor = previousMonth(cursor);
  }

  if (include && !months.includes(include)) {
    return include > latest ? [include, ...months] : [...months, include];
  }
  return months;
}

/**
 * The first instant of a month, for `Intl` month formatting only.
 *
 * Pinned to UTC noon and always read back with `timeZone: "UTC"`, so no
 * timezone shift can move `2026-08` into July. NEVER use this for a business
 * date — those stay `'YYYY-MM-DD'` strings end to end.
 */
export function monthAsDate(month: string): Date {
  return new Date(`${month}-01T12:00:00Z`);
}
