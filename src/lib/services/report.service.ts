import "server-only";
import { coinIssueRepository } from "@/lib/repositories/coin-issue.repository";
import { coinIssueItemRepository } from "@/lib/repositories/coin-issue-item.repository";
import { coinLedgerEntryRepository } from "@/lib/repositories/coin-ledger-entry.repository";
import { deliveryOrderRepository } from "@/lib/repositories/delivery-order.repository";
import { directSaleRepository } from "@/lib/repositories/direct-sale.repository";
import { expenseCategoryRepository } from "@/lib/repositories/expense-category.repository";
import { expenseRepository } from "@/lib/repositories/expense.repository";
import { orderItemRepository } from "@/lib/repositories/order-item.repository";
import { partyOrderRepository } from "@/lib/repositories/party-order.repository";
import { paymentRepository } from "@/lib/repositories/payment.repository";
import { productRepository } from "@/lib/repositories/product.repository";
import { staffRepository } from "@/lib/repositories/staff.repository";
import { coinTypeBalanceRepository } from "@/lib/repositories/insights/coin-type-balance.repository";
import { dailySalesRepository } from "@/lib/repositories/insights/daily-sales.repository";
import { productSalesRepository } from "@/lib/repositories/insights/product-sales.repository";
import { staffJarBalanceRepository } from "@/lib/repositories/insights/staff-jar-balance.repository";
import { staffOutstandingRepository } from "@/lib/repositories/insights/staff-outstanding.repository";
import { NotFoundError } from "@/lib/errors";
import { daysBetween, monthBounds, todayIST } from "@/lib/dates";
import { dashboardPaths } from "@/lib/api/routes.dashboard";
import {
  REPORT_DEFINITIONS,
  resolveReportFilters,
  type ReportFilters,
  type ReportQuery,
  type ReportSlug,
} from "@/lib/validation/report";
import {
  toSalesChannelTotalsDto,
  toStaffJarBalanceDto,
  toStaffOutstandingDto,
} from "@/lib/dto/insights.dto";
import type {
  CoinReconciliationReportDto,
  CoinReconciliationRowDto,
  CollectionGroupDto,
  CollectionGroupKey,
  CollectionReceiptDto,
  DailyCollectionReportDto,
  JarMovementRowDto,
  JarReconciliationReportDto,
  JarStaffGroupDto,
  PartyStatementDayDto,
  PartyStatementReportDto,
  ProductMovementReportDto,
  ProductMovementRowDto,
  ProfitLossLineDto,
  ProfitLossReportDto,
  ReportIndexDto,
  ReportMetaDto,
  ReportResultDto,
  StaffOutstandingReportDto,
  StaffStatementIssueRowDto,
  StaffStatementJarRowDto,
  StaffStatementOrderRowDto,
} from "@/lib/dto/report.dto";

/**
 * The seven reports. Spec: design/MODULES/09-reports.md
 *
 * WHY THIS FILE AND NOT `insights.service.ts`. That service is the thin DTO
 * face of the seven views and nothing else. A REPORT is a document: the staff
 * statement needs `v_staff_outstanding` plus open orders plus open coin issues
 * plus coin issue lines plus every jar still out. Composing them is a service's
 * job — "one service, several repositories" — and a service calling another
 * service is how the layering rule dies. Same split `dashboard.service.ts`
 * already makes. See .claude/ARCHITECTURE.md §4
 *
 * ── NOT ONE RUPEE IS ADDED UP IN THIS FILE ──────────────────────────────────
 *
 * Every total, subtotal, difference and average below was computed by
 * PostgreSQL, either inside a view or inside a repository aggregate. Where a
 * figure genuinely spans two relations — a day's cash is `payments` plus
 * `direct_sales`; profit is `v_daily_sales` minus `expenses` — the second
 * relation's total is BOUND INTO the first's query as a `numeric` so the
 * addition still happens in the database. That is the same contract
 * `dailySalesRepository.profitBetween` established, and it is the only reason
 * the collection sheet's drawer figure can be trusted against a physical count.
 *
 * The arithmetic that IS done here is, exhaustively:
 *   · counts of rows and jars — integers, never money
 *   · ratios and percentages — `returnRate`, `variancePercent`, `% of income`
 *   · day counts, through `lib/dates`
 *   · `units × litres`, a quantity product
 * Every one of those is called out at its site.
 *
 * ── A REPORT NEVER WRITES ───────────────────────────────────────────────────
 *
 * There is no create, update or delete in this file and there never will be.
 * §2's sixth principle: a report only reads, and every row links out to the
 * record that owns it.
 */

/* ── Constants ───────────────────────────────────────────────────────────── */

/** Ageing turns amber here and red at 15. DESIGN-STANDARDS §13. */
const OVERDUE_DAYS = 7;

/** The four bands of the collection sheet, in the fixed order §5.3 requires. */
const COLLECTION_GROUPS: CollectionGroupKey[] = [
  "DELIVERY",
  "PARTY",
  "WALK_IN",
  "COIN_ISSUE",
];

/* ── The launcher ────────────────────────────────────────────────────────── */

/**
 * `/reports` — the seven cards and the bad news two of them carry.
 *
 * The alert footers are what stop the index being a menu (§3.3), so they are
 * computed here rather than left to the card: the owner opens coin
 * reconciliation because the card told him to, not because he remembered to.
 *
 * The coin check asks the LEDGER, over the current month, which is the same
 * question `/reports/coin-reconciliation` answers when opened with its default
 * preset — the card and the report it links to therefore cannot disagree.
 */
export async function getReportIndex(): Promise<ReportIndexDto> {
  const today = todayIST();
  const month = monthBounds(today);

  const [ledger, balances, jarRows] = await Promise.all([
    coinLedgerEntryRepository.reconcileBetween(month.from, today, null),
    coinTypeBalanceRepository.findAll(),
    staffJarBalanceRepository.findAll(),
  ]);

  const jars = jarRows.map(toStaffJarBalanceDto);
  const overdue = jars.filter((row) => row.oldestPendingDays >= OVERDUE_DAYS);

  return {
    generatedAt: new Date().toISOString(),
    alerts: {
      coinTypesTotal: balances.length,
      coinTypesNotTying: ledger.filter((row) => row.difference !== 0).length,
      // Counts of jars, not money. §11.3
      jarsOverdue: overdue.reduce((total, row) => total + row.jarsOut, 0),
      jarsOverdueStaff: overdue.filter((row) => row.jarsOut > 0).length,
    },
  };
}

/* ── The dispatcher ──────────────────────────────────────────────────────── */

/**
 * Run one report.
 *
 * The slug is a validated enum by the time it arrives, so the switch is total
 * and a new report is a compile error until it is handled here.
 */
export async function runReport(
  slug: ReportSlug,
  query: ReportQuery,
): Promise<ReportResultDto> {
  const filters = resolveReportFilters(slug, query);

  switch (slug) {
    case "daily-collection":
      return { slug, ...(await dailyCollection(filters)) };
    case "staff-outstanding":
      return { slug, ...(await staffOutstanding(filters)) };
    case "coin-reconciliation":
      return { slug, ...(await coinReconciliation(filters)) };
    case "party-statement":
      return { slug, ...(await partyStatement(filters)) };
    case "product-movement":
      return { slug, ...(await productMovement(filters)) };
    case "profit-loss":
      return { slug, ...(await profitLoss(filters)) };
    case "jar-reconciliation":
      return { slug, ...(await jarReconciliation(filters)) };
  }
}

