import type { ReportPreset, ReportSlug } from "@/lib/validation/report";

/**
 * The seven reports, as flat shapes.
 *
 * WHAT IS AND IS NOT IN HERE. Figures only — no labels, no copy, no colour.
 * Every string the owner reads comes from the message catalogue in the page
 * that renders it, exactly as `dashboard.dto.ts` carries figures while
 * `dashboard-kpis.tsx` carries words. A DTO that carried its own headings would
 * make the report untranslatable and the catalogue unauditable.
 *
 * EVERY MONETARY FIGURE HERE WAS COMPUTED BY POSTGRESQL. Nothing in the report
 * service adds, subtracts or averages a rupee — see the header of
 * `report.service.ts`. Ratios and day counts are the documented exception.
 *
 * Business dates are `'YYYY-MM-DD'`; timestamps are ISO strings.
 */

/* ── Shared shell ────────────────────────────────────────────────────────── */

export interface ReportMetaDto {
  slug: ReportSlug;
  preset: ReportPreset;
  /** Inclusive bounds actually applied — never the raw query. */
  from: string;
  to: string;
  /** The single date, for reports that take one. */
  date: string;
  /** ISO. Printed on every page so an old copy cannot read as current. §12.1 */
  generatedAt: string;
  /** DATA rows only, excluding group, subtotal and total rows. §13.3 */
  rowCount: number;
  /** Whether this report gets a Print button and an A4 layout. §13.3 */
  printable: boolean;
  /** `DCS-2026-08-14`, `STF-000007`, `PTY-000012` — the footer's document code. */
  documentCode: string;
  /** Who or what the report is about — the print header's subject line. */
  subject: string | null;
  /** Second line under the subject: a phone number, an address, a code. */
  subjectMeta: string | null;
  /** True when a required filter is unset and nothing was run. §4.5 */
  awaitingSubject: boolean;
}

/* ── 1 · Daily collection sheet ──────────────────────────────────────────── */

export type CollectionGroupKey =
  | "DELIVERY"
  | "PARTY"
  | "WALK_IN"
  | "COIN_ISSUE";

export interface CollectionReceiptDto {
  id: string;
  /** ISO timestamp — the receipt time, rendered `09:20 am`. */
  receivedAt: string;
  group: CollectionGroupKey;
  /** `ORD-000131`, `DWS-000876`. */
  reference: string;
  referenceHref: string | null;
  /** Staff member, party or walk-in customer. Any script. */
  from: string;
  mode: string;
  amount: number;
  /** `OUT` is a refund; it is shown and it reduces the group total. */
  direction: "IN" | "OUT";
  note: string | null;
}

export interface CollectionGroupDto {
  key: CollectionGroupKey;
  receiptCount: number;
  total: number;
  rows: CollectionReceiptDto[];
}

export interface CollectionCoinRowDto {
  coinTypeId: string;
  name: string;
  perCoinPrice: number;
  coins: number;
  value: number;
}

export interface DailyCollectionReportDto {
  meta: ReportMetaDto;
  summary: {
    totalCollected: number;
    receiptCount: number;
    cash: number;
    cashCount: number;
    coins: number;
    coinsCount: number;
    coinCount: number;
    other: number;
    otherCount: number;
    expectedInDrawer: number;
  };
  groups: CollectionGroupDto[];
  coinsByType: CollectionCoinRowDto[];
  coinsTotal: { coins: number; value: number };
  reconciliation: {
    cash: number;
    upi: number;
    bank: number;
    writeOff: number;
    expectedInDrawer: number;
  };
  /**
   * Orders raised on this date that collected nothing — the difference between
   * "no activity" and "activity, no money", which §5.5 insists on stating.
   */
  ordersRaised: number;
  /** `v_daily_sales.collection` for the date. The cross-check, not a second source. */
  viewCollection: number;
  /** True when the requested date is in the future. §5.5 */
  future: boolean;
}

/* ── 2 · Staff outstanding statement ─────────────────────────────────────── */

export interface StaffStatementOrderRowDto {
  id: string;
  code: string;
  orderDate: string;
  total: number;
  paid: number;
  balance: number;
  paymentStatus: string;
  itemCount: number;
  quantity: number;
  ageDays: number;
  href: string;
}

export interface StaffStatementIssueRowDto {
  id: string;
  code: string;
  issueDate: string;
  coinsIssued: number;
  issuedValue: number;
  coinsReturned: number;
  returnedValue: number;
  paid: number;
  pending: number;
  ageDays: number;
  href: string;
}

export interface StaffStatementJarRowDto {
  id: string;
  productId: string;
  productTitle: string;
  orderId: string;
  orderCode: string;
  orderDate: string;
  qtyOut: number;
  daysOut: number;
  href: string;
}

