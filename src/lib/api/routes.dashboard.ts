import { COIN_ISSUE_FILTERS } from "@/lib/table/configs/coin-issue";
import { DELIVERY_ORDER_FILTERS } from "@/lib/table/configs/delivery-order";
import { DIRECT_SALE_FILTERS } from "@/lib/table/configs/direct-sale";
import { STAFF_FILTERS } from "@/lib/table/configs/staff";

/**
 * Every destination the dashboard points at, in one place.
 *
 * **Every number is a door** (DESIGN-STANDARDS §1.4). A KPI, a chart segment
 * or a table row that cannot be opened tells the owner something is wrong
 * without telling him where — so each figure on the screen resolves to a real,
 * filtered list through this module rather than a string literal typed at the
 * call site. Filter names come from the table configs, so a filter renamed
 * there is a type error here rather than a link that silently shows everything.
 *
 * WHERE THE DESIGN NAMES A ROUTE THAT DOES NOT EXIST YET — `/payments`,
 * `/reports/daily-collection`, `/reports/profit-loss`, `/coins/ledger` — the
 * link lands on the nearest real list that contains the same records. Those
 * gaps are reported rather than papered over with a dead href.
 */

/** Only used with two business dates, so the query string is never half-built. */
function range(from?: string, to?: string): string {
  if (!from || !to) return "";
  const search = new URLSearchParams({ from, to });
  return `?${search.toString()}`;
}

export function dashboardPaths(from?: string, to?: string) {
  const window = range(from, to);

  return {
    /* Period figures — row 1 and the charts. */
    orders: `/orders${window}`,
    partyOrders: `/party-orders${window}`,
    directSales: `/direct-sales${window}`,
    expenses: `/expenses${window}`,
    expenseCategory: (categoryId: string) =>
      `/expenses${window}${window ? "&" : "?"}category=${categoryId}`,

    /* One day, for a chart column. */
    ordersOn: (date: string) =>
      `/orders?${DELIVERY_ORDER_FILTERS.from}=${date}&${DELIVERY_ORDER_FILTERS.to}=${date}`,
    partyOn: (date: string) => `/party-orders?from=${date}&to=${date}`,
    directSalesOn: (date: string) =>
      `/direct-sales?${DIRECT_SALE_FILTERS.from}=${date}&${DIRECT_SALE_FILTERS.to}=${date}`,

    /* Row 2 — the current position. Never carries the period. */
    ordersPending: `/orders?${DELIVERY_ORDER_FILTERS.moneyPending}=1`,
    ordersJarsOut: `/orders?${DELIVERY_ORDER_FILTERS.jarsOut}=1`,
    /**
     * The design asks for `&age_gt=7`. The orders list has no ageing filter
     * yet, so the badge opens the same jars-out list rather than a URL that
     * would be silently ignored. Reported as a gap.
     */
    ordersJarsOverdue: `/orders?${DELIVERY_ORDER_FILTERS.jarsOut}=1`,
    partyPending: `/party-orders?outstanding=true`,
    coinIssuesPending: `/coins/issues?${COIN_ISSUE_FILTERS.status}=pending`,

    /* Row 4 — every table row and every cell that goes somewhere else. */
    staffWithBalance: `/staff?${STAFF_FILTERS.hasBalance}=1`,
    staff: (id: string) => `/staff/${id}`,
    ordersForStaff: (staffId: string) =>
      `/orders?${DELIVERY_ORDER_FILTERS.staffId}=${staffId}&${DELIVERY_ORDER_FILTERS.moneyPending}=1`,
    jarsForStaff: (staffId: string) =>
      `/orders?${DELIVERY_ORDER_FILTERS.staffId}=${staffId}&${DELIVERY_ORDER_FILTERS.jarsOut}=1`,
    coinIssuesForStaff: (staffId: string) =>
      `/coins/issues?${COIN_ISSUE_FILTERS.staffId}=${staffId}`,
    coinType: (id: string) => `/coins/types/${id}`,
    coinTypes: "/coins/types",
    product: (id: string) => `/products/${id}`,
  } as const;
}
