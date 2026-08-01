import type { Expense, ExpensePaymentMode } from "@/lib/db/entities";
import type { ListResult } from "@/lib/table/types";

/**
 * Plain shapes crossing the server → client boundary.
 *
 * TypeORM entities are CLASS INSTANCES, and React's server-component
 * serialiser rejects any object whose prototype isn't `Object.prototype`.
 * Mapping once here also keeps `searchBlob`, `deletedById` and every other
 * internal column out of the browser by construction.
 * See .claude/ARCHITECTURE.md §4.1 rule 8
 *
 * The CATEGORY NAME travels beside `categoryId`. The id is what filters and
 * groups; the name is what the owner reads, and it is editable — renaming
 * `Fuel` to `ડીઝલ` must propagate everywhere with no code change and without
 * touching a single historical expense.
 * See design/MODULES/07-expenses.md §6.6
 *
 * `attachment_url` is called `receiptUrl` on this side of the wire. The column
 * is generic; the owner is looking at a bill photo, and every string the UI
 * renders should be named for what the owner sees.
 */

/** What a category id resolves to. Two tiny fields, read once per request. */
export interface ExpenseCategoryLabel {
  name: string;
  /**
   * Retired categories stay on their historical expenses — the edit form has
   * to say `● Coin printing · inactive` rather than silently move the record.
   * See design/MODULES/07-expenses.md §4.5
   */
  isActive: boolean;
}

/**
 * Resolves the foreign keys a row carries into the words beside them.
 *
 * `staff` is optional because the LIST does not render a staff column — loading
 * names for 25 rows that never show them would be an N+1 for nothing. The
 * detail page passes it.
 */
export interface ExpenseLabels {
  categories: ReadonlyMap<string, ExpenseCategoryLabel>;
  staff?: ReadonlyMap<string, string>;
}

/**
 * A register row. Deliberately narrower than `ExpenseDto`: 25 rows have no use
 * for `updatedAt` or the note body, and shipping them costs bytes on every
 * repage.
 */
export interface ExpenseListItemDto {
  id: string;
  /** `EXP-000148` — generated, never editable. */
  code: string;
  /** Business date, `'YYYY-MM-DD'`. Never a `Date`. */
  expenseDate: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  paymentMode: ExpensePaymentMode;
  /** Any script. `null` renders as an em dash, never as a blank cell. */
  paidTo: string | null;
  staffId: string | null;
  receiptUrl: string | null;
  /**
   * Carried explicitly rather than derived in the cell. The attachment column
   * must show a `Paperclip` or an em dash and NEVER a blank — an empty cell
   * reads as "not loaded". See design §3.3
   */
  hasReceipt: boolean;
  /** Soft-deleted rows render dimmed with a Restore action. */
  isDeleted: boolean;
}

