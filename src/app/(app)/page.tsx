import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import {
  formatDate,
  formatDateRange,
  formatTime,
  formatWeekday,
  hourIST,
} from "@/lib/dates";
import {
  dashboardQuerySchema,
  resolveDashboardRange,
} from "@/lib/validation/dashboard";
import type { Locale } from "@/i18n/config";
import type { ExecutiveDashboardDto } from "@/lib/dto/dashboard.dto";
import { DashboardCharts } from "./dashboard-charts";
import { DashboardRiskRow, DashboardTodayRow } from "./dashboard-kpis";
import { DashboardToolbar } from "./dashboard-period-filter";
import {
  AttentionNeeded,
  CoinPosition,
  StaffScoreboard,
} from "./dashboard-tables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The executive dashboard. Spec: design/MODULES/08-dashboards.md §3
 *
 * The whole business on one page: what came in, what is at risk, whether the
 * trend is healthy, and what needs doing right now. It is opened many times a
 * day, often on a phone on the way to the plant.
 *
 * Fetched through the API like every other screen — no service import, no
 * repository, no DataSource (ARCHITECTURE §4). ONE request builds the whole
 * page: four rows that must agree with each other cannot be four round trips.
 *
 * MOBILE PUTS MONEY AT RISK FIRST. Below `md` the order is risk → today →
 * attention → charts → tables, because the outstanding position is what gets
 * checked in a moving vehicle. That is `order-*` on the sections below, not a
 * second markup tree. §3.7
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("dashboard");
  const locale = (await getLocale()) as Locale;
  const params = await searchParams;

  // A stale bookmark degrades to Today rather than throwing the page away.
  const query = dashboardQuerySchema.parse({
    period: first(params.period),
    from: first(params.from),
    to: first(params.to),
  });
  const range = resolveDashboardRange(query);

  const greeting =
    hourIST() < 12 ? "morning" : hourIST() < 17 ? "afternoon" : "evening";

  let data: ExecutiveDashboardDto;
  try {
    data = await api.get<ExecutiveDashboardDto>(
      apiRoutes.insights.dashboard({
        period: range.key,
        from: range.key === "custom" ? range.from : undefined,
        to: range.key === "custom" ? range.to : undefined,
      }),
    );
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <DashboardError
        title={t("error.title")}
        body={t("error.body")}
        retry={t("error.retry")}
      />
    );
  }

  const updated = formatTime(data.generatedAt, locale);

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {/* The only H1 in the application. §3.3.1 */}
          <h1 className="text-h2 font-bold text-foreground sm:text-h1">
            {t(`greeting.${greeting}`)}
          </h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {formatWeekday(data.asOfDate, locale)},{" "}
            {formatDate(data.asOfDate, locale)} ·{" "}
            {t("meta.updated", { time: updated })}
          </p>
          {range.key !== "today" ? (
            <p className="mt-1 text-caption text-muted-foreground">
              {t("period.showing", {
                range: formatDateRange(range.from, range.to, locale),
              })}
            </p>
          ) : null}
        </div>

        <DashboardToolbar
          period={range.key}
          from={range.from}
          to={range.to}
          rangeLabel={formatDateRange(range.from, range.to, locale)}
        />
      </header>

      <div className="flex flex-col gap-8">
        {/* Money at risk moves above Today below `md` — §3.7 */}
        <div className="order-2 md:order-1">
          <DashboardTodayRow data={data} />
        </div>

        <div className="order-1 md:order-2">
          <DashboardRiskRow data={data} />
        </div>

        <div className="order-4 md:order-3">
          <DashboardCharts
            trend={data.charts.revenueTrend}
            trendFrom={data.charts.trendFrom}
            trendTo={data.charts.trendTo}
            months={data.charts.revenueVsExpenses}
            products={data.charts.topProducts}
            mix={data.charts.collectionMix}
            productMonth={data.charts.productMonth}
          />
        </div>

        {/* Attention needed sits third on a phone and last on a desktop — the
            owner in a vehicle wants the action list, the owner at a desk reads
            the scoreboard first. §3.7 */}
        <div className="order-3 grid grid-cols-1 gap-6 md:order-5 xl:grid-cols-2">
          <AttentionNeeded
            rows={data.tables.attention}
            total={data.tables.attentionTotal}
          />
          <CoinPosition rows={data.tables.coinPosition} />
        </div>

        <div className="order-5 md:order-4">
          <StaffScoreboard rows={data.tables.scoreboard} />
        </div>
      </div>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Whole-page error. The shell, sidebar and header stay; only the content area
 * says what happened — and it says the data is safe, because the owner's first
 * question is never "what is the status code". §3.4
 */
function DashboardError({
  title,
  body,
  retry,
}: {
  title: string;
  body: string;
  retry: string;
}) {
  return (
    <Card className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <AlertTriangle className="size-12 text-destructive" aria-hidden />
      <h1 className="mt-4 text-h4 font-semibold text-foreground">{title}</h1>
      <p className="mt-1 max-w-prose text-body-sm text-muted-foreground">
        {body}
      </p>
      <Button asChild className="mt-4">
        <Link href="/">{retry}</Link>
      </Button>
    </Card>
  );
}
