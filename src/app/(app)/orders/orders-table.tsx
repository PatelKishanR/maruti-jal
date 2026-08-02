"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { DataTable, type DataTableColumn, type QuickChip } from "@/components/data-table";
import { EmptyState, ErrorState } from "@/components/common/empty-state";
import { Money, Quantity } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import { formatDateRelative, daysAgo } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type {
  DeliveryOrderListItemDto,
  DeliveryOrderListResponseDto,
} from "@/lib/dto/delivery-order.dto";
import { OrderStatusBadges } from "./order-badges";

export function OrdersTable({ data }: { data: DeliveryOrderListResponseDto }) {
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

  const relative = (iso: string) =>
    formatDateRelative(iso, locale, {
      today: tCommon("today"),
      yesterday: tCommon("yesterday"),
    });

  const columns: DataTableColumn<DeliveryOrderListItemDto>[] = [
    {
      id: "code",
      header: t("columns.code"),
      sortKey: "code",
      cell: (o) => (
        <span className="font-mono text-[13px] font-medium text-primary">{o.code}</span>
      ),
    },
    {
      id: "staff",
      header: t("columns.staff"),
      sortKey: "staff",
      cell: (o) => (
        <span className="block">
          <span className="block text-foreground">{o.staffName}</span>
          {o.staffPhone && (
            <span className="block text-caption text-muted-foreground">{o.staffPhone}</span>
          )}
        </span>
      ),
    },
    {
      id: "items",
      header: t("columns.items"),
      hideOnMobile: true,
      cell: (o) => (
        <span className="rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">
          {t("itemsChip", {
            lines: o.items.lineCount,
            units: o.items.unitCount,
          })}
        </span>
      ),
    },
    {
      id: "total",
      header: t("columns.total"),
      sortKey: "total",
      align: "right",
      cell: (o) => (
        <span className="block">
          <Money value={o.totalAmount} />
          {/* Decision D5 made visible. Unsold jars coming back LOWER the total,
              so without the struck original a correct figure reads as a bug. */}
          {o.items.filledReturnCredit > 0 && (
            <span
              className="block text-caption text-muted-foreground line-through"
              title={t("wasTooltip", {
                credit: formatINR(o.items.filledReturnCredit),
              })}
            >
              {formatINR(o.items.grossAmount - o.discountAmount)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "outstanding",
      header: t("columns.outstanding"),
      sortKey: "outstanding",
      align: "right",
      cell: (o) => (
        <Money
          value={o.dueAmount}
          emphasis
          variant={o.outstandingAmount < 0 ? "refund" : undefined}
        />
      ),
    },
    {
      id: "date",
      header: t("columns.date"),
      sortKey: "date",
      hideOnMobile: true,
      cell: (o) => {
        const age = daysAgo(o.orderDate);
        return (
          <span
            className={
              o.jarsOut && age > 15
                ? "text-destructive"
                : o.jarsOut && age > 7
                  ? "text-warning"
                  : undefined
            }
          >
            {relative(o.orderDate)}
          </span>
        );
      },
    },
    {
      id: "status",
      header: t("columns.status"),
      align: "center",
      cell: (o) => <OrderStatusBadges order={o} className="justify-center" />,
    },
  ];

  const quickChips: QuickChip[] = [
    { id: "today", label: t("chips.today"), params: { range: "today" } },
    { id: "moneyPending", label: t("chips.moneyPending"), params: { payment: "pending" } },
    { id: "jarsOut", label: t("chips.jarsOut"), params: { returns: "pending" } },
    { id: "settled", label: t("chips.settled"), params: { status: "settled" } },
  ];

  return (
    <DataTable
      columns={columns}
      result={data}
      rowKey={(o) => o.id}
      rowHref={(o) => `/orders/${o.id}`}
      rowClassName={(o) => (o.status === "CANCELLED" ? "opacity-60" : undefined)}
      searchPlaceholder={t("searchPlaceholder")}
      quickChips={quickChips}
      // The owner reads this register a day at a time; bands are how the paper
      // one was organised.
      groupBy={{
        key: (o) => o.orderDate,
        render: (date, rows) => (
          <span className="flex w-full items-center justify-between text-caption">
            <span className="font-medium uppercase tracking-wide text-muted-foreground">
              {relative(date)}
            </span>
            <span className="text-muted-foreground">
              {t("bandSummary", { count: rows.length })}
            </span>
          </span>
        ),
      }}
      renderExpanded={(o) => <OrderLinesPreview order={o} />}
      toolbarActions={
        <Button asChild>
          <Link href="/orders/new">{t("actions.add")}</Link>
        </Button>
      }
      emptyState={
        <EmptyState
          variant="no-data"
          icon="order"
          title={t("empty.noData.title")}
          description={t("empty.noData.body")}
          action={
            <Button asChild>
              <Link href="/orders/new">{t("empty.noData.action")}</Link>
            </Button>
          }
        />
      }
      noResultsState={
        <EmptyState
          variant="no-results"
          title={t("empty.noResults.title")}
          description={t("empty.noResults.body")}
        />
      }
    />
  );
}

/**
 * The expanded panel: what the order actually contained.
 *
 * Every figure here comes straight off the DTO. Nothing is recomputed —
 * `filledReturnCredit` and `lineTotal` are the database's own arithmetic, and
 * re-deriving them in the browser is how the two drift apart.
 */
function OrderLinesPreview({ order }: { order: DeliveryOrderListItemDto }) {
  const t = useTranslations("orders");

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-caption">
        <span className="text-muted-foreground">
          {t("expanded.lines", { count: order.items.lineCount })}
        </span>
        <span className="text-muted-foreground">
          {t("expanded.units")} <Quantity value={order.items.unitCount} />
        </span>
        {order.items.filledReturnCredit > 0 && (
          <span className="text-warning">
            {t("expanded.credited")}{" "}
            <Money value={order.items.filledReturnCredit} />
          </span>
        )}
        {order.qtyPending > 0 && (
          <span className="text-destructive">
            {t("expanded.stillOut")} <Quantity value={order.qtyPending} />
          </span>
        )}
      </div>

      <Link
        href={`/orders/${order.id}`}
        onClick={(e) => e.stopPropagation()}
        className="mt-2 inline-block text-caption font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("expanded.open")}
      </Link>
    </div>
  );
}

export { ErrorState };
