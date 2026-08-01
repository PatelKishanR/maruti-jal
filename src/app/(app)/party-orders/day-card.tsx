"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Ban,
  Calendar,
  CalendarPlus,
  Check,
  Copy,
  FileText,
  MoreHorizontal,
  Pencil,
  SkipForward,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Money, Quantity } from "@/components/common/money";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, formatTime, formatWeekday, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { DayDeliveryStatus } from "@/lib/db/entities/enums";
import {
  buildScheduleEntries,
  viewRateDifference,
  viewRateOverridden,
  type DayCardItemView,
  type DayCardView,
} from "./schedule-model";

/**
 * The day-card timeline. Spec: design/MODULES/05-party-orders.md §5.3
 *
 * ONE component for the wizard, the detail page and the edit screen — only the
 * footer actions differ. Nothing is learned twice between building a schedule
 * and running one, which is the whole reason the schedule builder and the
 * detail page look identical.
 *
 * **Gaps are visible.** A date with no delivery renders as a thin dashed marker
 * between the first and last scheduled day, and a run of four or more collapses
 * behind `Show days`. A missing date is information — it is the day the wedding
 * didn't need water — and a timeline that silently jumps from the 14th to the
 * 16th hides a mistake exactly as well as it hides an intention.
 */

const RAIL_DOT: Record<DayDeliveryStatus, string> = {
  SCHEDULED: "bg-primary border-primary",
  DELIVERED: "bg-success border-success",
  SKIPPED: "bg-warning border-warning",
  // Hollow — the day was called off, and the rail says so at a glance.
  CANCELLED: "bg-card border-muted-foreground/40",
};

const STATUS_KIND = {
  SCHEDULED: "scheduled",
  DELIVERED: "delivered",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
} as const;

export interface DayCardActions {
  onEdit?: (view: DayCardView) => void;
  onDuplicate?: (view: DayCardView) => void;
  onRemove?: (view: DayCardView) => void;
  onMarkDelivered?: (view: DayCardView) => void;
  onMarkSkipped?: (view: DayCardView) => void;
  onRestore?: (view: DayCardView) => void;
}