export interface ExpenseDto extends ExpenseListItemDto {
  note: string | null;
  staffName: string | null;
  categoryIsActive: boolean;
  /** ISO instants — the row's audit stamps, not business dates. */
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * One entry on the detail page's activity rail.
 *
 * `action` is a catalogue key SUFFIX (`expenses.activity.<action>`), not a
 * sentence — a Gujarati UI must not receive English history.
 */
export interface ExpenseActivityDto {
  id: string;
  /** ISO instant. */
  at: string;
  action: "created" | "deleted";
  actorName: string | null;
}

export interface ExpenseDetailDto extends ExpenseDto {
  /** Newest first. The timeline component does not sort. */
  activity: ExpenseActivityDto[];
  /**
   * False while the rail is built from the row's own timestamps rather than
   * from the revision log. Lets the page say "field-level history isn't
   * recorded yet" instead of implying nothing ever changed.
   */
  activityComplete: boolean;
}

/** One category's share of a month. Powers KPI 2 and the chip band. */
export interface ExpenseCategorySpendDto {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
  /** 0–100. Null when the month has no spend at all — never a divide by zero. */
  sharePercent: number | null;
}

export type ExpenseTrendDirection = "up" | "down" | "flat";

/**
 * The month's profit, with BOTH sides named.
 *
 * `income` is null until orders exist, and `profit` is null whenever income is
 * — a profit figure built from a guessed income is worse than no figure. The
 * card renders "Figures arrive once orders exist" from `available`.
 */
export interface ExpenseMonthProfitDto {
  /** `YYYY-MM`. */
  month: string;
  income: number | null;
  expenses: number;
  profit: number | null;
  available: boolean;
}

export interface ExpenseKpisDto {
  /** `YYYY-MM` the strip covers. */
  month: string;
  previousMonth: string;
  thisMonthTotal: number;
  thisMonthCount: number;
  previousMonthTotal: number;
  /** current − previous, computed by PostgreSQL. Negative means spend fell. */
  deltaAmount: number;
  /** Null when last month was zero — a rise from nothing has no percentage. */
  deltaPercent: number | null;
  /**
   * Which way spending moved. The UI paints `up` in Danger, NOT in Success:
   * rising expenses are bad news. See DESIGN-STANDARDS §8 and design §1.5
   */
  trend: ExpenseTrendDirection;
  biggestCategory: ExpenseCategorySpendDto | null;
  profit: ExpenseMonthProfitDto;
}

/** One chip in the band above the table. */
export interface ExpenseCategoryChipDto {
  id: string;
  name: string;
  isActive: boolean;
  /** Spend in the selected month. Zero renders as an em dash. */
  monthTotal: number;
  monthCount: number;
}

/**
 * The foot row under the table: the total of exactly what is on screen.
 *
 * `filtered` drives the label — `Aug 2026 total` versus `Fuel in Aug 2026
 * total`. A filtered list showing an unfiltered sum is how an owner learns to
 * distrust every figure on the page. See design §3.3
 */
export interface ExpenseTotalsDto {
  total: number;
  count: number;
  filtered: boolean;
}

export interface ExpenseListResponseDto {
  result: ListResult<ExpenseListItemDto>;
  kpis: ExpenseKpisDto;
  totals: ExpenseTotalsDto;
  /** The owner's own order, not alphabetical. */
  categories: ExpenseCategoryChipDto[];
  /**
   * Every expense ever recorded, ignoring the month.
   *
   * This is what tells `No expenses recorded yet` apart from `Nothing recorded
   * in Aug 2026` — two different messages with two different CTAs, and getting
   * them the wrong way round tells an owner with 312 expenses that he has none.
   * See design §3.4
   */
  totalRecorded: number;
  /** The month the view is framed by, resolved server-side in IST. */
  month: string;
  /** The inclusive business-date bounds actually applied. */
  from: string;
  to: string;
}

/**
 * The picker option. MODULE-RECIPE §5 — every module ships one.
 *
 * Structurally identical to `ComboboxOption` in `components/form`, declared
 * here so a service never has to import a client component for a type.
 */
export interface ExpenseOptionDto {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Every expense path in one place.
 *
 * These belong in `lib/api/routes.ts` alongside `products` and `staff`; they
 * live here only because this module does not own that file — exactly as
 * `expenseCategoryRoutes` does. Fold both in when convenient; the shape is
 * already `apiRoutes`-compatible.
 */
export const expenseRoutes = {
  list: "/api/expenses",
  create: "/api/expenses",
  byId: (id: string) => `/api/expenses/${encodeURIComponent(id)}`,
  restore: (id: string) => `/api/expenses/${encodeURIComponent(id)}/restore`,
  options: "/api/expenses/options",
} as const;

/** App paths, so a row `href` and a KPI deep link are built the same way. */
export const expensePaths = {
  list: "/expenses",
  new: "/expenses/new",
  detail: (id: string) => `/expenses/${encodeURIComponent(id)}`,
  edit: (id: string) => `/expenses/${encodeURIComponent(id)}/edit`,
  month: (month: string) => `/expenses?month=${encodeURIComponent(month)}`,
  category: (month: string, categoryId: string) =>
    `/expenses?month=${encodeURIComponent(month)}&category=${encodeURIComponent(categoryId)}`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A category id with no matching row falls back to an em dash rather than to
 * an empty cell — a visible `—` beats a blank that looks like a rendering bug.
 * The FK is RESTRICT, so this is defence, not an expected path.
 */
const MISSING = "—";

function categoryLabel(
  labels: ExpenseLabels,
  categoryId: string,
): ExpenseCategoryLabel {
  return labels.categories.get(categoryId) ?? { name: MISSING, isActive: false };
}

export function toExpenseListItemDto(
  expense: Expense,
  labels: ExpenseLabels,
): ExpenseListItemDto {
  return {
    id: expense.id,
    code: expense.code,
    expenseDate: expense.expenseDate,
    categoryId: expense.categoryId,
    categoryName: categoryLabel(labels, expense.categoryId).name,
    amount: expense.amount,
    paymentMode: expense.paymentMode,
    paidTo: expense.paidTo,
    staffId: expense.staffId,
    receiptUrl: expense.attachmentUrl,
    hasReceipt: expense.attachmentUrl !== null,
    isDeleted: expense.deletedAt !== null,
  };
}

export function toExpenseDto(
  expense: Expense,
  labels: ExpenseLabels,
): ExpenseDto {
  return {
    ...toExpenseListItemDto(expense, labels),
    note: expense.note,
    staffName:
      expense.staffId === null
        ? null
        : (labels.staff?.get(expense.staffId) ?? null),
    categoryIsActive: categoryLabel(labels, expense.categoryId).isActive,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    deletedAt: expense.deletedAt?.toISOString() ?? null,
  };
}

/**
 * Profit with the income half absent.
 *
 * Delivery orders are Wave 4, and party orders and walk-ins are being built
 * right now, so there is nothing honest to add up yet. The SHAPE is real and
 * the card renders its "figures arrive once orders exist" state from it — when
 * the three order modules land, only the service body changes.
 */
export function pendingProfit(
  month: string,
  expenses: number,
): ExpenseMonthProfitDto {
  return { month, income: null, expenses, profit: null, available: false };
}
