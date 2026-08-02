import type { InsightsChannel } from "./insights.dto";
import type { DashboardPeriod } from "@/lib/validation/dashboard";

/**
 * DTOs live here, not in services, so the frontend can import the TYPE without
 * pulling a server module into its import graph.
 */
export interface DashboardSummaryDto {
  period: "today" | "week" | "month" | "last-month";
  /** Placeholder until Phase 8 — proves the full data path end to end. */
  accountCount: number;
  /** Modules whose figures aren't built yet, so the UI can say so honestly. */
  pendingModules: string[];
}

export interface SessionStateDto {
  valid: boolean;
}

/* ── The executive dashboard ─────────────────────────────────────────────── */

/**
 * ONE response for the whole screen.
 *
 * Four rows that must agree with each other cannot be four round trips: the
 * moment they are, row 1 and row 3 can be in flight against different seconds
 * and the owner reads two different days at once. Same reasoning as the
 * `{ result, stats }` list responses — MODULE-RECIPE §7.
 *
 * Every money field here was added up by PostgreSQL. Nothing in the service
 * that builds this shape adds two rupee figures together.
 */

export interface DashboardRangeDto {
  key: DashboardPeriod;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  /** How the trend line should read: `vsYesterday`, `vsLastWeek`, … */
  trendLabelKey: string;
}

export interface DashboardChannelRevenueDto {
  channel: InsightsChannel;
  revenue: number;
  collection: number;
  docCount: number;
}

/** Percent change against the previous window. `null` when there is no base. */
export type DashboardDelta = number | null;

export interface DashboardPeriodDto {
  revenue: number;
  revenueByChannel: DashboardChannelRevenueDto[];
  collection: number;
  expenses: number;
  expenseCount: number;
  topExpenseCategory: { id: string; name: string; amount: number } | null;
  /** Collection − expenses, subtracted inside PostgreSQL. §3.3.2 card 4. */
  net: number;
  deltas: {
    revenue: DashboardDelta;
    collection: DashboardDelta;
    expenses: DashboardDelta;
    net: DashboardDelta;
  };
}

/**
 * Row 2. A CURRENT position — never scoped by the period filter, which is why
 * it is a sibling of `period` here rather than a field inside it.
 */
export interface DashboardRiskDto {
  staffCash: number;
  staffCashOrders: number;
  staffCashStaff: number;
  staffCashOldestDays: number;

  partyDues: number;
  partyCount: number;
  partyOldestDays: number;

  coinDues: number;
  coinIssues: number;
  coinStaff: number;
  coinOldestDays: number;

  jarsOut: number;
  jarsStaff: number;
  jarsOrders: number;
  /** Jars held by a staff member whose oldest pending order is 7+ days old. */
  jarsOverdue: number;
  jarsOverdueStaff: number;
}

/** C1 — one row per day, already pivoted onto the three channels. */
export interface DashboardTrendPointDto {
  date: string;
  delivery: number;
  party: number;
  walkIn: number;
}

/** C2 — one row per month. `profit` is `revenue − expenses`, computed in SQL. */
export interface DashboardMonthPointDto {
  /** `'YYYY-MM'`. */
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

/** C3 — a ranked bar. Single hue: rank is not identity. */
export interface DashboardProductBarDto {
  productId: string;
  title: string;
  qtyBilled: number;
  qtyIssued: number;
  revenue: number;
}

/**
 * C4 — cash vs coins.
 *
 * `other` folds UPI, bank transfer and write-off together rather than opening a
 * fourth colour slot: DESIGN-STANDARDS §12.1 carries three categorical hues and
 * a fourth concurrent series is folded into "Other", never invented.
 */
export interface DashboardCollectionMixDto {
  cash: number;
  cashCount: number;
  coins: number;
  coinsCount: number;
  other: number;
  otherCount: number;
  total: number;
}

export interface DashboardScoreboardRowDto {
  staffId: string;
  staffCode: string;
  staffName: string;
  staffPhone: string;
  openOrders: number;
  cashOut: number;
  coinDues: number;
  jarsOut: number;
  /** Age of the oldest order still holding jars — drives the row's dot colour. */
  jarsOldestDays: number;
  daysOutstanding: number;
}

export interface DashboardCoinPositionRowDto {
  coinTypeId: string;
  name: string;
  coinsPerPacket: number;
  perCoinPrice: number;
  inStock: number;
  stockPackets: number;
  stockValue: number;
  outWithStaff: number;
  outValue: number;
  openIssues: number;
}

/** T3 — the merged action list. Severity first, then age. */
export type DashboardAttentionKind = "cash" | "jars" | "coins" | "party";
export type DashboardAttentionSeverity = "danger" | "warning" | "info";

export interface DashboardAttentionRowDto {
  id: string;
  kind: DashboardAttentionKind;
  severity: DashboardAttentionSeverity;
  /** The person or party this row is about. */
  subject: string;
  /** Rupees for the money rows, null where the row is about jars or a booking. */
  amount: number | null;
  quantity: number | null;
  /** `5 orders`, `PTY-000012 · Day 2 of 3` — the reference half of line 2. */
  reference: string | null;
  ageDays: number;
  href: string;
}

export interface ExecutiveDashboardDto {
  /** The IST business day `v_exec_summary` computed itself against. */
  asOfDate: string;
  /** When this payload was built — the `Updated 6:05 pm` stamp. */
  generatedAt: string;
  range: DashboardRangeDto;
  period: DashboardPeriodDto;
  risk: DashboardRiskDto;
  charts: {
    /** The window C1 actually covers — at least 30 days, even on `Today`. */
    trendFrom: string;
    trendTo: string;
    revenueTrend: DashboardTrendPointDto[];
    revenueVsExpenses: DashboardMonthPointDto[];
    /** `'YYYY-MM'` — the month C3 and C4 describe. */
    productMonth: string;
    topProducts: DashboardProductBarDto[];
    collectionMix: DashboardCollectionMixDto;
  };
  tables: {
    scoreboard: DashboardScoreboardRowDto[];
    coinPosition: DashboardCoinPositionRowDto[];
    attention: DashboardAttentionRowDto[];
    attentionTotal: number;
  };
}
