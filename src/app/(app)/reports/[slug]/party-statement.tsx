import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Money, Quantity } from "@/components/common/money";
import { formatDate, formatTime } from "@/lib/dates";
import { formatINR, formatQuantity, formatRupeesPlain } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { PartyStatementReportDto } from "@/lib/dto/report.dto";
import {
  RHead,
  ReportBanner,
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
import {
  PrintDocument,
  PrintFooter,
  PrintHeader,
  PrintSection,
} from "../print-document";

/**
 * The party order statement. Spec: design/MODULES/09-reports.md §8
 *
 * THE ONLY REPORT AN OUTSIDER READS, which changes several decisions:
 *
 *  · STATUS IS A WORD, NOT A BADGE, even on screen — the client-facing register
 *    style has to stay consistent with the printed version the party is handed.
 *  · ROWS DO NOT NAVIGATE. Making them clickable would be an internal
 *    affordance on a document meant to be read flat. `Open party order ›` lives
 *    in the header instead. §8.3
 *  · PLANNED DAYS RENDER AT FULL OPACITY. A client needs to see what is still
 *    coming, so `Scheduled` days are not dimmed. §8.3
 *  · SKIPPED DAYS show `—` and are excluded from the total.
 */
export async function PartyStatementReport({
  report,
}: {
  report: PartyStatementReportDto;
}) {
  const t = await getTranslations("reports.party-statement");
  const locale = (await getLocale()) as Locale;
  const { summary, party } = report;

  const progress =
    summary.daysTotal > 0
      ? Math.round((summary.daysDelivered / summary.daysTotal) * 100)
      : 0;

  return (
    <>
      {party?.status === "CANCELLED" ? (
        <ReportBanner
          tone="info"
          icon={AlertTriangle}
          title={t("cancelled")}
        />
      ) : null}

      <SummaryBand>
        <SummaryCell
          label={t("summary.payable")}
          value={<Money value={summary.totalPayable} />}
          context={t("summary.days", {
            count: formatQuantity(summary.daysTotal),
          })}
        />
        <SummaryCell
          label={t("summary.received")}
          value={<Money value={summary.received} />}
          context={t("summary.payments", {
            count: formatQuantity(report.payments.length),
          })}
        />
        <SummaryCell
          label={t("summary.outstanding")}
          value={<Money value={summary.outstanding} emphasis />}
          tone={summary.outstanding > 0 ? "danger" : "success"}
          emphasis
        />
        <SummaryCell
          label={t("summary.delivered")}
          value={
            <span>
              {formatQuantity(summary.daysDelivered)}
              <span className="mx-1 text-muted-foreground">/</span>
              {formatQuantity(summary.daysTotal)}
            </span>
          }
          context={
            <span className="block h-1 w-24 rounded-full bg-border">
              <span
                className="block h-1 rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </span>
          }
        />
      </SummaryBand>

      <ReportSection title={t("schedule.title")}>
        {report.days.length === 0 ? (
          <ReportNote>{t("schedule.empty")}</ReportNote>
        ) : (
          <ReportTable minWidth={760} hint={t("swipeHint")}>
            <RHead>
              <RTh pinned align="center" className="w-14">
                {t("columns.day")}
              </RTh>
              <RTh>{t("columns.date")}</RTh>
              <RTh>{t("columns.items")}</RTh>
              <RTh align="right">{t("columns.qty")}</RTh>
              <RTh align="right">{t("columns.rate")}</RTh>
              <RTh align="right">{t("columns.amount")}</RTh>
            </RHead>

            <tbody>
              {report.days.map((day) => {
                const skipped =
                  day.status === "SKIPPED" || day.status === "CANCELLED";
                const lines = day.items.length > 0 ? day.items : [null];

                return lines.map((item, index) => (
                  <tr
                    key={`${day.id}-${index}`}
                    className={index === 0 ? "border-t border-border" : undefined}
                  >
                    {/* Day number and date print once per day; extra item lines
                        leave those cells blank rather than repeating. §12.3 */}
                    <RTd
                      pinned
                      align="center"
                      className={cn(
                        "font-mono",
                        index > 0 && "border-t-0",
                      )}
                    >
                      {index === 0 ? formatQuantity(day.dayNo) : ""}
                    </RTd>
                    <RTd className={index > 0 ? "border-t-0" : undefined}>
                      {index === 0 ? (
                        <>
                          <span className="block">
                            {formatDate(day.serviceDate, locale)}
                          </span>
                          {/* Status as a WORD, with the staff member and the
                              delivered time. Never a badge. §8.3 */}
                          <span className="mt-0.5 block text-caption text-muted-foreground">
                            {t(`status.${day.status}`)}
                            {day.assignedStaffName
                              ? ` · ${day.assignedStaffName}`
                              : ""}
                            {day.deliveredAt
                              ? ` · ${formatTime(day.deliveredAt, locale)}`
                              : ""}
                          </span>
                        </>
                      ) : null}
                    </RTd>
                    <RTd className={index > 0 ? "border-t-0" : undefined}>
                      {item?.productTitle ?? "—"}
                    </RTd>
                    <RTd
                      align="right"
                      className={index > 0 ? "border-t-0" : undefined}
                    >
                      {item ? (
                        <Quantity
                          value={item.deliveredQuantity ?? item.quantity}
                        />
                      ) : null}
                    </RTd>
                    <RTd
                      align="right"
                      className={index > 0 ? "border-t-0" : undefined}
                    >
                      {item ? <Money value={item.unitPrice} /> : null}
                    </RTd>
                    <RTd
                      align="right"
                      className={index > 0 ? "border-t-0" : undefined}
                    >
                      {skipped ? (
                        <span className="font-mono text-muted-foreground">
                          —
                        </span>
                      ) : item ? (
                        <Money value={item.lineTotal} />
                      ) : (
                        <Money value={day.dayTotal} />
                      )}
                    </RTd>
                  </tr>
                ));
              })}
            </tbody>

            <tfoot>
              <RSubtotalRow>
                <td className={cn(SUBTOTAL_CELL, "sticky left-0 z-10 bg-card")} />
                <td className={SUBTOTAL_CELL} />
                <td className={SUBTOTAL_CELL} />
                <td className={SUBTOTAL_CELL} />
                <td
                  className={cn(SUBTOTAL_CELL, "text-right text-muted-foreground")}
                >
                  {t("totals.payable")}
                </td>
                <td className={cn(SUBTOTAL_CELL, "text-right")}>
                  <Money value={summary.totalPayable} emphasis />
                </td>
              </RSubtotalRow>
            </tfoot>
          </ReportTable>
        )}
      </ReportSection>

      <ReportSection title={t("payments.title")}>
        {report.payments.length === 0 ? (
          <ReportNote>{t("payments.empty")}</ReportNote>
        ) : (
          <ReportTable minWidth={560}>
            <RHead>
              <RTh pinned>{t("columns.date")}</RTh>
              <RTh>{t("columns.mode")}</RTh>
              <RTh>{t("columns.note")}</RTh>
              <RTh align="right">{t("columns.amount")}</RTh>
            </RHead>
            <tbody>
              {report.payments.map((payment) => (
                <tr key={payment.id} className="border-t border-border">
                  <RTd pinned>{formatDate(payment.paidOn, locale)}</RTd>
                  <RTd>
                    <Badge>{payment.mode}</Badge>
                  </RTd>
                  <RTd className="text-muted-foreground">
                    {payment.isAdvance ? t("advance") : (payment.note ?? "—")}
                  </RTd>
                  <RTd align="right">
                    <Money
                      value={
                        payment.direction === "OUT"
                          ? -payment.amount
                          : payment.amount
                      }
                      variant={
                        payment.direction === "OUT" ? "refund" : "default"
                      }
                    />
                  </RTd>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <RSubtotalRow>
                <td className={cn(SUBTOTAL_CELL, "sticky left-0 z-10 bg-card")} />
                <td className={SUBTOTAL_CELL} />
                <td
                  className={cn(SUBTOTAL_CELL, "text-right text-muted-foreground")}
                >
                  {t("totals.received")}
                </td>
                <td className={cn(SUBTOTAL_CELL, "text-right")}>
                  <Money value={report.paymentsTotal} emphasis />
                </td>
              </RSubtotalRow>
            </tfoot>
          </ReportTable>
        )}
      </ReportSection>

      <ReportFootnoteCard>
        <p className="text-body-sm text-muted-foreground">
          {t("closing.line", {
            payable: formatINR(summary.totalPayable),
            received: formatINR(report.paymentsTotal),
          })}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <p className="flex items-center gap-2 text-h4 font-semibold text-foreground">
            {report.closingBalance === 0 ? (
              <CheckCircle2 className="size-5 text-success" aria-hidden />
            ) : report.closingBalance < 0 ? (
              <RotateCcw className="size-5 text-primary" aria-hidden />
            ) : null}
            {report.closingBalance === 0
              ? t("closing.fullyPaid")
              : report.closingBalance < 0
                ? t("closing.refundDue")
                : t("closing.balance")}
          </p>
          <Money
            value={report.closingBalance}
            emphasis
            zeroAs="value"
            variant={report.closingBalance < 0 ? "refund" : "default"}
            className="font-mono text-[1.25rem] font-bold"
          />
        </div>
      </ReportFootnoteCard>

      <PrintStatement report={report} />
    </>
  );
}

/* ── The A4 document ─────────────────────────────────────────────────────── */

/**
 * §12.3 — the only document an outsider reads.
 *
 * NO INTERNAL CODES beyond `PTY-000012`, no staff names, no assigned-to column:
 * a client does not need to know who drove. The closing note dates the document
 * so an old printout cannot be read as current, and the footer carries the
 * business name and the party order code rather than a document code.
 */
async function PrintStatement({ report }: { report: PartyStatementReportDto }) {
  const t = await getTranslations("reports.party-statement");
  const p = await getTranslations("reports.print");
  const locale = (await getLocale()) as Locale;
  const { meta, summary } = report;

  return (
    <PrintDocument>
      <PrintHeader meta={meta} title={t("title")} />

      <PrintSection title={t("schedule.title")}>
        <table>
          <thead>
            <tr>
              <th className="num">{t("columns.day")}</th>
              <th>{t("columns.date")}</th>
              <th>{t("columns.item")}</th>
              <th className="num">{t("columns.qty")}</th>
              <th className="num">{t("columns.rate")}</th>
              <th className="num">{p("amountColumn")}</th>
              <th>{t("columns.status")}</th>
            </tr>
          </thead>
          <tbody>
            {report.days.flatMap((day) => {
              const skipped =
                day.status === "SKIPPED" || day.status === "CANCELLED";
              const lines = day.items.length > 0 ? day.items : [null];

              return lines.map((item, index) => (
                <tr key={`${day.id}-${index}`}>
                  <td className="figure">
                    {index === 0 ? formatQuantity(day.dayNo) : ""}
                  </td>
                  <td>{index === 0 ? formatDate(day.serviceDate, locale) : ""}</td>
                  <td>{item?.productTitle ?? ""}</td>
                  <td className="figure">
                    {item
                      ? formatQuantity(item.deliveredQuantity ?? item.quantity)
                      : ""}
                  </td>
                  <td className="figure">
                    {item ? formatRupeesPlain(item.unitPrice) : ""}
                  </td>
                  <td className="figure">
                    {skipped
                      ? "—"
                      : item
                        ? formatRupeesPlain(item.lineTotal)
                        : formatRupeesPlain(day.dayTotal)}
                  </td>
                  {/* STATUS AS A WORD. §12.1, §12.3 */}
                  <td>{index === 0 ? t(`status.${day.status}`) : ""}</td>
                </tr>
              ));
            })}
          </tbody>
          <tfoot>
            <tr className="subtotal">
              <td colSpan={5}>{t("print.totalPayable")}</td>
              <td className="figure">{formatINR(summary.totalPayable)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </PrintSection>

      <PrintSection title={t("payments.title")}>
        <table>
          <thead>
            <tr>
              <th>{t("columns.date")}</th>
              <th>{t("columns.mode")}</th>
              <th>{t("columns.note")}</th>
              <th className="num">{p("amountColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {report.payments.map((payment) => (
              <tr key={payment.id}>
                <td>{formatDate(payment.paidOn, locale)}</td>
                <td>{payment.mode}</td>
                <td>{payment.isAdvance ? t("advance") : (payment.note ?? "")}</td>
                <td className="figure">
                  {formatRupeesPlain(
                    payment.direction === "OUT"
                      ? -payment.amount
                      : payment.amount,
                  )}
                </td>
              </tr>
            ))}
            {report.payments.length === 0 ? (
              <tr>
                <td colSpan={4} className="italic">
                  {t("payments.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="subtotal">
              <td colSpan={3}>{t("print.totalReceived")}</td>
              <td className="figure">{formatINR(report.paymentsTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </PrintSection>

      <div className="avoid-break mt-6 flex justify-end">
        <table className="w-[70mm]">
          <tbody>
            <tr className="grand-total">
              <td>
                {report.closingBalance === 0
                  ? t("print.closingPaid")
                  : report.closingBalance < 0
                    ? t("print.closingRefund")
                    : t("print.closing")}
              </td>
              <td className="figure">
                {formatINR(Math.abs(report.closingBalance))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* The sentence that stops an old printout being read as current. §12.3 */}
      <p className="caption mt-6">{p("asAtNote")}</p>

      <PrintFooter meta={meta} />
    </PrintDocument>
  );
}
