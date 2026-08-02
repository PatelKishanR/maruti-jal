import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Money, Quantity } from "@/components/common/money";
import { formatDate } from "@/lib/dates";
import { formatINR, formatQuantity, formatRupeesPlain } from "@/lib/money";
import { cn } from "@/lib/utils";
import { dashboardPaths } from "@/lib/api/routes.dashboard";
import type { Locale } from "@/i18n/config";
import type { StaffOutstandingReportDto } from "@/lib/dto/report.dto";
import {
  RHead,
  ReportBanner,
  ReportNote,
  ReportSection,
  ReportTable,
  RRow,
  RSubtotalRow,
  RTd,
  RTh,
  SUBTOTAL_CELL,
  SummaryBand,
  SummaryCell,
} from "../report-shell";
import {
  PrintDocument,
  PrintFooter,
  PrintHeader,
  PrintSection,
  PrintSignatures,
  PrintSummary,
} from "../print-document";

/** Spark Orange past 7 days, Spark Red past 15. DESIGN-STANDARDS §13. */
function ageTone(days: number): string {
  return days >= 15
    ? "text-destructive"
    : days > 7
      ? "text-warning"
      : "text-muted-foreground";
}

/**
 * The staff outstanding statement. Spec: design/MODULES/09-reports.md §6
 *
 * Everything one staff member owes, in one document, handed over during a
 * settlement conversation. It has to survive being read across a table by
 * someone who did not open it — which is why the print layout in §12.2 is a
 * different design rather than a screenshot, and why it ends in two signature
 * rules.
 *
 * ALL THREE SECTIONS ALWAYS RENDER, even when empty. A settlement conversation
 * needs to SEE that a category is clear, not have it silently absent. §6.3
 *
 * SECTION C IGNORES THE DATE RANGE and says so on its own heading. A jar out
 * since June is still out today, and hiding it because the range starts in July
 * would be a lie. §6.3
 */
