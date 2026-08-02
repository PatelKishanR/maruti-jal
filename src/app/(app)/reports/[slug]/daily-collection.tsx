import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarX2, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Money, Quantity } from "@/components/common/money";
import { formatDate, formatTime } from "@/lib/dates";
import { formatINR, formatQuantity, formatRupeesPlain } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { DailyCollectionReportDto } from "@/lib/dto/report.dto";
import {
  GROUP_CELL,
  RGroupRow,
  RHead,
  ReportEmpty,
  ReportFootnoteCard,
  ReportNote,
  ReportSection,
  ReportTable,
  RRow,
  RTd,
  RTh,
  RTotalRow,
  SUBTOTAL_CELL,
  SummaryBand,
  SummaryCell,
  TOTAL_CELL,
  RSubtotalRow,
} from "../report-shell";
import {
  PrintDocument,
  PrintFooter,
  PrintHeader,
  PrintSection,
  PrintSignatures,
} from "../print-document";

/**
 * The daily collection sheet. Spec: design/MODULES/09-reports.md §5
 *
 * The end-of-day tally: what came in, from whom, in what form — and the figure
 * that should physically be in the drawer. When the cash count disagrees, this
 * sheet shows exactly which line to look at.
 *
 * COINS ARE NOT DRAWER MONEY, and the layout has to make that impossible to
 * confuse: they are counted in their own sub-table, excluded from `EXPECTED IN
 * DRAWER`, and the reconciliation card says why in words. §5.3
 *
 * FOUR GROUPS ALWAYS RENDER, even empty. `— no receipts` is information; a
 * missing band reads as a printing fault. §5.3, §12.4
 */
