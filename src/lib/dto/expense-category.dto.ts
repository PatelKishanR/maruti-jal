import type { ExpenseCategory } from "@/lib/db/entities";

/**
 * Plain shapes crossing the server → client boundary.
 *
 * TypeORM entities are CLASS INSTANCES, and React's serialiser rejects any
 * object whose prototype isn't `Object.prototype`. Mapping once here is also
 * what keeps `deletedById` and friends off the wire.
 * See .claude/ARCHITECTURE.md §4.1 rule 8
 */
export interface ExpenseCategoryDto {
  id: string;
  /** Any script — `Fuel`, `પ્લાન્ટ મેઇન્ટેનન્સ`. */
  name: string;
  /** Ascending. The owner's chosen order, not alphabetical. */
  sortOrder: number;
  /**
   * Switched off categories stay on historical expenses and disappear from the
   * expense form's dropdown. They are still listed here — the owner needs to
   * see one to switch it back on. See MODULES/07-expenses.md §4.1
   */
  isActive: boolean;
}

export function toExpenseCategoryDto(
  category: ExpenseCategory,
): ExpenseCategoryDto {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

/**
 * One option in a picker.
 *
 * Structurally identical to `ComboboxOption` in `components/form/entity-combobox`
 * — deliberately re-declared rather than imported, because a service must never
 * depend on a component module.
 */
export interface LookupOptionDto {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function toExpenseCategoryOption(
  category: ExpenseCategory,
): LookupOptionDto {
  return { id: category.id, label: category.name };
}

/**
 * Every expense-category path in one place.
 *
 * These belong in `lib/api/routes.ts` alongside `account` and `dashboard`; they
 * live here only because this module does not own that file. Fold them in when
 * convenient — the shape is already `apiRoutes`-compatible.
 */
export const expenseCategoryRoutes = {
  list: (status: "all" | "active" | "inactive" = "all") =>
    `/api/expense-categories?status=${status}`,
  create: "/api/expense-categories",
  byId: (id: string) => `/api/expense-categories/${encodeURIComponent(id)}`,
  reactivate: (id: string) =>
    `/api/expense-categories/${encodeURIComponent(id)}/reactivate`,
  reorder: "/api/expense-categories/reorder",
  options: "/api/expense-categories/options",
} as const;
