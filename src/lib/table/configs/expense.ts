import type { TableConfig } from "@/lib/table/types";
import {
  EXPENSE_FILTERS,
  EXPENSE_SORT_KEYS,
  expenseFilterSchemas,
  type ExpenseSortKey,
} from "@/lib/validation/expense";

/**
 * The expense table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/07-expenses.md
 *
 * Client-safe by construction — zod and types only, no `server-only`, no
 * entity or repository imports. See .claude/MODULE-RECIPE.md §1
 */

/**
 * Public sort key → hard-coded qualified SQL column.
 *
 * THE INJECTION DEFENCE IS THIS MAP: user input is only ever a lookup KEY into
 * it, so `?sort=id;DROP TABLE expenses` misses it and falls back to the
 * default. See .claude/ARCHITECTURE.md §6.2
 *
 * `createdAt` is in the map but NOT in `EXPENSE_SORT_KEYS`: the service uses it
 * for the options picker ("most recently recorded first"), and it is never
 * offered as a column header. The URL-facing subset is picked out below, so a
 * key advertised to the browser always has a column behind it.
 */
export const EXPENSE_SORT_COLUMNS = {
  expenseDate: "e.expenseDate",
  /** The identity number, not the text code — 'EXP-9' must precede 'EXP-10'. */
  code: "e.expenseNo",
  amount: "e.amount",
  paidTo: "e.paidTo",
  createdAt: "e.createdAt",
} as const;

/** Every key the repository can ORDER BY, URL-facing or not. */
export type ExpenseSortColumnKey = keyof typeof EXPENSE_SORT_COLUMNS;

/**
 * The URL-facing subset, PICKED from the map above rather than retyped.
 *
 * A key in `EXPENSE_SORT_KEYS` with no column here is a compile error.
 */
const urlSortable = Object.fromEntries(
  EXPENSE_SORT_KEYS.map((key) => [key, EXPENSE_SORT_COLUMNS[key]]),
) as Record<ExpenseSortKey, string>;

export const expenseTableConfig: TableConfig & {
  sortable: Record<ExpenseSortKey, string>;
} = {
  sortable: urlSortable,
  /** A spend register is read newest first — this month, then last month. */
  defaultSort: { key: "expenseDate", dir: "desc" },
  /**
   * One generated column (paid-to ‖ note) under one trigram index, plus `code`
   * beside it — PostgreSQL forbids a generated column referencing another
   * generated column, so the code cannot be folded in. Category, staff, payment
   * mode and date are filters, not free text.
   * See .claude/DATA-MODEL.md §5.2, §5.5
   */
  searchable: ["e.searchBlob", "e.code"],
  /**
   * Unknown filter keys are dropped; declared ones are schema-validated, and a
   * malformed value is ignored rather than 500-ing a bookmarked URL.
   *
   * `month` carries the default view. It has no default VALUE here because the
   * default is "the current month in IST" — a figure only the server can
   * compute honestly, so the service fills it in.
   */
  filters: {
    [EXPENSE_FILTERS.month]: expenseFilterSchemas.month,
    [EXPENSE_FILTERS.from]: expenseFilterSchemas.from,
    [EXPENSE_FILTERS.to]: expenseFilterSchemas.to,
    [EXPENSE_FILTERS.category]: expenseFilterSchemas.category,
    [EXPENSE_FILTERS.mode]: expenseFilterSchemas.mode,
    [EXPENSE_FILTERS.staff]: expenseFilterSchemas.staff,
    [EXPENSE_FILTERS.minAmount]: expenseFilterSchemas.minAmount,
    [EXPENSE_FILTERS.maxAmount]: expenseFilterSchemas.maxAmount,
    [EXPENSE_FILTERS.receipt]: expenseFilterSchemas.receipt,
  },
  defaultPageSize: 25,
  maxPageSize: 100,
};

/** Re-exported so table code has one import for the keys and the config. */
export { EXPENSE_FILTERS, EXPENSE_SORT_KEYS };
export type { ExpenseSortKey };
