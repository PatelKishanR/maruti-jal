"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timeline, type TimelineEntry } from "@/components/common/timeline";
import { EmptyState } from "@/components/common/empty-state";
import { Money, Quantity } from "@/components/common/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type { CoinIssueDetailDto } from "@/lib/dto/coin-issue.dto";
import { ColourDot, PerCoinValue } from "../../types/coin-figures";

/**
 * Coins · Returns · Payments. Spec: design MODULES/04-coins §8.3
 *
 * Counts live in the tab labels, so the owner knows whether opening one is
 * worth the click. **No tab is ever blank** — each empty state says what will
 * appear there and, where there is one, offers the action that fills it. §8.5
 *
 * The Activity tab of the design is deliberately absent rather than faked:
 * `audit_logs` and `document_revisions` are populated by triggers but no
 * endpoint reads them yet. An empty "Activity" tab would imply nothing had
 * happened. Reported as a gap.
 */
export function CoinIssueDetailTabs({ issue }: { issue: CoinIssueDetailDto }) {
  const t = useTranslations("coins.issues.detail");
  // Payment modes live under `coins.issues.modes`, shared with the payment
  // modal — one vocabulary, so `Bank transfer` cannot read two ways.
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const [tab, setTab] = useState("coins");

  const returnEntries: TimelineEntry[] = issue.returns.map((event) => ({
    id: event.id,
    title: t("timeline.returned", {
      coins: formatQuantity(Math.abs(event.coinsReturned)),
      name: event.coinTypeName,
      amount: formatINR(event.valueCredited),
    }),
    meta: formatDateTime(event.createdAt, locale),
    note: event.note,
    // A reversal is a correction, not a return — it reads amber so the two are
    // never mistaken for one another in a scan down the column.
    tone: event.coinsReturned < 0 ? "warning" : "success",
  }));

  const paymentEntries: TimelineEntry[] = issue.payments.map((payment) => ({
    id: payment.id,
    title:
      payment.direction === "IN"
        ? t("timeline.paid", {
            amount: formatINR(payment.amount),
            mode: tRoot(`coins.issues.modes.${payment.mode}`),
          })
        : t("timeline.refunded", {
            amount: formatINR(payment.amount),
            mode: tRoot(`coins.issues.modes.${payment.mode}`),
          }),
    meta: `${formatDate(payment.paidOn, locale)} · ${payment.code}`,
    note: payment.referenceNo ?? payment.note,
    // Outbound money is PRIMARY blue, never red. §8.3
    tone: payment.direction === "IN" ? "success" : "primary",
  }));

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="coins">
          {t("tabs.coins", { count: formatQuantity(issue.lines.length) })}
        </TabsTrigger>
        <TabsTrigger value="returns">
          {t("tabs.returns", { count: formatQuantity(issue.returns.length) })}
        </TabsTrigger>
        <TabsTrigger value="payments">
          {t("tabs.payments", { count: formatQuantity(issue.payments.length) })}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="coins">
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border text-caption uppercase tracking-[0.04em] text-muted-foreground">
                <th className="py-2 text-left font-semibold">
                  {t("breakdown.coinType")}
                </th>
                <th className="py-2 text-right font-semibold">
                  {t("breakdown.packets")}
                </th>
                <th className="py-2 text-right font-semibold">
                  {t("breakdown.coins")}
                </th>
                <th className="py-2 text-right font-semibold">
                  {t("breakdown.rate")}
                </th>
                <th className="py-2 text-right font-semibold">
                  {t("breakdown.issuedValue")}
                </th>
                <th className="py-2 text-right font-semibold">
                  {t("breakdown.returned")}
                </th>
                <th className="py-2 text-right font-semibold">
                  {t("breakdown.net")}
                </th>
              </tr>
            </thead>
            <tbody>
              {issue.lines.map((line) => (
                <tr key={line.id} className="border-b border-border">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <ColourDot colour={line.colourHex} />
                      {/* Every coin type name opens that type's ledger. §8.6 */}
                      <Link
                        href={`/coins/types/${line.coinTypeId}`}
                        className="hover:text-primary hover:underline"
                      >
                        {line.coinTypeName}
                      </Link>
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Quantity value={line.packets} />
                  </td>
                  <td className="py-2 text-right">
                    <Quantity value={line.coinsIssued} />
                  </td>
                  <td className="py-2 text-right">
                    <PerCoinValue value={line.perCoinPrice} />
                  </td>
                  <td className="py-2 text-right">
                    <Money value={line.lineAmount} zeroAs="value" />
                  </td>
                  <td className="py-2 text-right">
                    <span className="font-mono text-caption text-muted-foreground">
                      {formatQuantity(line.coinsReturned)}
                    </span>
                    {" / "}
                    <Money value={line.returnedValue} className="inline" />
                  </td>
                  <td className="py-2 text-right">
                    <Money value={line.netAmount} emphasis zeroAs="value" />
                  </td>
                </tr>
              ))}

              <tr className="border-t-2 border-t-foreground font-semibold">
                <td className="py-2">{t("breakdown.total")}</td>
                <td />
                <td className="py-2 text-right">
                  <Quantity value={issue.totalCoinsIssued} emphasis />
                </td>
                <td />
                <td className="py-2 text-right">
                  <Money value={issue.totalAmount} emphasis zeroAs="value" />
                </td>
                <td className="py-2 text-right">
                  <Money value={issue.returnedValue} emphasis />
                </td>
                <td className="py-2 text-right">
                  <Money value={issue.netPayable} emphasis zeroAs="value" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="returns">
        {returnEntries.length === 0 ? (
          <EmptyState
            icon="returned"
            title={t("emptyReturns.title")}
            description={t("emptyReturns.body", { staff: issue.staffName })}
          />
        ) : (
          <Timeline entries={returnEntries} />
        )}
      </TabsContent>

      <TabsContent value="payments">
        {paymentEntries.length === 0 ? (
          <EmptyState
            icon="payment"
            title={t("emptyPayments.title")}
            description={t("emptyPayments.body", {
              staff: issue.staffName,
              amount: formatINR(Math.abs(issue.outstandingAmount)),
            })}
          />
        ) : (
          <Timeline entries={paymentEntries} />
        )}
      </TabsContent>
    </Tabs>
  );
}
