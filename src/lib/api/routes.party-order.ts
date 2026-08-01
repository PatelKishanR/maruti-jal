import { TABLE_PARAMS } from "@/lib/table/types";
import { partyOrderTableConfig } from "@/lib/table/configs/party-order";

/**
 * Party-order API and app paths.
 *
 * Lives beside `routes.ts` rather than inside it only because that file is
 * owned elsewhere — fold `partyOrderRoutes` in as `apiRoutes.partyOrders` when
 * convenient. Same pattern as `routes.staff.ts` and `routes.direct-sale.ts`.
 */

type RawParams = Record<string, string | string[] | undefined>;

/**
 * The filter parameter names, taken from the table config rather than retyped.
 *
 * The config is the single source of truth for the filter vocabulary, so a
 * filter renamed there stops being forwarded here rather than being silently
 * dropped by the server.
 */
export const PARTY_ORDER_FILTERS = Object.keys(
  partyOrderTableConfig.filters,
) as (keyof typeof partyOrderTableConfig.filters)[];

const LIST_PARAMS = [
  TABLE_PARAMS.page,
  TABLE_PARAMS.pageSize,
  TABLE_PARAMS.q,
  TABLE_PARAMS.sort,
  TABLE_PARAMS.dir,
  ...PARTY_ORDER_FILTERS,
] as const;

function listQueryString(params: RawParams = {}): string {
  const search = new URLSearchParams();
  for (const key of LIST_PARAMS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const partyOrderRoutes = {
  /** `GET` list (rows + KPIs) · `POST` book. */
  list: (params?: RawParams) => `/api/party-orders${listQueryString(params)}`,
  create: "/api/party-orders",
  /** `GET` one · `PATCH` party details · `DELETE` cancel. */
  detail: (id: string) => `/api/party-orders/${id}`,
  /**
   * The cancellation reason travels as a query parameter — `api.del` sends no
   * body, and a `DELETE` with one is poorly supported by intermediaries.
   */
  cancel: (id: string, reason?: string | null) =>
    reason
      ? `/api/party-orders/${id}?reason=${encodeURIComponent(reason)}`
      : `/api/party-orders/${id}`,
  /** `POST` one day or a whole generated run. */
  days: (id: string) => `/api/party-orders/${id}/days`,
  /** `PATCH` one day · `DELETE` remove it. */
  day: (id: string, dayId: string) => `/api/party-orders/${id}/days/${dayId}`,
  payments: (id: string) => `/api/party-orders/${id}/payments`,
  calendar: (month?: string) =>
    month
      ? `/api/party-orders/calendar?month=${encodeURIComponent(month)}`
      : "/api/party-orders/calendar",
  options: "/api/party-orders/options",
} as const;

/* The app-side routes, so links are typed in one place too. */
export const partyOrderPaths = {
  list: "/party-orders",
  new: "/party-orders/new",
  detail: (id: string) => `/party-orders/${id}`,
  /** The schedule tab, deep-linked from a progress bar. §3.6 */
  schedule: (id: string) => `/party-orders/${id}?tab=schedule`,
  payments: (id: string) => `/party-orders/${id}?tab=payments`,
  /** One day-card scrolled into view — where a calendar pill lands. §10.6 */
  day: (id: string, serviceDate: string) =>
    `/party-orders/${id}?tab=schedule&day=${serviceDate}`,
  calendar: (month?: string) =>
    month ? `/party-orders/calendar?month=${month}` : "/party-orders/calendar",
  /** KPI deep links — every figure is a door. §3.3 */
  active: "/party-orders?delivery=inProgress",
  upcoming: "/party-orders?delivery=upcoming",
  outstanding: "/party-orders?outstanding=true",
} as const;
