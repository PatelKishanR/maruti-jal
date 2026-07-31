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
   * TODO(wave-4): the product filter, the date range and the "include voided"
   * toggle get their Zod schemas here when the list page ships. The repository
   * already filters on all three.
   */
  filters: {},
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
