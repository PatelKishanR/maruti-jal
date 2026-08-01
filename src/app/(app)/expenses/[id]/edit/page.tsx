import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/i18n/config";
import {
  expenseCategoryRoutes,
  type LookupOptionDto,
} from "@/lib/dto/expense-category.dto";
import { expensePaths, type ExpenseDetailDto } from "@/lib/dto/expense.dto";
import { ExpenseForm } from "../../expense-form";
import {
  toFormInitial,
  withHistoricalOption,
  type ExpenseSelectOption,
} from "../../expense-form-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Edit expense. Spec: design/MODULES/07-expenses.md §4
 *
 * The same form as Add, plus the month-impact banner — which lives inside
 * `ExpenseForm`, so the two screens cannot drift.
 *
 * The record's OWN category and staff are folded into the option lists even
 * when they have since been retired. Without that, opening this form for an
 * expense filed under a switched-off category would show an empty select, and
 * saving a typo fix in the note would silently move the expense to whatever
 * happened to be first in the list. §4.5
 */
export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("expenses");
  const locale = (await getLocale()) as Locale;

  let expense: ExpenseDetailDto;
  let categories: LookupOptionDto[];
  let staffOptions: ExpenseSelectOption[];

  try {
    [expense, categories, staffOptions] = await Promise.all([
      api.get<ExpenseDetailDto>(`/api/expenses/${id}`),
      api
        .get<LookupOptionDto[]>(expenseCategoryRoutes.options)
        .catch(() => [] as LookupOptionDto[]),
      api
        .get<ExpenseSelectOption[]>("/api/staff/options")
        .catch(() => [] as ExpenseSelectOption[]),
    ]);
  } catch (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
        <SearchX className="size-12 text-muted-foreground/60" aria-hidden />
        <h1 className="mt-4 text-h4 font-semibold text-foreground">
          {missing ? t("detail.notFoundTitle") : t("detail.errorTitle")}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {missing ? t("detail.notFoundBody") : t("detail.errorBody")}
        </p>
        <Button asChild className="mt-4">
          <Link href={expensePaths.list}>{t("detail.backToExpenses")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-180">
      {/* Back goes to the DETAIL page, not the list — that is where the owner
          came from, and it is where Save lands them. */}
      <Link
        href={expensePaths.detail(expense.id)}
        className="mb-2 inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-4" aria-hidden />
        <span className="font-mono text-[13px]">{expense.code}</span>
      </Link>

      <h1 className="text-h2 font-semibold text-foreground">
        {t("edit.title", { code: expense.code })}
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        {t("edit.subtitle", {
          date: formatDate(expense.expenseDate, locale),
        })}
      </p>

      <ExpenseForm
        mode="edit"
        expenseId={expense.id}
        expenseCode={expense.code}
        initial={toFormInitial(expense)}
        categories={withHistoricalOption(
          categories.map((c) => ({ id: c.id, label: c.label })),
          expense.categoryId,
          expense.categoryName,
        )}
        staffOptions={withHistoricalOption(
          staffOptions,
          expense.staffId,
          expense.staffName,
        )}
      />
    </div>
  );
}
