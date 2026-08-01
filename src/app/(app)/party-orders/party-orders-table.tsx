"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Ban,
  Banknote,
  Calendar,
  CalendarPlus,
  Eye,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import {
  DataTable,
  useTableParams,
  type DataTableColumn,
  type QuickChip,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/common/empty-state";
import { DateInput } from "@/components/form";
import { Money } from "@/components/common/money";
import { api } from "@/lib/api/client";
import { partyOrderPaths, partyOrderRoutes } from "@/lib/api/routes.party-order";
import { formatDate, formatDateRange } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { ListResult } from "@/lib/table/types";
import type { PartyOrderListItemDto } from "@/lib/dto/party-order.dto";
import {
  PARTY_ORDER_DELIVERY_FILTERS,
  PARTY_ORDER_PAYMENT_FILTERS,
} from "@/lib/table/configs/party-order";
import { PartyProgress, PartyStatusBadges } from "./party-order-badges";
import { PaymentModal } from "./payment-modal";

/**
 * The bookings list. Spec: design/MODULES/05-party-orders.md §3
 *
 * Talks to the API only — no service, no repository, no database import.
 * See .claude/ARCHITECTURE.md §4
 *
 * Every `sortKey` below is a key of `partyOrderTableConfig.sortable`. It travels
 * as a URL parameter and is used by the server ONLY as a lookup key into that
 * allowlist, never as a SQL fragment.
 */
export function PartyOrdersTable({
  result,
}: {
  result: ListResult<PartyOrderListItemDto>;
}) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;
  const { get, clearAll } = useTableParams();
  const query = get("q") ?? "";

  const columns: DataTableColumn<PartyOrderListItemDto>[] = [
    {
      id: "code",
      header: t("columns.code"),
      sortKey: "code",
      width: "128px",
      cell: (order) => (
        <span className="flex items-center gap-1">
          {/* The row the owner is looking for at 6 am. §3.5 */}
          {order.hasDeliveryToday && (
            <Calendar className="size-3 shrink-0 text-primary" aria-hidden />
          )}
          <span className="font-mono text-[13px] font-medium text-primary">
            {order.code}
          </span>
        </span>
      ),
    },
    {
      id: "party",
      header: t("columns.party"),
      sortKey: "partyName",
      cell: (order) => (
        <div className="min-w-0">
          {/* Wraps rather than truncates — `પટેલ સમાજ વાડી, કલોલ ચાર રસ્તા
              પાસે` is a real party name. §1 */}
          <p className="text-sm font-medium text-foreground">{order.partyName}</p>
          <p className="font-mono text-caption text-muted-foreground">
            {order.phone}
          </p>
        </div>
      ),
    },
    {
      id: "address",
      header: t("columns.address"),
      width: "200px",
      hideOnMobile: true,
      cell: (order) => (
        <span
          className="block truncate text-sm text-muted-foreground"
          title={order.deliveryAddress}
        >
          {order.deliveryAddress}
        </span>
      ),
    },
    {
      id: "dates",
      header: t("columns.dates"),
      sortKey: "startDate",
      width: "150px",
      cell: (order) =>
        order.firstServiceDate && order.lastServiceDate ? (
          <span className="text-sm text-foreground">
            {formatDateRange(order.firstServiceDate, order.lastServiceDate, locale)}
          </span>
        ) : (
          <span className="text-caption text-muted-foreground">
            {t("noSchedule")}
          </span>
        ),
    },
    {
      id: "days",
      header: t("columns.days"),
      width: "96px",
      cell: (order) => (
        <PartyProgress
          progress={order.progress}
          cancelled={order.status === "CANCELLED"}
        />
      ),
    },
    {
      id: "payable",
      header: t("columns.payable"),
      sortKey: "totalAmount",
      align: "right",
      width: "120px",
      cell: (order) => <Money value={order.totalAmount} />,
    },
    {
      id: "received",
      header: t("columns.received"),
      align: "right",
      width: "120px",
      cell: (order) => <Money value={order.paidAmount} />,
    },
    {
      id: "outstanding",
      header: t("columns.outstanding"),
      sortKey: "outstandingAmount",
      align: "right",
      width: "130px",
      // Negative renders as `(₹1,000.00)` in Danger — the company owes it back.
      cell: (order) => <Money value={order.outstandingAmount} emphasis />,
    },
    {
      id: "status",
      header: t("columns.status"),
      width: "190px",
      cell: (order) => <PartyStatusBadges order={order} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "center",
      width: "56px",
      cell: (order) => <RowActions order={order} />,
    },
  ];

  /**
   * `Money pending` combines with any of the other three; the delivery chips
   * are mutually exclusive because a booking is in exactly one of those states.
   * §3.6
   */
  const quickChips: QuickChip[] = [
    { id: "all", label: t("chips.all"), params: { delivery: undefined } },
    {
      id: "upcoming",
      label: t("chips.upcoming"),
      params: { delivery: "upcoming" },
    },
    {
      id: "inProgress",
      label: t("chips.inProgress"),
      params: { delivery: "inProgress" },
    },
    {
      id: "outstanding",
      label: t("chips.moneyPending"),
      params: { outstanding: "true" },
    },
    {
      id: "completed",
      label: t("chips.completed"),
      params: { delivery: "completed" },
    },
  ];

  return (
    <DataTable
      columns={columns}
      result={result}
      rowKey={(order) => order.id}
      rowHref={(order) => partyOrderPaths.detail(order.id)}
      searchPlaceholder={t("searchPlaceholder")}
      quickChips={quickChips}
      filters={<PartyOrderFilters />}
      // A cancelled booking stays legible but reads as history. §3.5
      rowClassName={(order) =>
        cn(
          order.status === "CANCELLED" && "opacity-60",
          order.hasDeliveryToday && "border-l-[3px] border-l-primary",
        )
      }
      emptyState={
        <EmptyState
          icon="party"
          title={t("empty.noData.title")}
          description={t("empty.noData.body")}
          action={
            <Button asChild>
              <Link href={partyOrderPaths.new}>{t("actions.add")}</Link>
            </Button>
          }
        />
      }
      noResultsState={
        <EmptyState
          variant="no-results"
          title={t("empty.noResults.title")}
          description={
            query
              ? t("empty.noResults.bodyWithQuery", { query })
              : t("empty.noResults.body")
          }
          onClearFilters={clearAll}
        />
      }
      mobileCard={(order) => <PartyOrderCard order={order} />}
    />
  );
}

