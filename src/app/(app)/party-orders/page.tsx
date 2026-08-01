import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Plus } from "lucide-react";
import { KpiCard, KpiRow } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { partyOrderPaths, partyOrderRoutes } from "@/lib/api/routes.party-order";
import { formatDate, monthBounds } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import { parseListQuery, TABLE_PARAMS } from "@/lib/table";
import { partyOrderTableConfig } from "@/lib/table/configs/party-order";
import type { Locale } from "@/i18n/config";
import type {
  PartyOrderKpisDto,
  PartyOrderListResponseDto,
} from "@/lib/dto/party-order.dto";
import { PartyOrdersLoadError, PartyOrdersTable } from "./party-orders-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every booking, its dates, its progress and its money.
 * Spec: design/MODULES/05-party-orders.md §3
 *
 * Fetches through the API like every other screen — no service import, no
 * repository, no DataSource. See .claude/ARCHITECTURE.md §4
 *
 * All table state lives in the URL, so this page re-runs per request and the
 * server stays the single source of truth. `parseListQuery` neutralises
 * everything hostile before it becomes a query string: the sort value has to be
 * a KEY of `partyOrderTableConfig.sortable` or it falls back to the default.
 *
 * The list and its KPI strip arrive in ONE response, so the strip and the table
 * cannot disagree while one of them is in flight.
 */
export default async function PartyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("partyOrders");
  const params = await searchParams;
  const query = parseListQuery(params, partyOrderTableConfig);

  const header = (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <>
          <Button variant="secondary" asChild>
            <Link href={partyOrderPaths.calendar()}>
              <CalendarDays aria-hidden />
              {t("actions.calendar")}
            </Link>
          </Button>
          <Button asChild>
            <Link href={partyOrderPaths.new}>
              <Plus aria-hidden />
              {t("actions.add")}
            </Link>
          </Button>
        </>
      }
    />
  );

  let data: PartyOrderListResponseDto;
  try {
    data = await api.get<PartyOrderListResponseDto>(
      partyOrderRoutes.list({
        [TABLE_PARAMS.page]: String(query.page),
        [TABLE_PARAMS.pageSize]: String(query.pageSize),
        [TABLE_PARAMS.sort]: query.sort.key,
        [TABLE_PARAMS.dir]: query.sort.dir,
        [TABLE_PARAMS.q]: query.q,
        ...query.filters,
      }),
    );
  } catch {
    // Plain language, no stack trace, and a retry that re-runs this render.
    return (
      <>
        {header}
        <PartyOrdersLoadError />
      </>
    );
  }

  return (
    <>
      {header}
      <PartyKpis kpis={data.kpis} />
      <PartyOrdersTable result={data.result} />
    </>
  );
}

/**
 * The four KPI cards — §3.3. Every figure is a door.
 *
 * A server component: `KpiCard` takes an icon NAME rather than a component,
 * precisely so a strip whose data is already fetched on the server does not
 * need a client island. See components/common/icons.ts
 */
async function PartyKpis({ kpis }: { kpis: PartyOrderKpisDto }) {
  const t = await getTranslations("partyOrders.kpis");
  const locale = (await getLocale()) as Locale;

  const trend = percentChange(kpis.revenueThisMonth, kpis.revenuePreviousMonth);
  const previousMonthLabel = formatDate(
    monthBounds(`${kpis.month}-01`).from,
    locale,
  );

  return (
    <KpiRow className="mb-6">
      <KpiCard
        icon="party"
        label={t("activeLabel")}
        value={kpis.activeParties}
        format="count"
        href={partyOrderPaths.active}
        breakdown={t("activeBreakdown", {
          starting: kpis.startingThisWeek,
          days: kpis.daysScheduled,
        })}
        zeroHint={t("activeZero")}
      />

      <KpiCard
        icon="calendar"
        label={t("todayLabel")}
        value={kpis.deliveriesToday}
        format="count"
        href={partyOrderPaths.calendar()}
        breakdown={
          kpis.deliveriesToday > 0
            ? [
                t("todayUnits", { units: formatQuantity(kpis.unitsToday) }),
                kpis.staffToday.join(" · "),
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        zeroHint={t("todayZero")}
      />

      <KpiCard
        icon="payment"
        label={t("revenueLabel")}
        value={kpis.revenueThisMonth}
        href={partyOrderPaths.list}
        trend={
          trend === null
            ? undefined
            : {
                direction: trend > 0 ? "up" : trend < 0 ? "down" : "flat",
                percent: trend,
                label: t("vsPreviousMonth", { month: previousMonthLabel }),
              }
        }
        breakdown={t("revenueBookings", { count: kpis.bookingsThisMonth })}
        zeroHint={t("revenueZero")}
      />

      <KpiCard
        icon="rupee"
        label={t("outstandingLabel")}
        value={kpis.totalOutstanding}
        href={partyOrderPaths.outstanding}
        // Alert only when there is something to chase — a red card on a settled
        // book is noise the owner learns to ignore. §3.3
        variant={kpis.totalOutstanding > 0 ? "alert" : "default"}
        invertTrend
        breakdown={[
          t("outstandingParties", { count: kpis.partiesOutstanding }),
          kpis.oldestOutstandingDays === null
            ? null
            : t("outstandingOldest", { days: kpis.oldestOutstandingDays }),
        ]
          .filter(Boolean)
          .join(" · ")}
        zeroHint={t("outstandingZero")}
      />
    </KpiRow>
  );
}

/**
 * Month-on-month movement.
 *
 * `null` when the previous month is zero: "up 100%" from nothing is a figure
 * the owner cannot act on, and a card that shows it stops being read.
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