export function ScheduleTimeline({
  days,
  onAddDay,
  actions,
  highlightDate,
  className,
}: {
  days: DayCardView[];
  /** A no-delivery marker opens the Edit-day modal pre-set to that date. §5.8 */
  onAddDay?: (serviceDate: string) => void;
  actions?: DayCardActions;
  /** `?day=` deep link from a calendar pill — scrolled to and ringed. §10.6 */
  highlightDate?: string;
  className?: string;
}) {
  const entries = buildScheduleEntries(days);

  return (
    <div className={cn("relative", className)}>
      {/* The rail: 2px, behind every node, stopping at the last one. */}
      <div
        className="absolute bottom-4 left-2 top-4 w-0.5 bg-border"
        aria-hidden
      />

      <ol className="flex flex-col gap-4">
        {entries.map((entry) =>
          entry.kind === "day" ? (
            <li key={entry.key} className="relative">
              <span
                className={cn(
                  "absolute left-0 top-5 z-10 size-3 rounded-full border-2",
                  RAIL_DOT[entry.day.status],
                )}
                aria-hidden
              />
              <DayCard
                view={entry.day}
                actions={actions}
                highlighted={highlightDate === entry.day.serviceDate}
              />
            </li>
          ) : (
            <li key={entry.key} className="relative">
              <NoDeliveryMarker
                from={entry.from}
                to={entry.to}
                count={entry.count}
                collapsible={entry.collapsible}
                dates={entry.dates}
                onAddDay={onAddDay}
              />
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

export function DayCard({
  view,
  actions,
  highlighted = false,
}: {
  view: DayCardView;
  actions?: DayCardActions;
  highlighted?: boolean;
}) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;
  const today = todayIST();

  const isToday = view.serviceDate === today;
  const overdue = view.status === "SCHEDULED" && view.serviceDate < today;
  const dimmed = view.status === "SKIPPED" || view.status === "CANCELLED";
  const billed = view.status !== "SKIPPED" && view.status !== "CANCELLED";
  const billedOnActuals = view.items.some(
    (item) => item.deliveredQuantity !== null,
  );

  return (
    <article
      id={`day-${view.serviceDate}`}
      className={cn(
        "ml-10 overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        // The card the owner is looking for at 6 am. §5.3
        isToday && "border-l-[3px] border-l-primary",
        highlighted && "outline-2 outline-offset-2 outline-primary",
      )}
    >
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <h3 className="min-w-0 text-base font-semibold text-foreground">
          {isToday ? `${t("day.today")} · ` : ""}
          {formatDate(view.serviceDate, locale)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            · {formatWeekday(view.serviceDate, locale)}
          </span>
        </h3>

        <div className="flex shrink-0 items-center gap-2">
          {overdue && (
            <span title={t("day.pastWarning")}>
              <AlertTriangle className="size-4 text-warning" aria-hidden />
              <span className="sr-only">{t("day.pastWarning")}</span>
            </span>
          )}
          {view.generated && (
            <Badge variant="primary">{t("day.generated")}</Badge>
          )}
          <StatusBadge status={STATUS_KIND[view.status]} />
          <DayMenu view={view} actions={actions} />
        </div>
      </header>

      {view.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-caption text-muted-foreground">
          {t("day.noItems")}
        </p>
      ) : (
        <ul className={cn(dimmed && "opacity-60")}>
          {view.items.map((item) => (
            <ItemRow key={item.key} item={item} />
          ))}
        </ul>
      )}

      {view.notes && (
        <p className="flex items-start gap-2 border-t border-border px-4 py-2 text-sm text-muted-foreground">
          <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>&ldquo;{view.notes}&rdquo;</span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2">
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-3.5 shrink-0" aria-hidden />
          {view.staffName ?? (
            <span className="text-muted-foreground/60">
              {t("day.notAssigned")}
            </span>
          )}
          {view.deliveredAt && (
            <span className="text-caption">
              · {t("day.deliveredAt", { time: formatTime(view.deliveredAt, locale) })}
            </span>
          )}
        </span>

        <span className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">
            {t("day.dayTotal")}
          </span>
          {/* A skipped or cancelled day is NOT billed — the total renders as an
              em dash rather than a figure the booking total will not contain. */}
          {billed ? (
            <Money value={view.total} emphasis className="text-base" />
          ) : (
            <span className="text-caption text-muted-foreground">
              {t("day.notBilled")}
            </span>
          )}
        </span>
      </div>

      {billed && billedOnActuals && (
        <p className="border-t border-border px-4 py-1 text-right text-caption text-muted-foreground">
          {t("day.billedOnDelivered")}
        </p>
      )}

      <DayFooter view={view} actions={actions} />
    </article>
  );
}

function ItemRow({ item }: { item: DayCardItemView }) {
  const t = useTranslations("partyOrders");
  const overridden = viewRateOverridden(item);
  const difference = viewRateDifference(item);

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-sm">
        <span className="min-w-0 flex-1 text-foreground">{item.title}</span>

        <span className="w-24 text-right font-mono tabular-nums text-muted-foreground">
          {item.deliveredQuantity !== null &&
          item.deliveredQuantity !== item.quantity ? (
            <>
              <span className="text-muted-foreground/60 line-through">
                × {item.quantity}
              </span>{" "}
              <span className="text-foreground">→ {item.deliveredQuantity}</span>
            </>
          ) : (
            <>× {item.deliveredQuantity ?? item.quantity}</>
          )}
        </span>

        <span className="w-24 text-right font-mono tabular-nums text-muted-foreground">
          @ {formatINR(item.unitPrice)}
        </span>

        <Money value={item.lineTotal} zeroAs="value" className="w-28" />
      </div>

      {/* The override strip — the price was negotiated, and by how much. §5.3 */}
      {overridden && (
        <p className="ml-8 mb-1.5 border-l-2 border-warning bg-[var(--badge-warning-bg)] px-2 py-1 text-caption text-[var(--badge-warning-fg)]">
          {t("day.rateOverride", {
            price: formatINR(item.unitPrice),
            base: formatINR(item.basePrice ?? 0),
            difference: `${difference > 0 ? "+" : "−"}${formatINR(Math.abs(difference))}`,
          })}
        </p>
      )}
    </li>
  );
}

function DayFooter({
  view,
  actions,
}: {
  view: DayCardView;
  actions?: DayCardActions;
}) {
  const t = useTranslations("partyOrders");

  const canEdit = actions?.onEdit && view.status !== "CANCELLED";
  const canDeliver =
    actions?.onMarkDelivered && view.status === "SCHEDULED" && view.id;
  const canRestore = actions?.onRestore && view.status === "CANCELLED";

  if (!canEdit && !canDeliver && !actions?.onDuplicate && !canRestore) {
    return null;
  }

  return (
    <footer className="flex min-h-12 flex-wrap items-center justify-end gap-3 border-t border-border bg-muted px-4 py-2">
      {canRestore && (
        <Button variant="ghost" size="sm" onClick={() => actions?.onRestore?.(view)}>
          {t("day.restore")}
        </Button>
      )}
      {canEdit && (
        <Button variant="secondary" size="sm" onClick={() => actions?.onEdit?.(view)}>
          <Pencil aria-hidden />
          {t("day.edit")}
        </Button>
      )}
      {actions?.onDuplicate && view.status !== "CANCELLED" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => actions?.onDuplicate?.(view)}
        >
          <Copy aria-hidden />
          {t("day.duplicate")}
        </Button>
      )}
      {canDeliver && (
        <Button size="sm" onClick={() => actions?.onMarkDelivered?.(view)}>
          <Check aria-hidden />
          {t("day.markDelivered")}
        </Button>
      )}
    </footer>
  );
}

function DayMenu({
  view,
  actions,
}: {
  view: DayCardView;
  actions?: DayCardActions;
}) {
  const t = useTranslations("partyOrders");
  if (!actions) return null;

  const delivered = view.status === "DELIVERED";
  const cancelled = view.status === "CANCELLED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("day.menu", { date: view.serviceDate })}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {actions.onEdit && !cancelled && (
          <DropdownMenuItem onSelect={() => actions.onEdit?.(view)}>
            <Pencil aria-hidden />
            {t("day.edit")}
          </DropdownMenuItem>
        )}
        {actions.onDuplicate && !cancelled && (
          <DropdownMenuItem onSelect={() => actions.onDuplicate?.(view)}>
            <Copy aria-hidden />
            {t("day.duplicateTo")}
          </DropdownMenuItem>
        )}
        {actions.onMarkSkipped && view.status === "SCHEDULED" && (
          <DropdownMenuItem onSelect={() => actions.onMarkSkipped?.(view)}>
            <SkipForward aria-hidden />
            {t("day.markSkipped")}
          </DropdownMenuItem>
        )}
        {actions.onRestore && cancelled && (
          <DropdownMenuItem onSelect={() => actions.onRestore?.(view)}>
            <Calendar aria-hidden />
            {t("day.restore")}
          </DropdownMenuItem>
        )}

        {actions.onRemove && !cancelled && (
          <>
            <DropdownMenuSeparator />
            {/* A DELIVERED day is never deletable, only cancellable — billing
                history is preserved, and the menu says which one it is. §7 */}
            <DropdownMenuItem destructive onSelect={() => actions.onRemove?.(view)}>
              {delivered ? <Ban aria-hidden /> : <Trash2 aria-hidden />}
              {delivered ? t("day.cancelDay") : t("day.removeDay")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The gap. 28px, a dashed rule broken by its own label.
 *
 * Clicking anywhere on it opens the Edit-day modal pre-set to that date, which
 * is the fastest path to filling a hole in a schedule. §5.3
 */
function NoDeliveryMarker({
  from,
  to,
  count,
  collapsible,
  dates,
  onAddDay,
}: {
  from: string;
  to: string;
  count: number;
  collapsible: boolean;
  dates: string[];
  onAddDay?: (serviceDate: string) => void;
}) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;
  const [expanded, setExpanded] = useState(false);

  if (collapsible && !expanded) {
    return (
      <div className="ml-10 flex min-h-8 items-center gap-3 border-t border-dashed border-border">
        <span className="-mt-2 bg-card pr-3 text-caption text-muted-foreground/60">
          {t("gap.collapsed", {
            range: `${formatDate(from, locale)} – ${formatDate(to, locale)}`,
            count,
          })}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="-mt-2 ml-auto min-h-11 bg-card pl-3 text-caption text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("gap.showDays")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {dates.map((date) => (
        <SingleGap key={date} date={date} onAddDay={onAddDay} />
      ))}
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="ml-10 self-end text-caption text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("gap.hideDays")}
        </button>
      )}
    </div>
  );
}