/** Below `md` each row becomes a card. §3.7 */
function PartyOrderCard({ order }: { order: PartyOrderListItemDto }) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[13px] font-medium text-primary">
          {order.code}
        </span>
        <PartyStatusBadges order={order} className="items-end" />
      </div>

      <p className="text-base font-medium text-foreground">{order.partyName}</p>

      <p className="text-caption text-muted-foreground">
        {order.phone}
        {order.firstServiceDate && order.lastServiceDate
          ? ` · ${formatDateRange(order.firstServiceDate, order.lastServiceDate, locale)}`
          : ""}
      </p>

      <PartyProgress
        progress={order.progress}
        cancelled={order.status === "CANCELLED"}
      />

      <div className="flex items-center justify-between gap-3 border-t border-border pt-1">
        <span className="text-caption text-muted-foreground">
          {t("columns.payable")} <Money value={order.totalAmount} />
        </span>
        <span className="text-caption text-muted-foreground">
          {t("columns.outstanding")}{" "}
          <Money value={order.outstandingAmount} emphasis />
        </span>
      </div>
    </div>
  );
}

/**
 * Row menu. Always visible, not hover-only — hover-only actions are
 * undiscoverable and impossible on touch. DESIGN-STANDARDS §5.2
 */
function RowActions({ order }: { order: PartyOrderListItemDto }) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [, startTransition] = useTransition();

  const cancelled = order.status === "CANCELLED";

  async function cancel() {
    try {
      await api.del(partyOrderRoutes.cancel(order.id));
      startTransition(() => router.refresh());
      toast.success(t("toast.cancelled", { code: order.code }));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  }

  return (
    // The row itself navigates; this cell must not.
    <span onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("rowActions.menu", { party: order.partyName })}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={partyOrderPaths.detail(order.id)}>
              <Eye aria-hidden />
              {t("rowActions.view")}
            </Link>
          </DropdownMenuItem>

          {!cancelled && (
            <>
              <DropdownMenuItem onSelect={() => setPaying(true)}>
                <Banknote aria-hidden />
                {t("rowActions.recordPayment")}
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href={partyOrderPaths.schedule(order.id)}>
                  <CalendarPlus aria-hidden />
                  {t("rowActions.addDay")}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href={partyOrderPaths.detail(order.id)}>
                  <Pencil aria-hidden />
                  {t("rowActions.edit")}
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem destructive onSelect={() => setCancelling(true)}>
                <Ban aria-hidden />
                {t("rowActions.cancel")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PaymentModal
        open={paying}
        onOpenChange={setPaying}
        order={order}
        onRecorded={() => startTransition(() => router.refresh())}
      />

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t("cancelBooking.title", { code: order.code })}
        // The consequence in one sentence, with the figures. §7.6
        description={t("cancelBooking.body", {
          party: order.partyName,
          days: order.progress.scheduledDays,
          received: formatINR(order.paidAmount),
          from: order.firstServiceDate
            ? formatDate(order.firstServiceDate, locale)
            : "—",
        })}
        confirmLabel={t("cancelBooking.confirm")}
        onConfirm={cancel}
      />
    </span>
  );
}

/** The filter popover — design §3.3. */
function PartyOrderFilters() {
  const t = useTranslations("partyOrders.filters");
  const { get, setParams } = useTableParams();

  return (
    <>
      <FilterSelect
        label={t("delivery")}
        value={get("delivery") ?? "all"}
        options={PARTY_ORDER_DELIVERY_FILTERS.map((value) => ({
          value,
          label: t(`deliveryOptions.${value}`),
        }))}
        onChange={(value) =>
          setParams({ delivery: value === "all" ? undefined : value })
        }
      />

      <FilterSelect
        label={t("payment")}
        value={get("payment") ?? "all"}
        options={PARTY_ORDER_PAYMENT_FILTERS.map((value) => ({
          value,
          label: t(`paymentOptions.${value}`),
        }))}
        onChange={(value) =>
          setParams({ payment: value === "all" ? undefined : value })
        }
      />

      <label className="flex flex-col gap-1">
        <span className="text-caption font-medium text-muted-foreground">
          {t("from")}
        </span>
        <DateInput
          value={get("from") ?? ""}
          onValueChange={(value) => setParams({ from: value || undefined })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-caption font-medium text-muted-foreground">
          {t("to")}
        </span>
        <DateInput
          value={get("to") ?? ""}
          onValueChange={(value) => setParams({ to: value || undefined })}
        />
      </label>
    </>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-45 flex-col gap-1">
      <span className="text-caption font-medium text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * The list failed to load.
 *
 * A client component because `Try again` re-runs the server render, and a
 * Server Component cannot hand a callback across the boundary.
 */
export function PartyOrdersLoadError() {
  const t = useTranslations("partyOrders.error");
  const router = useRouter();

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <ErrorState
        title={t("listTitle")}
        description={t("listBody")}
        onRetry={() => router.refresh()}
      />
    </div>
  );
}