export async function StaffOutstandingReport({
  report,
}: {
  report: StaffOutstandingReportDto;
}) {
  const t = await getTranslations("reports.staff-outstanding");
  const locale = (await getLocale()) as Locale;
  const { meta, summary, staff } = report;

  const settled =
    summary.totalOwed === 0 && summary.jarsOut === 0 && staff !== null;

  return (
    <>
      {staff && !staff.isActive ? (
        <ReportBanner
          tone="warning"
          icon={AlertTriangle}
          title={t("inactive", { name: staff.name })}
        />
      ) : null}

      <SummaryBand>
        <SummaryCell
          label={t("summary.totalOwed")}
          value={<Money value={summary.totalOwed} emphasis />}
          context={t("summary.openRecords", {
            count: formatQuantity(
              summary.openOrderCount + summary.openIssueCount,
            ),
          })}
          tone={summary.totalOwed > 0 ? "danger" : "default"}
          emphasis
        />
        <SummaryCell
          label={t("summary.orderBalances")}
          value={<Money value={summary.orderBalances} />}
          context={t("summary.orders", {
            count: formatQuantity(summary.openOrderCount),
          })}
          href={staff ? dashboardPaths().ordersForStaff(staff.id) : undefined}
        />
        <SummaryCell
          label={t("summary.coinDues")}
          value={<Money value={summary.coinDues} />}
          context={t("summary.issues", {
            count: formatQuantity(summary.openIssueCount),
          })}
          href={
            staff ? dashboardPaths().coinIssuesForStaff(staff.id) : undefined
          }
        />
        <SummaryCell
          label={t("summary.jarsOut")}
          value={<Quantity value={summary.jarsOut} zeroAs="dash" />}
          tone={summary.jarsOut > 0 ? "danger" : "default"}
          href={staff ? dashboardPaths().jarsForStaff(staff.id) : undefined}
          badge={
            report.jars.overdueQty > 0 ? (
              <span className="rounded-full bg-(--badge-danger-bg) px-2 py-0.5 text-caption font-medium text-(--badge-danger-fg)">
                {t("summary.overdue", {
                  count: formatQuantity(report.jars.overdueQty),
                  days: formatQuantity(summary.jarsOldestDays),
                })}
              </span>
            ) : undefined
          }
        />
      </SummaryBand>

      {settled ? (
        <Card className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center print:hidden">
          <CheckCircle2 className="size-12 text-success" aria-hidden />
          <h2 className="mt-4 text-h4 font-semibold text-foreground">
            {t("allClear.title", { name: staff.name })}
          </h2>
          <p className="mt-1 max-w-prose text-body-sm text-muted-foreground">
            {t("allClear.body", { date: formatDate(meta.to, locale) })}
          </p>
        </Card>
      ) : (
        <>
          {/* ── Section A ── */}
          <ReportSection
            title={t("sectionA.title")}
            meta={t("sectionA.meta", {
              count: formatQuantity(report.orders.count),
              amount: formatINR(report.orders.subtotal.balance),
            })}
          >
            {report.orders.rows.length === 0 ? (
              <ReportNote>{t("sectionA.empty")}</ReportNote>
            ) : (
              <ReportTable minWidth={780} hint={t("swipeHint")}>
                <RHead>
                  <RTh pinned>{t("columns.order")}</RTh>
                  <RTh>{t("columns.date")}</RTh>
                  <RTh>{t("columns.items")}</RTh>
                  <RTh align="right">{t("columns.total")}</RTh>
                  <RTh align="right">{t("columns.paid")}</RTh>
                  <RTh align="right">{t("columns.balance")}</RTh>
                  <RTh align="right">{t("columns.age")}</RTh>
                </RHead>
                <tbody>
                  {report.orders.rows.map((row) => (
                    <RRow key={row.id}>
                      <RTd pinned className="font-mono text-caption">
                        <Link
                          href={row.href}
                          className="text-primary hover:underline"
                        >
                          {row.code}
                        </Link>
                      </RTd>
                      <RTd>{formatDate(row.orderDate, locale)}</RTd>
                      <RTd className="text-caption text-muted-foreground">
                        {t("columns.itemsValue", {
                          items: formatQuantity(row.itemCount),
                          units: formatQuantity(row.quantity),
                        })}
                      </RTd>
                      <RTd align="right">
                        <Money value={row.total} />
                      </RTd>
                      <RTd align="right">
                        <Money value={row.paid} />
                      </RTd>
                      <RTd align="right">
                        <Money value={row.balance} emphasis />
                      </RTd>
                      <RTd align="right">
                        <span
                          className={cn(
                            "font-mono text-caption tabular-nums",
                            ageTone(row.ageDays),
                          )}
                        >
                          {t("columns.ageValue", {
                            days: formatQuantity(row.ageDays),
                          })}
                        </span>
                      </RTd>
                    </RRow>
                  ))}
                </tbody>
                <tfoot>
                  <RSubtotalRow>
                    <td
                      className={cn(SUBTOTAL_CELL, "sticky left-0 z-10 bg-card text-muted-foreground")}
                    >
                      {t("subtotal")}
                    </td>
                    <td className={SUBTOTAL_CELL} />
                    <td className={SUBTOTAL_CELL} />
                    <td className={cn(SUBTOTAL_CELL, "text-right")}>
                      <Money value={report.orders.subtotal.total} emphasis />
                    </td>
                    <td className={cn(SUBTOTAL_CELL, "text-right")}>
                      <Money value={report.orders.subtotal.paid} emphasis />
                    </td>
                    <td className={cn(SUBTOTAL_CELL, "text-right")}>
                      <Money value={report.orders.subtotal.balance} emphasis />
                    </td>
                    <td className={SUBTOTAL_CELL} />
                  </RSubtotalRow>
                </tfoot>
              </ReportTable>
            )}

            {/* The summary band is the ALL-TIME position; this section is not.
                When the range leaves a balance behind, the document says so
                rather than letting the reader discover it. */}
            {report.orders.outOfRangeBalance !== 0 ? (
              <ReportNote>
                {t("sectionA.outOfRange", {
                  amount: formatINR(report.orders.outOfRangeBalance),
                })}
              </ReportNote>
            ) : null}
          </ReportSection>

          {/* ── Section B ── */}
          <ReportSection
            title={t("sectionB.title")}
            meta={t("sectionB.meta", {
              count: formatQuantity(report.coinIssues.count),
              amount: formatINR(report.coinIssues.subtotal.pending),
            })}
          >
            {report.coinIssues.rows.length === 0 ? (
              <ReportNote>{t("sectionB.empty")}</ReportNote>
            ) : (
              <ReportTable minWidth={820} hint={t("swipeHint")}>
                <RHead>
                  <RTh pinned>{t("columns.issue")}</RTh>
                  <RTh>{t("columns.date")}</RTh>
                  <RTh align="right">{t("columns.issued")}</RTh>
                  <RTh align="right">{t("columns.returned")}</RTh>
                  <RTh align="right">{t("columns.paid")}</RTh>
                  <RTh align="right">{t("columns.pending")}</RTh>
                </RHead>
                <tbody>
                  {report.coinIssues.rows.map((row) => (
                    <RRow key={row.id}>
                      <RTd pinned className="font-mono text-caption">
                        <Link
                          href={row.href}
                          className="text-primary hover:underline"
                        >
                          {row.code}
                        </Link>
                      </RTd>
                      <RTd>{formatDate(row.issueDate, locale)}</RTd>
                      <RTd align="right" className="whitespace-nowrap">
                        {formatQuantity(row.coinsIssued)} /{" "}
                        {formatINR(row.issuedValue)}
                      </RTd>
                      <RTd align="right" className="whitespace-nowrap">
                        {formatQuantity(row.coinsReturned)} /{" "}
                        {formatINR(row.returnedValue)}
                      </RTd>
                      <RTd align="right">
                        <Money value={row.paid} />
                      </RTd>
                      <RTd align="right">
                        {/* A negative pending is a REFUND the company owes —
                            Nova Blue, not Danger. DESIGN-STANDARDS §13. */}
                        <Money
                          value={row.pending}
                          emphasis
                          variant={row.pending < 0 ? "refund" : "default"}
                        />
                      </RTd>
                    </RRow>
                  ))}
                </tbody>
                <tfoot>
                  <RSubtotalRow>
                    <td
                      className={cn(SUBTOTAL_CELL, "sticky left-0 z-10 bg-card text-muted-foreground")}
                    >
                      {t("subtotal")}
                    </td>
                    <td className={SUBTOTAL_CELL} />
                    <td className={SUBTOTAL_CELL} />
                    <td className={SUBTOTAL_CELL} />
                    <td className={cn(SUBTOTAL_CELL, "text-right")}>
                      <Money value={report.coinIssues.subtotal.paid} emphasis />
                    </td>
                    <td className={cn(SUBTOTAL_CELL, "text-right")}>
                      <Money
                        value={report.coinIssues.subtotal.pending}
                        emphasis
                      />
                    </td>
                  </RSubtotalRow>
                </tfoot>
              </ReportTable>
            )}

            {report.coinIssues.outOfRangePending !== 0 ? (
              <ReportNote>
                {t("sectionB.outOfRange", {
                  amount: formatINR(report.coinIssues.outOfRangePending),
                })}
              </ReportNote>
            ) : null}
          </ReportSection>

          {/* ── Section C ── */}
          <ReportSection
            title={t("sectionC.title")}
            note={t("sectionC.note")}
            meta={t("sectionC.meta", {
              count: formatQuantity(report.jars.totalQty),
            })}
          >
            {report.jars.rows.length === 0 ? (
              <ReportNote>{t("sectionC.empty")}</ReportNote>
            ) : (
              <ReportTable minWidth={720} hint={t("swipeHint")}>
                <RHead>
                  <RTh pinned>{t("columns.product")}</RTh>
                  <RTh>{t("columns.fromOrder")}</RTh>
                  <RTh>{t("columns.dateOut")}</RTh>
                  <RTh align="right">{t("columns.qtyOut")}</RTh>
                  <RTh align="right">{t("columns.daysOut")}</RTh>
                </RHead>
                <tbody>
                  {report.jars.rows.map((row) => (
                    <RRow key={row.id}>
                      <RTd pinned>{row.productTitle}</RTd>
                      <RTd className="font-mono text-caption">
                        <Link
                          href={row.href}
                          className="text-primary hover:underline"
                        >
                          {row.orderCode}
                        </Link>
                      </RTd>
                      <RTd>{formatDate(row.orderDate, locale)}</RTd>
                      <RTd align="right">
                        <Quantity value={row.qtyOut} emphasis />
                      </RTd>
                      <RTd align="right">
                        <span
                          className={cn(
                            "inline-flex items-center justify-end gap-1.5 font-mono text-caption tabular-nums",
                            ageTone(row.daysOut),
                          )}
                        >
                          {row.daysOut > 7 ? (
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                row.daysOut >= 15
                                  ? "bg-destructive"
                                  : "bg-warning",
                              )}
                              aria-hidden
                            />
                          ) : null}
                          {t("columns.ageValue", {
                            days: formatQuantity(row.daysOut),
                          })}
                        </span>
                      </RTd>
                    </RRow>
                  ))}
                </tbody>
                <tfoot>
                  <RSubtotalRow>
                    <td
                      className={cn(SUBTOTAL_CELL, "sticky left-0 z-10 bg-card text-muted-foreground")}
                    >
                      {t("total")}
                    </td>
                    <td className={SUBTOTAL_CELL} />
                    <td className={SUBTOTAL_CELL} />
                    <td className={cn(SUBTOTAL_CELL, "text-right")}>
                      <Quantity value={report.jars.totalQty} emphasis />
                    </td>
                    <td className={SUBTOTAL_CELL} />
                  </RSubtotalRow>
                </tfoot>
              </ReportTable>
            )}
          </ReportSection>
        </>
      )}

      <PrintStatement report={report} />
    </>
  );
}

