import type {
  CoinCirculationRow,
  CoinCirculationTotalsRow,
} from "@/lib/repositories/insights/coin-circulation.repository";
import type {
  DailySalesChannelTotalsRow,
  DailySalesRow,
  DailySalesTotalsRow,
  PeriodProfitRow,
  SalesChannel,
} from "@/lib/repositories/insights/daily-sales.repository";
import type { ExecSummaryRow } from "@/lib/repositories/insights/exec-summary.repository";
import type {
  ProductSalesLeaderRow,
  ProductSalesLifetimeRow,
  ProductSalesRow,
} from "@/lib/repositories/insights/product-sales.repository";
import type {
  StaffJarBalanceRow,
  StaffJarBalanceTotalsRow,
} from "@/lib/repositories/insights/staff-jar-balance.repository";
import type {
  StaffOutstandingRow,
  StaffOutstandingTotalsRow,
} from "@/lib/repositories/insights/staff-outstanding.repository";

/**
 * Plain shapes for the seven dashboard views.
 *
 * Same contract as every other DTO file: flat objects, no class instances, no
 * `Date`s — business dates stay `'YYYY-MM-DD'` strings end to end. The row
 * imports above are TYPE-ONLY, so nothing server-only is pulled into a client
 * component that imports these types. See ARCHITECTURE §4.1 rule 8.
 *
 * ── THE ONE THING THIS FILE EXISTS TO GET RIGHT ─────────────────────────────
 *
 * `numeric` columns arrive from `pg` as STRINGS. `data-source.ts` sets that
 * parser deliberately — `Number()` at the driver would reintroduce float error
 * on every rupee in the system — and entity columns undo it through the `money`
 * transformer. A raw query over a view has no entity and therefore no
 * transformer, so THIS is the transformer, and it runs exactly once, here.
 *
 * Skip it and `revenue + collection` is `"9304.00" + "1960.00"` →
 * `"9304.001960.00"`. That is not a type error, it renders as a number in a
 * card, and nobody notices until the figures are cited to a bank.
 */

/* ── Conversion, in one place ────────────────────────────────────────────── */

/**
 * `numeric` string → number, FOR DISPLAY.
 *
 * Every money column on these views is `COALESCE`d to zero by the view itself,
 * so `null` here means a genuinely absent figure and not a missing row.
 */