export async function DailyCollectionReport({
  report,
}: {
  report: DailyCollectionReportDto;
}) {
  const t = await getTranslations("reports.daily-collection");
  const locale = (await getLocale()) as Locale;
  const { meta, summary } = report;

  if (report.future) {
    return (
      <ReportSection>
        <ReportEmpty
          icon={CalendarX2}
          title={t("future.title")}
          body={t("future.body")}
        />
      </ReportSection>
    );
  }

  const nothingCollected = summary.receiptCount === 0;

  return (
    <>
      <SummaryBand>
        <SummaryCell
          label={t("summary.total")}
          value={<Money value={summary.totalCollected} emphasis />}
          context={t("summary.receipts", {
            count: formatQuantity(summary.receiptCount),
          })}
          emphasis
        />
        <SummaryCell
          label={t("summary.cash")}
          value={<Money value={summary.cash} />}
          context={t("summary.receipts", {
            count: formatQuantity(summary.cashCount),
          })}
        />
        <SummaryCell
          label={t("summary.coins")}
          value={<Money value={summary.coins} />}
          context={t("summary.coinCount", {
            count: formatQuantity(summary.coinCount),
          })}
        />
        <SummaryCell
          label={t("summary.drawer")}
          value={<Money value={summary.expectedInDrawer} />}
          context={t("summary.drawerNote")}
        />
      </SummaryBand>

      <ReportSection>
        {nothingCollected ? (
          <ReportEmpty
            icon={SearchX}
            title={t("empty.title")}
            body={
              report.ordersRaised > 0
                ? t("empty.ordersOnly", {
                    count: formatQuantity(report.ordersRaised),
                  })
                : t("empty.body", { date: formatDate(meta.date, locale) })
            }
          />
        ) : (
          <ReportTable minWidth={880} hint={t("swipeHint")}>
            <RHead>
              <RTh pinned className="w-20">
                {t("columns.time")}
              </RTh>
              <RTh className="hidden sm:table-cell">{t("columns.source")}</RTh>
              <RTh>{t("columns.reference")}</RTh>
              <RTh>{t("columns.from")}</RTh>
              <RTh align="center">{t("columns.mode")}</RTh>
              <RTh align="right">{t("columns.amount")}</RTh>
            </RHead>

            <tbody>
              {report.groups.map((group) => (
                <GroupBlock
                  key={group.key}
                  group={group}
                  locale={locale}
                  labels={{
                    title: t(`groups.${group.key}`),
                    receipts: t("summary.receipts", {
                      count: formatQuantity(group.receiptCount),
                    }),
                    none: t("groups.none"),
                    subtotal: t("subtotal"),
                  }}
                />
              ))}
            </tbody>

            <tfoot>
              <RTotalRow>
                <td className={cn(TOTAL_CELL, "sticky left-0 z-10 bg-muted")}>
                  {t("totalCollected")}
                </td>
                <td className={cn(TOTAL_CELL, "hidden sm:table-cell")} />
                <td className={TOTAL_CELL} />
                <td className={TOTAL_CELL} />
                <td className={cn(TOTAL_CELL, "text-center")}>
                  {t("summary.receipts", {
                    count: formatQuantity(summary.receiptCount),
                  })}
                </td>
                <td className={cn(TOTAL_CELL, "text-right")}>
                  <Money
                    value={summary.totalCollected}
                    emphasis
                    className="text-body"
                  />
                </td>
              </RTotalRow>
            </tfoot>
          </ReportTable>
        )}
      </ReportSection>

      {/* Coins get their own card. They are tokens returning to stock, not
          money entering the drawer, and mixing them into the table above would
          make the drawer figure unverifiable. §5.3 */}
      <ReportSection title={t("coins.title")}>
        {report.coinsByType.length === 0 ? (
          <ReportNote>{t("coins.empty")}</ReportNote>
        ) : (
          <ReportTable minWidth={520}>
            <RHead>
              <RTh pinned>{t("coins.type")}</RTh>
              <RTh align="right">{t("coins.perCoin")}</RTh>
              <RTh align="right">{t("coins.received")}</RTh>
              <RTh align="right">{t("coins.value")}</RTh>
            </RHead>
            <tbody>
              {report.coinsByType.map((row) => (
                <RRow key={row.coinTypeId}>
                  <RTd pinned>{row.name}</RTd>
                  <RTd align="right">
                    <Money value={row.perCoinPrice} />
                  </RTd>
                  <RTd align="right">
                    <Quantity value={row.coins} zeroAs="dash" />
                  </RTd>
                  <RTd align="right">
                    <Money value={row.value} emphasis />
                  </RTd>
                </RRow>
              ))}
            </tbody>
            <tfoot>
              <RTotalRow>
                <td className={cn(TOTAL_CELL, "sticky left-0 z-10 bg-muted")}>
                  {t("total")}
                </td>
                <td className={TOTAL_CELL} />
                <td className={cn(TOTAL_CELL, "text-right")}>
                  <Quantity value={report.coinsTotal.coins} emphasis />
                </td>
                <td className={cn(TOTAL_CELL, "text-right")}>
                  <Money value={report.coinsTotal.value} emphasis />
                </td>
              </RTotalRow>
            </tfoot>
          </ReportTable>
        )}
      </ReportSection>

      {/* The arithmetic written out as a sentence — this is the figure the
          drawer gets counted against. §5.3 */}
      <ReportFootnoteCard>
        <p className="text-body-sm text-foreground">
          {t("reconciliation.line", {
            cash: formatINR(report.reconciliation.cash),
            other: formatINR(
              report.reconciliation.upi + report.reconciliation.bank,
            ),
            drawer: formatINR(report.reconciliation.expectedInDrawer),
          })}
        </p>
        <p className="mt-1.5 text-caption text-muted-foreground">
          {t("reconciliation.note")}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          {t("reconciliation.crossCheck", {
            amount: formatINR(report.viewCollection),
          })}
        </p>
      </ReportFootnoteCard>

      <PrintSheet report={report} />
    </>
  );
}

