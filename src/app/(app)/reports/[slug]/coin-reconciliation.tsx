import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, SearchX } from "lucide-react";
import { Money, Quantity } from "@/components/common/money";
import { formatPerCoinValue, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CoinReconciliationReportDto } from "@/lib/dto/report.dto";
import {
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

/**
 * Coin reconciliation. Spec: design/MODULES/09-reports.md §7
 *
 * Prove that every coin is accounted for: opening + in − out = closing, per
 * coin type, and whether the recomputed closing matches what the ledger itself
 * was carrying. This is the report the dashboard's danger banner sends the
 * owner to.
 *
 * SIGNED MOVEMENTS ARE COLOURED, and this is the ONE place in the app where a
 * signed figure is: outflows carry a leading `−` in Spark Red, inflows a `+` in
 * Spark Green, because here the direction IS the content. §7.3
 *
 * NO PDF. It is a working document, not one that gets handed over, and the
 * export bar says so rather than leaving the owner wondering. §7.4
 *
 * ZEROS ARE A VALID ANSWER. A coin type with no movement renders with opening
 * equal to closing rather than disappearing — §7.5 calls that useful, not an
 * empty state.
 */
export async function CoinReconciliationReport({
  report,
}: {
  report: CoinReconciliationReportDto;
}) {
  const t = await getTranslations("reports.coin-reconciliation");
  const { summary, totals } = report;
  const failing = report.rows.filter((row) => !row.reconciles);

  return (
    <>
      {failing.length > 0 ? (
        <ReportBanner
          tone="danger"
          icon={AlertTriangle}
          title={t("banner.title", {
            name: failing[0].name,
            difference: formatQuantity(Math.abs(failing[0].difference)),
          })}
          body={t("banner.body")}
        />
      ) : null}

      <SummaryBand>
        <SummaryCell
          label={t("summary.inStock")}
          value={<Quantity value={summary.coinsInStock} emphasis />}
          context={t("summary.types", {
            count: formatQuantity(summary.typeCount),
          })}
        />
        <SummaryCell
          label={t("summary.valueInStock")}
          value={<Money value={summary.valueInStock} emphasis />}
        />
        <SummaryCell
          label={t("summary.outWithStaff")}
          value={<Quantity value={summary.outWithStaff} zeroAs="dash" />}
          context={<Money value={summary.valueOutWithStaff} />}
          tone={summary.outWithStaff > 0 ? "warning" : "default"}
        />
        {/* The fourth cell is a STATUS, not a figure. §7.3 */}
        <SummaryCell
          label={t("summary.reconciles")}
          value={
            <span className="inline-flex items-center gap-2">
              {summary.reconciles ? (
                <CheckCircle2 className="size-5 shrink-0" aria-hidden />
              ) : (
                <AlertTriangle className="size-5 shrink-0" aria-hidden />
              )}
              <span className="font-sans text-h4">
                {summary.reconciles
                  ? t("summary.allTie", {
                      count: formatQuantity(summary.typeCount),
                    })
                  : t("summary.notTying", {
                      count: formatQuantity(
                        summary.typeCount - summary.tyingCount,
                      ),
                      total: formatQuantity(summary.typeCount),
                    })}
              </span>
            </span>
          }
          tone={summary.reconciles ? "success" : "danger"}
        />
      </SummaryBand>

      <ReportSection>
        {report.rows.length === 0 ? (
          <ReportEmpty
            icon={SearchX}
            title={t("empty.title")}
            body={t("empty.body")}
          />
        ) : (
          <>
            <ReportTable minWidth={960} hint={t("swipeHint")}>
              <RHead>
                <RTh pinned>{t("columns.coinType")}</RTh>
                <RTh align="right">{t("columns.opening")}</RTh>
                <RTh align="right">{t("columns.issued")}</RTh>
                <RTh align="right">{t("columns.returned")}</RTh>
                <RTh align="right">{t("columns.received")}</RTh>
                <RTh align="right">{t("columns.adjusted")}</RTh>
                <RTh align="right">{t("columns.closing")}</RTh>
                <RTh align="center" className="w-16">
                  {t("columns.check")}
                </RTh>
              </RHead>

              <tbody>
                {report.rows.map((row) => (
                  <RRow
                    key={row.coinTypeId}
                    // A divergent row takes a 3px Spark Red left border. §7.3
                    className={
                      row.reconciles ? undefined : "border-l-[3px] border-l-destructive"
                    }
                  >
                    <RTd pinned className="align-top">
                      <Link
                        href={row.href}
                        className="block py-1 hover:underline"
                      >
                        <span className="block font-medium text-foreground">
                          {row.name}
                        </span>
                        <span className="block text-caption text-muted-foreground">
                          {t("perCoin", {
                            price: formatPerCoinValue(row.perCoinPrice),
                            packet: formatQuantity(row.coinsPerPacket),
                          })}
                        </span>
                      </Link>
                    </RTd>
                    <RTd align="right">
                      <Quantity value={row.opening} zeroAs="value" />
                    </RTd>
                    <Signed value={row.issued} />
                    <Signed value={row.returned} />
                    <Signed value={row.received} />
                    <Signed value={row.adjusted} />
                    <RTd align="right" className="align-top">
                      <span className="block py-1">
                        <Quantity value={row.closing} emphasis />
                        <span className="mt-0.5 block font-mono text-caption tabular-nums text-muted-foreground">
                          <Money value={row.closingValue} />
                        </span>
                      </span>
                    </RTd>
                    <RTd align="center">
                      {row.reconciles ? (
                        <CheckCircle2
                          className="mx-auto size-4 text-success"
                          aria-label={t("columns.ties")}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 font-mono text-caption font-semibold tabular-nums text-destructive"
                          title={t("checkTooltip", {
                            computed: formatQuantity(row.closing),
                            ledger: formatQuantity(row.ledgerBalance),
                            difference: formatQuantity(
                              Math.abs(row.difference),
                            ),
                          })}
                        >
                          <AlertTriangle className="size-3.5" aria-hidden />
                          {row.difference > 0 ? "+" : ""}
                          {formatQuantity(row.difference)}
                        </span>
                      )}
                    </RTd>
                  </RRow>
                ))}
              </tbody>

              <tfoot>
                <RTotalRow>
                  <td className={cn(TOTAL_CELL, "sticky left-0 z-10 bg-muted")}>
                    {t("total")}
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Quantity value={totals.opening} emphasis />
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Quantity value={totals.issued} zeroAs="dash" emphasis />
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Quantity value={totals.returned} zeroAs="dash" emphasis />
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Quantity value={totals.received} zeroAs="dash" emphasis />
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Quantity value={totals.adjusted} zeroAs="dash" emphasis />
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Quantity value={totals.closing} emphasis />
                    <span className="mt-0.5 block">
                      <Money value={totals.closingValue} emphasis />
                    </span>
                  </td>
                  <td className={TOTAL_CELL} />
                </RTotalRow>
              </tfoot>
            </ReportTable>

            <ReportNote>
              {t("adjustmentsNote", {
                count: formatQuantity(report.adjustmentCount),
              })}
            </ReportNote>
            <ReportNote>{t("balanceNowNote")}</ReportNote>
          </>
        )}
      </ReportSection>
    </>
  );
}

/**
 * The one place a signed figure is coloured, because the direction is the
 * content: `−1,200` in Spark Red, `+300` in Spark Green, `0` as an em dash.
 * §7.3
 */
function Signed({ value }: { value: number }) {
  if (value === 0) {
    return (
      <RTd align="right">
        <span className="font-mono tabular-nums text-muted-foreground">—</span>
      </RTd>
    );
  }

  return (
    <RTd align="right">
      <span
        className={cn(
          "font-mono font-medium tabular-nums",
          value < 0 ? "text-destructive" : "text-success",
        )}
      >
        {value > 0 ? "+" : "−"}
        {formatQuantity(Math.abs(value))}
      </span>
    </RTd>
  );
}
