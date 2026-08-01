import type { ExpensePaymentMode } from "@/lib/db/entities/enums";
import type { ExpenseDto } from "@/lib/dto/expense.dto";

/**
 * The expense form's shape and its two pure builders.
 *
 * These live OUTSIDE `expense-form.tsx` because that file is `"use client"`,
 * and a server component may not CALL an export of a client module — it may
 * only render it as a component or pass it as a prop. `/expenses/new` and
 * `/expenses/[id]/edit` both build their initial values on the server, so the
 * builders have to sit on this side of the boundary.
 * See .claude/MODULE-RECIPE.md §7
 *
 * `ExpensePaymentMode` is imported from `entities/enums`, which has no imports
 * at all — the same reason `validation/expense.ts` can reach for it from code
 * that runs in the browser.
 */

export interface ExpenseFormInitial {
  /** Business date, `'YYYY-MM-DD'`. Defaults to today, never the future. */
  expenseDate: string;
  categoryId: string;
  /** Null means the box is EMPTY, which is not the same as ₹0.00. */
  amount: number | null;
  paymentMode: ExpensePaymentMode;
  paidTo: string;
  staffId: string | null;
  note: string;
  /**
   * A stored object key or link. No storage provider is configured yet, so on a
   * new expense this is always null — see the dropzone in `expense-form.tsx`,
   * which says so out loud rather than swallowing the file.
   */
  receiptUrl: string | null;
}

/** Cash is what a water plant pays out in more often than anything else. */
const DEFAULT_PAYMENT_MODE: ExpensePaymentMode = "CASH";

/**
 * A fresh form: today's date, cash, everything else blank.
 *
 * `lastCategoryId` pre-selects the category from the most recent expense —
 * design §4.5, "category = the last category used, shown with `Last used —
 * change if needed`". Diesel is bought far more often than a borewell is
 * repaired, so the previous choice is the best available guess.
 */
export function blankExpense(
  today: string,
  lastCategoryId?: string,
): ExpenseFormInitial {
  return {
    expenseDate: today,
    categoryId: lastCategoryId ?? "",
    amount: null,
    paymentMode: DEFAULT_PAYMENT_MODE,
    paidTo: "",
    staffId: null,
    note: "",
    receiptUrl: null,
  };
}

/** An existing record, ready for the edit form. */
export function toFormInitial(expense: ExpenseDto): ExpenseFormInitial {
  return {
    expenseDate: expense.expenseDate,
    categoryId: expense.categoryId,
    amount: expense.amount,
    paymentMode: expense.paymentMode,
    paidTo: expense.paidTo ?? "",
    staffId: expense.staffId,
    note: expense.note ?? "",
    receiptUrl: expense.receiptUrl,
  };
}

/**
 * One option in the category or staff select.
 *
 * Structurally `LookupOptionDto`, re-declared so this module depends on nothing
 * — it is imported by both a server page and a client form.
 */
export interface ExpenseSelectOption {
  id: string;
  label: string;
  hint?: string;
  /** Rendered as `● Coin printing · inactive` and never offered on a create. */
  inactive?: boolean;
}

/**
 * Ensures the record's OWN category (or staff) is in the list it is chosen
 * from, even after it has been retired.
 *
 * Without this, opening the edit form for an expense filed under a since-retired
 * category would show an empty select — and saving an unrelated field would
 * silently move the expense to whatever happened to be first in the list.
 * See design/MODULES/07-expenses.md §4.5
 */
export function withHistoricalOption(
  options: ExpenseSelectOption[],
  selectedId: string | null,
  label: string | null,
): ExpenseSelectOption[] {
  if (!selectedId || !label) return options;
  if (options.some((option) => option.id === selectedId)) return options;
  return [...options, { id: selectedId, label, inactive: true }];
}
