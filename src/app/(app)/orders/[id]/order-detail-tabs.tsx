"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Timeline, type TimelineEntry } from "@/components/common/timeline";
import { Money, Quantity } from "@/components/common/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type { DeliveryOrderDetailDto, OrderLineDto } from "@/lib/dto/delivery-order.dto";

export function OrderDetailTabs({ order }: { order: DeliveryOrderDetailDto }) {
  const t = useTranslations("orders.detail");
  const locale = useLocale() as Locale;
  const [tab, setTab] = useState("items");

  const returnEntries: TimelineEntry[] = order.returns.map((r) => ({
    id: r.id,
    tone: r.isReversal ? "warning" : "success",
    title: (
      <span>
        {t("returnedLine", {
          product: r.productTitle,
          empty: r.emptyQty,
          filled: r.filledQty,
        })}
        {r.lostQty > 0 && (
          <span className="ml-2 text-destructive">
            {t("lost", { count: r.lostQty })}
          </span>
        )}
      </span>
    ),
    meta: formatDate(r.returnDate, locale),
    note: r.note,
  }));

  const paymentEntries: TimelineEntry[] = order.payments.map((p) => ({
    id: p.id,
    tone: p.direction === "OUT" ? "primary" : "success",
    title: (
      <span>
        {p.direction === "OUT" ? t("refunded") : t("paid")}{" "}
        <Money value={p.amount} emphasis />
        <span className="ml-2 text-muted-foreground">
          {t(`modes.${p.mode}` as never)}
        </span>
      </span>
    ),
    meta: `${formatDate(p.paidOn, locale)} · ${p.code}`,
    note:
      p.mode === "COIN" && p.coinCount
        ? t("coinsNote", { count: p.coinCount })
        : p.referenceNo,
  }));

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="items" count={order.lines.length}>
          {t("tabs.items")}
        </TabsTrigger>
        <TabsTrigger value="returns" count={order.returns.length}>
          {t("tabs.returns")}
        </TabsTrigger>
        <TabsTrigger value="payments" count={order.payments.length}>
          {t("tabs.payments")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="items">
        <LinesTable order={order} />
      </TabsContent>

      <TabsContent value="returns">
        <Timeline entries={returnEntries} emptyLabel={t("noReturns")} className="p-4" />
      </TabsContent>

      <TabsContent value="payments">
        <Timeline entries={paymentEntries} emptyLabel={t("noPayments")} className="p-4" />
      </TabsContent>
    </Tabs>
  );
}

function LinesTable({ order }: { order: DeliveryOrderDetailDto }) {
  const t = useTranslations("orders.detail");

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("cols.product")}</TableHead>
            <TableHead align="right">{t("cols.qty")}</TableHead>
            <TableHead align="right">{t("cols.rate")}</TableHead>
            <TableHead align="right">{t("cols.returned")}</TableHead>
            <TableHead align="right">{t("cols.pending")}</TableHead>
            <TableHead align="right">{t("cols.total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.lines.map((line) => (
            <LineRow key={line.id} line={line} />
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col items-end gap-1 border-t border-border bg-muted px-4 py-3 text-sm">
        {/* Decision D5, spelled out. The subtotal is LOWER than the goods that
            left the plant, and the owner has to see why or he will read a
            correct figure as a mistake. */}
        {order.items.filledReturnCredit > 0 && (
          <>
            <SummaryLine label={t("goodsIssued")} value={order.items.grossAmount} />
            <SummaryLine
              label={t("filledCredit")}
              value={-order.items.filledReturnCredit}
              tone="warning"
            />
          </>
        )}
        {order.discountAmount > 0 && (
          <SummaryLine label={t("discount")} value={-order.discountAmount} />
        )}
        <div className="mt-1 flex w-full max-w-xs items-baseline justify-between border-t border-border pt-2">
          <span className="font-medium text-foreground">{t("billed")}</span>
          <span className="font-mono text-h4 font-semibold tabular-nums text-foreground">
            {formatINR(order.totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div className="flex w-full max-w-xs items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          tone === "warning"
            ? "font-mono tabular-nums text-warning"
            : "font-mono tabular-nums text-muted-foreground"
        }
      >
        {formatINR(value)}
      </span>
    </div>
  );
}

function LineRow({ line }: { line: OrderLineDto }) {
  const t = useTranslations("orders.detail");

  return (
    <TableRow
      // A bargained rate gets an amber edge, so the owner can see which lines
      // went out below list price without reading every number.
      className={line.isPriceOverridden ? "border-l-2 border-l-warning" : undefined}
    >
      <TableCell>
        <span className="block text-foreground">{line.productTitle}</span>
        {line.isPriceOverridden && (
          <Badge variant="warning" className="mt-1">
            {t("bargained", { delta: formatINR(line.priceDelta) })}
          </Badge>
        )}
      </TableCell>
      <TableCell align="right">
        <Quantity value={line.quantity} />
      </TableCell>
      <TableCell align="right">
        <Money value={line.unitPrice} />
      </TableCell>
      <TableCell align="right">
        <span className="text-muted-foreground">
          {t("returnedSplit", {
            empty: line.returnedEmptyQty,
            filled: line.returnedFilledQty,
          })}
        </span>
      </TableCell>
      <TableCell align="right">
        {line.pendingQty > 0 ? (
          <span className="font-mono tabular-nums text-destructive">
            {line.pendingQty}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell align="right">
        <span className="block">
          <Money value={line.lineTotal} emphasis />
          {line.filledReturnCredit > 0 && (
            <span className="block text-caption text-muted-foreground line-through">
              {formatINR(line.grossLineTotal)}
            </span>
          )}
        </span>
      </TableCell>
    </TableRow>
  );
}
