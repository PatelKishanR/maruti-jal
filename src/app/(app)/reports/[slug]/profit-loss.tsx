import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, SearchX } from "lucide-react";
import { Money } from "@/components/common/money";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ProfitLossLineDto, ProfitLossReportDto } from "@/lib/dto/report.dto";
import {
  RHead,
  ReportBanner,
  ReportEmpty,
  ReportFootnoteCard,
  ReportNote,
  ReportSection,
  ReportTable,
  RSubtotalRow,
  RTd,
  RTh,
  SUBTOTAL_CELL,
  SummaryBand,
  SummaryCell,
} from "../report-shell";

/**
 * Profit & loss summary. Spec: design/MODULES/09-reports.md §10
 *
 * Answers "did the business make money this period?" with income by channel
 * against expenses by category. Not a bookkeeping statement — a categorised
 * list of outgoings against categorised income, which is sufficient and
 * immediately understandable.
 *
 * ORDERED BIGGEST FIRST, ALWAYS. The largest leak reads first. §10.3
 *
 * THE PROPORTION BAR IS SUPPLEMENTARY. The percentage carries the value; the
 * bar carries the shape. It is dropped below 480px and nothing is lost. §10.3
 *
 * A PERIOD WITH INCOME AND NO EXPENSES gets a Warning banner rather than a
 * flattering profit figure — that is almost always a data gap, not a very good
 * month. §10.4
 */
export async function ProfitLossReport({
  report,
}: {
  report: ProfitLossReportDto;
}) {
  const t = await getTranslations("reports.profit-loss");
  const { summary, net } = report;
  const loss = summary.profit < 0;
  const nothing = summary.income === 0 && summary.expenses === 0;

  return (
    <>
      {report.expensesMissing ? (
        <ReportBanner
          tone="warning"
          icon={AlertTriangle}
          title={t("banner.expensesMissing")}
        />
      ) : null}
      {report.incomeMissing ? (
        <ReportBanner
          tone="warning"
          icon={AlertTriangle}
          title={t("banner.incomeMissing")}
        />
      ) : null}

      <SummaryBand>
        <SummaryCell
          label={t("summary.income")}
          value={<Money value={summary.income} />}
        />
        <SummaryCell
          label={t("summary.expenses")}
          value={<Money value={summary.expenses} />}
        />
        <SummaryCell
          label={t("summary.profit")}
          value={<Money value={summary.profit} emphasis zeroAs="value" />}
          tone={loss ? "danger" : "default"}
          emphasis
        />
        <SummaryCell
          label={t("summary.margin")}
          value={
            summary.marginPercent === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span>{formatQuantity(summary.marginPercent)}%</span>
            )
          }
          tone={
            summary.marginPercent !== null && summary.marginPercent < 0
              ? "danger"
              : "default"
          }
        />
      </SummaryBand>

      {nothing ? (
        <ReportSection>
          <ReportEmpty
            icon={SearchX}
            title={t("empty.title")}
            body={t("empty.body")}
          />
        </ReportSection>
      ) : (
        <>
          <ReportSection title={t("income.title")}>
            <LineTable
              rows={report.income.rows}
              total={report.income.total}
              tone="income"
              labels={{
                name: t("columns.channel"),
                amount: t("columns.amount"),
                percent: t("columns.percentOfIncome"),
                total: t("totals.income"),
                translate: (key: string) => t(`channels.${key}`),
              }}
            />
          </ReportSection>

          <ReportSection title={t("expenses.title")}>
            <LineTable
              rows={report.expenses.rows}
              total={report.expenses.total}
              tone="expense"
              labels={{
                name: t("columns.category"),
                amount: t("columns.amount"),
                percent: t("columns.percentOfExpenses"),
                total: t("totals.expenses"),
                translate: (_key: string, name: string | null) => name ?? "—",
              }}
            />
            {report.expenses.zeroCategoryCount > 0 ? (
              <ReportNote>
                {t("expenses.zeroNote", {
                  count: formatQuantity(report.expenses.zeroCategoryCount),
                })}
              </ReportNote>
            ) : null}
          </ReportSection>

          {/* The one 28px figure in the module — the number the owner opened
              the report for. §10.3 */}
          <ReportFootnoteCard
            className={
              loss ? "border-l-[3px] border-l-destructive" : undefined
            }
          >
            <p className="text-body-sm text-muted-foreground">
              {t("net.line", {
                income: formatINR(net.income),
                expenses: formatINR(net.expenses),
              })}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-h4 font-semibold text-foreground">
                {loss ? t("net.loss") : t("net.profit")}
              </p>
              <Money
                value={net.profit}
                emphasis
                zeroAs="value"
                className="font-mono text-h2 font-bold"
              />
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {t("net.context", {
                margin:
                  net.marginPercent === null
                    ? "—"
                    : `${formatQuantity(net.marginPercent)}%`,
                days: formatQuantity(net.days),
                average: formatINR(net.averagePerDay),
              })}
            </p>
          </ReportFootnoteCard>
        </>
      )}
    </>
  );
}

function LineTable({
  rows,
  total,
  tone,
  labels,
}: {
  rows: ProfitLossLineDto[];
  total: number;
  tone: "income" | "expense";
  labels: {
    name: string;
    amount: string;
    percent: string;
    total: string;
    translate: (key: string, name: string | null) => string;
  };
}) {
  // The bar is scaled to the LARGEST ROW IN ITS OWN TABLE, not to the total —
  // otherwise every bar on a well-spread table is a sliver. §10.3
  const largest = rows.reduce((max, row) => Math.max(max, row.amount), 0);

  return (
    <ReportTable minWidth={520}>
      <RHead>
        <RTh pinned>{labels.name}</RTh>
        <RTh align="right">{labels.amount}</RTh>
        <RTh align="right">{labels.percent}</RTh>
        <RTh className="hidden w-24 sm:table-cell" />
      </RHead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="group border-t border-border hover:bg-muted">
            <RTd pinned>
              <Link href={row.href} className="hover:underline">
                {labels.translate(row.key, row.name)}
              </Link>
            </RTd>
            <RTd align="right">
              <Money value={row.amount} emphasis />
            </RTd>
            <RTd align="right">
              <span className="font-mono tabular-nums">
                {formatQuantity(row.percent)}%
              </span>
            </RTd>
            <RTd className="hidden sm:table-cell">
              <span
                className="block h-1.5 w-20 rounded-full bg-border"
                aria-hidden
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full",
                    tone === "income" ? "bg-primary" : "bg-warning",
                  )}
                  style={{
                    width: `${largest > 0 ? Math.round((row.amount / largest) * 100) : 0}%`,
                  }}
                />
              </span>
            </RTd>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <RSubtotalRow>
          <td
            className={cn(SUBTOTAL_CELL, "sticky left-0 z-10 bg-card text-muted-foreground")}
          >
            {labels.total}
          </td>
          <td className={cn(SUBTOTAL_CELL, "text-right")}>
            <Money value={total} emphasis />
          </td>
          <td className={cn(SUBTOTAL_CELL, "text-right font-mono tabular-nums")}>
            {total === 0 ? "—" : "100.0%"}
          </td>
          <td className={cn(SUBTOTAL_CELL, "hidden sm:table-cell")} />
        </RSubtotalRow>
      </tfoot>
    </ReportTable>
  );
}
