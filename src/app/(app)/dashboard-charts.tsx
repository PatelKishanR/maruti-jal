"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Table2, ChartColumn } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatINR, formatINRCompact, formatQuantity } from "@/lib/money";
import { dashboardPaths } from "@/lib/api/routes.dashboard";
import type { Locale } from "@/i18n/config";
import type {
  DashboardCollectionMixDto,
  DashboardMonthPointDto,
  DashboardProductBarDto,
  DashboardTrendPointDto,
} from "@/lib/dto/dashboard.dto";

/**
 * Row 3 — the four charts. Spec: design/MODULES/08 §3.3.4 · STANDARDS §12
 *
 * ── THE PALETTE IS THREE HUES, NOT FIVE ─────────────────────────────────────
 *
 * `--chart-1` blue · `--chart-2` orange · `--chart-3` teal. Purple and green
 * were removed as categorical slots because they fail: purple sits at ΔE 2.3
 * from blue under protanopia and green at 11.3 from teal in NORMAL vision.
 * `--chart-profit` (green) and `--chart-outstanding` (red) are SEMANTIC and
 * never take a categorical position. A fourth concurrent series is folded into
 * "Other" — it is never given a generated fourth colour. §12.1
 *
 * Walk-in therefore renders TEAL here, not the green the older design draft
 * shows. Teal is free in this chart (coins are not on it) and green is not a
 * categorical colour any more.
 *
 * ── CONTRAST RELIEF IS OBLIGATORY ───────────────────────────────────────────
 *
 * Orange and teal fall below 3:1 on white, so colour is never the only signal
 * on any chart below. Every one of them carries: direct labels where they fit,
 * a legend where they do not, **2px surface-coloured separation** between
 * adjacent bars and stacked segments (drawn as a `--card` stroke), a hover
 * tooltip, and a `View as table` toggle — which is also simply the fastest way
 * to read an exact figure.
 *
 * No dual-axis chart exists here. Revenue, expenses and profit are all rupees
 * and share one scale; two measures of different scale would become two charts.
 */

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const;
const GRID = "var(--border)";
/** The gap colour. On dark this is `#1E293B` — the card, never black. §3.8 */
const SURFACE = "var(--card)";

const SERIES = {
  delivery: "var(--chart-1)",
  party: "var(--chart-2)",
  walkIn: "var(--chart-3)",
  revenue: "var(--chart-1)",
  expenses: "var(--chart-2)",
  profit: "var(--chart-profit)",
  cash: "var(--chart-1)",
  coins: "var(--chart-3)",
  other: "var(--chart-2)",
  ranked: "var(--chart-1)",
} as const;

export interface DashboardChartsProps {
  trend: DashboardTrendPointDto[];
  trendFrom: string;
  trendTo: string;
  months: DashboardMonthPointDto[];
  products: DashboardProductBarDto[];
  mix: DashboardCollectionMixDto;
  productMonth: string;
}

export function DashboardCharts(props: DashboardChartsProps) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <RevenueTrendChart
        data={props.trend}
        from={props.trendFrom}
        to={props.trendTo}
      />
      <RevenueVsExpensesChart data={props.months} />
      <TopProductsChart data={props.products} month={props.productMonth} />
      <CollectionMixChart mix={props.mix} month={props.productMonth} />
    </section>
  );
}

/* ── The card shell, shared by all four ──────────────────────────────────── */

function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle: string;
  /** The accessible fallback. Never optional — §12.1. */
  table: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("dashboard.charts");
  const [asTable, setAsTable] = React.useState(false);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-caption text-muted-foreground">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setAsTable((value) => !value)}
          aria-pressed={asTable}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-caption font-medium text-muted-foreground transition-colors duration-100 hover:border-primary/40 hover:text-foreground"
        >
          {asTable ? (
            <ChartColumn className="size-3.5" aria-hidden />
          ) : (
            <Table2 className="size-3.5" aria-hidden />
          )}
          {asTable ? t("viewAsChart") : t("viewAsTable")}
        </button>
      </div>

      {asTable ? table : children}
    </Card>
  );
}

/** Axes stay drawn; only the plot area says there is nothing here. §12.3 */
function EmptyPlot({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p className="text-caption text-muted-foreground">{message}</p>
    </div>
  );
}

