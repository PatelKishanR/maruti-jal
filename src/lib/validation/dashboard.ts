import { z } from "zod";
import { addDays, daysBetween, isBusinessDate, monthBounds, todayIST } from "@/lib/dates";

/**
 * Query params arrive as strings, so every schema here coerces and defaults.
 * Unknown keys are dropped by Zod rather than reaching a service.
 */
export const dashboardSummaryQuerySchema = z.object({
  period: z
    .enum(["today", "week", "month", "last-month"], {
      message: "common.invalidRequest",
    })
    .default("today"),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

/* ── The executive dashboard's period filter ─────────────────────────────── */

/**
 * The five segments of the global date filter — design/MODULES/08 §4.
 *
 * It scopes ROWS 1 AND 3 ONLY. Row 2 (money at risk) and row 4 (the operational
 * tables) are a current position, and dimming them with a period would tell the
 * owner that ₹1.85L of outstanding cash was earned today.
 */
export const DASHBOARD_PERIODS = [
  "today",
  "week",
  "month",
  "last-month",
  "custom",
] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** `'YYYY-MM-DD'` — business dates are strings end to end (ARCHITECTURE §9.2). */
const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isBusinessDate(value));

/**
 * A stale bookmark must degrade, never 422.
 *
 * `.catch(undefined)` on every member means `?period=quarter&from=lol` resolves
 * to Today rather than throwing the whole dashboard away — MODULE-RECIPE §2.
 */
export const dashboardQuerySchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).optional().catch(undefined),
  from: businessDate.optional().catch(undefined),
  to: businessDate.optional().catch(undefined),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** Ranges above this are a mis-typed URL, not a question. §4.4 */
const MAX_RANGE_DAYS = 366;

export interface DashboardRange {
  key: DashboardPeriod;
  from: string;
  to: string;
  /**
   * The immediately preceding window of the SAME length — what every trend on
   * row 1 is measured against, so `▲ 8.4%` always compares like with like.
   */
  previousFrom: string;
  previousTo: string;
}

/**
 * `?period=` → concrete bounds, resolved on the server.
 *
 * Pure string arithmetic through `lib/dates`, so it is safe in a client
 * component too: the page uses it to label the filter and to build the deep
 * links behind every figure without a second round trip.
 *
 * Future dates are clamped to today rather than rejected — there is no data
 * there, and a filter that errors is worse than one that shows the truth.
 */
export function resolveDashboardRange(
  query: DashboardQuery,
  today: string = todayIST(),
): DashboardRange {
  const key = query.period ?? "today";

  const window = ((): { from: string; to: string; key: DashboardPeriod } => {
    switch (key) {
      case "week": {
        // Monday of the current week through today — the owner's working week.
        const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
        return { from: addDays(today, -weekday), to: today, key };
      }
      case "month": {
        return { from: monthBounds(today).from, to: today, key };
      }
      case "last-month": {
        const anchor = addDays(monthBounds(today).from, -1);
        const bounds = monthBounds(anchor);
        return { from: bounds.from, to: bounds.to, key };
      }
      case "custom": {
        const from = query.from;
        const to = query.to;
        if (!from || !to || from > to || daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
          return { from: today, to: today, key: "today" };
        }
        return { from, to: to > today ? today : to, key };
      }
      case "today":
      default:
        return { from: today, to: today, key: "today" };
    }
  })();

  const length = daysBetween(window.from, window.to) + 1;
  const previousTo = addDays(window.from, -1);

  return {
    ...window,
    previousFrom: addDays(previousTo, -(length - 1)),
    previousTo,
  };
}

/**
 * The trend wording changes with the period — `vs yesterday` on Today,
 * `vs last week` on This week. The card would otherwise claim a month-long
 * comparison was a daily one. §3.3.2
 */
export const DASHBOARD_TREND_LABEL: Record<DashboardPeriod, string> = {
  today: "vsYesterday",
  week: "vsLastWeek",
  month: "vsLastMonth",
  "last-month": "vsPreviousMonth",
  custom: "vsPreviousPeriod",
};
