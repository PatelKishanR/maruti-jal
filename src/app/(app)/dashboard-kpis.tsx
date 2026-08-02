import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { KpiCard, KpiRow, type KpiTrend } from "@/components/common/kpi-card";
import { formatINRCompact, formatQuantity } from "@/lib/money";
import { dashboardPaths } from "@/lib/api/routes.dashboard";
import type {
  DashboardDelta,
  ExecutiveDashboardDto,
} from "@/lib/dto/dashboard.dto";

/**
 * Rows 1 and 2. Spec: design/MODULES/08-dashboards.md §3.3.2, §3.3.3
 *
 * A SERVER component. `KpiCard` takes an icon NAME rather than a component
 * reference precisely so a strip whose data is already on the server does not
 * need a client island — see `components/common/icons.ts`.
 *
 * Two rules the design is emphatic about, both implemented here:
 *
 *  1. **Row 2 is a CURRENT position** and carries a visible note saying so.
 *     Without it the owner reads ₹75,860 of outstanding cash as today's takings.
 *  2. **Trend colour inverts for expenses.** A rise in what was spent is bad
 *     news; painting it green is worse than painting it nothing.
 */

/** `null` (no base period) drops the trend line rather than inventing one. */
function trendOf(delta: DashboardDelta, label: string): KpiTrend | undefined {
  if (delta === null) return undefined;
  return {
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    percent: delta,
    label,
  };
}

export async function DashboardTodayRow({
  data,
}: {
  data: ExecutiveDashboardDto;
}) {
  const t = await getTranslations("dashboard");
  const { period, range } = data;
  const paths = dashboardPaths(range.from, range.to);

  const vs = t(`trend.${range.trendLabelKey}`);
  const channel = (name: string) =>
    period.revenueByChannel.find((row) => row.channel === name)?.revenue ?? 0;

  return (
    <section aria-labelledby="dash-today">
      <h2
        id="dash-today"
        className="mb-3 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground"
      >
        {t("sections.today")}
      </h2>

      <KpiRow>
        <KpiCard
          icon="directSale"
          label={t("kpi.revenue")}
          value={period.revenue}
          href={paths.orders}
          trend={trendOf(period.deltas.revenue, vs)}
          zeroHint={t("kpi.noSales")}
          breakdown={t("kpi.revenueBreakdown", {
            delivery: formatINRCompact(channel("DELIVERY")),
            party: formatINRCompact(channel("PARTY")),
            walkIn: formatINRCompact(channel("WALK_IN")),
          })}
        />

        <KpiCard
          icon="cash"
          label={t("kpi.collection")}
          value={period.collection}
          href={paths.orders}
          trend={trendOf(period.deltas.collection, vs)}
          zeroHint={t("kpi.noCollection")}
          breakdown={t("kpi.collectionBreakdown", {
            cash: formatINRCompact(data.charts.collectionMix.cash),
            coins: formatINRCompact(data.charts.collectionMix.coins),
          })}
        />

        <KpiCard
          icon="expense"
          label={t("kpi.expenses")}
          value={period.expenses}
          href={paths.expenses}
          // Up is BAD here, so the arrow keeps its direction and loses its
          // green. §3.3.2 card 3.
          trend={trendOf(period.deltas.expenses, vs)}
          invertTrend
          zeroHint={t("kpi.noExpenses")}
          breakdown={
            period.topExpenseCategory
              ? t("kpi.expenseBreakdown", {
                  count: formatQuantity(period.expenseCount),
                  category: period.topExpenseCategory.name,
                  amount: formatINRCompact(period.topExpenseCategory.amount),
                })
              : t("kpi.expenseBreakdownPlain", {
                  count: formatQuantity(period.expenseCount),
                })
          }
        />

        <KpiCard
          icon="trendUp"
          label={t("kpi.net")}
          value={period.net}
          href={paths.expenses}
          trend={trendOf(period.deltas.net, vs)}
          // A negative net is the alert variant on any period — §3.3.2.
          variant={period.net < 0 ? "alert" : "default"}
          breakdown={t("kpi.netBreakdown")}
        />
      </KpiRow>
    </section>
  );
}