function FigureTable({
  head,
  rows,
}: {
  head: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-border">
      <table className="w-full border-separate border-spacing-0 text-body-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {head.map((cell, index) => (
              <th
                key={cell}
                className={cn(
                  "h-11 px-3 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground",
                  index === 0 ? "text-left" : "text-right",
                )}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "h-11 border-t border-border px-3",
                    cellIndex === 0 ? "text-left" : "figure",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Card, 1px border, shadow-lg — the tooltip spec in §3.3.4. */
function TooltipShell({
  header,
  children,
}: {
  header: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-55 rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="border-b border-border pb-2 text-caption font-semibold text-foreground">
        {header}
      </p>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function TooltipRow({
  colour,
  label,
  value,
  strong = false,
}: {
  colour?: string;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2 text-body-sm text-muted-foreground">
        {colour ? (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: colour }}
            aria-hidden
          />
        ) : null}
        {label}
      </span>
      <span
        className={cn(
          "figure text-body-sm text-foreground",
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * A clickable legend. The last active series is not clickable — a chart with
 * every series switched off is a bug the user cannot get out of. §3.3.4
 */
function Legend({
  items,
  hidden,
  onToggle,
}: {
  items: Array<{ key: string; label: string; colour: string; line?: boolean }>;
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  const lastActive = items.filter((item) => !hidden.has(item.key)).length === 1;

  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => {
        const off = hidden.has(item.key);
        const locked = !off && lastActive;
        return (
          <li key={item.key}>
            <button
              type="button"
              disabled={locked}
              onClick={() => onToggle(item.key)}
              className={cn(
                "flex items-center gap-2 text-caption",
                off ? "text-muted-foreground/60" : "text-muted-foreground",
                locked ? "cursor-default" : "hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "shrink-0",
                  item.line ? "h-0.5 w-3 rounded-full" : "size-3 rounded-full",
                )}
                style={
                  off
                    ? {
                        background: "transparent",
                        boxShadow: `inset 0 0 0 1px ${item.colour}`,
                      }
                    : { background: item.colour }
                }
                aria-hidden
              />
              {item.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function useToggles() {
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return { hidden, toggle };
}

/** `2 Aug` — the year is on the card's sub-label, not on 30 ticks. */
function dayTick(iso: string, locale: Locale): string {
  return formatDate(iso, locale).replace(/[\s,]*\d{4}$/, "");
}

function monthTick(month: string, locale: Locale, withYear: boolean): string {
  const full = formatMonth(`${month}-01`, locale);
  return withYear ? full : full.replace(/\s*\d{4}$/, "");
}

/* ── C1 · Revenue trend, stacked by channel ──────────────────────────────── */

function RevenueTrendChart({
  data,
  from,
  to,
}: {
  data: DashboardTrendPointDto[];
  from: string;
  to: string;
}) {
  const t = useTranslations("dashboard.charts");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { hidden, toggle } = useToggles();

  /**
   * The stack total, for the tooltip and the direct label.
   *
   * A DISPLAY sum of three figures the database already computed, in the one
   * place the design demands it — a stacked column IS a total, and hiding it
   * would leave the owner reading a height he cannot name. Nothing derived
   * here is ever stored or compared against a book figure.
   */
  const rows = data.map((point) => ({
    ...point,
    total: point.delivery + point.party + point.walkIn,
  }));
  const peak = rows.reduce(
    (best, row) => (row.total > best ? row.total : best),
    0,
  );
  const empty = peak === 0;

  const series = [
    { key: "delivery", label: t("series.delivery"), colour: SERIES.delivery },
    { key: "party", label: t("series.party"), colour: SERIES.party },
    { key: "walkIn", label: t("series.walkIn"), colour: SERIES.walkIn },
  ];

  return (
    <ChartCard
      title={t("trend.title")}
      subtitle={t("trend.subtitle", {
        range: `${formatDate(from, locale)} – ${formatDate(to, locale)}`,
      })}
      table={
        <FigureTable
          head={[t("column.date"), t("series.delivery"), t("series.party"), t("series.walkIn"), t("total")]}
          rows={rows.map((row) => [
            formatDate(row.date, locale),
            formatINR(row.delivery),
            formatINR(row.party),
            formatINR(row.walkIn),
            formatINR(row.total),
          ])}
        />
      }
    >
      <div className="overflow-x-auto">
        <div className="relative h-70 min-w-140">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="20%"
              accessibilityLayer
              onClick={(state: { activeLabel?: string | number }) => {
                if (typeof state?.activeLabel === "string") {
                  router.push(dashboardPaths().ordersOn(state.activeLabel));
                }
              }}
            >
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                interval={Math.max(0, Math.floor(rows.length / 6) - 1)}
                tickFormatter={(value: string) => dayTick(value, locale)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                width={56}
                tickCount={5}
                tickFormatter={(value: number) => formatINRCompact(value)}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipShell header={formatDate(String(label), locale)}>
                      {series.map((item) => (
                        <TooltipRow
                          key={item.key}
                          colour={item.colour}
                          label={item.label}
                          value={formatINR(
                            Number(
                              (payload[0]?.payload as Record<string, number>)?.[
                                item.key
                              ] ?? 0,
                            ),
                          )}
                        />
                      ))}
                      <div className="border-t border-border pt-1">
                        <TooltipRow
                          label={t("total")}
                          value={formatINR(
                            Number(
                              (payload[0]?.payload as { total?: number })
                                ?.total ?? 0,
                            ),
                          )}
                          strong
                        />
                      </div>
                    </TooltipShell>
                  ) : null
                }
              />

              {/*
                The 2px surface stroke IS the mandated secondary encoding: it
                separates touching segments and neighbouring columns by shape,
                so orange↔teal never rely on hue alone. §12.1
              */}
              {series
                .filter((item) => !hidden.has(item.key))
                .map((item, index, visible) => (
                  <Bar
                    key={item.key}
                    dataKey={item.key}
                    stackId="revenue"
                    name={item.label}
                    fill={item.colour}
                    stroke={SURFACE}
                    strokeWidth={2}
                    radius={
                      index === visible.length - 1 ? [4, 4, 0, 0] : undefined
                    }
                  >
                    {index === visible.length - 1 ? (
                      <LabelList
                        dataKey="total"
                        position="top"
                        className="fill-foreground"
                        style={{ fontSize: 12, fontWeight: 600 }}
                        formatter={(value) =>
                          // Only the tallest column is labelled — 30 labels
                          // would be noise, one is a reference point. §3.3.4
                          Number(value) === peak && peak > 0
                            ? formatINRCompact(Number(value))
                            : ""
                        }
                      />
                    ) : null}
                  </Bar>
                ))}
            </BarChart>
          </ResponsiveContainer>

          {empty ? <EmptyPlot message={t("empty.trend")} /> : null}
        </div>
      </div>

      <Legend items={series} hidden={hidden} onToggle={toggle} />
    </ChartCard>
  );
}

/* ── C2 · Revenue vs expenses, with a profit line ────────────────────────── */

function RevenueVsExpensesChart({ data }: { data: DashboardMonthPointDto[] }) {
  const t = useTranslations("dashboard.charts");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { hidden, toggle } = useToggles();

  const empty = data.every(
    (row) => row.revenue === 0 && row.expenses === 0,
  );
  const last = data[data.length - 1];

  const series = [
    { key: "revenue", label: t("series.revenue"), colour: SERIES.revenue },
    { key: "expenses", label: t("series.expenses"), colour: SERIES.expenses },
    {
      key: "profit",
      label: t("series.profit"),
      colour: SERIES.profit,
      line: true,
    },
  ];

  return (
    <ChartCard
      title={t("months.title")}
      subtitle={t("months.subtitle", {
        range: data.length
          ? `${monthTick(data[0].month, locale, true)} – ${monthTick(
              data[data.length - 1].month,
              locale,
              true,
            )}`
          : "",
      })}
      table={
        <FigureTable
          head={[
            t("column.month"),
            t("series.revenue"),
            t("series.expenses"),
            t("series.profit"),
          ]}
          rows={data.map((row) => [
            monthTick(row.month, locale, true),
            formatINR(row.revenue),
            formatINR(row.expenses),
            formatINR(row.profit),
          ])}
        />
      }
    >
      <div className="relative h-70">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 24, bottom: 0, left: 0 }}
            barGap={2}
            accessibilityLayer
            onClick={(state: { activeLabel?: string | number }) => {
              if (typeof state?.activeLabel === "string") {
                router.push(`/expenses?month=${state.activeLabel}`);
              }
            }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              tickFormatter={(value: string, index: number) =>
                monthTick(value, locale, index === 0)
              }
            />
            {/* ONE axis. All three series are rupees; a second scale is the
                one chart mistake this system refuses outright. §3.3.4 C2 */}
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              width={56}
              tickCount={5}
              tickFormatter={(value: number) => formatINRCompact(value)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as DashboardMonthPointDto;
                const margin =
                  row.revenue > 0
                    ? Math.round((row.profit / row.revenue) * 1000) / 10
                    : null;
                return (
                  <TooltipShell header={monthTick(row.month, locale, true)}>
                    <TooltipRow
                      colour={SERIES.revenue}
                      label={t("series.revenue")}
                      value={formatINR(row.revenue)}
                    />
                    <TooltipRow
                      colour={SERIES.expenses}
                      label={t("series.expenses")}
                      value={formatINR(row.expenses)}
                    />
                    <TooltipRow
                      colour={SERIES.profit}
                      label={t("series.profit")}
                      value={formatINR(row.profit)}
                    />
                    {margin !== null ? (
                      <div className="border-t border-border pt-1">
                        <p
                          className={cn(
                            "text-caption",
                            margin < 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {t("margin", { percent: margin.toFixed(1) })}
                        </p>
                      </div>
                    ) : null}
                  </TooltipShell>
                );
              }}
            />

            {!hidden.has("revenue") ? (
              <Bar
                dataKey="revenue"
                name={t("series.revenue")}
                fill={SERIES.revenue}
                stroke={SURFACE}
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
            ) : null}
            {!hidden.has("expenses") ? (
              <Bar
                dataKey="expenses"
                name={t("series.expenses")}
                fill={SERIES.expenses}
                stroke={SURFACE}
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
            ) : null}
            {/* Profit is separated from expenses by MARK TYPE as well as hue —
                a line against columns, plus the end label below. §3.3.4 C2 */}
            {!hidden.has("profit") ? (
              <Line
                type="monotone"
                dataKey="profit"
                name={t("series.profit")}
                stroke={SERIES.profit}
                strokeWidth={2}
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="profit"
                  position="top"
                  className="fill-foreground"
                  style={{ fontSize: 12, fontWeight: 600 }}
                  formatter={(value) =>
                    last && Number(value) === last.profit && last.profit !== 0
                      ? formatINRCompact(Number(value))
                      : ""
                  }
                />
              </Line>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>

        {empty ? <EmptyPlot message={t("empty.months")} /> : null}
      </div>

      <Legend items={series} hidden={hidden} onToggle={toggle} />
    </ChartCard>
  );
}

/* ── C3 · Top 5 products, ranked ─────────────────────────────────────────── */

function TopProductsChart({
  data,
  month,
}: {
  data: DashboardProductBarDto[];
  month: string;
}) {
  const t = useTranslations("dashboard.charts");
  const locale = useLocale() as Locale;
  const router = useRouter();

  return (
    <ChartCard
      title={t("products.title")}
      subtitle={t("products.subtitle", {
        month: monthTick(month, locale, true),
      })}
      table={
        <FigureTable
          head={[t("column.product"), t("column.units"), t("series.revenue")]}
          rows={data.map((row) => [
            row.title,
            formatQuantity(row.qtyBilled),
            formatINR(row.revenue),
          ])}
        />
      }
    >
      <div className="relative h-55">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 72, bottom: 4, left: 0 }}
            accessibilityLayer
            onClick={(state: { activeLabel?: string | number }) => {
              const hit = data.find((row) => row.title === state?.activeLabel);
              if (hit) router.push(dashboardPaths().product(hit.productId));
            }}
          >
            {/* No gridlines and no value axis: five labelled bars need
                neither, and the scale is set by the longest bar. §3.3.4 C3 */}
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="title"
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              width={150}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as DashboardProductBarDto;
                return (
                  <TooltipShell header={row.title}>
                    <TooltipRow
                      label={t("column.units")}
                      value={formatQuantity(row.qtyBilled)}
                    />
                    <TooltipRow
                      label={t("column.issued")}
                      value={formatQuantity(row.qtyIssued)}
                    />
                    <TooltipRow
                      label={t("series.revenue")}
                      value={formatINR(row.revenue)}
                    />
                  </TooltipShell>
                );
              }}
            />
            {/*
              A SINGLE hue. Rank is not identity — colour follows the entity,
              so a filter that reorders this list must never repaint it. §12.1
            */}
            <Bar
              dataKey="qtyBilled"
              fill={SERIES.ranked}
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            >
              <LabelList
                dataKey="qtyBilled"
                position="right"
                className="fill-foreground"
                style={{ fontSize: 12, fontWeight: 600 }}
                formatter={(value) =>
                  t("units", { count: formatQuantity(Number(value)) })
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {data.length === 0 ? <EmptyPlot message={t("empty.products")} /> : null}
      </div>
    </ChartCard>
  );
}

/* ── C4 · Collection mix ─────────────────────────────────────────────────── */

function CollectionMixChart({
  mix,
  month,
}: {
  mix: DashboardCollectionMixDto;
  month: string;
}) {
  const t = useTranslations("dashboard.charts");
  const locale = useLocale() as Locale;

  const rows = [
    { key: "cash", label: t("series.cash"), value: mix.cash, count: mix.cashCount, colour: SERIES.cash },
    { key: "coins", label: t("series.coins"), value: mix.coins, count: mix.coinsCount, colour: SERIES.coins },
    { key: "other", label: t("series.other"), value: mix.other, count: mix.otherCount, colour: SERIES.other },
  ].filter((row) => row.key !== "other" || row.value > 0);

  const share = (value: number) =>
    mix.total > 0 ? Math.round((value / mix.total) * 1000) / 10 : 0;

  return (
    <ChartCard
      title={t("mix.title")}
      subtitle={t("mix.subtitle", { month: monthTick(month, locale, true) })}
      table={
        <FigureTable
          head={[t("column.mode"), t("column.amount"), t("column.share")]}
          rows={rows.map((row) => [
            row.label,
            formatINR(row.value),
            `${share(row.value).toFixed(1)}%`,
          ])}
        />
      }
    >
      {mix.total === 0 ? (
        <div className="relative flex h-55 items-center justify-center">
          <EmptyPlot message={t("empty.mix")} />
        </div>
      ) : (
        <div>
          {/* One 32px bar. Two categories do not warrant a pie, and the 2px
              surface gap between fills is the mandated separation. §3.3.4 C4 */}
          <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-lg">
            {rows
              .filter((row) => row.value > 0)
              .map((row) => (
                <div
                  key={row.key}
                  // The hover tooltip for this chart: the exact figure, its
                  // share of the exact total, and how many payments made it.
                  title={`${row.label} · ${formatINR(row.value)} · ${share(
                    row.value,
                  ).toFixed(1)}% ${t("ofTotal", {
                    total: formatINR(mix.total),
                  })} · ${t("payments", { count: formatQuantity(row.count) })}`}
                  style={{
                    background: row.colour,
                    width: `${share(row.value)}%`,
                  }}
                  className="flex items-center justify-center"
                >
                  {share(row.value) >= 12 ? (
                    <span className="figure text-caption font-semibold text-white">
                      {share(row.value).toFixed(1)}%
                    </span>
                  ) : null}
                </div>
              ))}
          </div>

          <dl className="mt-4">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <dt className="flex items-center gap-2 text-body-sm text-muted-foreground">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: row.colour }}
                    aria-hidden
                  />
                  {row.label}
                </dt>
                <dd className="flex items-center gap-4">
                  <span className="figure text-body-sm font-semibold text-foreground">
                    {formatINR(row.value)}
                  </span>
                  <span className="figure w-14 text-caption text-muted-foreground">
                    {share(row.value).toFixed(1)}%
                  </span>
                </dd>
              </div>
            ))}

            <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2">
              <dt className="text-body-sm font-medium text-foreground">
                {t("total")}
              </dt>
              <dd className="figure text-body-sm font-semibold text-foreground">
                {formatINR(mix.total)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </ChartCard>
  );
}