async function GroupBlock({
  group,
  locale,
  labels,
}: {
  group: DailyCollectionReportDto["groups"][number];
  locale: Locale;
  labels: {
    title: string;
    receipts: string;
    none: string;
    subtotal: string;
  };
}) {
  return (
    <>
      {/* A group row is a heading AND a subtotal — reading it alone answers
          the question. §4.3 */}
      <RGroupRow>
        <td className={cn(GROUP_CELL, "sticky left-0 z-10 bg-muted")}>
          {labels.title}
        </td>
        <td className={cn(GROUP_CELL, "hidden sm:table-cell")} />
        <td className={GROUP_CELL} />
        <td className={GROUP_CELL} />
        <td className={cn(GROUP_CELL, "text-center text-caption font-normal text-muted-foreground")}>
          {labels.receipts}
        </td>
        <td className={cn(GROUP_CELL, "text-right")}>
          <Money value={group.total} emphasis />
        </td>
      </RGroupRow>

      {group.rows.length === 0 ? (
        <tr>
          <td
            className="h-11 border-t border-border px-4 text-body-sm text-muted-foreground"
            colSpan={6}
          >
            {labels.none}
          </td>
        </tr>
      ) : (
        group.rows.map((row) => (
          <RRow key={row.id}>
            <RTd pinned className="font-mono text-caption">
              {formatTime(row.receivedAt, locale)}
            </RTd>
            <RTd className="hidden sm:table-cell">{labels.title}</RTd>
            <RTd className="font-mono text-caption">
              {row.referenceHref ? (
                <Link
                  href={row.referenceHref}
                  className="text-primary hover:underline"
                >
                  {row.reference}
                </Link>
              ) : (
                row.reference
              )}
            </RTd>
            <RTd>{row.from}</RTd>
            <RTd align="center">
              <Badge>{row.mode}</Badge>
            </RTd>
            <RTd align="right">
              <Money
                value={row.direction === "OUT" ? -row.amount : row.amount}
                variant={row.direction === "OUT" ? "refund" : "default"}
              />
            </RTd>
          </RRow>
        ))
      )}

      {group.rows.length > 0 ? (
        <RSubtotalRow>
          <td className={cn(SUBTOTAL_CELL, "sticky left-0 z-10 bg-card")} />
          <td className={cn(SUBTOTAL_CELL, "hidden sm:table-cell")} />
          <td className={SUBTOTAL_CELL} />
          <td className={SUBTOTAL_CELL} />
          <td className={cn(SUBTOTAL_CELL, "text-right text-muted-foreground")}>
            {labels.subtotal}
          </td>
          <td className={cn(SUBTOTAL_CELL, "text-right")}>
            <Money value={group.total} emphasis />
          </td>
        </RSubtotalRow>
      ) : null}
    </>
  );
}

/* ── The A4 document ─────────────────────────────────────────────────────── */

/**
 * §12.4 — and the point of it is the two handwriting rules at the bottom. This
 * sheet is printed so the drawer can be counted against it, so `Counted` and
 * `Difference` are the reason the document leaves the screen at all.
 */
