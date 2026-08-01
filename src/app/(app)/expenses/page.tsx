import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard, KpiRow } from "@/components/common/kpi-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { formatINR, formatQuantity } from "@/lib/money";
import { parseListQuery, TABLE_PARAMS, type ListQuery } from "@/lib/table";
import { expenseTableConfig } from "@/lib/table/configs/expense";
import {
  expensePaths,
  type ExpenseListResponseDto,
} from "@/lib/dto/expense.dto";
import type { ExpenseSelectOption } from "./expense-form-model";
import { monthAsDate } from "./expense-months";
import { ExpensesLoadError, ExpensesTable } from "./expenses-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The cash-out register. Spec: design/MODULES/07-expenses.md §3
 *
 * Fetches through the API like every other screen — no service import, no
 * repository, no DataSource. See .claude/ARCHITECTURE.md §4
 *
 * All table state lives in the URL, so this page re-runs per request and the
 * server stays the single source of truth. `parseListQuery` neutralises
 * everything hostile before it becomes a query string: the sort value has to be
 * a KEY of `expenseTableConfig.sortable` or it falls back to the default.
 *
 * **The month is not defaulted here.** "This month" is IST-dependent, and only
 * the server that owns the data can resolve it honestly — the service does, and
 * returns the month it chose so the selector, the KPI labels and the foot row
 * all name the same one.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("expenses");
  const format = await getFormatter();
  const params = await searchParams;
  const query = parseListQuery(params, expenseTableConfig);

  const header = (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <Button asChild>
          <Link href={expensePaths.new}>
            <Plus aria-hidden />
            {t("actions.add")}
          </Link>
        </Button>
      }
    />
  );

  let data: ExpenseListResponseDto;
  let staffOptions: ExpenseSelectOption[];

  try {
    [data, staffOptions] = await Promise.all([
      api.get<ExpenseListResponseDto>(`/api/expenses?${toApiQuery(query)}`),
      // Fetched here rather than inside the filter popover so a bookmarked
      // `?staff=<uuid>` shows a NAME the moment the page paints.
      api
        .get<ExpenseSelectOption[]>("/api/staff/options")
        .catch(() => [] as ExpenseSelectOption[]),
    ]);
  } catch {
    // Plain language, no stack trace, and a retry that re-runs this render.
    return (
      <>
        {header}
        <ExpensesLoadError />
      </>
    );
  }

  const { kpis } = data;

  const monthLabel = (month: string) =>
    format.dateTime(monthAsDate(month), {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <>
      {header}

      {/* Every number is a door — each card lands on the list it describes. §1.4
          These are rendered straight from the server: `KpiCard` takes an icon
          NAME, so no LucideIcon function has to cross the boundary and this
          strip needs no client island. See components/common/icons.ts */}
      <KpiRow className="mb-6">
        <KpiCard
          icon="expense"
          label={t("kpi.thisMonth")}
          value={kpis.thisMonthTotal}
          format="money"
          href={expensePaths.month(kpis.month)}
          breakdown={t("kpi.expenseCount", {
            count: formatQuantity(kpis.thisMonthCount),
          })}
          zeroHint={t("kpi.nothingThisMonth", { month: monthLabel(kpis.month) })}
        />

        {/* The value is a WORD, not a figure — `Fuel` set in 28px tabular mono
            reads as a code, and Gujarati clips at that size. The amount moves
            down to the breakdown, where mono belongs. DESIGN-STANDARDS §8 */}
        <KpiCard
          icon="expense"
          label={t("kpi.biggestCategory")}
          valueTypography="name"
          valueLabel={kpis.biggestCategory?.categoryName}
          href={
            kpis.biggestCategory
              ? expensePaths.category(kpis.month, kpis.biggestCategory.categoryId)
              : undefined
          }
          breakdown={
            kpis.biggestCategory
              ? kpis.biggestCategory.sharePercent === null
                ? formatINR(kpis.biggestCategory.total)
                : t("kpi.categoryShare", {
                    amount: formatINR(kpis.biggestCategory.total),
                    percent: kpis.biggestCategory.sharePercent,
                  })
              : t("kpi.noSpendYet")
          }
        />

        {/*
          THE TREND INVERTS HERE. Spending more is bad news, and a green
          ▲ 8.4% on a rising expense card is worse than no colour at all —
          it congratulates the owner for the thing he opened the page to
          worry about. `invertTrend` flips it to Danger. DESIGN-STANDARDS §8
        */}
        <KpiCard
          icon={kpis.trend === "down" ? "trendDown" : "trendUp"}
          label={t("kpi.vsLastMonth")}
          value={Math.abs(kpis.deltaAmount)}
          format="money"
          invertTrend
          trend={
            kpis.deltaPercent === null
              ? undefined
              : {
                  direction: kpis.trend,
                  percent: kpis.deltaPercent,
                  label: t("kpi.vsMonth", {
                    month: monthLabel(kpis.previousMonth),
                  }),
                }
          }
          href={expensePaths.month(kpis.previousMonth)}
          breakdown={
            // An unchanged month is covered by `zeroHint`; "₹0.00 more than
            // Jul" would be a sentence nobody needs to read.
            kpis.deltaAmount === 0
              ? undefined
              : kpis.deltaPercent === null
                ? t("kpi.noPreviousMonth", {
                    month: monthLabel(kpis.previousMonth),
                  })
                : t(kpis.trend === "down" ? "kpi.lessThan" : "kpi.moreThan", {
                    amount: formatINR(Math.abs(kpis.deltaAmount)),
                    month: monthLabel(kpis.previousMonth),
                  })
          }
          zeroHint={t("kpi.sameAsLastMonth", {
            month: monthLabel(kpis.previousMonth),
          })}
        />

        {/*
          Profit mixes income and expense, and income comes from delivery
          orders, party orders and walk-ins — none of which exist yet. The card
          renders `—` and says why, rather than showing turnover-minus-nothing
          and calling it profit. Trend is NOT inverted here: profit rising is
          genuinely good news.
        */}
        <KpiCard
          icon="cash"
          label={t("kpi.profit")}
          value={kpis.profit.profit}
          format="money"
          breakdown={
            kpis.profit.available
              ? t("kpi.profitBreakdown", {
                  income: formatINR(kpis.profit.income ?? 0),
                  expenses: formatINR(kpis.profit.expenses),
                })
              : t("kpi.profitPending")
          }
        />
      </KpiRow>

      <ExpensesTable
        result={data.result}
        totals={data.totals}
        categories={data.categories}
        staffOptions={staffOptions}
        month={data.month}
        totalRecorded={data.totalRecorded}
      />
    </>
  );
}

/**
 * `ListQuery` → the API's search string.
 *
 * Only keys the module declared survive `parseListQuery`, so nothing unknown
 * can be forwarded and the sort key is already known-good.
 */
function toApiQuery(query: ListQuery): string {
  const search = new URLSearchParams();

  search.set(TABLE_PARAMS.page, String(query.page));
  search.set(TABLE_PARAMS.pageSize, String(query.pageSize));
  search.set(TABLE_PARAMS.sort, query.sort.key);
  search.set(TABLE_PARAMS.dir, query.sort.dir);
  if (query.q) search.set(TABLE_PARAMS.q, query.q);

  for (const [key, value] of Object.entries(query.filters)) {
    if (typeof value === "string" && value) search.set(key, value);
  }

  return search.toString();
}
