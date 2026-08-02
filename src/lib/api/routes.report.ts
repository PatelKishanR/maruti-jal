import {
  REPORT_DEFINITIONS,
  reportSearchParams,
  type ReportFilters,
  type ReportSlug,
} from "@/lib/validation/report";

/**
 * Report API and app paths.
 *
 * Lives beside `routes.ts` on the same terms as `routes.staff.ts` and
 * `routes.party-order.ts` — fold it in as `apiRoutes.reports` when convenient.
 * The point either way is that no component types a report URL by hand: the
 * filters that produced a screen and the filters that produce its CSV are built
 * from ONE function, so an export can never quietly disagree with the table
 * above it. §13.3
 */

type RawParams = Record<string, string | string[] | undefined>;

/** Only the parameters a report understands are forwarded. */
const REPORT_PARAMS = [
  "preset",
  "date",
  "from",
  "to",
  "staffId",
  "partyOrderId",
  "coinTypeId",
  "productIds",
] as const;

function queryString(params: RawParams = {}): string {
  const search = new URLSearchParams();
  for (const key of REPORT_PARAMS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const reportRoutes = {
  /** The launcher's alert footers. Takes no parameters by design. */
  index: "/api/reports",
  /** One report, run. Pass a page's searchParams straight through. */
  run: (slug: ReportSlug, params?: RawParams) =>
    `/api/reports/${slug}${queryString(params)}`,
  /**
   * The CSV download. A real `Content-Disposition: attachment` response, not a
   * blob assembled in the browser — so the file is byte-identical to what the
   * server computed and the filters cannot be re-applied client-side. §13.3
   */
  export: (slug: ReportSlug, filters: ReportFilters) => {
    const search = reportSearchParams(filters);
    search.set("format", "csv");
    return `/api/reports/${slug}/export?${search.toString()}`;
  },
} as const;

export const reportPaths = {
  index: "/reports",
  report: (slug: ReportSlug, params?: RawParams) =>
    `/reports/${slug}${queryString(params)}`,
  /** The same screen with the filters that produced it — the `Copy link` target. */
  fromFilters: (filters: ReportFilters) => {
    const search = reportSearchParams(filters).toString();
    return `/reports/${filters.slug}${search ? `?${search}` : ""}`;
  },
  /** Every report, in the order the launcher lays them out. §3.4 */
  all: Object.keys(REPORT_DEFINITIONS) as ReportSlug[],
} as const;