function money(value: string | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** Same, but a null stays null — `avg_realised_price` when nothing was billed. */
function moneyOrNull(value: string | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** `int4` already arrives as a number; this only guards a null aggregate. */
function count(value: number | null | undefined): number {
  return value ?? 0;
}

/* ── Staff ───────────────────────────────────────────────────────────────── */

export interface StaffOutstandingDto {
  staffId: string;
  staffCode: string;
  staffName: string;
  staffPhone: string;
  staffIsActive: boolean;
  /** Net dues across delivery orders. Negative means the staff overpaid. */
  orderDues: number;
  openOrderCount: number;
  oldestOrderDueDate: string | null;
  /** Net dues across coin issues. Negative means a refund is owed to him. */
  coinDues: number;
  openIssueCount: number;
  oldestIssueDueDate: string | null;
  /** `orderDues + coinDues`, added by PostgreSQL — never here. */
  totalDues: number;
  /** Age of the oldest open item, in days. */
  daysOutstanding: number;
}

export interface StaffOutstandingTotalsDto {
  orderDues: number;
  coinDues: number;
  totalDues: number;
  /** How many people owe anything at all. */
  staffWithBalance: number;
  openOrderCount: number;
  openIssueCount: number;
}

export interface StaffJarBalanceDto {
  staffId: string;
  staffCode: string;
  staffName: string;
  staffPhone: string;
  staffIsActive: boolean;
  jarsIssued: number;
  jarsReturnedEmpty: number;
  jarsReturnedFilled: number;
  jarsLost: number;
  jarsOut: number;
  /** Orders with jars still pending. */
  openOrderCount: number;
  oldestPendingDate: string | null;
  oldestPendingDays: number;
}

export interface StaffJarBalanceTotalsDto {
  jarsOut: number;
  jarsIssued: number;
  staffWithJars: number;
  openOrderCount: number;
}

export function toStaffOutstandingDto(
  row: StaffOutstandingRow,
): StaffOutstandingDto {
  return {
    staffId: row.staff_id,
    staffCode: row.staff_code,
    staffName: row.staff_name,
    staffPhone: row.staff_phone,
    staffIsActive: row.staff_is_active,
    orderDues: money(row.order_dues),
    openOrderCount: count(row.open_order_count),
    oldestOrderDueDate: row.oldest_order_due_date,
    coinDues: money(row.coin_dues),
    openIssueCount: count(row.open_issue_count),
    oldestIssueDueDate: row.oldest_issue_due_date,
    totalDues: money(row.total_dues),
    daysOutstanding: count(row.days_outstanding),
  };
}

export function toStaffOutstandingTotalsDto(
  row: StaffOutstandingTotalsRow,
): StaffOutstandingTotalsDto {
  return {
    orderDues: money(row.order_dues),
    coinDues: money(row.coin_dues),
    totalDues: money(row.total_dues),
    staffWithBalance: count(row.staff_with_balance),
    openOrderCount: count(row.open_order_count),
    openIssueCount: count(row.open_issue_count),
  };
}

export function toStaffJarBalanceDto(
  row: StaffJarBalanceRow,
): StaffJarBalanceDto {
  return {
    staffId: row.staff_id,
    staffCode: row.staff_code,
    staffName: row.staff_name,
    staffPhone: row.staff_phone,
    staffIsActive: row.staff_is_active,
    jarsIssued: count(row.jars_issued),
    jarsReturnedEmpty: count(row.jars_returned_empty),
    jarsReturnedFilled: count(row.jars_returned_filled),
    jarsLost: count(row.jars_lost),
    jarsOut: count(row.jars_out),
    openOrderCount: count(row.open_order_count),
    oldestPendingDate: row.oldest_pending_date,
    oldestPendingDays: count(row.oldest_pending_days),
  };
}

export function toStaffJarBalanceTotalsDto(
  row: StaffJarBalanceTotalsRow,
): StaffJarBalanceTotalsDto {
  return {
    jarsOut: count(row.jars_out),
    jarsIssued: count(row.jars_issued),
    staffWithJars: count(row.staff_with_jars),
    openOrderCount: count(row.open_order_count),
  };
}

/* ── Coins ───────────────────────────────────────────────────────────────── */

export interface CoinCirculationDto {
  coinTypeId: string;
  coinTypeName: string;
  perCoinPrice: number;
  coinsIssued: number;
  coinsReturned: number;
  coinsRedeemed: number;
  /** Out with staff, unreturned and unredeemed. */
  coinsInCirculation: number;
  valueInCirculation: number;
  openIssueCount: number;
  staffHoldingCount: number;
}

export interface CoinCirculationTotalsDto {
  coinsInCirculation: number;
  valueInCirculation: number;
  coinsIssued: number;
  coinsReturned: number;
  coinsRedeemed: number;
  openIssueCount: number;
}

export function toCoinCirculationDto(
  row: CoinCirculationRow,
): CoinCirculationDto {
  return {
    coinTypeId: row.coin_type_id,
    coinTypeName: row.coin_type_name,
    perCoinPrice: money(row.per_coin_price),
    coinsIssued: count(row.coins_issued),
    coinsReturned: count(row.coins_returned),
    coinsRedeemed: count(row.coins_redeemed),
    coinsInCirculation: count(row.coins_in_circulation),
    valueInCirculation: money(row.value_in_circulation),
    openIssueCount: count(row.open_issue_count),
    staffHoldingCount: count(row.staff_holding_count),
  };
}

export function toCoinCirculationTotalsDto(
  row: CoinCirculationTotalsRow,
): CoinCirculationTotalsDto {
  return {
    coinsInCirculation: count(row.coins_in_circulation),
    valueInCirculation: money(row.value_in_circulation),
    coinsIssued: count(row.coins_issued),
    coinsReturned: count(row.coins_returned),
    coinsRedeemed: count(row.coins_redeemed),
    openIssueCount: count(row.open_issue_count),
  };
}

/* ── Sales ───────────────────────────────────────────────────────────────── */

export type InsightsChannel = SalesChannel;

export interface DailySalesDto {
  businessDate: string;
  channel: InsightsChannel;
  /** Billed on this date. */
  revenue: number;
  /** Received on this date — a different date from the one that billed it. */
  collection: number;
  docCount: number;
}

export interface SalesTotalsDto {
  revenue: number;
  collection: number;
  docCount: number;
}

export interface SalesChannelTotalsDto extends SalesTotalsDto {
  channel: InsightsChannel;
}

/** Income, spend and the difference — all three computed by PostgreSQL. */
export interface PeriodProfitDto {
  income: number;
  expenses: number;
  profit: number;
}

export function toDailySalesDto(row: DailySalesRow): DailySalesDto {
  return {
    businessDate: row.business_date,
    channel: row.channel,
    revenue: money(row.revenue),
    collection: money(row.collection),
    docCount: count(row.doc_count),
  };
}

export function toSalesTotalsDto(row: DailySalesTotalsRow): SalesTotalsDto {
  return {
    revenue: money(row.revenue),
    collection: money(row.collection),
    docCount: count(row.doc_count),
  };
}

export function toSalesChannelTotalsDto(
  row: DailySalesChannelTotalsRow,
): SalesChannelTotalsDto {
  return { channel: row.channel, ...toSalesTotalsDto(row) };
}

export function toPeriodProfitDto(row: PeriodProfitRow): PeriodProfitDto {
  return {
    income: money(row.income),
    expenses: money(row.expenses),
    profit: money(row.profit),
  };
}

/* ── Products ────────────────────────────────────────────────────────────── */

export interface ProductSalesDto {
  productId: string;
  productCode: string;
  productTitle: string;
  currentBasePrice: number;
  /** First day of the month, `'YYYY-MM-01'`. */
  month: string;
  /** Jars that physically left. */
  qtyIssued: number;
  /** Jars that were charged for. Pair this with revenue, not `qtyIssued`. */
  qtyBilled: number;
  revenue: number;
  baseValue: number;
  /** `baseValue - revenue`. Negative means it went out above list price. */
  discountValue: number;
  /** Null when nothing was billed — the view refuses to divide by zero. */
  avgRealisedPrice: number | null;
  avgBasePrice: number | null;
  lineCount: number;
  documentCount: number;
}

export interface ProductSalesLifetimeDto {
  qtyIssued: number;
  qtyBilled: number;
  revenue: number;
  lineCount: number;
  documentCount: number;
  lastMonth: string | null;
}

export interface ProductSalesLeaderDto {
  productId: string;
  productTitle: string;
  qtyBilled: number;
  revenue: number;
}

export function toProductSalesDto(row: ProductSalesRow): ProductSalesDto {
  return {
    productId: row.product_id,
    productCode: row.product_code,
    productTitle: row.product_title,
    currentBasePrice: money(row.current_base_price),
    month: row.month,
    qtyIssued: count(row.qty_issued),
    qtyBilled: count(row.qty_billed),
    revenue: money(row.revenue),
    baseValue: money(row.base_value),
    discountValue: money(row.discount_value),
    avgRealisedPrice: moneyOrNull(row.avg_realised_price),
    avgBasePrice: moneyOrNull(row.avg_base_price),
    lineCount: count(row.line_count),
    documentCount: count(row.document_count),
  };
}

export function toProductSalesLifetimeDto(
  row: ProductSalesLifetimeRow,
): ProductSalesLifetimeDto {
  return {
    qtyIssued: count(row.qty_issued),
    qtyBilled: count(row.qty_billed),
    revenue: money(row.revenue),
    lineCount: count(row.line_count),
    documentCount: count(row.document_count),
    lastMonth: row.last_month,
  };
}

export function toProductSalesLeaderDto(
  row: ProductSalesLeaderRow,
): ProductSalesLeaderDto {
  return {
    productId: row.product_id,
    productTitle: row.product_title,
    qtyBilled: count(row.qty_billed),
    revenue: money(row.revenue),
  };
}

/* ── Executive summary ───────────────────────────────────────────────────── */

export interface ExecSummaryDto {
  /** Today as an IST business day — not the server's UTC date. */
  asOfDate: string;
  monthStart: string;

  revenueToday: number;
  revenueMtd: number;
  collectionToday: number;
  collectionMtd: number;

  receivableOrders: number;
  receivableCoins: number;
  receivableParty: number;
  totalReceivable: number;

  jarsOut: number;
  staffWithJarsOut: number;

  /** Coins in the company's own stock. */
  coinStockCoins: number;
  coinStockValue: number;
  /** Coins out with staff — the float. */
  coinFloatCoins: number;
  coinFloatValue: number;

  upcomingDeliveries7d: number;
  nextServiceDate: string | null;
}

export function toExecSummaryDto(row: ExecSummaryRow): ExecSummaryDto {
  return {
    asOfDate: row.as_of_date,
    monthStart: row.month_start,
    revenueToday: money(row.revenue_today),
    revenueMtd: money(row.revenue_mtd),
    collectionToday: money(row.collection_today),
    collectionMtd: money(row.collection_mtd),
    receivableOrders: money(row.receivable_orders),
    receivableCoins: money(row.receivable_coins),
    receivableParty: money(row.receivable_party),
    totalReceivable: money(row.total_receivable),
    jarsOut: count(row.jars_out),
    staffWithJarsOut: count(row.staff_with_jars_out),
    coinStockCoins: count(row.coin_stock_coins),
    coinStockValue: money(row.coin_stock_value),
    coinFloatCoins: count(row.coin_float_coins),
    coinFloatValue: money(row.coin_float_value),
    upcomingDeliveries7d: count(row.upcoming_deliveries_7d),
    nextServiceDate: row.next_service_date,
  };
}