async function PrintSheet({ report }: { report: DailyCollectionReportDto }) {
  const t = await getTranslations("reports.daily-collection");
  const p = await getTranslations("reports.print");
  const locale = (await getLocale()) as Locale;
  const { meta, summary } = report;

  return (
    <PrintDocument>
      <PrintHeader meta={meta} title={t("title")} periodMode="date" />

      <table className="section">
        <thead>
          <tr>
            <th>{t("columns.time")}</th>
            <th>{t("columns.source")}</th>
            <th>{t("columns.reference")}</th>
            <th>{t("columns.from")}</th>
            <th>{t("columns.mode")}</th>
            <th className="num">{p("amountColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {report.groups.map((group) => (
            <PrintGroup
              key={group.key}
              group={group}
              locale={locale}
              title={t(`groups.${group.key}`)}
              none={t("groups.none")}
              subtotal={t("subtotal")}
              receipts={(n: number) =>
                t("summary.receipts", { count: formatQuantity(n) })
              }
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="grand-total">
            <td colSpan={4}>{t("totalCollected")}</td>
            <td>
              {t("summary.receipts", {
                count: formatQuantity(summary.receiptCount),
              })}
            </td>
            <td className="figure">{formatINR(summary.totalCollected)}</td>
          </tr>
        </tfoot>
      </table>

      {/* 8mm of air above the coin block: coins are not drawer cash and the
          layout has to make that impossible to confuse. §12.4 */}
      <PrintSection title={t("coins.title")}>
        <table>
          <thead>
            <tr>
              <th>{t("coins.type")}</th>
              <th className="num">{t("coins.perCoin")}</th>
              <th className="num">{t("coins.received")}</th>
              <th className="num">{t("coins.value")}</th>
            </tr>
          </thead>
          <tbody>
            {report.coinsByType.map((row) => (
              <tr key={row.coinTypeId}>
                <td>{row.name}</td>
                <td className="figure">{formatRupeesPlain(row.perCoinPrice)}</td>
                <td className="figure">{formatQuantity(row.coins)}</td>
                <td className="figure">{formatRupeesPlain(row.value)}</td>
              </tr>
            ))}
            {report.coinsByType.length === 0 ? (
              <tr>
                <td colSpan={4} className="italic">
                  {t("coins.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="subtotal">
              <td colSpan={2}>{t("total")}</td>
              <td className="figure">
                {formatQuantity(report.coinsTotal.coins)}
              </td>
              <td className="figure">{formatINR(report.coinsTotal.value)}</td>
            </tr>
          </tfoot>
        </table>
      </PrintSection>

      <PrintSection title={t("print.cashReconciliation")}>
        <table className="w-[90mm]">
          <tbody>
            <tr>
              <td className="plain">{t("print.cashCollected")}</td>
              <td className="figure plain">
                {formatINR(report.reconciliation.cash)}
              </td>
            </tr>
            <tr>
              <td className="plain">{t("print.upiBank")}</td>
              <td className="figure plain">
                {formatINR(
                  report.reconciliation.upi + report.reconciliation.bank,
                )}
              </td>
            </tr>
            <tr className="subtotal">
              <td>{t("summary.drawer")}</td>
              <td className="figure">
                {formatINR(report.reconciliation.expectedInDrawer)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* The whole reason the document is printed. §12.4 */}
        <p className="caption mt-8 flex flex-wrap gap-x-12 gap-y-4">
          <span>
            {t("print.counted")} <span className="sign-rule" />
          </span>
          <span>
            {t("print.difference")} <span className="sign-rule" />
          </span>
        </p>
      </PrintSection>

      <PrintSignatures
        blocks={[
          { label: t("print.checkedBy"), dateLabel: p("date") },
        ]}
      />

      <PrintFooter meta={meta} />
    </PrintDocument>
  );
}

async function PrintGroup({
  group,
  locale,
  title,
  none,
  subtotal,
  receipts,
}: {
  group: DailyCollectionReportDto["groups"][number];
  locale: Locale;
  title: string;
  none: string;
  subtotal: string;
  receipts: (count: number) => string;
}) {
  return (
    <>
      <tr>
        <td colSpan={6} className="group-head section-heading">
          {title}
        </td>
      </tr>
      {group.rows.length === 0 ? (
        <tr>
          {/* An absent group would read as a printing fault. §12.4 */}
          <td colSpan={6} className="italic">
            {none}
          </td>
        </tr>
      ) : (
        group.rows.map((row) => (
          <tr key={row.id}>
            <td className="figure">{formatTime(row.receivedAt, locale)}</td>
            <td>{title}</td>
            <td className="font-mono">{row.reference}</td>
            <td>{row.from}</td>
            {/* Mode is a WORD on paper, never a pill. §12.1 */}
            <td>{row.mode}</td>
            <td className="figure">
              {formatRupeesPlain(
                row.direction === "OUT" ? -row.amount : row.amount,
              )}
            </td>
          </tr>
        ))
      )}
      <tr className="subtotal">
        <td colSpan={4}>{subtotal}</td>
        <td>{receipts(group.receiptCount)}</td>
        <td className="figure">{formatRupeesPlain(group.total)}</td>
      </tr>
    </>
  );
}
