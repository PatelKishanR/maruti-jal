import { Fragment } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, PackageCheck, SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Quantity } from "@/components/common/money";
import { formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { JarReconciliationReportDto } from "@/lib/dto/report.dto";
import {
  GROUP_CELL,
  RGroupRow,
  RHead,
  ReportBanner,
  ReportEmpty,
  ReportNote,
  ReportSection,
  ReportTable,
  RRow,
  RTd,
  RTh,
  RTotalRow,
  SummaryBand,
  SummaryCell,
  TOTAL_CELL,
} from "../report-shell";

/** Below 85% amber, below 70% red, exactly 100% green. §11.3 */
function rateTone(rate: number | null): string {
  if (rate === null) return "text-muted-foreground";
  if (rate >= 100) return "text-success";
  if (rate < 70) return "text-destructive";
  if (rate < 85) return "text-warning";
  return "text-foreground";
}

/**
 * Jar reconciliation. Spec: design/MODULES/09-reports.md §11
 *
 * Where every jar is: issued, returned empty, returned filled, written off,
 * still out — per staff member and product. The operational counterpart to the
 * coin ledger.
 *
 * THE `FILLED` COLUMN NEEDS ITS FOOTNOTE. Without it the column reads as an
 * error; with it, `"Filled" jars came back unsold and were credited against the
 * order total` explains a number that would otherwise look like a mistake. §11.3
 *
 * RETURN % IS RECOMPUTED FROM THE TOTALS at every level — row, staff group and
 * grand total — never averaged from the level below. Averaging averages is how
 * a 93% return rate becomes an 87% one. §11.3
 *
 * GROUP ORDER IS `STILL OUT` DESCENDING and does not change. The person holding
 * the most jars is the first name on the page, every time. §11.6
 */
export async function JarReconciliationReport({
  report,
}: {
  report: JarReconciliationReportDto;
}) {
  const t = await getTranslations("reports.jar-reconciliation");
  const { summary, totals } = report;

  const settled = report.groups.length > 0 && summary.stillOut === 0;

  return (
    <>
      {summary.writtenOff > 0 ? (
        <ReportBanner
          tone="warning"
          icon={AlertTriangle}
          title={t("banner.writeOffs", {
            count: formatQuantity(summary.writtenOff),
          })}
        />
      ) : null}

      {/* Five cells on xl, dropping to 3+2 on lg. §11.3 */}
      <SummaryBand columns={5}>
        <SummaryCell
          label={t("summary.issued")}
          value={<Quantity value={summary.issued} emphasis />}
        />
        <SummaryCell
          label={t("summary.returned")}
          value={<Quantity value={summary.returned} />}
          context={t("summary.returnedSplit", {
            empty: formatQuantity(summary.empty),
            filled: formatQuantity(summary.filled),
          })}
        />
        <SummaryCell
          label={t("summary.writtenOff")}
          value={<Quantity value={summary.writtenOff} zeroAs="dash" />}
          tone={summary.writtenOff > 0 ? "danger" : "default"}
        />
        <SummaryCell
          label={t("summary.stillOut")}
          value={<Quantity value={summary.stillOut} zeroAs="dash" emphasis />}
          tone={summary.stillOut > 0 ? "danger" : "default"}
          emphasis
          badge={
            summary.overdue > 0 ? (
              <span className="rounded-full bg-(--badge-danger-bg) px-2 py-0.5 text-caption font-medium text-(--badge-danger-fg)">
                {t("summary.overdue", {
                  count: formatQuantity(summary.overdue),
                })}
              </span>
            ) : undefined
          }
        />
        <SummaryCell
          label={t("summary.returnRate")}
          value={
            summary.returnRatePercent === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span>{formatQuantity(summary.returnRatePercent)}%</span>
            )
          }
        />
      </SummaryBand>

      {settled ? (
        <Card className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center print:hidden">
          <PackageCheck className="size-12 text-success" aria-hidden />
          <h2 className="mt-4 text-h4 font-semibold text-foreground">
            {t("allSettled")}
          </h2>
        </Card>
      ) : (
        <ReportSection>
          {report.groups.length === 0 ? (
            <ReportEmpty
              icon={SearchX}
              title={t("empty.title")}
              body={t("empty.body")}
            />
          ) : (
            <>
              <ReportTable minWidth={880} hint={t("swipeHint")}>
                <RHead>
                  <RTh pinned>{t("columns.staffProduct")}</RTh>
                  <RTh align="right">{t("columns.issued")}</RTh>
                  <RTh align="right">{t("columns.empty")}</RTh>
                  <RTh align="right">{t("columns.filled")}</RTh>
                  <RTh align="right">{t("columns.lost")}</RTh>
                  <RTh align="right">{t("columns.stillOut")}</RTh>
                  <RTh align="right">{t("columns.returnRate")}</RTh>
                </RHead>

                <tbody>
                  {report.groups.map((group) => (
                    <Fragment key={group.staffId}>
                      {/* A collapsed report is a per-staff summary, so the
                          group row carries the group's own totals in EVERY
                          numeric column. §11.3 */}
                      <RGroupRow>
                        <td
                          className={cn(GROUP_CELL, "sticky left-0 z-10 bg-muted")}
                        >
                          <Link href={group.href} className="hover:underline">
                            {group.staffName}
                          </Link>
                        </td>
                        <td className={cn(GROUP_CELL, "text-right")}>
                          <Quantity value={group.issued} emphasis />
                        </td>
                        <td className={cn(GROUP_CELL, "text-right")}>
                          <Quantity value={group.empty} zeroAs="dash" />
                        </td>
                        <td className={cn(GROUP_CELL, "text-right")}>
                          <Quantity value={group.filled} zeroAs="dash" />
                        </td>
                        <td className={cn(GROUP_CELL, "text-right")}>
                          <Quantity
                            value={group.lost}
                            zeroAs="dash"
                            className={group.lost > 0 ? "text-destructive" : undefined}
                          />
                        </td>
                        <td className={cn(GROUP_CELL, "text-right")}>
                          <StillOut
                            value={group.stillOut}
                            days={group.oldestDays}
                          />
                        </td>
                        <td
                          className={cn(
                            GROUP_CELL,
                            "text-right font-mono tabular-nums",
                            rateTone(group.returnRatePercent),
                          )}
                        >
                          {group.returnRatePercent === null
                            ? "—"
                            : `${formatQuantity(group.returnRatePercent)}%`}
                        </td>
                      </RGroupRow>

                      {group.rows.map((row) => (
                        <RRow key={`${group.staffId}-${row.productId}`}>
                          <RTd pinned className="pl-10">
                            <Link href={row.href} className="hover:underline">
                              {row.productTitle}
                            </Link>
                          </RTd>
                          <RTd align="right">
                            <Quantity value={row.issued} />
                          </RTd>
                          <RTd align="right">
                            <Quantity value={row.empty} zeroAs="dash" />
                          </RTd>
                          <RTd align="right">
                            <Quantity value={row.filled} zeroAs="dash" />
                          </RTd>
                          <RTd align="right">
                            <Quantity
                              value={row.lost}
                              zeroAs="dash"
                              className={
                                row.lost > 0 ? "text-destructive" : undefined
                              }
                            />
                          </RTd>
                          <RTd align="right">
                            <StillOut
                              value={row.stillOut}
                              days={row.oldestDays}
                            />
                          </RTd>
                          <RTd
                            align="right"
                            className={cn(
                              "font-mono tabular-nums",
                              rateTone(row.returnRatePercent),
                            )}
                          >
                            {row.returnRatePercent === null
                              ? "—"
                              : `${formatQuantity(row.returnRatePercent)}%`}
                          </RTd>
                        </RRow>
                      ))}
                    </Fragment>
                  ))}
                </tbody>

                <tfoot>
                  <RTotalRow>
                    <td className={cn(TOTAL_CELL, "sticky left-0 z-10 bg-muted")}>
                      {t("total")}
                    </td>
                    <td className={cn(TOTAL_CELL, "text-right")}>
                      <Quantity value={totals.issued} emphasis />
                    </td>
                    <td className={cn(TOTAL_CELL, "text-right")}>
                      <Quantity value={totals.empty} zeroAs="dash" emphasis />
                    </td>
                    <td className={cn(TOTAL_CELL, "text-right")}>
                      <Quantity value={totals.filled} zeroAs="dash" emphasis />
                    </td>
                    <td className={cn(TOTAL_CELL, "text-right")}>
                      <Quantity value={totals.lost} zeroAs="dash" emphasis />
                    </td>
                    <td className={cn(TOTAL_CELL, "text-right")}>
                      <Quantity value={totals.stillOut} zeroAs="dash" emphasis />
                    </td>
                    <td
                      className={cn(
                        TOTAL_CELL,
                        "text-right font-mono font-semibold tabular-nums",
                      )}
                    >
                      {totals.returnRatePercent === null
                        ? "—"
                        : `${formatQuantity(totals.returnRatePercent)}%`}
                    </td>
                  </RTotalRow>
                </tfoot>
              </ReportTable>

              <ReportNote>{t("filledNote")}</ReportNote>
              <ReportNote>
                {t("nowNote", {
                  count: formatQuantity(report.jarsOutNow),
                })}
              </ReportNote>
            </>
          )}
        </ReportSection>
      )}
    </>
  );
}

/** A 6px leading dot: Spark Red past a week, Spark Orange inside it. §11.3 */
function StillOut({ value, days }: { value: number; days: number }) {
  if (value === 0) {
    return <Quantity value={0} zeroAs="dash" />;
  }

  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          days >= 7 ? "bg-destructive" : "bg-warning",
        )}
        aria-hidden
      />
      <Quantity value={value} emphasis />
    </span>
  );
}