export interface StaffOutstandingReportDto {
  meta: ReportMetaDto;
  staff: {
    id: string;
    code: string;
    name: string;
    phone: string;
    isActive: boolean;
  } | null;
  /**
   * The all-time position, straight off `v_staff_outstanding` and
   * `v_staff_jar_balance` — the same rows `/staff` reads, so the two screens
   * cannot disagree. Sections A and B below are RANGE-scoped.
   */
  summary: {
    totalOwed: number;
    orderBalances: number;
    coinDues: number;
    openOrderCount: number;
    openIssueCount: number;
    jarsOut: number;
    jarsOldestDays: number;
    daysOutstanding: number;
  };
  orders: {
    rows: StaffStatementOrderRowDto[];
    subtotal: { total: number; paid: number; balance: number };
    count: number;
    /** Balance owed on orders OUTSIDE the range. Zero means A ties to the band. */
    outOfRangeBalance: number;
  };
  coinIssues: {
    rows: StaffStatementIssueRowDto[];
    subtotal: { pending: number; paid: number };
    count: number;
    outOfRangePending: number;
  };
  /** Section C ignores the range on purpose — a jar out since June is still out. §6.3 */
  jars: {
    rows: StaffStatementJarRowDto[];
    totalQty: number;
    overdueQty: number;
  };
}

/* ── 3 · Coin reconciliation ─────────────────────────────────────────────── */

export interface CoinReconciliationRowDto {
  coinTypeId: string;
  name: string;
  perCoinPrice: number;
  coinsPerPacket: number;
  /** Balance carried into the window: Σ every ledger movement before `from`. */
  opening: number;
  /** Signed, as the ledger records them: issues negative, returns positive. */
  issued: number;
  returned: number;
  received: number;
  adjusted: number;
  /** `opening + issued + returned + received + adjusted`, added by PostgreSQL. */
  closing: number;
  closingValue: number;
  /** The ledger's own running balance at `to` — what `closing` is checked against. */
  ledgerBalance: number;
  /** `closing - ledgerBalance`. Zero means the window ties. */
  difference: number;
  reconciles: boolean;
  entryCount: number;
  /** `coin_types.balance_coins` today. Comparable only when `to` is today. */
  balanceNow: number;
  outWithStaff: number;
  href: string;
}

export interface CoinReconciliationReportDto {
  meta: ReportMetaDto;
  summary: {
    coinsInStock: number;
    valueInStock: number;
    outWithStaff: number;
    valueOutWithStaff: number;
    typeCount: number;
    tyingCount: number;
    reconciles: boolean;
  };
  rows: CoinReconciliationRowDto[];
  totals: {
    opening: number;
    issued: number;
    returned: number;
    received: number;
    adjusted: number;
    closing: number;
    closingValue: number;
  };
  adjustmentCount: number;
}

/* ── 4 · Party order statement ───────────────────────────────────────────── */

export interface PartyStatementItemDto {
  productId: string;
  productTitle: string;
  quantity: number;
  deliveredQuantity: number | null;
  unitPrice: number;
  lineTotal: number;
}

export interface PartyStatementDayDto {
  id: string;
  dayNo: number;
  serviceDate: string;
  status: string;
  assignedStaffName: string | null;
  deliveredAt: string | null;
  items: PartyStatementItemDto[];
  dayTotal: number;
}

export interface PartyStatementPaymentDto {
  id: string;
  paidOn: string;
  mode: string;
  note: string | null;
  isAdvance: boolean;
  amount: number;
  direction: "IN" | "OUT";
}

export interface PartyStatementReportDto {
  meta: ReportMetaDto;
  party: {
    id: string;
    code: string;
    name: string;
    phone: string;
    address: string;
    status: string;
    firstServiceDate: string | null;
    lastServiceDate: string | null;
    totalDays: number;
  } | null;
  summary: {
    totalPayable: number;
    received: number;
    outstanding: number;
    daysDelivered: number;
    daysTotal: number;
  };
  days: PartyStatementDayDto[];
  payments: PartyStatementPaymentDto[];
  paymentsTotal: number;
  /** Positive owed, negative refund due. Straight off the header rollup. */
  closingBalance: number;
}

/* ── 5 · Product movement ────────────────────────────────────────────────── */

export interface ProductMovementRowDto {
  productId: string;
  code: string;
  title: string;
  litres: number;
  isReturnable: boolean;
  basePrice: number;
  /** Units billed per channel. `walkIn` is always null — see the DTO note below. */
  delivery: number;
  party: number;
  walkIn: number | null;
  units: number;
  /** `units × litres`, a QUANTITY product and not money. */
  litresTotal: number;
  revenue: number;
  baseValue: number;
  discountValue: number;
  avgRate: number | null;
  avgBaseRate: number | null;
  /** Realised against base, as a percentage. Negative means below list. */
  variancePercent: number | null;
  href: string;
}

