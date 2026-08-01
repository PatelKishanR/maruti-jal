import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api/client";
import { todayIST } from "@/lib/dates";
import {
  expenseCategoryRoutes,
  type LookupOptionDto,
} from "@/lib/dto/expense-category.dto";
import {
  expensePaths,
  type ExpenseListResponseDto,
} from "@/lib/dto/expense.dto";
import { ExpenseForm } from "../expense-form";
import { blankExpense, type ExpenseSelectOption } from "../expense-form-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Add expense. Spec: design/MODULES/07-expenses.md §4
 *
 * Three fetches, all through the API. Only ACTIVE categories and staff are
 * offered — a retired category stays on the expenses already filed under it but
 * must never be selectable on a new one. §4.1
 *
 * The category defaults to the last one used. Diesel is bought far more often
 * than a borewell is repaired, so the previous choice is the best guess
 * available, and it is the difference between a five-second entry and a
 * fifteen-second one. §4.5
 */
export default async function NewExpensePage() {
  const t = await getTranslations("expenses");

  const [categories, staffOptions, recent] = await Promise.all([
    api
      .get<LookupOptionDto[]>(expenseCategoryRoutes.options)
      .catch(() => [] as LookupOptionDto[]),
    api
      .get<ExpenseSelectOption[]>("/api/staff/options")
      .catch(() => [] as ExpenseSelectOption[]),
    // One row, newest first. A failure here costs a pre-filled field, never
    // the form — so it degrades to a blank category rather than an error page.
    api
      .get<ExpenseListResponseDto>("/api/expenses?pageSize=1")
      .catch(() => undefined),
  ]);

  const lastCategoryId = recent?.result.rows[0]?.categoryId;
  // Only pre-select a category still on the list — the last one used may have
  // been switched off since.
  const lastUsed = categories.some((c) => c.id === lastCategoryId)
    ? lastCategoryId
    : undefined;

  return (
    <div className="max-w-180">
      <Link
        href={expensePaths.list}
        className="mb-2 inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("backToList")}
      </Link>

      <h1 className="text-h2 font-semibold text-foreground">
        {t("create.title")}
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        {t("create.subtitle")}
      </p>

      <ExpenseForm
        mode="create"
        initial={blankExpense(todayIST(), lastUsed)}
        categories={categories.map((c) => ({ id: c.id, label: c.label }))}
        staffOptions={staffOptions}
      />
    </div>
  );
}