function SingleGap({
  date,
  onAddDay,
}: {
  date: string;
  onAddDay?: (serviceDate: string) => void;
}) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;

  const label = t("gap.noDelivery", {
    date: `${formatDate(date, locale)} · ${formatWeekday(date, locale)}`,
  });

  const content = (
    <span className="flex min-h-7 items-center gap-3 border-t border-dashed border-border">
      <span className="-mt-2 bg-card pr-3 text-caption text-muted-foreground/60 group-hover:text-muted-foreground">
        {label}
      </span>
      {onAddDay && (
        <span className="-mt-2 ml-auto bg-card pl-3 text-caption text-primary opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100">
          <CalendarPlus className="mr-1 inline size-3.5" aria-hidden />
          {t("gap.addDay")}
        </span>
      )}
    </span>
  );

  if (!onAddDay) {
    return <div className="ml-10">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onAddDay(date)}
      aria-label={t("gap.addDayOn", { date })}
      className="group ml-10 block w-full py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {content}
    </button>
  );
}

/**
 * The right-aligned totals block under a schedule. §5.3
 *
 * `total` is a preview figure in the wizard and the stored `total_amount` on a
 * saved booking — the caller decides which, because only it knows whether a
 * database row exists yet.
 */
export function ScheduleTotals({
  days,
  units,
  total,
  className,
}: {
  days: number;
  units: number;
  total: number;
  className?: string;
}) {
  const t = useTranslations("partyOrders");

  return (
    <dl className={cn("ml-auto w-80 max-w-full text-sm", className)}>
      <div className="flex items-center justify-between gap-4 py-1">
        <dt className="text-muted-foreground">{t("totals.days")}</dt>
        <dd>
          <Quantity value={days} />
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4 py-1">
        <dt className="text-muted-foreground">{t("totals.units")}</dt>
        <dd>
          <Quantity value={units} />
        </dd>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-2">
        <dt className="font-semibold text-foreground">{t("totals.payable")}</dt>
        <dd>
          <Money value={total} emphasis className="text-lg" />
        </dd>
      </div>
    </dl>
  );
}
