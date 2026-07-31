"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatINR, formatINRCompact, formatQuantity } from "@/lib/money";

/**
 * KPI card. Spec: .claude/design/DESIGN-STANDARDS.md §8
 *
 * ┌──────────────────────────────┐
 * │ 💰  TODAY'S COLLECTION       │
 * │ ₹18,450                      │
 * │ ▲ 12% vs yesterday           │
 * │ Cash ₹14,200 · Coins ₹4,250  │
 * └──────────────────────────────┘
 *
 * **Every number is a door** (§1.4). The whole card is clickable and lands on
 * the filtered list behind the figure — a KPI that cannot be opened tells the
 * owner something is wrong without telling them where.
 *
 * **Trend colour inverts for expenses and outstanding.** A rise in what you owe
 * or what you spent is bad news, and painting it green is worse than painting
 * it nothing. Pass `invertTrend` on those cards.
 *
 * Never renders a blank card: zero shows `₹0` with a context line, an error
 * shows `—` with a retry, loading shimmers at the value with the label already
 * in place so the card does not change shape when the figure lands.
 */

export interface KpiTrend {
  direction: "up" | "down" | "flat";
  /** Magnitude only — the arrow carries the direction. Rendered to 1 decimal. */
  percent: number;
  /** Already translated, e.g. "vs yesterday". */
  label: string;
}

export interface KpiCardProps {
  /** Already translated. Rendered 12px/600 uppercase. */
  label: string;
  icon?: LucideIcon;
  value?: number | string | null;
  /** `money` abbreviates per §13 (`₹1.85L`); `count` groups without decimals. */
  format?: "money" | "count";
  /** Overrides the formatted figure when the value isn't a plain number. */
  valueLabel?: string;
  /** Where the figure opens. Omit only for a card that genuinely has no list. */
  href?: string;
  trend?: KpiTrend;
  /** Expenses and outstanding: up is bad, so the trend colours flip. §8 */
  invertTrend?: boolean;
  /** One `·` separated line, already translated. */
  breakdown?: string;
  /** Shown under a zero value instead of leaving the card empty. */
  zeroHint?: string;
  /** 3px destructive left border, value in Danger. §8 */
  variant?: "default" | "alert";
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function KpiCard({
  label,
  icon: Icon,
  value,
  format = "money",
  valueLabel,
  href,
  trend,
  invertTrend = false,
  breakdown,
  zeroHint,
  variant = "default",
  loading = false,
  error = false,
  onRetry,
  className,
}: KpiCardProps) {
  const t = useTranslations("common");
  const amount = toNumber(value);
  const isZero = !loading && !error && amount === 0 && !valueLabel;
  const isBlank = !loading && !error && amount === null && !valueLabel;

  const card = cn(
    "block rounded-lg border border-border bg-card p-5 text-left shadow-sm",
    "transition-colors duration-100",
    variant === "alert" && "border-l-[3px] border-l-destructive",
    className,
  );
  // Cards do not lift (§2.4); the border turning Nova Blue is the whole hover.
  const interactive = "hover:border-primary/40 cursor-pointer";

  const body = (
    <>
      <p className="flex items-center gap-1 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
        {label}
      </p>

      <div className="mt-2">
        {loading ? (
          <>
            <Skeleton className="h-8 w-28" />
            <span className="sr-only">{t("loading")}</span>
          </>
        ) : error ? (
          <p className="font-mono text-h2 font-bold tabular-nums text-muted-foreground">
            —
          </p>
        ) : (
          <p
            className={cn(
              "font-mono text-h2 font-bold tabular-nums",
              variant === "alert"
                ? "text-destructive"
                : isZero || isBlank
                  ? "text-muted-foreground"
                  : "text-foreground",
            )}
            // §13: an abbreviated figure always carries its exact value.
            title={
              !valueLabel && amount !== null && format === "money"
                ? formatINR(amount)
                : undefined
            }
          >
            {valueLabel ?? renderValue(amount, format)}
          </p>
        )}
      </div>

      {error ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onRetry?.();
          }}
          className="mt-1 text-caption font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("tryAgain")}
        </button>
      ) : null}

      {!loading && !error && isZero ? (
        <p className="mt-1 text-caption text-muted-foreground">
          {zeroHint ?? t("kpi.nothingYet")}
        </p>
      ) : null}

      {!loading && !error && !isZero && trend ? (
        <Trend trend={trend} invert={invertTrend} />
      ) : null}

      {!loading && !error && breakdown ? (
        <p className="mt-1 text-caption text-muted-foreground">{breakdown}</p>
      ) : null}
    </>
  );

  // A card that failed to load must not navigate — there is nothing behind it
  // yet, and the retry control cannot legally live inside an anchor.
  if (href && !error) {
    return (
      <Link href={href} className={cn(card, interactive)}>
        {body}
      </Link>
    );
  }

  return <div className={card}>{body}</div>;
}

function Trend({ trend, invert }: { trend: KpiTrend; invert: boolean }) {
  const t = useTranslations("common.kpi");
  const { direction, percent, label } = trend;

  const good = direction === "up" ? !invert : direction === "down" ? invert : null;
  const tone =
    good === null
      ? "text-muted-foreground"
      : good
        ? "text-success"
        : "text-destructive";
  const Icon = direction === "up" ? TrendingUp : TrendingDown;

  return (
    <p className={cn("mt-1 flex items-center gap-1 text-caption", tone)}>
      {direction === "flat" ? null : (
        <Icon className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="sr-only">
        {direction === "up"
          ? t("increased")
          : direction === "down"
            ? t("decreased")
            : t("unchanged")}
      </span>
      <span className="font-mono tabular-nums">
        {Math.abs(percent).toFixed(1)}%
      </span>
      <span>{label}</span>
    </p>
  );
}

function renderValue(amount: number | null, format: "money" | "count"): string {
  if (amount === null) return "—";
  return format === "money" ? formatINRCompact(amount) : formatQuantity(amount);
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The KPI strip. 4 across on `xl`, 2 on `md`, 1 below, 24px gap, equal
 * heights — §8. Heights are never fixed: Gujarati labels wrap to two lines.
 */
export function KpiRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4",
        className,
      )}
      {...props}
    />
  );
}
