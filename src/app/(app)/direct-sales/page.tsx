import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard, KpiRow, type KpiTrend } from "@/components/common/kpi-card";
import { api } from "@/lib/api/client";
import { directSalePaths, directSaleRoutes } from "@/lib/api/routes.direct-sale";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/i18n/config";
import type { DirectSaleListDto, DirectSaleStatsDto } from "@/lib/dto/direct-sale.dto";
import { DirectSalesTable } from "./direct-sales-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Walk-in list. Spec: design/MODULES/06-direct-sales.md §3
 *
 * Two jobs on one screen: record the sale happening right now, and read off
 * what the drawer should contain at closing. There is deliberately **no
 * `+ New sale` button** — the create form is the always-focused row at the top
 * of the table, and a second way to reach it would be a slower path to the
 * same place.
 *
 * A server component that fetches through `lib/api/client` like every other
 * screen — cookies forwarded, no service import, no repository, no DataSource.
 * See ARCHITECTURE §4.1 rule 1
 */
export default async function DirectSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("directSales");
  const locale = (await getLocale()) as Locale;

  // Rows, KPIs and day bands in ONE round trip. §3.5
  const { result, stats, dayGroups } = await api.get<DirectSaleListDto>(
    directSaleRoutes.list(params),
  );

  const countDelta = stats.todayCount - stats.yesterdayCount;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Every number is a door: each card lands on the list behind it. §3.3 */}
      <KpiRow className="mb-6">
        <KpiCard
          label={t("kpi.walkIns")}
          icon="directSale"
          value={stats.todayCount}
          format="count"
          href={directSalePaths.today}
          breakdown={
            stats.yesterdayCount === 0 && countDelta === 0
              ? undefined
              : countDelta > 0
                ? t("kpi.walkInsUp", { count: countDelta })
                : countDelta < 0
                  ? t("kpi.walkInsDown", { count: Math.abs(countDelta) })
                  : t("kpi.walkInsFlat")
          }
          zeroHint={t("kpi.walkInsZero")}
        />

        {/* The cash-drawer figure — the one the owner reads at closing, so it
            comes first among the money cards. §3.3 */}
        <KpiCard
          label={t("kpi.collected")}
          icon="cash"
          value={stats.todayTotal}
          href={directSalePaths.todayByAmount}
          trend={collectedTrend(stats, t("kpi.vsYesterday"))}
          zeroHint={t("kpi.collectedZero")}
        />

        <KpiCard
          label={t("kpi.month")}
          icon="trendUp"
          value={stats.monthTotal}
          href={directSalePaths.month}
          breakdown={
            stats.monthCount > 0
              ? t("kpi.monthBreakdown", {
                  count: stats.monthCount,
                  date: formatDate(stats.monthFrom, locale),
                })
              : undefined
          }
          zeroHint={t("kpi.monthZero")}
        />

        <KpiCard
          label={t("kpi.average")}
          icon="rupee"
          value={stats.averageToday}
          href={directSalePaths.today}
          breakdown={
            stats.todayCount > 0
              ? t("kpi.averageBreakdown", { count: stats.todayCount })
              : undefined
          }
          zeroHint={t("kpi.averageZero")}
        />
      </KpiRow>

      <DirectSalesTable result={result} stats={stats} dayGroups={dayGroups} />
    </>
  );
}

/**
 * `▲ 18.4% vs yesterday`.
 *
 * A ratio for display, not an accumulation — no rupees are added up here, and
 * both figures came out of SQL. With nothing taken yesterday there is no
 * percentage to state: "up 100%" from zero is arithmetic, not information.
 */
function collectedTrend(
  stats: DirectSaleStatsDto,
  label: string,
): KpiTrend | undefined {
  if (stats.yesterdayTotal <= 0) return undefined;

  const change =
    ((stats.todayTotal - stats.yesterdayTotal) / stats.yesterdayTotal) * 100;

  return {
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    percent: change,
    label,
  };
}
