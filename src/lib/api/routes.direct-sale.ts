import { TABLE_PARAMS } from "@/lib/table/types";
import { DIRECT_SALE_FILTERS } from "@/lib/table/configs/direct-sale";

/**
 * Direct-sale API and app paths.
 *
 * Lives beside `routes.ts` rather than inside it only because that file is
 * owned elsewhere — fold `directSaleRoutes` in as `apiRoutes.directSales` when
 * convenient. Same pattern as `routes.staff.ts`.
 */

type RawParams = Record<string, string | string[] | undefined>;

/** Only the parameters this module understands are forwarded to the API. */
const LIST_PARAMS = [
  TABLE_PARAMS.page,
  TABLE_PARAMS.pageSize,
  TABLE_PARAMS.q,
  TABLE_PARAMS.sort,
  TABLE_PARAMS.dir,
  DIRECT_SALE_FILTERS.range,
  DIRECT_SALE_FILTERS.from,
  DIRECT_SALE_FILTERS.to,
  DIRECT_SALE_FILTERS.minAmount,
  DIRECT_SALE_FILTERS.maxAmount,
  DIRECT_SALE_FILTERS.voided,
  DIRECT_SALE_FILTERS.productId,
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

export const directSaleRoutes = {
  /** `GET` list (rows + KPIs + day bands) · `POST` record. */
  list: (params?: RawParams) => `/api/direct-sales${listQueryString(params)}`,
  create: "/api/direct-sales",
  /** `GET` one · `PATCH` correct (same day only) · `DELETE` void. */
  detail: (id: string) => `/api/direct-sales/${id}`,
} as const;

/* The app-side routes, so links are typed in one place too. */
export const directSalePaths = {
  list: "/direct-sales",
  detail: (id: string) => `/direct-sales/${id}`,
  edit: (id: string) => `/direct-sales/${id}/edit`,
  /** KPI deep links — every figure is a door. §3.3 */
  today: `/direct-sales?${DIRECT_SALE_FILTERS.range}=today`,
  yesterday: `/direct-sales?${DIRECT_SALE_FILTERS.range}=yesterday`,
  month: `/direct-sales?${DIRECT_SALE_FILTERS.range}=month`,
  /** The cash card opens today's list, biggest sale first. */
  todayByAmount: `/direct-sales?${DIRECT_SALE_FILTERS.range}=today&${TABLE_PARAMS.sort}=amount&${TABLE_PARAMS.dir}=desc`,
} as const;
