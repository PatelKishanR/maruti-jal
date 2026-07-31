import { z } from "zod";
import type { TableConfig } from "@/lib/table/types";

/**
 * The direct-sale (walk-in) table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/06-direct-sales.md
 *
 * Written ahead of the module (wave 4) so the allowlist exists in ONE place
 * from the first line of UI code. `DirectSaleRepository` already imports it.
 *
 * Client-safe by construction — zod and types only, no `server-only`, no
 * entity or repository imports. See .claude/MODULE-RECIPE.md §1
 */

/**
 * Public sort key → hard-coded qualified SQL column.
 *
 * THE INJECTION DEFENCE IS THIS MAP: user input is only ever a lookup KEY into
 * it, so `?sort=id;DROP TABLE direct_sales` misses it and falls back to the
 * default. See .claude/ARCHITECTURE.md §6.2
 */
export const DIRECT_SALE_SORT_COLUMNS = {
  /** The BUSINESS date — what the owner reconciles the cash box against. */
  saleDate: "ds.saleDate",
  /** The instant, so two sales on the same day still order correctly. */
  soldAt: "ds.soldAt",
  /** The identity number, not the text code — 'DWS-9' must precede 'DWS-10'. */
  code: "ds.saleNo",
  amount: "ds.amount",
  customerName: "ds.customerName",
} as const;

export type DirectSaleSortKey = keyof typeof DIRECT_SALE_SORT_COLUMNS;

/**
 * The sorts that keep the day-group bands.
 *
 * A per-day cash tally is meaningless once rows are reordered ACROSS days, so
 * sorting by amount or customer drops the bands and swaps the `TIME` column
 * for `DATE`. See design/MODULES/06-direct-sales.md §3.6
 */
export const DIRECT_SALE_GROUPED_SORTS: readonly DirectSaleSortKey[] = [
  "saleDate",
  "soldAt",
  "code",
];

/** URL parameter names for this module's filters, in one place. */
export const DIRECT_SALE_FILTERS = {
  range: "range",
  from: "from",
  to: "to",
  minAmount: "minAmount",
  maxAmount: "maxAmount",
  /** `1` shows voided rows. Off by default — §3.3 filter popover. */
  voided: "voided",
  productId: "productId",
} as const;

/**
 * The quick chips, which are the primary navigation of this screen: the owner
 * lives on `Today`. Resolved to concrete `from`/`to` bounds in the service, so
 * no date arithmetic reaches SQL.
 */
export const DIRECT_SALE_RANGES = [
  "today",
  "yesterday",
  "week",
  "month",
  "all",
] as const;

export type DirectSaleRange = (typeof DIRECT_SALE_RANGES)[number];

/** Today's counter first: this list is read as "what have we sold today?". */
export const DEFAULT_DIRECT_SALE_RANGE: DirectSaleRange = "today";

/** `'YYYY-MM-DD'` and nothing else — business dates are strings end to end. */
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Up to 2 decimals, no sign — an amount filter is never negative. */
const rupees = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);

export const directSaleTableConfig = {
  sortable: DIRECT_SALE_SORT_COLUMNS,
  /** Today's counter first: this list is read as "what have we sold today?". */
  defaultSort: { key: "saleDate", dir: "desc" },
  /**
   * One generated column (customer name ‖ phone ‖ address) under one trigram
   * index, plus `code` beside it — PostgreSQL forbids a generated column
   * referencing another generated column, so the code cannot be folded in.
   * See .claude/DATA-MODEL.md §5.2, §5.5
   */
  searchable: ["ds.searchBlob", "ds.code"],
  /**
   * Unknown filter keys are dropped; declared ones are schema-validated, and a
   * malformed value is ignored rather than 500-ing a bookmarked URL. The
   * repository already filters on every key below.
   */
  filters: {
    [DIRECT_SALE_FILTERS.range]: z.enum(DIRECT_SALE_RANGES),
    [DIRECT_SALE_FILTERS.from]: businessDate,
    [DIRECT_SALE_FILTERS.to]: businessDate,
    [DIRECT_SALE_FILTERS.minAmount]: rupees,
    [DIRECT_SALE_FILTERS.maxAmount]: rupees,
    [DIRECT_SALE_FILTERS.voided]: z.literal("1"),
    [DIRECT_SALE_FILTERS.productId]: z.string().uuid(),
  },
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
