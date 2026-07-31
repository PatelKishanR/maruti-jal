import { TABLE_PARAMS } from "@/lib/table/types";
import { STAFF_FILTERS } from "@/lib/table/configs/staff";

/**
 * Staff API paths.
 *
 * Lives beside `routes.ts` rather than inside it only because that file is
 * owned elsewhere — fold `staffRoutes` in as `apiRoutes.staff` when convenient.
 * Either way, components import paths from a module like this one rather than
 * typing string literals, so a rename is one edit and a typo is a type error.
 */

type RawParams = Record<string, string | string[] | undefined>;

/** Only the parameters this module understands are forwarded to the API. */
const LIST_PARAMS = [
  TABLE_PARAMS.page,
  TABLE_PARAMS.pageSize,
  TABLE_PARAMS.q,
  TABLE_PARAMS.sort,
  TABLE_PARAMS.dir,
  STAFF_FILTERS.status,
  STAFF_FILTERS.hasBalance,
  STAFF_FILTERS.hasJars,
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

export const staffRoutes = {
  /** `GET` list · `POST` create. Pass a page's searchParams straight through. */
  list: (params?: RawParams) => `/api/staff${listQueryString(params)}`,
  create: "/api/staff",
  /** `GET` one · `PATCH` update · `DELETE` deactivate. */
  detail: (id: string) => `/api/staff/${id}`,
  reactivate: (id: string) => `/api/staff/${id}/reactivate`,
  /** `ComboboxOption[]` for the shared EntityCombobox. */
  options: "/api/staff/options",
} as const;

/* The app-side routes, so links are typed in one place too. */
export const staffPaths = {
  list: "/staff",
  new: "/staff/new",
  detail: (id: string) => `/staff/${id}`,
  edit: (id: string) => `/staff/${id}/edit`,
  /** KPI deep links — every figure is a door. */
  all: `/staff?${STAFF_FILTERS.status}=all`,
  active: `/staff?${STAFF_FILTERS.status}=active`,
  withBalance: `/staff?${STAFF_FILTERS.hasBalance}=1`,
  withJars: `/staff?${STAFF_FILTERS.hasJars}=1`,
} as const;
