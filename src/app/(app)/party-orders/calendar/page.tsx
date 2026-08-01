import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { api } from "@/lib/api/client";
import { partyOrderPaths, partyOrderRoutes } from "@/lib/api/routes.party-order";
import {
  addDays,
  eachDay,
  formatDate,
  formatMonth,
  formatWeekday,
  monthBounds,
  todayIST,
} from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { DayDeliveryStatus } from "@/lib/db/entities/enums";
import type {
  PartyCalendarDeliveryDto,
  PartyCalendarDto,
} from "@/lib/dto/party-order.dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The month grid. Spec: design/MODULES/05-party-orders.md §10
 *
 * The schedule builder answers "what does this booking look like?"; this
 * answers "what does **this week** look like?" — the question asked at 6 am
 * while jars are being loaded. It is the only screen in the app that crosses
 * bookings by date.
 *
 * Server-rendered, and the month nav is a plain link, so the URL is the state:
 * `?month=2026-09` is shareable and the back button works. Every figure comes
 * from the API — the cell totals are a grouped SQL aggregate, never a sum over
 * the pills. See .claude/ARCHITECTURE.md §9.1
 *
 * The grid window is already padded to whole Monday→Sunday weeks by the
 * service, so this page chunks the dates by seven and does no date arithmetic
 * of its own beyond stepping a month.
 */
