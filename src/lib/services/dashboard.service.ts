import "server-only";
import { userRepository } from "@/lib/repositories/user.repository";
import { coinTypeRepository } from "@/lib/repositories/coin-type.repository";
import { expenseCategoryRepository } from "@/lib/repositories/expense-category.repository";
import { expenseRepository } from "@/lib/repositories/expense.repository";
import { partyOrderRepository } from "@/lib/repositories/party-order.repository";
import { paymentRepository } from "@/lib/repositories/payment.repository";
import { coinCirculationRepository } from "@/lib/repositories/insights/coin-circulation.repository";
import { dailySalesRepository } from "@/lib/repositories/insights/daily-sales.repository";
import { execSummaryRepository } from "@/lib/repositories/insights/exec-summary.repository";
import { productSalesRepository } from "@/lib/repositories/insights/product-sales.repository";
import { staffJarBalanceRepository } from "@/lib/repositories/insights/staff-jar-balance.repository";
import { staffOutstandingRepository } from "@/lib/repositories/insights/staff-outstanding.repository";
import { addDays, daysAgo, daysBetween, monthBounds, todayIST } from "@/lib/dates";
import {
  toCoinCirculationDto,
  toDailySalesDto,
  toExecSummaryDto,
  toProductSalesDto,
  toSalesChannelTotalsDto,
  toSalesTotalsDto,
  toStaffJarBalanceDto,
  toStaffJarBalanceTotalsDto,
  toStaffOutstandingDto,
  toStaffOutstandingTotalsDto,
  type CoinCirculationDto,
  type StaffJarBalanceDto,
  type StaffOutstandingDto,
} from "@/lib/dto/insights.dto";
import {
  DASHBOARD_TREND_LABEL,
  resolveDashboardRange,
  type DashboardQuery,
  type DashboardSummaryQuery,
} from "@/lib/validation/dashboard";
import type {
  DashboardAttentionRowDto,
  DashboardCoinPositionRowDto,
  DashboardCollectionMixDto,
  DashboardDelta,
  DashboardMonthPointDto,
  DashboardProductBarDto,
  DashboardScoreboardRowDto,
  DashboardSummaryDto,
  DashboardTrendPointDto,
  ExecutiveDashboardDto,
} from "@/lib/dto/dashboard.dto";

/**
 * Dashboard aggregates.
 *
 * WHY THIS FILE AND NOT `insights.service.ts`. The insights service is the thin
 * DTO face of the seven views and nothing else. The executive dashboard is a
 * SCREEN: it needs those views plus expenses, plus payments by mode, plus the
 * live coin stock, plus today's party schedule. Composing them is a service's
 * job — "one service, several repositories" — and a service calling another
 * service is how the layering rule dies. That is exactly the split the header
 * of `insights.service.ts` describes; this file is the dashboard's own module.
 * See .claude/ARCHITECTURE.md §4
 *
 * NOT ONE RUPEE IS ADDED UP HERE. Every total, every subtraction and every
 * bucket below was computed by PostgreSQL. The only arithmetic in this file is
 * on counts, days and percentages — see `percentDelta`.
 */
export async function getDashboardSummary(
  period: DashboardSummaryQuery["period"],
): Promise<DashboardSummaryDto> {
  const accountCount = await userRepository.count();

  return {
    period,
    accountCount,
    pendingModules: [],
  };
}

/** Rows 3 and 4 of the attention list start caring at these ages. §3.3.5 T3 */
const OVERDUE_DAYS = 7;
const UNSETTLED_COIN_DAYS = 15;

/** The trend chart never shows fewer than a month, even when the filter is Today. */
const MIN_TREND_DAYS = 30;

/** C2's window. Six months is the shortest span a seasonal business can read. */
const TREND_MONTHS = 6;

/** T1 shows the top 8; the footer link goes to the full ranking. §3.3.5 T1 */
const SCOREBOARD_ROWS = 8;

/** T3 keeps a lid on the list; the page expands in place to this maximum. */
const ATTENTION_ROWS = 20;