export interface ProductMovementReportDto {
  meta: ReportMetaDto;
  summary: {
    totalUnits: number;
    totalLitres: number;
    revenue: number;
    baseValue: number;
    discountValue: number;
    discountPercent: number | null;
  };
  rows: ProductMovementRowDto[];
  totals: {
    delivery: number;
    party: number;
    units: number;
    litres: number;
    revenue: number;
  };
  /**
   * `v_product_sales` keys on the MONTH, so a report over 05–20 Aug covers the
   * whole of August. The snapped window is stated rather than hidden.
   */
  monthFrom: string;
  monthTo: string;
  monthSnapped: boolean;
  /**
   * Walk-in revenue for the range, from `v_daily_sales`. It has no units and no
   * per-product split — `direct_sales` records an amount and nothing else — so
   * it is stated on its own instead of being folded into a units column.
   */
  walkInRevenue: number;
}

/* ── 6 · Profit & loss ───────────────────────────────────────────────────── */

export interface ProfitLossLineDto {
  key: string;
  /** Category name for expenses; null for a channel, which is a fixed key. */
  name: string | null;
  amount: number;
  /** Share of its own table's total, 1 decimal. A ratio, not a rupee figure. */
  percent: number;
  href: string;
}

export interface ProfitLossReportDto {
  meta: ReportMetaDto;
  summary: {
    income: number;
    expenses: number;
    profit: number;
    marginPercent: number | null;
  };
  income: { rows: ProfitLossLineDto[]; total: number };
  expenses: {
    rows: ProfitLossLineDto[];
    total: number;
    /** Categories that exist but spent nothing — the §10.4 footnote. */
    zeroCategoryCount: number;
  };
  net: {
    income: number;
    expenses: number;
    profit: number;
    marginPercent: number | null;
    days: number;
    /** Profit ÷ days, divided by PostgreSQL. */
    averagePerDay: number;
  };
  /** A period with income and no expenses is nearly always a data gap. §10.4 */
  expensesMissing: boolean;
  incomeMissing: boolean;
}

/* ── 7 · Jar reconciliation ──────────────────────────────────────────────── */

export interface JarMovementRowDto {
  productId: string;
  productTitle: string;
  issued: number;
  empty: number;
  filled: number;
  lost: number;
  stillOut: number;
  returnRatePercent: number | null;
  oldestDays: number;
  href: string;
}

export interface JarStaffGroupDto {
  staffId: string;
  staffCode: string;
  staffName: string;
  issued: number;
  empty: number;
  filled: number;
  lost: number;
  stillOut: number;
  returnRatePercent: number | null;
  oldestDays: number;
  href: string;
  rows: JarMovementRowDto[];
}

export interface JarReconciliationReportDto {
  meta: ReportMetaDto;
  summary: {
    issued: number;
    returned: number;
    empty: number;
    filled: number;
    writtenOff: number;
    stillOut: number;
    overdue: number;
    returnRatePercent: number | null;
  };
  groups: JarStaffGroupDto[];
  totals: {
    issued: number;
    empty: number;
    filled: number;
    lost: number;
    stillOut: number;
    returnRatePercent: number | null;
  };
  /** Jars out right now across the whole plant, from `v_staff_jar_balance`. */
  jarsOutNow: number;
}

/* ── The union the API returns ───────────────────────────────────────────── */

export type ReportResultDto =
  | ({ slug: "daily-collection" } & DailyCollectionReportDto)
  | ({ slug: "staff-outstanding" } & StaffOutstandingReportDto)
  | ({ slug: "coin-reconciliation" } & CoinReconciliationReportDto)
  | ({ slug: "party-statement" } & PartyStatementReportDto)
  | ({ slug: "product-movement" } & ProductMovementReportDto)
  | ({ slug: "profit-loss" } & ProfitLossReportDto)
  | ({ slug: "jar-reconciliation" } & JarReconciliationReportDto);

/* ── The launcher ────────────────────────────────────────────────────────── */

/**
 * `/reports` — the seven cards plus the bad news two of them carry.
 *
 * The alert footers are what stop the index being a menu: the owner opens coin
 * reconciliation because the card told him to, not because he remembered. §3.3
 */
export interface ReportIndexDto {
  generatedAt: string;
  alerts: {
    coinTypesTotal: number;
    coinTypesNotTying: number;
    jarsOverdue: number;
    jarsOverdueStaff: number;
  };
}