/* ── 1 · Daily collection sheet ──────────────────────────────────────────── */

/**
 * What came in on one date, from whom, in what form — and the figure that
 * should physically be in the drawer. §5
 *
 * FOUR SOURCES, ONE SHEET. Delivery, party and coin-issue receipts are rows in
 * `payments`; walk-ins are rows in `direct_sales` and have no payment record at
 * all. The sheet composes both, and the summary band's totals are computed by
 * one query that takes the walk-in half as a bound `numeric` — see
 * `paymentRepository.collectionSheetTotalsBetween`.
 */
async function dailyCollection(
  filters: ReportFilters,
): Promise<DailyCollectionReportDto> {
  const date = filters.date;
  const today = todayIST();
  const future = date > today;

  if (future) {
    // §5.5: a future date is refused with a reason, not run and shown as empty.
    return emptyCollectionSheet(filters, true);
  }

  const [receipts, walkIns, walkInTotal, contextTotals, coinRows, balances, viewRows, ordersRaised] =
    await Promise.all([
      paymentRepository.findBetween(date, date),
      directSaleRepository.findBetween(date, date),
      directSaleRepository.sumForDate(date),
      paymentRepository.totalsByContextBetween(date, date),
      paymentRepository.coinsReceivedBetween(date, date),
      coinTypeBalanceRepository.findAll(),
      dailySalesRepository.findByDate(date),
      deliveryOrderRepository.countRaisedOn(date),
    ]);

  // The walk-in half is bound into SQL rather than added here. See the header.
  const totals = await paymentRepository.collectionSheetTotalsBetween(
    date,
    date,
    walkInTotal.total.toFixed(2),
    walkInTotal.count,
  );

  // Resolve each receipt's reference and the name beside it. Three batched
  // lookups, not one per row — repositories never join across entities, so the
  // service zips. ARCHITECTURE §4.1 rule 4.
  const orderIds = unique(receipts.map((p) => p.orderId));
  const issueIds = unique(receipts.map((p) => p.coinIssueId));
  const partyIds = unique(receipts.map((p) => p.partyOrderId));

  const [orders, issues, parties] = await Promise.all([
    deliveryOrderRepository.findManyByIds(orderIds),
    coinIssueRepository.findManyByIds(issueIds),
    partyOrderRepository.findManyByIds(partyIds),
  ]);

  const staffIds = unique([
    ...orders.map((o) => o.staffId),
    ...issues.map((i) => i.staffId),
  ]);
  const staff = await staffRepository.findManyByIds(staffIds);
  const staffById = byId(staff);
  const orderById = byId(orders);
  const issueById = byId(issues);
  const partyById = byId(parties);
  const coinTypeById = new Map(
    balances.map((row) => [row.coin_type_id, row] as const),
  );

  const rows: CollectionReceiptDto[] = receipts.map((payment) => {
    const order = payment.orderId ? orderById.get(payment.orderId) : undefined;
    const issue = payment.coinIssueId
      ? issueById.get(payment.coinIssueId)
      : undefined;
    const party = payment.partyOrderId
      ? partyById.get(payment.partyOrderId)
      : undefined;

    const group: CollectionGroupKey =
      payment.contextType === "ORDER"
        ? "DELIVERY"
        : payment.contextType === "PARTY_ORDER"
          ? "PARTY"
          : "COIN_ISSUE";

    return {
      id: payment.id,
      receivedAt: payment.createdAt.toISOString(),
      group,
      reference: order?.code ?? issue?.code ?? party?.code ?? payment.code,
      referenceHref: order
        ? `/orders/${order.id}`
        : issue
          ? `/coins/issues/${issue.id}`
          : party
            ? `/party-orders/${party.id}`
            : null,
      from:
        (order ? staffById.get(order.staffId)?.name : undefined) ??
        (issue ? staffById.get(issue.staffId)?.name : undefined) ??
        party?.partyName ??
        "—",
      mode: payment.mode,
      amount: payment.amount,
      direction: payment.direction,
      note: payment.note,
    };
  });

  for (const sale of walkIns) {
    rows.push({
      id: sale.id,
      receivedAt: sale.soldAt.toISOString(),
      group: "WALK_IN",
      reference: sale.code,
      referenceHref: `/direct-sales/${sale.id}`,
      from: sale.customerName,
      mode: sale.mode,
      amount: sale.amount,
      direction: "IN",
      note: sale.note,
    });
  }

  const contextTotal = new Map(
    contextTotals.map((row) => [row.contextType, row] as const),
  );

  /**
   * All four bands render even when empty — `— no receipts` is information, and
   * a missing band reads as a printing fault. §5.3
   */
  const groups: CollectionGroupDto[] = COLLECTION_GROUPS.map((key) => {
    const source =
      key === "DELIVERY"
        ? contextTotal.get("ORDER")
        : key === "PARTY"
          ? contextTotal.get("PARTY_ORDER")
          : key === "COIN_ISSUE"
            ? contextTotal.get("COIN_ISSUE")
            : undefined;

    return {
      key,
      receiptCount:
        key === "WALK_IN" ? walkInTotal.count : (source?.receipts ?? 0),
      total: key === "WALK_IN" ? walkInTotal.total : (source?.total ?? 0),
      rows: rows
        .filter((row) => row.group === key)
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)),
    };
  });

  const coinsByType = coinRows
    .map((row) => {
      const type = coinTypeById.get(row.coinTypeId);
      return {
        coinTypeId: row.coinTypeId,
        name: type?.coin_type_name ?? "—",
        perCoinPrice: Number(type?.per_coin_price ?? 0),
        coins: row.coins,
        value: row.value,
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    meta: meta(filters, rows.length, {
      documentCode: `DCS-${date}`,
      subject: null,
      subjectMeta: null,
    }),
    summary: {
      totalCollected: totals.total,
      receiptCount: totals.receipts,
      cash: totals.cash,
      cashCount: totals.cashReceipts,
      coins: totals.coins,
      coinsCount: totals.coinsReceipts,
      coinCount: totals.coinCount,
      other: totals.other,
      otherCount: totals.otherReceipts,
      expectedInDrawer: totals.expectedInDrawer,
    },
    groups,
    coinsByType,
    coinsTotal: { coins: totals.coinCount, value: totals.coins },
    reconciliation: {
      cash: totals.cash,
      upi: totals.upi,
      bank: totals.bank,
      writeOff: totals.writeOff,
      expectedInDrawer: totals.expectedInDrawer,
    },
    ordersRaised,
    /**
     * The cross-check, and deliberately NOT a second source for the headline.
     * `v_daily_sales` collection covers delivery, party and walk-in — it
     * excludes coin issue settlements, which are a stock movement rather than
     * a sale (DashboardViews migration, view 5). The two agreeing on a day
     * with no coin settlements is the reconciliation this line exists for.
     */
    viewCollection: viewRows.reduce(
      (total, row) => total + Number(row.collection),
      0,
    ),
    future: false,
  };
}

function emptyCollectionSheet(
  filters: ReportFilters,
  future: boolean,
): DailyCollectionReportDto {
  return {
    meta: meta(filters, 0, {
      documentCode: `DCS-${filters.date}`,
      subject: null,
      subjectMeta: null,
    }),
    summary: {
      totalCollected: 0,
      receiptCount: 0,
      cash: 0,
      cashCount: 0,
      coins: 0,
      coinsCount: 0,
      coinCount: 0,
      other: 0,
      otherCount: 0,
      expectedInDrawer: 0,
    },
    groups: COLLECTION_GROUPS.map((key) => ({
      key,
      receiptCount: 0,
      total: 0,
      rows: [],
    })),
    coinsByType: [],
    coinsTotal: { coins: 0, value: 0 },
    reconciliation: {
      cash: 0,
      upi: 0,
      bank: 0,
      writeOff: 0,
      expectedInDrawer: 0,
    },
    ordersRaised: 0,
    viewCollection: 0,
    future,
  };
}

/* ── 2 · Staff outstanding statement ─────────────────────────────────────── */

/**
 * Everything one staff member owes, in one document. §6
 *
 * THE SUMMARY BAND IS THE VIEW, NOT THE SECTIONS. `v_staff_outstanding` and
 * `v_staff_jar_balance` are the same rows `/staff` renders, so the band and
 * that screen are mathematically incapable of disagreeing — which is the whole
 * point of a statement handed over during a settlement conversation.
 *
 * Sections A and B are RANGE-scoped, so they can legitimately fall short of the
 * band. Rather than let the reader discover that, each section carries the
 * balance the range left behind, subtracted by PostgreSQL in the same query
 * that produced the subtotal.
 *
 * SECTION C IGNORES THE RANGE ENTIRELY. A jar out since June is still out
 * today; scoping it would print a smaller number than the one about to be
 * counted at the gate. §6.3 states this and the report repeats it on screen.
 */
async function staffOutstanding(
  filters: ReportFilters,
): Promise<StaffOutstandingReportDto> {
  if (!filters.staffId) return emptyStaffStatement(filters);

  const staff = await staffRepository.findById(filters.staffId);
  if (!staff) {
    throw new NotFoundError("Staff", { staffId: filters.staffId });
  }

  const [
    duesRow,
    jarRow,
    orders,
    orderTotals,
    issues,
    issueTotals,
    openLines,
    jarTotals,
  ] = await Promise.all([
    staffOutstandingRepository.findByStaffId(staff.id),
    staffJarBalanceRepository.findByStaffId(staff.id),
    deliveryOrderRepository.findOutstandingByStaffBetween(
      staff.id,
      filters.from,
      filters.to,
    ),
    deliveryOrderRepository.statementTotalsForStaff(
      staff.id,
      filters.from,
      filters.to,
    ),
    coinIssueRepository.findOutstandingByStaffBetween(
      staff.id,
      filters.from,
      filters.to,
    ),
    coinIssueRepository.statementTotalsForStaff(
      staff.id,
      filters.from,
      filters.to,
    ),
    orderItemRepository.findOpenLinesByStaff(staff.id),
    orderItemRepository.sumOpenJarsByStaff(staff.id, OVERDUE_DAYS),
  ]);

  const dues = duesRow ? toStaffOutstandingDto(duesRow) : null;
  const jars = jarRow ? toStaffJarBalanceDto(jarRow) : null;

  const [lineSummaries, issueLines] = await Promise.all([
    orderItemRepository.summariseByOrderIds(orders.map((o) => o.id)),
    coinIssueItemRepository.findByIssueIds(issues.map((i) => i.id)),
  ]);

  const summaryByOrder = new Map(
    lineSummaries.map((row) => [row.orderId, row] as const),
  );

  const orderRows: StaffStatementOrderRowDto[] = orders.map((order) => {
    const lines = summaryByOrder.get(order.id);
    return {
      id: order.id,
      code: order.code,
      orderDate: order.orderDate,
      total: order.totalAmount,
      // `paid_total - refunded` is what the header rollup nets to; both are
      // trigger-maintained columns, read here rather than re-derived.
      paid: order.paidTotalAmount - order.refundedAmount,
      balance: order.outstandingAmount,
      paymentStatus: order.paymentStatus,
      itemCount: lines?.itemCount ?? 0,
      quantity: lines?.quantity ?? 0,
      ageDays: Math.max(daysBetween(order.orderDate, todayIST()), 0),
      href: `/orders/${order.id}`,
    };
  });

  const issueRows: StaffStatementIssueRowDto[] = issues.map((issue) => {
    const lines = issueLines.filter((line) => line.coinIssueId === issue.id);
    return {
      id: issue.id,
      code: issue.code,
      issueDate: issue.issueDate,
      // Coin COUNTS, not money — the header rollup carries both.
      coinsIssued: issue.totalCoinsIssued,
      issuedValue: issue.totalAmount,
      coinsReturned: issue.totalCoinsReturned,
      returnedValue: issue.returnedValue,
      paid: issue.paidAmount - issue.refundedAmount,
      pending: issue.outstandingAmount,
      ageDays: Math.max(daysBetween(issue.issueDate, todayIST()), 0),
      href: `/coins/issues/${issue.id}${lines.length > 0 ? "" : ""}`,
    };
  });

  const jarRows: StaffStatementJarRowDto[] = openLines
    .map((line) => ({
      id: line.id,
      productId: line.productId,
      productTitle: line.productTitle,
      orderId: line.orderId,
      orderCode: line.order?.code ?? "—",
      orderDate: line.order?.orderDate ?? "",
      qtyOut: line.pendingQty,
      daysOut: line.order?.orderDate
        ? Math.max(daysBetween(line.order.orderDate, todayIST()), 0)
        : 0,
      href: `/orders/${line.orderId}`,
    }))
    // By product, then newest order first — §6.3's grouping rule.
    .sort(
      (a, b) =>
        a.productTitle.localeCompare(b.productTitle) ||
        b.orderDate.localeCompare(a.orderDate),
    );

  return {
    meta: meta(filters, orderRows.length + issueRows.length + jarRows.length, {
      documentCode: staff.code,
      subject: staff.name,
      subjectMeta: staff.phone,
    }),
    staff: {
      id: staff.id,
      code: staff.code,
      name: staff.name,
      phone: staff.phone,
      isActive: staff.isActive,
    },
    summary: {
      totalOwed: dues?.totalDues ?? 0,
      orderBalances: dues?.orderDues ?? 0,
      coinDues: dues?.coinDues ?? 0,
      openOrderCount: dues?.openOrderCount ?? 0,
      openIssueCount: dues?.openIssueCount ?? 0,
      jarsOut: jars?.jarsOut ?? 0,
      jarsOldestDays: jars?.oldestPendingDays ?? 0,
      daysOutstanding: dues?.daysOutstanding ?? 0,
    },
    orders: {
      rows: orderRows,
      subtotal: {
        total: orderTotals.total,
        paid: orderTotals.paid,
        balance: orderTotals.balance,
      },
      count: orderTotals.count,
      outOfRangeBalance: orderTotals.outOfRangeBalance,
    },
    coinIssues: {
      rows: issueRows,
      subtotal: { pending: issueTotals.pending, paid: issueTotals.paid },
      count: issueTotals.count,
      outOfRangePending: issueTotals.outOfRangePending,
    },
    jars: {
      rows: jarRows,
      totalQty: jarTotals.qty,
      overdueQty: jarTotals.overdueQty,
    },
  };
}

function emptyStaffStatement(
  filters: ReportFilters,
): StaffOutstandingReportDto {
  return {
    meta: meta(filters, 0, {
      documentCode: "STF",
      subject: null,
      subjectMeta: null,
    }),
    staff: null,
    summary: {
      totalOwed: 0,
      orderBalances: 0,
      coinDues: 0,
      openOrderCount: 0,
      openIssueCount: 0,
      jarsOut: 0,
      jarsOldestDays: 0,
      daysOutstanding: 0,
    },
    orders: {
      rows: [],
      subtotal: { total: 0, paid: 0, balance: 0 },
      count: 0,
      outOfRangeBalance: 0,
    },
    coinIssues: {
      rows: [],
      subtotal: { pending: 0, paid: 0 },
      count: 0,
      outOfRangePending: 0,
    },
    jars: { rows: [], totalQty: 0, overdueQty: 0 },
  };
}

/* ── 3 · Coin reconciliation ─────────────────────────────────────────────── */

/**
 * Opening + in − out = closing, per coin type, and whether it ties. §7
 *
 * TWO INDEPENDENT ANSWERS, COMPARED. `closing` re-sums every movement up to
 * `to` BY DATE; `ledgerBalance` is the running balance the ledger stamped on
 * its last row in `entry_seq` order. Same table, two routes, so their agreement
 * is worth printing — and their disagreement means either the running balance
 * is corrupt or an entry carries a date that contradicts its position in the
 * sequence. Both are things the owner needs told.
 *
 * `balanceNow` is a THIRD number and is shown as such: `coin_types.balance_coins`
 * is the live cache, so it only equals the window's closing when the window
 * ends today. Presenting it as the tie-breaker would make every historical
 * period look broken.
 *
 * Coin types with no ledger movement still appear, with their opening equal to
 * their closing. §7.5 calls that a valid and useful answer, not an empty state.
 */
async function coinReconciliation(
  filters: ReportFilters,
): Promise<CoinReconciliationReportDto> {
  const [ledger, balances, totals] = await Promise.all([
    coinLedgerEntryRepository.reconcileBetween(
      filters.from,
      filters.to,
      filters.coinTypeId,
    ),
    filters.coinTypeId
      ? coinTypeBalanceRepository.findByCoinTypeId(filters.coinTypeId)
      : coinTypeBalanceRepository.findAll(),
    coinTypeBalanceRepository.totals(),
  ]);

  const ledgerByType = new Map(ledger.map((row) => [row.coinTypeId, row]));

  const rows: CoinReconciliationRowDto[] = balances.map((type) => {
    const movement = ledgerByType.get(type.coin_type_id);
    const perCoinPrice = Number(type.per_coin_price);
    const closing = movement?.closing ?? type.balance_coins;

    return {
      coinTypeId: type.coin_type_id,
      name: type.coin_type_name,
      perCoinPrice,
      coinsPerPacket: type.coins_per_packet,
      opening: movement?.opening ?? type.balance_coins,
      issued: movement?.issued ?? 0,
      returned: movement?.returned ?? 0,
      received: movement?.received ?? 0,
      adjusted: movement?.adjusted ?? 0,
      closing,
      /**
       * A per-ROW display product, rounded to two decimals — exactly what
       * `coin-type.dto.ts` documents for the same figure and what
       * `dashboard.service.buildCoinPosition` does. The ledger has no
       * `balance_after_value` column to carry a running value, so there is no
       * SQL total to read instead. Every CROSS-ROW total on this report is
       * still a database aggregate.
       */
      closingValue: Math.round(closing * perCoinPrice * 100) / 100,
      ledgerBalance: movement?.ledgerBalance ?? type.balance_coins,
      difference: movement?.difference ?? 0,
      reconciles: (movement?.difference ?? 0) === 0,
      entryCount: movement?.entryCount ?? 0,
      balanceNow: type.balance_coins,
      outWithStaff: type.coins_in_circulation,
      href: dashboardPaths().coinType(type.coin_type_id),
    };
  });

  const sum = (pick: (row: CoinReconciliationRowDto) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  return {
    meta: meta(filters, rows.length, {
      documentCode: `CRC-${filters.from}`,
      subject: filters.coinTypeId ? (rows[0]?.name ?? null) : null,
      subjectMeta: null,
    }),
    summary: {
      coinsInStock: totals.balance_coins,
      valueInStock: Number(totals.stock_value),
      outWithStaff: totals.coins_in_circulation,
      valueOutWithStaff: Number(totals.value_at_risk),
      typeCount: rows.length,
      tyingCount: rows.filter((row) => row.reconciles).length,
      reconciles: rows.every((row) => row.reconciles),
    },
    rows,
    totals: {
      // Coin COUNTS. The one money figure below is a sum of per-row display
      // products and is labelled as such on the total row.
      opening: sum((row) => row.opening),
      issued: sum((row) => row.issued),
      returned: sum((row) => row.returned),
      received: sum((row) => row.received),
      adjusted: sum((row) => row.adjusted),
      closing: sum((row) => row.closing),
      closingValue: Number(totals.stock_value),
    },
    adjustmentCount: ledger.reduce((n, row) => n + row.adjustmentCount, 0),
  };
}

/* ── 4 · Party order statement ───────────────────────────────────────────── */

/**
 * The client-facing document: scheduled days, payments received, closing
 * balance. §8
 *
 * Every money figure comes from a trigger-maintained rollup — `total_amount`,
 * `paid_amount`, `outstanding_amount` on the header and `day_total` /
 * `line_total` on the schedule — never re-derived from lines. A statement that
 * disagreed with the booking screen beside it would be worse than no statement.
 */
async function partyStatement(
  filters: ReportFilters,
): Promise<PartyStatementReportDto> {
  if (!filters.partyOrderId) return emptyPartyStatement(filters);

  const order = await partyOrderRepository.findByIdWithSchedule(
    filters.partyOrderId,
  );
  if (!order) {
    throw new NotFoundError("Party order", {
      partyOrderId: filters.partyOrderId,
    });
  }

  const days = [...(order.days ?? [])].sort((a, b) =>
    a.serviceDate.localeCompare(b.serviceDate),
  );

  const [payments, staff] = await Promise.all([
    paymentRepository.findByPartyOrderId(order.id),
    staffRepository.findManyByIds(
      unique(days.map((day) => day.assignedStaffId)),
    ),
  ]);
  const staffById = byId(staff);

  const dayRows: PartyStatementDayDto[] = days.map((day, index) => ({
    id: day.id,
    dayNo: index + 1,
    serviceDate: day.serviceDate,
    status: day.deliveryStatus,
    assignedStaffName: day.assignedStaffId
      ? (staffById.get(day.assignedStaffId)?.name ?? null)
      : null,
    deliveredAt: day.deliveredAt ? day.deliveredAt.toISOString() : null,
    items: [...(day.items ?? [])]
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((item) => ({
        productId: item.productId,
        productTitle: item.productTitle,
        quantity: item.quantity,
        deliveredQuantity: item.deliveredQuantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    dayTotal: day.dayTotal,
  }));

  const deliveredCount = dayRows.filter(
    (day) => day.status === "DELIVERED",
  ).length;

  return {
    meta: meta(
      {
        ...filters,
        // The booking defines its own period; the header prints that, not a
        // range the owner never chose. §8.3
        from: order.firstServiceDate ?? filters.from,
        to: order.lastServiceDate ?? filters.to,
      },
      dayRows.length + payments.length,
      {
        documentCode: order.code,
        subject: order.partyName,
        subjectMeta: `${order.code} · ${order.phone}`,
      },
    ),
    party: {
      id: order.id,
      code: order.code,
      name: order.partyName,
      phone: order.phone,
      address: order.deliveryAddress,
      status: order.status,
      firstServiceDate: order.firstServiceDate,
      lastServiceDate: order.lastServiceDate,
      totalDays: order.totalDays,
    },
    summary: {
      totalPayable: order.totalAmount,
      received: order.paidAmount,
      outstanding: order.outstandingAmount,
      daysDelivered: deliveredCount,
      daysTotal: order.totalDays,
    },
    days: dayRows,
    payments: payments
      .map((payment) => ({
        id: payment.id,
        paidOn: payment.paidOn,
        mode: payment.mode,
        note: payment.note,
        isAdvance: payment.isAdvance,
        amount: payment.amount,
        direction: payment.direction,
      }))
      .sort((a, b) => a.paidOn.localeCompare(b.paidOn)),
    // `paid_amount` already nets refunds — `fn_recompute_party_order` maintains
    // it — so the payments table's total is read off the header, not summed.
    paymentsTotal: order.paidAmount,
    closingBalance: order.outstandingAmount,
  };
}

function emptyPartyStatement(filters: ReportFilters): PartyStatementReportDto {
  return {
    meta: meta(filters, 0, {
      documentCode: "PTY",
      subject: null,
      subjectMeta: null,
    }),
    party: null,
    summary: {
      totalPayable: 0,
      received: 0,
      outstanding: 0,
      daysDelivered: 0,
      daysTotal: 0,
    },
    days: [],
    payments: [],
    paymentsTotal: 0,
    closingBalance: 0,
  };
}

/* ── 5 · Product movement ────────────────────────────────────────────────── */

/**
 * What actually sells, through which channel, and how much of the base price
 * survives contact with the field. §9
 *
 * THE VIEW IS MONTHLY. `v_product_sales` keys on `date_trunc('month', …)`, so a
 * range of 05–20 Aug reports the whole of August. The snapped window is
 * returned on the DTO and printed on the screen rather than quietly applied —
 * a period silently widened is how a figure gets quoted for the wrong fortnight.
 *
 * WALK-INS HAVE NO UNITS. `direct_sales` records an amount, no quantity and no
 * unit price, so the view has no walk-in branch at all. The channel column is
 * therefore null for every product, and walk-in revenue is stated on its own
 * from `v_daily_sales`. Folding a row with no quantity into `qty_billed` would
 * corrupt both the units and the realised price.
 */
async function productMovement(
  filters: ReportFilters,
): Promise<ProductMovementReportDto> {
  const monthFrom = monthBounds(filters.from).from;
  const monthTo = monthBounds(filters.to).from;
  const monthSnapped =
    monthFrom !== filters.from || monthBounds(filters.to).to !== filters.to;

  const [rawRows, totals, channelTotals] = await Promise.all([
    productSalesRepository.findBetweenMonths(monthFrom, monthTo, filters.productIds),
    productSalesRepository.totalsBetweenMonths(monthFrom, monthTo, filters.productIds),
    dailySalesRepository.totalsByChannelBetween(
      monthFrom,
      monthBounds(filters.to).to,
    ),
  ]);

  const products = await productRepository.findManyByIds(
    rawRows.map((row) => row.product_id),
  );
  const productById = byId(products);

  const rows: ProductMovementRowDto[] = rawRows.map((row) => {
    const product = productById.get(row.product_id);
    const litres = product?.litres ?? 0;
    const units = row.qty_billed;
    const avgRate =
      row.avg_realised_price === null ? null : Number(row.avg_realised_price);
    const avgBaseRate =
      row.avg_base_price === null ? null : Number(row.avg_base_price);

    return {
      productId: row.product_id,
      code: row.product_code,
      title: product?.title ?? row.product_title,
      litres,
      isReturnable: product?.isReturnable ?? true,
      basePrice: Number(row.current_base_price),
      delivery: row.delivery_qty,
      party: row.party_qty,
      walkIn: null,
      units,
      /** A QUANTITY product — litres per unit times units. Never money. */
      litresTotal: Math.round(units * litres * 1000) / 1000,
      revenue: Number(row.revenue),
      baseValue: Number(row.base_value),
      discountValue: Number(row.discount_value),
      avgRate,
      avgBaseRate,
      /** A RATIO of two SQL-computed prices. Negative means below list. */
      variancePercent:
        avgRate !== null && avgBaseRate !== null && avgBaseRate !== 0
          ? Math.round(((avgRate - avgBaseRate) / avgBaseRate) * 1000) / 10
          : null,
      href: dashboardPaths().product(row.product_id),
    };
  });

  // `numeric` arrives from the driver as a string; the insights mapper is the
  // one place that conversion happens. insights.dto.ts explains why.
  const walkIn = channelTotals
    .map(toSalesChannelTotalsDto)
    .find((row) => row.channel === "WALK_IN");

  return {
    meta: meta(filters, rows.length, {
      documentCode: `PRM-${monthFrom.slice(0, 7)}`,
      subject: null,
      subjectMeta: null,
    }),
    summary: {
      totalUnits: totals.qty_billed,
      // Litres across every product: a sum of QUANTITY products, not money.
      totalLitres:
        Math.round(
          rows.reduce((total, row) => total + row.litresTotal, 0) * 1000,
        ) / 1000,
      revenue: Number(totals.revenue),
      baseValue: Number(totals.base_value),
      discountValue: Number(totals.discount_value),
      discountPercent:
        totals.discount_percent === null
          ? null
          : Number(totals.discount_percent),
    },
    rows,
    totals: {
      delivery: totals.delivery_qty,
      party: totals.party_qty,
      units: totals.qty_billed,
      litres:
        Math.round(
          rows.reduce((total, row) => total + row.litresTotal, 0) * 1000,
        ) / 1000,
      revenue: Number(totals.revenue),
    },
    monthFrom,
    monthTo: monthBounds(filters.to).to,
    monthSnapped,
    walkInRevenue: walkIn?.revenue ?? 0,
  };
}

/* ── 6 · Profit & loss ───────────────────────────────────────────────────── */

/**
 * Income by channel against expenses by category. §10
 *
 * Not a bookkeeping statement — a categorised list of outgoings against
 * categorised income, which is what the owner actually asks for.
 *
 * The subtraction, the margin and the daily average are all done by PostgreSQL
 * through `profitSummaryBetween`, which takes the expense total as a bound
 * `numeric` because income and spend live in different relations and no view
 * can join them. See that method for the full argument.
 */
async function profitLoss(filters: ReportFilters): Promise<ProfitLossReportDto> {
  const days = Math.max(daysBetween(filters.from, filters.to) + 1, 1);

  const [byChannel, expenseTotal, byCategory, categories] = await Promise.all([
    dailySalesRepository.totalsByChannelBetween(filters.from, filters.to),
    expenseRepository.sumFiltered({
      fromDate: filters.from,
      toDate: filters.to,
    }),
    expenseRepository.sumByCategoryBetween(filters.from, filters.to),
    expenseCategoryRepository.findAllOrdered(),
  ]);

  const net = await dailySalesRepository.profitSummaryBetween(
    filters.from,
    filters.to,
    expenseTotal.total.toFixed(2),
    days,
  );

  const income = Number(net.income);
  const expenses = Number(net.expenses);
  const categoryName = new Map(categories.map((c) => [c.id, c.name] as const));

  /** Share of a table's own total — a RATIO, which is why it is allowed here. */
  const share = (amount: number, total: number) =>
    total === 0 ? 0 : Math.round((amount / total) * 1000) / 10;

  const incomeRows: ProfitLossLineDto[] = byChannel
    .map(toSalesChannelTotalsDto)
    .map((row) => ({
      key: row.channel,
      name: null,
      amount: row.revenue,
      percent: share(row.revenue, income),
      href:
        row.channel === "DELIVERY"
          ? dashboardPaths(filters.from, filters.to).orders
          : row.channel === "PARTY"
            ? dashboardPaths(filters.from, filters.to).partyOrders
            : dashboardPaths(filters.from, filters.to).directSales,
    }))
    // Biggest first, always — the largest line reads first. §10.3
    .sort((a, b) => b.amount - a.amount)
    .filter((row) => row.amount !== 0);

  const expenseRows: ProfitLossLineDto[] = byCategory
    .filter((row) => row.total !== 0)
    .map((row) => ({
      key: row.categoryId,
      name: categoryName.get(row.categoryId) ?? "—",
      amount: row.total,
      percent: share(row.total, expenses),
      href: dashboardPaths(filters.from, filters.to).expenseCategory(
        row.categoryId,
      ),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    meta: meta(filters, incomeRows.length + expenseRows.length, {
      documentCode: `PNL-${filters.from}`,
      subject: null,
      subjectMeta: null,
    }),
    summary: {
      income,
      expenses,
      profit: Number(net.profit),
      marginPercent:
        net.margin_percent === null ? null : Number(net.margin_percent),
    },
    income: { rows: incomeRows, total: income },
    expenses: {
      rows: expenseRows,
      total: expenses,
      // A category that exists and spent nothing — the §10.4 footnote.
      zeroCategoryCount: Math.max(categories.length - expenseRows.length, 0),
    },
    net: {
      income,
      expenses,
      profit: Number(net.profit),
      marginPercent:
        net.margin_percent === null ? null : Number(net.margin_percent),
      days,
      averagePerDay: Number(net.average_per_day),
    },
    // A P&L with income and no expenses is almost always a data gap, not a very
    // good month, and §10.4 insists the report says so.
    expensesMissing: income > 0 && expenses === 0,
    incomeMissing: income === 0 && expenses > 0,
  };
}

/* ── 7 · Jar reconciliation ──────────────────────────────────────────────── */

/**
 * Where every jar is: issued, returned empty, returned filled, written off,
 * still out — per staff member and product. §11
 *
 * The grouped aggregate is computed by PostgreSQL
 * (`orderItemRepository.jarMovementByStaffProduct`); this function pivots it
 * into staff groups and totals the COUNTS, which are integers and never money.
 *
 * `jarsOutNow` is deliberately a different number from `summary.stillOut`: the
 * former is the whole plant's position from `v_staff_jar_balance` right now,
 * the latter is what the report's date range and filters account for. Printing
 * one and labelling it the other is how a reconciliation stops reconciling.
 *
 * NON-RETURNABLE PRODUCTS NEVER APPEAR. A bottle is not a jar, and the
 * repository excludes them at source on the line's `is_returnable` SNAPSHOT.
 */
async function jarReconciliation(
  filters: ReportFilters,
): Promise<JarReconciliationReportDto> {
  const [cells, jarTotals, jarBalances] = await Promise.all([
    orderItemRepository.jarMovementByStaffProduct({
      from: filters.from,
      to: filters.to,
      staffId: filters.staffId,
      productIds: filters.productIds,
    }),
    staffJarBalanceRepository.totals(),
    staffJarBalanceRepository.findAll(),
  ]);

  const [staff, products] = await Promise.all([
    staffRepository.findManyByIds(unique(cells.map((cell) => cell.staffId))),
    productRepository.findManyByIds(
      unique(cells.map((cell) => cell.productId)),
    ),
  ]);
  const staffById = byId(staff);
  const productById = byId(products);
  const balanceByStaff = new Map(
    jarBalances.map((row) => [row.staff_id, row] as const),
  );

  /** Counts, never money. Every total on this report is an integer. */
  const rate = (issued: number, returned: number) =>
    issued === 0 ? null : Math.round((returned / issued) * 1000) / 10;

  const grouped = new Map<string, JarMovementRowDto[]>();
  for (const cell of cells) {
    const rows = grouped.get(cell.staffId) ?? [];
    rows.push({
      productId: cell.productId,
      productTitle: productById.get(cell.productId)?.title ?? cell.productTitle,
      issued: cell.issued,
      empty: cell.empty,
      filled: cell.filled,
      lost: cell.lost,
      stillOut: cell.stillOut,
      returnRatePercent: cell.returnRatePercent,
      oldestDays: cell.oldestDays,
      href: `/orders?staffId=${cell.staffId}&productId=${cell.productId}&jarsOut=1`,
    });
    grouped.set(cell.staffId, rows);
  }

  const groups: JarStaffGroupDto[] = [...grouped.entries()]
    .map(([staffId, rows]) => {
      const sum = (pick: (row: JarMovementRowDto) => number) =>
        rows.reduce((total, row) => total + pick(row), 0);
      const issued = sum((row) => row.issued);
      const empty = sum((row) => row.empty);
      const filled = sum((row) => row.filled);
      const person = staffById.get(staffId);

      return {
        staffId,
        staffCode: person?.code ?? "—",
        staffName: person?.name ?? "—",
        issued,
        empty,
        filled,
        lost: sum((row) => row.lost),
        stillOut: sum((row) => row.stillOut),
        // Recomputed from the group's own totals, never averaged across its
        // product rows. §11.3
        returnRatePercent: rate(issued, empty + filled),
        oldestDays: balanceByStaff.get(staffId)?.oldest_pending_days ?? 0,
        href: dashboardPaths().staff(staffId),
        rows: rows.sort((a, b) => b.stillOut - a.stillOut),
      };
    })
    // Group order is STILL OUT descending and does not change with sorting. §11.6
    .sort(
      (a, b) => b.stillOut - a.stillOut || a.staffName.localeCompare(b.staffName),
    );

  const total = (pick: (group: JarStaffGroupDto) => number) =>
    groups.reduce((sum, group) => sum + pick(group), 0);

  const issued = total((g) => g.issued);
  const empty = total((g) => g.empty);
  const filled = total((g) => g.filled);
  const lost = total((g) => g.lost);
  const stillOut = total((g) => g.stillOut);
  const overdue = groups
    .filter((group) => group.oldestDays >= OVERDUE_DAYS)
    .reduce((sum, group) => sum + group.stillOut, 0);

  return {
    meta: meta(
      filters,
      groups.reduce((n, group) => n + group.rows.length, 0),
      { documentCode: `JAR-${filters.from}`, subject: null, subjectMeta: null },
    ),
    summary: {
      issued,
      returned: empty + filled,
      empty,
      filled,
      writtenOff: lost,
      stillOut,
      overdue,
      returnRatePercent: rate(issued, empty + filled),
    },
    groups,
    totals: {
      issued,
      empty,
      filled,
      lost,
      stillOut,
      returnRatePercent: rate(issued, empty + filled),
    },
    jarsOutNow: jarTotals.jars_out,
  };
}

/* ── CSV export ──────────────────────────────────────────────────────────── */

export interface ReportCsv {
  filename: string;
  /** UTF-8 text, BOM already prefixed. */
  body: string;
}

/**
 * A report as a CSV file. §13.3
 *
 * FOUR THINGS THIS GETS RIGHT, ALL OF WHICH ARE EASY TO GET WRONG:
 *
 *  1. **UTF-8 with a byte-order mark.** Without it, Excel on Windows renders
 *     `રમેશ પટેલ` as mojibake while every other tool looks fine, and it comes
 *     back weeks later as "the export is broken".
 *  2. **Latin digits.** Figures are emitted with `toFixed(2)` and plain
 *     `String(n)` rather than through `Intl`, so no locale can turn a rupee
 *     figure into `૧૨૩` and no thousands separator can split a cell in two.
 *     A CSV is read by a spreadsheet, not by a person.
 *  3. **Comma-safe quoting.** Every field is quoted and internal quotes are
 *     doubled, per RFC 4180 — Gujarati notes and party addresses contain both.
 *  4. **`row_type`.** Group, subtotal and total rows are REAL rows carrying
 *     `group` / `subtotal` / `total`, so the file adds up the same way the
 *     screen does. `meta.rowCount` still counts data rows only.
 *
 * COLUMN HEADERS ARE STABLE ENGLISH KEYS, not catalogue strings. A CSV is
 * parsed downstream — by Excel, by the owner's accountant, possibly by a
 * script — and a header that changed with the UI language would break every
 * one of them. The four-line preamble carries the human context instead.
 */
export async function renderReportCsv(
  slug: ReportSlug,
  query: ReportQuery,
): Promise<ReportCsv> {
  const filters = resolveReportFilters(slug, query);
  const result = await runReport(slug, query);
  const lines: string[][] = [];

  switch (result.slug) {
    case "daily-collection": {
      lines.push(["row_type", "time", "source", "reference", "from", "mode", "amount"]);
      for (const group of result.groups) {
        lines.push(["group", "", group.key, "", "", `${group.receiptCount} receipts`, num(group.total)]);
        for (const row of group.rows) {
          lines.push([
            "data",
            row.receivedAt,
            row.group,
            row.reference,
            row.from,
            row.mode,
            num(row.direction === "OUT" ? -row.amount : row.amount),
          ]);
        }
        lines.push(["subtotal", "", group.key, "", "", "", num(group.total)]);
      }
      lines.push(["total", "", "TOTAL_COLLECTED", "", "", String(result.summary.receiptCount), num(result.summary.totalCollected)]);
      lines.push(["total", "", "EXPECTED_IN_DRAWER", "", "", "", num(result.summary.expectedInDrawer)]);
      break;
    }

    case "staff-outstanding": {
      lines.push(["row_type", "section", "reference", "date", "total", "paid", "balance", "status", "age_days", "quantity"]);
      lines.push(["group", "A_OPEN_DELIVERY_ORDERS", "", "", "", "", "", "", "", ""]);
      for (const row of result.orders.rows) {
        lines.push(["data", "A", row.code, row.orderDate, num(row.total), num(row.paid), num(row.balance), row.paymentStatus, String(row.ageDays), String(row.quantity)]);
      }
      lines.push(["subtotal", "A", "", "", num(result.orders.subtotal.total), num(result.orders.subtotal.paid), num(result.orders.subtotal.balance), "", "", ""]);

      lines.push(["group", "B_OPEN_COIN_ISSUES", "", "", "", "", "", "", "", ""]);
      for (const row of result.coinIssues.rows) {
        lines.push(["data", "B", row.code, row.issueDate, num(row.issuedValue), num(row.paid), num(row.pending), "", String(row.ageDays), String(row.coinsIssued)]);
      }
      lines.push(["subtotal", "B", "", "", "", num(result.coinIssues.subtotal.paid), num(result.coinIssues.subtotal.pending), "", "", ""]);

      lines.push(["group", "C_JARS_STILL_OUT", "", "", "", "", "", "", "", ""]);
      for (const row of result.jars.rows) {
        lines.push(["data", "C", row.orderCode, row.orderDate, "", "", "", row.productTitle, String(row.daysOut), String(row.qtyOut)]);
      }
      lines.push(["subtotal", "C", "", "", "", "", "", "", "", String(result.jars.totalQty)]);
      lines.push(["total", "TOTAL_OWED", "", "", "", "", num(result.summary.totalOwed), "", "", String(result.summary.jarsOut)]);
      break;
    }

    case "coin-reconciliation": {
      lines.push(["row_type", "coin_type", "per_coin_price", "opening", "issued", "returned", "received", "adjusted", "closing", "closing_value", "ledger_balance", "difference", "reconciles"]);
      for (const row of result.rows) {
        lines.push(["data", row.name, num(row.perCoinPrice), String(row.opening), String(row.issued), String(row.returned), String(row.received), String(row.adjusted), String(row.closing), num(row.closingValue), String(row.ledgerBalance), String(row.difference), row.reconciles ? "yes" : "no"]);
      }
      lines.push(["total", "", "", String(result.totals.opening), String(result.totals.issued), String(result.totals.returned), String(result.totals.received), String(result.totals.adjusted), String(result.totals.closing), num(result.totals.closingValue), "", "", result.summary.reconciles ? "yes" : "no"]);
      break;
    }

    case "party-statement": {
      lines.push(["row_type", "day", "date", "item", "quantity", "rate", "amount", "status"]);
      for (const day of result.days) {
        if (day.items.length === 0) {
          lines.push(["data", String(day.dayNo), day.serviceDate, "", "", "", num(day.dayTotal), day.status]);
        }
        for (const [index, item] of day.items.entries()) {
          lines.push([
            "data",
            index === 0 ? String(day.dayNo) : "",
            index === 0 ? day.serviceDate : "",
            item.productTitle,
            String(item.deliveredQuantity ?? item.quantity),
            num(item.unitPrice),
            num(item.lineTotal),
            index === 0 ? day.status : "",
          ]);
        }
      }
      lines.push(["total", "", "", "TOTAL_PAYABLE", "", "", num(result.summary.totalPayable), ""]);
      lines.push(["group", "", "", "PAYMENTS_RECEIVED", "", "", "", ""]);
      for (const payment of result.payments) {
        lines.push(["data", "", payment.paidOn, payment.mode, "", "", num(payment.direction === "OUT" ? -payment.amount : payment.amount), payment.isAdvance ? "advance" : ""]);
      }
      lines.push(["total", "", "", "TOTAL_RECEIVED", "", "", num(result.paymentsTotal), ""]);
      lines.push(["total", "", "", "CLOSING_BALANCE", "", "", num(result.closingBalance), ""]);
      break;
    }

    case "product-movement": {
      lines.push(["row_type", "product_code", "product", "base_price", "delivery_units", "party_units", "units", "litres", "revenue", "avg_rate", "variance_percent"]);
      for (const row of result.rows) {
        lines.push(["data", row.code, row.title, num(row.basePrice), String(row.delivery), String(row.party), String(row.units), String(row.litresTotal), num(row.revenue), row.avgRate === null ? "" : num(row.avgRate), row.variancePercent === null ? "" : String(row.variancePercent)]);
      }
      // AVG RATE is blank on the total row: averaging averages is wrong, and a
      // wrong average is worse than none. §9.3
      lines.push(["total", "", "", "", String(result.totals.delivery), String(result.totals.party), String(result.totals.units), String(result.totals.litres), num(result.totals.revenue), "", ""]);
      break;
    }

    case "profit-loss": {
      lines.push(["row_type", "section", "line", "amount", "percent"]);
      lines.push(["group", "INCOME", "", "", ""]);
      for (const row of result.income.rows) {
        lines.push(["data", "INCOME", row.name ?? row.key, num(row.amount), String(row.percent)]);
      }
      lines.push(["subtotal", "INCOME", "TOTAL_INCOME", num(result.income.total), "100.0"]);
      lines.push(["group", "EXPENSES", "", "", ""]);
      for (const row of result.expenses.rows) {
        lines.push(["data", "EXPENSES", row.name ?? row.key, num(row.amount), String(row.percent)]);
      }
      lines.push(["subtotal", "EXPENSES", "TOTAL_EXPENSES", num(result.expenses.total), "100.0"]);
      lines.push(["total", "", "NET_PROFIT", num(result.net.profit), result.net.marginPercent === null ? "" : String(result.net.marginPercent)]);
      break;
    }

    case "jar-reconciliation": {
      lines.push(["row_type", "staff", "product", "issued", "empty", "filled", "lost", "still_out", "return_percent"]);
      for (const group of result.groups) {
        lines.push(["group", group.staffName, "", String(group.issued), String(group.empty), String(group.filled), String(group.lost), String(group.stillOut), group.returnRatePercent === null ? "" : String(group.returnRatePercent)]);
        for (const row of group.rows) {
          lines.push(["data", group.staffName, row.productTitle, String(row.issued), String(row.empty), String(row.filled), String(row.lost), String(row.stillOut), row.returnRatePercent === null ? "" : String(row.returnRatePercent)]);
        }
      }
      lines.push(["total", "", "", String(result.totals.issued), String(result.totals.empty), String(result.totals.filled), String(result.totals.lost), String(result.totals.stillOut), result.totals.returnRatePercent === null ? "" : String(result.totals.returnRatePercent)]);
      break;
    }
  }

  const width = lines.reduce((max, row) => Math.max(max, row.length), 1);
  const preamble = [
    ["report", CSV_REPORT_NAMES[slug]],
    ["filters", describeFilters(filters, result)],
    ["generated", result.meta.generatedAt],
    ["rows", String(result.meta.rowCount)],
  ].map((row) => pad(row, width));

  const body =
    "﻿" +
    [...preamble, pad([], width), ...lines.map((row) => pad(row, width))]
      .map((row) => row.map(quote).join(","))
      .join("\r\n") +
    "\r\n";

  return { filename: csvFilename(slug, filters, result), body };
}

/** English, stable, and only ever seen inside the file's own preamble. */
const CSV_REPORT_NAMES: Record<ReportSlug, string> = {
  "daily-collection": "Daily collection sheet",
  "staff-outstanding": "Staff outstanding statement",
  "coin-reconciliation": "Coin reconciliation",
  "party-statement": "Party order statement",
  "product-movement": "Product movement",
  "profit-loss": "Profit and loss summary",
  "jar-reconciliation": "Jar reconciliation",
};

function describeFilters(
  filters: ReportFilters,
  result: ReportResultDto,
): string {
  const parts: string[] = [];
  const definition = REPORT_DEFINITIONS[filters.slug];

  if (definition.fields.includes("date")) parts.push(`date=${filters.date}`);
  else parts.push(`from=${result.meta.from}`, `to=${result.meta.to}`);

  if (result.meta.subject) parts.push(`subject=${result.meta.subject}`);
  if (filters.coinTypeId) parts.push(`coinType=${filters.coinTypeId}`);
  if (filters.productIds.length > 0) {
    parts.push(`products=${filters.productIds.length}`);
  }
  return parts.join("; ");
}

/**
 * `maruti-jal_staff-outstanding_ramesh-patel_2026-07-01_2026-08-14.csv`
 *
 * The subject is TRANSLITERATED to Latin — in the filename only. A Gujarati
 * filename survives a modern filesystem perfectly well and then arrives
 * percent-encoded in an email client, which is exactly the moment the owner
 * cannot tell two exports apart. Every figure inside the file stays as typed.
 */
function csvFilename(
  slug: ReportSlug,
  filters: ReportFilters,
  result: ReportResultDto,
): string {
  const definition = REPORT_DEFINITIONS[slug];
  const window = definition.fields.includes("date")
    ? [filters.date]
    : [result.meta.from, result.meta.to];

  const subject = result.meta.subject ? latinSlug(result.meta.subject) : "";

  return [
    "maruti-jal",
    slug,
    ...(subject ? [subject] : []),
    ...window,
  ].join("_") + ".csv";
}

/**
 * Anything non-Latin collapses to its document code rather than to noise.
 *
 * A real transliteration engine is not worth a dependency here: the code is
 * unique, printable and already on the document, so `STF-000007` is a better
 * filename fragment than a lossy romanisation of `રમેશ પટેલ` would be.
 */
function latinSlug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length >= 2 ? cleaned : "";
}

/** RFC 4180: quote everything, double the internal quotes. */
function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Latin digits, two decimals, no grouping — a spreadsheet reads this. */
function num(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

function pad(row: string[], width: number): string[] {
  return [...row, ...Array<string>(Math.max(width - row.length, 0)).fill("")];
}

/* ── Shared helpers ──────────────────────────────────────────────────────── */

function meta(
  filters: ReportFilters,
  rowCount: number,
  extra: {
    documentCode: string;
    subject: string | null;
    subjectMeta: string | null;
  },
): ReportMetaDto {
  return {
    slug: filters.slug,
    preset: filters.preset,
    from: filters.from,
    to: filters.to,
    date: filters.date,
    generatedAt: new Date().toISOString(),
    rowCount,
    printable: REPORT_DEFINITIONS[filters.slug].printable,
    documentCode: extra.documentCode,
    subject: extra.subject,
    subjectMeta: extra.subjectMeta,
    awaitingSubject: filters.awaitingSubject,
  };
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row] as const));
}