/* ── The A4 document ─────────────────────────────────────────────────────── */

/**
 * §12.2 — a settlement document, not a screenshot.
 *
 * THREE THINGS THE SCREEN DOES NOT DO:
 *  · a narrow right-aligned summary LIST rather than a band of large figures,
 *    because a band reads as a poster and a settlement needs a running total
 *  · a STATUS column on Section A, spelled as `Partial` / `Unpaid`, because the
 *    screen carries that as a badge colour and mono paper cannot
 *  · two signature rules, 15mm below the total — this is the document both
 *    people sign
 *
 * The `₹` symbol appears in the summary and the total rows only; the columns
 * are headed `TOTAL (₹)` and drop it per cell, which buys about 4mm of column
 * width across the page. §12.2
 */
async function PrintStatement({
  report,
}: {
  report: StaffOutstandingReportDto;
}) {
  const t = await getTranslations("reports.staff-outstanding");
  const p = await getTranslations("reports.print");
  const locale = (await getLocale()) as Locale;
  const { meta, summary } = report;

  return (
    <PrintDocument>
      <PrintHeader meta={meta} title={t("title")} />

      <PrintSummary
        rows={[
          {
            label: t("summary.orderBalances"),
            value: formatINR(summary.orderBalances),
          },
          { label: t("summary.coinDues"), value: formatINR(summary.coinDues) },
        ]}
        total={{
          label: t("summary.totalOwed"),
          value: formatINR(summary.totalOwed),
        }}
        note={t("print.jarsNote", {
          jars: formatQuantity(summary.jarsOut),
          overdue: formatQuantity(report.jars.overdueQty),
        })}
      />

      <PrintSection title={t("print.sectionA")}>
        <table>
          <thead>
            <tr>
              <th>{t("columns.order")}</th>
              <th>{t("columns.date")}</th>
              <th className="num">{p("column.total")}</th>
              <th className="num">{p("column.paid")}</th>
              <th className="num">{p("column.balance")}</th>
              <th>{t("columns.status")}</th>
              <th className="num">{t("columns.age")}</th>
            </tr>
          </thead>
          <tbody>
            {report.orders.rows.map((row) => (
              <tr key={row.id}>
                <td className="font-mono">{row.code}</td>
                <td>{formatDate(row.orderDate, locale)}</td>
                <td className="figure">{formatRupeesPlain(row.total)}</td>
                <td className="figure">
                  {row.paid === 0 ? "—" : formatRupeesPlain(row.paid)}
                </td>
                <td className="figure">{formatRupeesPlain(row.balance)}</td>
                {/* STATUS AS A WORD. §12.1 */}
                <td>{t(`status.${row.paymentStatus}`)}</td>
                <td className="figure">
                  {t("print.days", { days: formatQuantity(row.ageDays) })}
                </td>
              </tr>
            ))}
            {report.orders.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="italic">
                  {t("sectionA.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="subtotal">
              <td colSpan={2}>{t("subtotal")}</td>
              <td className="figure">
                {formatRupeesPlain(report.orders.subtotal.total)}
              </td>
              <td className="figure">
                {formatRupeesPlain(report.orders.subtotal.paid)}
              </td>
              <td className="figure">
                {formatRupeesPlain(report.orders.subtotal.balance)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </PrintSection>

      <PrintSection title={t("print.sectionB")}>
        <table>
          <thead>
            <tr>
              <th>{t("columns.issue")}</th>
              <th>{t("columns.date")}</th>
              <th className="num">{t("columns.issued")}</th>
              <th className="num">{t("columns.returned")}</th>
              <th className="num">{p("column.paid")}</th>
              <th className="num">{p("column.pending")}</th>
            </tr>
          </thead>
          <tbody>
            {report.coinIssues.rows.map((row) => (
              <tr key={row.id}>
                <td className="font-mono">{row.code}</td>
                <td>{formatDate(row.issueDate, locale)}</td>
                <td className="figure">
                  {formatQuantity(row.coinsIssued)} /{" "}
                  {formatRupeesPlain(row.issuedValue)}
                </td>
                <td className="figure">
                  {formatQuantity(row.coinsReturned)} /{" "}
                  {formatRupeesPlain(row.returnedValue)}
                </td>
                <td className="figure">{formatRupeesPlain(row.paid)}</td>
                <td className="figure">{formatRupeesPlain(row.pending)}</td>
              </tr>
            ))}
            {report.coinIssues.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="italic">
                  {t("sectionB.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="subtotal">
              <td colSpan={5}>{t("subtotal")}</td>
              <td className="figure">
                {formatRupeesPlain(report.coinIssues.subtotal.pending)}
              </td>
            </tr>
          </tfoot>
        </table>
      </PrintSection>

      <PrintSection title={t("print.sectionC")} note={t("print.sectionCNote")}>
        <table>
          <thead>
            <tr>
              <th>{t("columns.product")}</th>
              <th>{t("columns.fromOrder")}</th>
              <th>{t("columns.dateOut")}</th>
              <th className="num">{t("columns.qtyOut")}</th>
              <th className="num">{t("columns.daysOut")}</th>
            </tr>
          </thead>
          <tbody>
            {report.jars.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.productTitle}</td>
                <td className="font-mono">{row.orderCode}</td>
                <td>{formatDate(row.orderDate, locale)}</td>
                <td className="figure">{formatQuantity(row.qtyOut)}</td>
                <td className="figure">
                  {t("print.days", { days: formatQuantity(row.daysOut) })}
                </td>
              </tr>
            ))}
            {report.jars.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="italic">
                  {t("sectionC.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="subtotal">
              <td colSpan={3}>{t("total")}</td>
              <td className="figure">
                {formatQuantity(report.jars.totalQty)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </PrintSection>

      {/* Repeated at the foot even when Section C ends mid-page. §12.2 */}
      <div className="avoid-break mt-6 flex justify-end">
        <table className="w-[60mm]">
          <tbody>
            <tr className="grand-total">
              <td>{t("print.totalOwed")}</td>
              <td className="figure">{formatINR(summary.totalOwed)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <PrintSignatures
        blocks={[
          {
            label: p("receivedBy"),
            under: report.staff?.name,
            dateLabel: p("date"),
          },
          { label: p("issuedBy"), under: p("forBusiness"), dateLabel: p("date") },
        ]}
      />

      <PrintFooter meta={meta} />
    </PrintDocument>
  );
}
