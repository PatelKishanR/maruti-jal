import type { TableConfig } from "@/lib/table/types";

/**
 * The expense table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/07-expenses.md
 *
 * Written ahead of the module (wave 4) so the allowlist exists in ONE place
 * from the first line of UI code. `ExpenseRepository` already imports it.
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
 */
export const EXPENSE_SORT_COLUMNS = {
  expenseDate: "e.expenseDate",
  /** The identity number, not the text code — 'EXP-9' must precede 'EXP-10'. */
  code: "e.expenseNo",
  amount: "e.amount",
  paidTo: "e.paidTo",
  createdAt: "e.createdAt",
} as const;

export type ExpenseSortKey = keyof typeof EXPENSE_SORT_COLUMNS;

export const expenseTableConfig = {
  sortable: EXPENSE_SORT_COLUMNS,
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
   * TODO(wave-4): category, staff, payment mode and the date range get their
   * Zod schemas here when the list page ships. The repository already filters
   * on all four.
   */
  filters: {},
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