export async function DashboardRiskRow({
  data,
}: {
  data: ExecutiveDashboardDto;
}) {
  const t = await getTranslations("dashboard");
  const { risk } = data;

  /** Zero drops out of the alert variant entirely — §3.3.3. */
  const variant = (value: number) => (value > 0 ? ("alert" as const) : ("default" as const));

  return (
    <section aria-labelledby="dash-risk">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="dash-risk"
          className="text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground"
        >
          {t("sections.risk")}
        </h2>
        {/* Load-bearing: without it ₹75,860 reads as a today figure. */}
        <p className="text-caption text-muted-foreground">
          {t("sections.riskNote")}
        </p>
      </div>

      <KpiRow>
        <KpiCard
          icon="payment"
          label={t("kpi.staffCash")}
          value={risk.staffCash}
          variant={variant(risk.staffCash)}
          href={dashboardPaths().ordersPending}
          zeroHint={t("kpi.nothingOutstanding")}
          breakdown={
            risk.staffCash > 0
              ? `${t("kpi.acrossOrders", {
                  orders: formatQuantity(risk.staffCashOrders),
                  staff: formatQuantity(risk.staffCashStaff),
                })} · ${t("kpi.oldest", {
                  days: formatQuantity(risk.staffCashOldestDays),
                })}`
              : undefined
          }
        />

        <KpiCard
          icon="party"
          label={t("kpi.partyDues")}
          value={risk.partyDues}
          variant={variant(risk.partyDues)}
          href={dashboardPaths().partyPending}
          zeroHint={t("kpi.nothingOutstanding")}
          breakdown={
            risk.partyDues > 0
              ? `${t("kpi.acrossParties", {
                  count: formatQuantity(risk.partyCount),
                })} · ${t("kpi.oldest", {
                  days: formatQuantity(risk.partyOldestDays),
                })}`
              : undefined
          }
        />

        <KpiCard
          icon="coin"
          label={t("kpi.coinDues")}
          value={risk.coinDues}
          variant={variant(risk.coinDues)}
          href={dashboardPaths().coinIssuesPending}
          zeroHint={t("kpi.nothingOutstanding")}
          breakdown={
            risk.coinDues > 0
              ? `${t("kpi.acrossIssues", {
                  count: formatQuantity(risk.coinIssues),
                })} · ${t("kpi.oldest", {
                  days: formatQuantity(risk.coinOldestDays),
                })}`
              : undefined
          }
        />

        <JarsOutCard
          jarsOut={risk.jarsOut}
          jarsOverdue={risk.jarsOverdue}
          jarsOrders={risk.jarsOrders}
          jarsStaff={risk.jarsStaff}
        />
      </KpiRow>
    </section>
  );
}

/**
 * The only KPI in the app carrying a NESTED link.
 *
 * `KpiCard` renders the whole card as one anchor, and an anchor inside an
 * anchor is invalid HTML — so the overdue badge sits beside the card rather
 * than inside it, keeping both targets real and both above 44×44px. Reported
 * as a kernel gap; the fix belongs in `KpiCard`, not here.
 */
function JarsOutCard({
  jarsOut,
  jarsOverdue,
  jarsOrders,
  jarsStaff,
}: {
  jarsOut: number;
  jarsOverdue: number;
  jarsOrders: number;
  jarsStaff: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <JarsKpi
        jarsOut={jarsOut}
        jarsOrders={jarsOrders}
        jarsStaff={jarsStaff}
      />
      {jarsOverdue > 0 ? <JarsOverdueBadge jars={jarsOverdue} /> : null}
    </div>
  );
}

async function JarsKpi({
  jarsOut,
  jarsOrders,
  jarsStaff,
}: {
  jarsOut: number;
  jarsOrders: number;
  jarsStaff: number;
}) {
  const t = await getTranslations("dashboard");

  return (
    <KpiCard
      icon="jarsOut"
      label={t("kpi.jarsOut")}
      value={jarsOut}
      format="count"
      variant={jarsOut > 0 ? "alert" : "default"}
      href={dashboardPaths().ordersJarsOut}
      zeroHint={t("kpi.noJarsOut")}
      className="flex-1"
      breakdown={
        jarsOut > 0
          ? t("kpi.jarsBreakdown", {
              orders: formatQuantity(jarsOrders),
              staff: formatQuantity(jarsStaff),
            })
          : undefined
      }
    />
  );
}

async function JarsOverdueBadge({ jars }: { jars: number }) {
  const t = await getTranslations("dashboard");

  return (
    <Link
      href={dashboardPaths().ordersJarsOverdue}
      // 8px of vertical padding clears the 44×44px touch minimum — §3.3.3.
      className="flex items-center gap-1.5 self-start rounded-md bg-(--badge-danger-bg) px-2.5 py-2 text-caption font-medium text-(--badge-danger-fg) hover:underline"
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      {t("kpi.jarsOverdue", { jars: formatQuantity(jars) })}
    </Link>
  );
}
