import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Litres, Money, Quantity } from "@/components/common/money";
import { formatINR, formatLitres, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ProductMovementReportDto } from "@/lib/dto/report.dto";
import {
  RHead,
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
 * Product movement. Spec: design/MODULES/09-reports.md §9
 *
 * What actually sells, through which channel, and how much of the base price
 * survives contact with the field.
 *
 * `AVG RATE` IS AN EM DASH ON THE TOTAL ROW. Averaging averages is wrong, and
 * printing a wrong average is worse than printing none. §9.3
 *
 * TWO THINGS THIS REPORT IS HONEST ABOUT rather than papering over:
 *  · `v_product_sales` keys on the MONTH, so a range inside a month reports the
 *    whole month. The snapped window is stated on the note below the table.
 *  · WALK-INS HAVE NO UNITS. `direct_sales` records an amount, no quantity and
 *    no unit price, so the channel column is an em dash for every product and
 *    the walk-in revenue is stated separately. Folding a row with no quantity
 *    into `qty_billed` would corrupt both the units and the realised price.
 */
export async function ProductMovementReport({
  report,
}: {
  report: ProductMovementReportDto;
}) {
  const t = await getTranslations("reports.product-movement");
  const { summary, totals } = report;

  return (
    <>
      <SummaryBand>
        <SummaryCell
          label={t("summary.units")}
          value={<Quantity value={summary.totalUnits} emphasis />}
        />
        <SummaryCell
          label={t("summary.litres")}
          value={
            <span>
              {formatQuantity(Math.round(summary.totalLitres))}
              <span className="ml-1 font-sans text-body-sm text-muted-foreground">
                L
              </span>
            </span>
          }
        />
        <SummaryCell
          label={t("summary.revenue")}
          value={<Money value={summary.revenue} emphasis />}
          emphasis
        />
        {/* A discount is neither good news nor bad — Spark Orange, not red. §9.3 */}
        <SummaryCell
          label={t("summary.discount")}
          value={
            summary.discountPercent === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span>
                ▼ {formatQuantity(summary.discountPercent)}%
              </span>
            )
          }
          context={t("summary.discountValue", {
            amount: formatINR(summary.discountValue),
          })}
          tone={summary.discountPercent ? "warning" : "default"}
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
            <ReportTable minWidth={1000} hint={t("swipeHint")}>
              <RHead>
                <RTh pinned>{t("columns.product")}</RTh>
                <RTh align="right">{t("columns.delivery")}</RTh>
                <RTh align="right">{t("columns.party")}</RTh>
                <RTh align="right">{t("columns.walkIn")}</RTh>
                <RTh align="right">{t("columns.units")}</RTh>
                <RTh align="right">{t("columns.litres")}</RTh>
                <RTh align="right">{t("columns.revenue")}</RTh>
                <RTh align="right">{t("columns.avgRate")}</RTh>
              </RHead>

              <tbody>
                {report.rows.map((row) => (
                  <RRow key={row.productId}>
                    <RTd pinned className="align-top">
                      <Link href={row.href} className="block py-1 hover:underline">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {row.title}
                          </span>
                          {/* Says why a bottle never appears in jar
                              reconciliation. §9.3 */}
                          {!row.isReturnable ? (
                            <Badge>{t("nonReturnable")}</Badge>
                          ) : null}
                        </span>
                        <span className="block text-caption text-muted-foreground">
                          {t("basePrice", { price: formatINR(row.basePrice) })}
                        </span>
                      </Link>
                    </RTd>
                    <RTd align="right">
                      <Quantity value={row.delivery} zeroAs="dash" />
                    </RTd>
                    <RTd align="right">
                      <Quantity value={row.party} zeroAs="dash" />
                    </RTd>
                    <RTd align="right">
                      <span
                        className="font-mono tabular-nums text-muted-foreground"
                        title={t("walkInTooltip")}
                      >
                        —
                      </span>
                    </RTd>
                    <RTd align="right">
                      <Quantity value={row.units} emphasis />
                    </RTd>
                    <RTd align="right">
                      <Litres value={row.litresTotal} />
                    </RTd>
                    <RTd align="right">
                      {row.revenue === 0 ? (
                        <span className="text-caption text-muted-foreground">
                          {t("noRevenue")}
                        </span>
                      ) : (
                        <Money value={row.revenue} emphasis />
                      )}
                    </RTd>
                    <RTd align="right" className="align-top">
                      <span className="block py-1">
                        <Money value={row.avgRate} />
                        <Variance value={row.variancePercent} />
                      </span>
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
                    <Quantity value={totals.delivery} zeroAs="dash" emphasis />
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Quantity value={totals.party} zeroAs="dash" emphasis />
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      —
                    </span>
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Quantity value={totals.units} emphasis />
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatLitres(totals.litres)}
                    </span>
                  </td>
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <Money value={totals.revenue} emphasis />
                  </td>
                  {/* Averaging averages is wrong. §9.3 */}
                  <td className={cn(TOTAL_CELL, "text-right")}>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      —
                    </span>
                  </td>
                </RTotalRow>
              </tfoot>
            </ReportTable>

            {report.monthSnapped ? (
              <ReportNote>
                {t("monthNote", {
                  from: report.monthFrom,
                  to: report.monthTo,
                })}
              </ReportNote>
            ) : null}
            <ReportNote>
              {t("walkInNote", {
                amount: formatINR(report.walkInRevenue),
              })}
            </ReportNote>
          </>
        )}
      </ReportSection>
    </>
  );
}

/**
 * `── 0.0%` at parity, `▼ 4.8%` in Spark Orange below base, `▲ 2.1%` in Spark
 * Green above. §9.3
 */
function Variance({ value }: { value: number | null }) {
  if (value === null) return null;

  const tone =
    value < 0 ? "text-warning" : value > 0 ? "text-success" : "text-muted-foreground";
  const glyph = value < 0 ? "▼" : value > 0 ? "▲" : "──";

  return (
    <span
      className={cn("mt-0.5 block font-mono text-caption tabular-nums", tone)}
    >
      {glyph} {formatQuantity(Math.abs(value))}%
    </span>
  );
}