export default async function PartyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("partyOrders.calendar");
  const tRoot = await getTranslations("partyOrders");
  const locale = (await getLocale()) as Locale;

  const params = await searchParams;
  const requested = typeof params.month === "string" ? params.month : undefined;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested ?? "")
    ? (requested as string)
    : todayIST().slice(0, 7);

  const header = (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <>
          <Button variant="secondary" asChild>
            <Link href={partyOrderPaths.list}>
              <List aria-hidden />
              {t("listView")}
            </Link>
          </Button>
          <Button asChild>
            <Link href={partyOrderPaths.new}>
              <Plus aria-hidden />
              {tRoot("actions.add")}
            </Link>
          </Button>
        </>
      }
    />
  );

  let calendar: PartyCalendarDto;
  try {
    calendar = await api.get<PartyCalendarDto>(partyOrderRoutes.calendar(month));
  } catch {
    return (
      <>
        {header}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex min-h-80 flex-col items-center justify-center text-center">
            <AlertTriangle className="size-12 text-destructive" aria-hidden />
            <h2 className="mt-4 text-h4 font-semibold text-foreground">
              {t("error.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("error.body")}</p>
            <Button asChild className="mt-4">
              <Link href={partyOrderPaths.calendar(month)}>
                {t("error.cta")}
              </Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const bounds = monthBounds(`${month}-01`);
  const today = todayIST();

  // Whole weeks by construction — the service padded the window. §10.3
  const cells = eachDay(calendar.from, calendar.to);
  const weeks: string[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  const byDate = new Map<string, PartyCalendarDeliveryDto[]>();
  for (const delivery of calendar.deliveries) {
    const list = byDate.get(delivery.serviceDate) ?? [];
    list.push(delivery);
    byDate.set(delivery.serviceDate, list);
  }

  const totalByDate = new Map(
    calendar.dayTotals.map((row) => [row.serviceDate, row.amount]),
  );

  const previousMonth = monthBounds(addDays(bounds.from, -1)).from.slice(0, 7);
  const nextMonth = monthBounds(addDays(bounds.to, 1)).from.slice(0, 7);

  return (
    <>
      {header}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              href={partyOrderPaths.calendar(previousMonth)}
              aria-label={t("previousMonth")}
            >
              <ChevronLeft aria-hidden />
            </Link>
          </Button>

          <h2 className="text-h4 font-semibold text-foreground">
            {formatMonth(bounds.from, locale)}
          </h2>

          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              href={partyOrderPaths.calendar(nextMonth)}
              aria-label={t("nextMonth")}
            >
              <ChevronRight aria-hidden />
            </Link>
          </Button>

          <Button variant="secondary" size="sm" asChild>
            <Link href={partyOrderPaths.calendar()}>{t("today")}</Link>
          </Button>
        </div>

        {/* Who is out this month. Informational — see the note in the report
            about filtering by staff. §10.3 */}
        {calendar.staff.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
            <span className="text-caption text-muted-foreground">
              {t("staffLabel")}
            </span>
            {calendar.staff.map((member) => (
              <Badge key={member.id}>{member.name}</Badge>
            ))}
          </div>
        )}

        {calendar.deliveries.length === 0 ? (
          <EmptyState
            icon="party"
            title={t("empty.title")}
            description={t("empty.body", {
              month: formatMonth(bounds.from, locale),
            })}
            action={
              <Button asChild>
                <Link href={partyOrderPaths.new}>{tRoot("actions.add")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 table-fixed border-collapse">
              <thead>
                <tr>
                  {weeks[0]?.map((date) => (
                    <th
                      key={date}
                      scope="col"
                      className="border-b border-border bg-muted px-2 py-3 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground"
                    >
                      {formatWeekday(date, locale)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0]}>
                    {week.map((date) => (
                      <DayCell
                        key={date}
                        date={date}
                        inMonth={date >= bounds.from && date <= bounds.to}
                        isToday={date === today}
                        deliveries={byDate.get(date) ?? []}
                        total={totalByDate.get(date) ?? null}
                        locale={locale}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {t("footer", {
            bookings: calendar.totals.bookings,
            days: calendar.totals.days,
            units: formatQuantity(calendar.totals.units),
            amount: formatINR(calendar.totals.amount),
          })}
        </div>
      </div>
    </>
  );
}

const PILL_VARIANT: Record<
  DayDeliveryStatus,
  "primary" | "success" | "warning" | "default"
> = {
  SCHEDULED: "primary",
  DELIVERED: "success",
  SKIPPED: "warning",
  CANCELLED: "default",
};

/** Three pills, then `+n more` — a cell that scrolls is a cell nobody reads. */
const MAX_PILLS = 3;

async function DayCell({
  date,
  inMonth,
  isToday,
  deliveries,
  total,
  locale,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  deliveries: PartyCalendarDeliveryDto[];
  total: number | null;
  locale: Locale;
}) {
  const t = await getTranslations("partyOrders.calendar");
  const visible = deliveries.slice(0, MAX_PILLS);
  const overflow = deliveries.length - visible.length;

  return (
    <td
      className={cn(
        "h-30 border border-border p-2 align-top",
        !inMonth && "bg-muted/40",
        isToday && "outline-2 -outline-offset-2 outline-primary",
      )}
    >
      <div className="flex h-full flex-col gap-1">
        <span
          className={cn(
            "text-sm font-medium",
            isToday &&
              "inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground",
            !inMonth && "text-muted-foreground/60",
            inMonth && !isToday && "text-foreground",
          )}
        >
          {Number(date.slice(8))}
        </span>

        <ul className="flex flex-col gap-1">
          {visible.map((delivery) => (
            <li key={delivery.dayId}>
              <Link
                href={partyOrderPaths.day(delivery.partyOrderId, delivery.serviceDate)}
                title={t("pillTooltip", {
                  party: delivery.partyName,
                  items: delivery.itemsSummary,
                  staff: delivery.assignedStaffName ?? "—",
                  amount: formatINR(delivery.dayTotal),
                })}
                className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Badge
                  variant={PILL_VARIANT[delivery.deliveryStatus]}
                  className={cn(
                    "w-full justify-start",
                    delivery.deliveryStatus === "CANCELLED" && "opacity-60",
                  )}
                >
                  <span className="truncate">{delivery.partyName}</span>
                  <span className="ml-auto font-mono tabular-nums">
                    {formatQuantity(delivery.units)}
                  </span>
                </Badge>
              </Link>
            </li>
          ))}
        </ul>

        {overflow > 0 && (
          <span className="text-caption text-primary">
            {t("more", { count: overflow })}
          </span>
        )}

        {total !== null && (
          <span className="mt-auto text-right font-mono text-caption tabular-nums text-muted-foreground">
            {formatINR(total)}
          </span>
        )}
      </div>

      <span className="sr-only">{formatDate(date, locale)}</span>
    </td>
  );
}