export async function getExecutiveDashboard(
  query: DashboardQuery,
): Promise<ExecutiveDashboardDto> {
  const today = todayIST();
  const range = resolveDashboardRange(query, today);

  // At least 30 days of columns, ending where the period ends. `Today` would
  // otherwise draw a chart with one bar in it.
  const trendFrom =
    daysBetween(range.from, range.to) + 1 >= MIN_TREND_DAYS
      ? range.from
      : addDays(range.to, -(MIN_TREND_DAYS - 1));

  const productMonth = range.to.slice(0, 7);
  const productMonthBounds = monthBounds(`${productMonth}-01`);

  const [
    execRow,
    totals,
    byChannel,
    previousTotals,
    dailyRows,
    expenseNow,
    expensePrevious,
    expenseByCategory,
    categories,
    mixRows,
    productRows,
    outstandingRows,
    jarRows,
    outstandingTotals,
    jarTotals,
    partyOutstanding,
    circulationRows,
    coinTypes,
    partyToday,
  ] = await Promise.all([
    execSummaryRepository.find(),
    dailySalesRepository.totalsBetween(range.from, range.to),
    dailySalesRepository.totalsByChannelBetween(range.from, range.to),
    dailySalesRepository.totalsBetween(range.previousFrom, range.previousTo),
    dailySalesRepository.findBetween(trendFrom, range.to),
    expenseRepository.sumFiltered({ fromDate: range.from, toDate: range.to }),
    expenseRepository.sumBetween(range.previousFrom, range.previousTo),
    expenseRepository.sumByCategoryBetween(range.from, range.to),
    expenseCategoryRepository.findAllOrdered(),
    paymentRepository.collectionMixBetween(
      productMonthBounds.from,
      productMonthBounds.to,
    ),
    productSalesRepository.findByMonth(productMonthBounds.from),
    staffOutstandingRepository.findAll(),
    staffJarBalanceRepository.findAll(),
    staffOutstandingRepository.totals(),
    staffJarBalanceRepository.totals(),
    partyOrderRepository.sumOutstanding(),
    coinCirculationRepository.findAll(),
    coinTypeRepository.findActive(),
    partyOrderRepository.findWithDeliveriesOn(today),
  ]);

  // These depend on an expense total from the batch above, so they cannot join
  // it. The subtractions themselves still happen inside PostgreSQL.
  const [netRow, previousNetRow, monthly] = await Promise.all([
    dailySalesRepository.netBetween(
      range.from,
      range.to,
      expenseNow.total.toFixed(2),
    ),
    dailySalesRepository.netBetween(
      range.previousFrom,
      range.previousTo,
      expensePrevious.toFixed(2),
    ),
    loadMonthlySeries(range.to),
  ]);

  const exec = toExecSummaryDto(execRow);
  const periodTotals = toSalesTotalsDto(totals);
  const previous = toSalesTotalsDto(previousTotals);
  const outstanding = outstandingRows.map(toStaffOutstandingDto);
  const jars = jarRows.map(toStaffJarBalanceDto);
  const duesTotals = toStaffOutstandingTotalsDto(outstandingTotals);
  const jarSummary = toStaffJarBalanceTotalsDto(jarTotals);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const topCategory = expenseByCategory[0];

  const netCurrent = Number(netRow.net);
  const netPrevious = Number(previousNetRow.net);
  const attention = buildAttention(outstanding, jars, partyToday);

  return {
    asOfDate: exec.asOfDate,
    generatedAt: new Date().toISOString(),
    range: {
      key: range.key,
      from: range.from,
      to: range.to,
      previousFrom: range.previousFrom,
      previousTo: range.previousTo,
      trendLabelKey: DASHBOARD_TREND_LABEL[range.key],
    },
    period: {
      revenue: periodTotals.revenue,
      revenueByChannel: byChannel.map(toSalesChannelTotalsDto),
      collection: periodTotals.collection,
      expenses: expenseNow.total,
      expenseCount: expenseNow.count,
      topExpenseCategory: topCategory
        ? {
            id: topCategory.categoryId,
            name: categoryNames.get(topCategory.categoryId) ?? "—",
            amount: topCategory.total,
          }
        : null,
      net: netCurrent,
      deltas: {
        revenue: percentDelta(periodTotals.revenue, previous.revenue),
        collection: percentDelta(periodTotals.collection, previous.collection),
        expenses: percentDelta(expenseNow.total, expensePrevious),
        net: percentDelta(netCurrent, netPrevious),
      },
    },
    risk: {
      staffCash: exec.receivableOrders,
      staffCashOrders: duesTotals.openOrderCount,
      staffCashStaff: outstanding.filter((row) => row.orderDues > 0).length,
      staffCashOldestDays: oldestDays(
        outstanding.filter((row) => row.orderDues > 0),
      ),

      partyDues: exec.receivableParty,
      partyCount: partyOutstanding.parties,
      partyOldestDays: partyOutstanding.oldestServiceDate
        ? Math.max(daysAgo(partyOutstanding.oldestServiceDate), 0)
        : 0,

      coinDues: exec.receivableCoins,
      coinIssues: duesTotals.openIssueCount,
      coinStaff: outstanding.filter((row) => row.coinDues > 0).length,
      coinOldestDays: oldestCoinDays(outstanding),

      jarsOut: exec.jarsOut,
      jarsStaff: exec.staffWithJarsOut,
      jarsOrders: jarSummary.openOrderCount,
      // Jars held by someone whose oldest pending order passed a week. The
      // view ages the ORDER, not the individual jar, so this is a count of
      // jars sitting behind an overdue order — stated that way in the copy.
      jarsOverdue: jars
        .filter((row) => row.oldestPendingDays >= OVERDUE_DAYS)
        .reduce((total, row) => total + row.jarsOut, 0),
      jarsOverdueStaff: jars.filter(
        (row) => row.jarsOut > 0 && row.oldestPendingDays >= OVERDUE_DAYS,
      ).length,
    },
    charts: {
      trendFrom,
      trendTo: range.to,
      revenueTrend: pivotTrend(dailyRows.map(toDailySalesDto), trendFrom, range.to),
      revenueVsExpenses: monthly,
      productMonth,
      topProducts: topProducts(productRows.map(toProductSalesDto)),
      collectionMix: foldMix(mixRows),
    },
    tables: {
      scoreboard: buildScoreboard(outstanding, jars),
      coinPosition: buildCoinPosition(
        coinTypes,
        circulationRows.map(toCoinCirculationDto),
      ),
      attention: attention.slice(0, ATTENTION_ROWS),
      attentionTotal: attention.length,
    },
  };
}

/* ── Row 3 · C2 ──────────────────────────────────────────────────────────── */

/**
 * Six months of revenue, expenses and the difference.
 *
 * One pair of queries per month rather than one grouped query, because the two
 * halves live in different relations — `v_daily_sales` and `expenses` — and a
 * repository may not join another entity's table. `profitBetween` takes the
 * expense total as a bound `numeric` and does the subtraction in SQL, which is
 * the same contract the expenses module's profit card already uses.
 */
async function loadMonthlySeries(
  anchor: string,
): Promise<DashboardMonthPointDto[]> {
  const months: string[] = [];
  let cursor = monthBounds(anchor).from;
  for (let i = 0; i < TREND_MONTHS; i += 1) {
    months.unshift(cursor);
    cursor = monthBounds(addDays(cursor, -1)).from;
  }

  return Promise.all(
    months.map(async (first) => {
      const bounds = monthBounds(first);
      const expenses = await expenseRepository.sumBetween(bounds.from, bounds.to);
      const row = await dailySalesRepository.profitBetween(
        bounds.from,
        bounds.to,
        expenses.toFixed(2),
      );

      return {
        month: first.slice(0, 7),
        revenue: Number(row.income),
        expenses: Number(row.expenses),
        profit: Number(row.profit),
      };
    }),
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Percentage change between two SQL-computed totals.
 *
 * A RATIO, not a rupee figure — which is why it is allowed here while the
 * amounts it comes from are not. `null` when the base period is zero: "up
 * ∞%" is not a fact the owner can act on, and the card drops its trend line
 * rather than inventing one.
 */
function percentDelta(current: number, base: number): DashboardDelta {
  if (base === 0) return null;
  return Math.round(((current - base) / Math.abs(base)) * 1000) / 10;
}

function oldestDays(rows: Array<{ daysOutstanding: number }>): number {
  return rows.reduce((max, row) => Math.max(max, row.daysOutstanding), 0);
}

function oldestCoinDays(
  rows: Array<{ coinDues: number; oldestIssueDueDate: string | null; daysOutstanding: number }>,
): number {
  return rows
    .filter((row) => row.coinDues > 0)
    .reduce(
      (max, row) =>
        Math.max(
          max,
          row.oldestIssueDueDate
            ? Math.max(daysAgo(row.oldestIssueDueDate), 0)
            : row.daysOutstanding,
        ),
      0,
    );
}

/**
 * Date × channel rows → one row per day with three named columns.
 *
 * Days with no sales are filled with zeros rather than dropped: a stacked
 * column chart that skips empty days silently compresses a quiet week into a
 * busy one. This places figures, it never adds them.
 */
function pivotTrend(
  rows: Array<{ businessDate: string; channel: string; revenue: number }>,
  from: string,
  to: string,
): DashboardTrendPointDto[] {
  const points = new Map<string, DashboardTrendPointDto>();

  for (let date = from; date <= to; date = addDays(date, 1)) {
    points.set(date, { date, delivery: 0, party: 0, walkIn: 0 });
  }

  for (const row of rows) {
    const point = points.get(row.businessDate);
    if (!point) continue;
    if (row.channel === "DELIVERY") point.delivery = row.revenue;
    else if (row.channel === "PARTY") point.party = row.revenue;
    else if (row.channel === "WALK_IN") point.walkIn = row.revenue;
  }

  return [...points.values()];
}

/** Top 5 by units billed. Sorting, not summing — the view did the adding. */
function topProducts(
  rows: Array<{
    productId: string;
    productTitle: string;
    qtyBilled: number;
    qtyIssued: number;
    revenue: number;
  }>,
): DashboardProductBarDto[] {
  return rows
    .filter((row) => row.qtyBilled > 0)
    .sort((a, b) => b.qtyBilled - a.qtyBilled || a.productTitle.localeCompare(b.productTitle))
    .slice(0, 5)
    .map((row) => ({
      productId: row.productId,
      title: row.productTitle,
      qtyBilled: row.qtyBilled,
      qtyIssued: row.qtyIssued,
      revenue: row.revenue,
    }));
}

/** Buckets and the grand total both arrive from SQL; this only names them. */
function foldMix(
  rows: Array<{ bucket: string; total: number; payments: number; grandTotal: number }>,
): DashboardCollectionMixDto {
  const find = (bucket: string) => rows.find((row) => row.bucket === bucket);
  const cash = find("CASH");
  const coins = find("COIN");
  const other = find("OTHER");

  return {
    cash: cash?.total ?? 0,
    cashCount: cash?.payments ?? 0,
    coins: coins?.total ?? 0,
    coinsCount: coins?.payments ?? 0,
    other: other?.total ?? 0,
    otherCount: other?.payments ?? 0,
    total: rows[0]?.grandTotal ?? 0,
  };
}

function buildScoreboard(
  outstanding: StaffOutstandingDto[],
  jars: StaffJarBalanceDto[],
): DashboardScoreboardRowDto[] {
  const jarsByStaff = new Map(jars.map((row) => [row.staffId, row]));
  const merged = new Map<string, DashboardScoreboardRowDto>();

  for (const row of outstanding) {
    const jar = jarsByStaff.get(row.staffId);
    merged.set(row.staffId, {
      staffId: row.staffId,
      staffCode: row.staffCode,
      staffName: row.staffName,
      staffPhone: row.staffPhone,
      openOrders: row.openOrderCount,
      cashOut: row.orderDues,
      coinDues: row.coinDues,
      jarsOut: jar?.jarsOut ?? 0,
      jarsOldestDays: jar?.oldestPendingDays ?? 0,
      daysOutstanding: row.daysOutstanding,
    });
  }

  // Someone can be square on money and still be holding 200 jars.
  for (const jar of jars) {
    if (merged.has(jar.staffId) || jar.jarsOut <= 0) continue;
    merged.set(jar.staffId, {
      staffId: jar.staffId,
      staffCode: jar.staffCode,
      staffName: jar.staffName,
      staffPhone: jar.staffPhone,
      openOrders: jar.openOrderCount,
      cashOut: 0,
      coinDues: 0,
      jarsOut: jar.jarsOut,
      jarsOldestDays: jar.oldestPendingDays,
      daysOutstanding: jar.oldestPendingDays,
    });
  }

  return [...merged.values()]
    .filter((row) => row.cashOut > 0 || row.coinDues > 0 || row.jarsOut > 0)
    .sort(
      (a, b) =>
        b.cashOut - a.cashOut ||
        b.coinDues - a.coinDues ||
        b.jarsOut - a.jarsOut ||
        a.staffName.localeCompare(b.staffName),
    )
    .slice(0, SCOREBOARD_ROWS);
}

/**
 * Stock from `coin_types`, circulation from the view.
 *
 * `balanceCoins × perCoinPrice` is a per-ROW display product rounded to two
 * decimals, exactly as `coin-type.dto.ts` documents for the same figure. Every
 * TOTAL on this screen is still a SQL aggregate.
 */
function buildCoinPosition(
  coinTypes: Array<{
    id: string;
    name: string;
    coinsPerPacket: number;
    perCoinPrice: number;
    balanceCoins: number;
  }>,
  circulation: CoinCirculationDto[],
): DashboardCoinPositionRowDto[] {
  const byType = new Map(circulation.map((row) => [row.coinTypeId, row]));

  return coinTypes.map((type) => {
    const live = byType.get(type.id);
    return {
      coinTypeId: type.id,
      name: type.name,
      coinsPerPacket: type.coinsPerPacket,
      perCoinPrice: type.perCoinPrice,
      inStock: type.balanceCoins,
      stockPackets:
        type.coinsPerPacket > 0
          ? Math.floor(type.balanceCoins / type.coinsPerPacket)
          : 0,
      stockValue: Math.round(type.balanceCoins * type.perCoinPrice * 100) / 100,
      outWithStaff: live?.coinsInCirculation ?? 0,
      outValue: live?.valueInCirculation ?? 0,
      openIssues: live?.openIssueCount ?? 0,
    };
  });
}

/**
 * The merged action list — four questions, one list, severity first.
 *
 * Rows are staff-level rather than document-level: the insights views age the
 * OLDEST open item per person, which is the figure the owner acts on ("ring
 * Ramesh"), and every row still opens the exact filtered list behind it.
 */
function buildAttention(
  outstanding: StaffOutstandingDto[],
  jars: StaffJarBalanceDto[],
  partyToday: Array<{
    id: string;
    code: string;
    partyName: string;
    days: Array<{ deliveryStatus: string; dayTotal: number }>;
  }>,
): DashboardAttentionRowDto[] {
  const rows: DashboardAttentionRowDto[] = [];

  for (const staff of outstanding) {
    if (staff.orderDues > 0 && staff.daysOutstanding >= OVERDUE_DAYS) {
      rows.push({
        id: `cash-${staff.staffId}`,
        kind: "cash",
        severity: "danger",
        subject: staff.staffName,
        amount: staff.orderDues,
        quantity: staff.openOrderCount,
        reference: null,
        ageDays: staff.daysOutstanding,
        href: `/orders?staffId=${staff.staffId}&moneyPending=1`,
      });
    }

    const coinAge = staff.oldestIssueDueDate
      ? Math.max(daysAgo(staff.oldestIssueDueDate), 0)
      : staff.daysOutstanding;

    if (staff.coinDues > 0 && coinAge >= UNSETTLED_COIN_DAYS) {
      rows.push({
        id: `coins-${staff.staffId}`,
        kind: "coins",
        severity: "warning",
        subject: staff.staffName,
        amount: staff.coinDues,
        quantity: staff.openIssueCount,
        reference: null,
        ageDays: coinAge,
        href: `/coins/issues?staffId=${staff.staffId}`,
      });
    }
  }

  for (const jar of jars) {
    if (jar.jarsOut > 0 && jar.oldestPendingDays >= OVERDUE_DAYS) {
      rows.push({
        id: `jars-${jar.staffId}`,
        kind: "jars",
        severity: "danger",
        subject: jar.staffName,
        amount: null,
        quantity: jar.jarsOut,
        reference: null,
        ageDays: jar.oldestPendingDays,
        href: `/orders?staffId=${jar.staffId}&jarsOut=1`,
      });
    }
  }

  for (const party of partyToday) {
    const scheduled = party.days.filter(
      (day) => day.deliveryStatus === "SCHEDULED",
    );
    if (scheduled.length === 0) continue;
    rows.push({
      id: `party-${party.id}`,
      kind: "party",
      severity: "info",
      subject: party.partyName,
      amount: scheduled[0].dayTotal,
      quantity: null,
      reference: party.code,
      ageDays: 0,
      href: `/party-orders/${party.id}`,
    });
  }

  const rank = { danger: 0, warning: 1, info: 2 } as const;
  return rows.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || b.ageDays - a.ageDays,
  );
}
