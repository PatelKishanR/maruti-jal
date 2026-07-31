import * as React from "react";
import { cn } from "@/lib/utils";
import {
  formatINR,
  formatINRCompact,
  formatLitres,
  formatQuantity,
} from "@/lib/money";

/**
 * Figures. Spec: .claude/design/DESIGN-STANDARDS.md §2.2, §5.3, §13
 *
 * Every number the owner reads renders through here, so a column of amounts is
 * identical in every module and in both languages. No component calls `Intl`
 * itself — all formatting goes through `@/lib/money`, which forces Latin digits
 * (see .claude/I18N.md §4.2). These are plain presentational components with no
 * state, so they work in a server tree and inside a client one alike.
 *
 * Three rules that are easy to get wrong and expensive to get wrong:
 *
 *  1. **Zero is an em dash, not `₹0.00`.** A page of `₹0.00` reads as data; a
 *     page of `—` reads as nothing to do. A legitimately-zero price passes
 *     `zeroAs="value"`.
 *  2. **Negatives are parenthesised, never prefixed with a minus.** The
 *     parentheses carry the sign, so colour is never the only signal.
 *  3. **A refund is Primary blue, not red.** Money the company owes back is not
 *     a loss; rendering a routine coin return in Danger red makes a normal
 *     Tuesday look like a problem. §13.
 */

/** Numeric columns arrive from `pg` as strings; accept both without ceremony. */
export type NumericValue = number | string | null | undefined;

type FigureProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children">;

function toNumber(value: NumericValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Mono, tabular, right-aligned. The shared shell for every figure below. */
const FIGURE = "font-mono tabular-nums text-right";

/**
 * The em dash used for zero, null and anything unknown.
 *
 * §5.3: an empty cell is never blank, never `null`, never `N/A`.
 */
export function EmptyFigure({ className, ...props }: FigureProps) {
  return (
    <span className={cn(FIGURE, "text-muted-foreground", className)} {...props}>
      —
    </span>
  );
}

export interface MoneyProps extends FigureProps {
  value: NumericValue;
  /**
   * `loss` → Danger. `refund` → **Primary blue**, because money owed back is
   * not a shortfall. Unset negatives fall back to `loss`. §13
   */
  variant?: "default" | "loss" | "refund";
  /** Balance and outstanding columns: weight 600, `text-foreground`. §2.2 */
  emphasis?: boolean;
  /** `dash` (default) renders zero as `—`; `value` renders a genuine `₹0.00`. */
  zeroAs?: "dash" | "value";
  /** KPI abbreviation — `₹1.85L`, paise dropped, exact value in the tooltip. §13 */
  compact?: boolean;
}

export function Money({
  value,
  variant = "default",
  emphasis = false,
  zeroAs = "dash",
  compact = false,
  className,
  ...props
}: MoneyProps) {
  const amount = toNumber(value);

  if (amount === null || (amount === 0 && zeroAs === "dash")) {
    return <EmptyFigure className={className} {...props} />;
  }

  const negative = amount < 0;
  const magnitude = Math.abs(amount);
  const wrap = (text: string) => (negative ? `(${text})` : text);
  const exact = wrap(formatINR(magnitude));

  return (
    <span
      className={cn(
        FIGURE,
        emphasis ? "font-semibold" : "font-medium",
        toneClass(variant, negative, emphasis),
        className,
      )}
      // §13: an abbreviated KPI figure always carries its full value.
      title={compact ? exact : undefined}
      {...props}
    >
      {compact ? wrap(formatINRCompact(magnitude)) : exact}
    </span>
  );
}

function toneClass(
  variant: "default" | "loss" | "refund",
  negative: boolean,
  emphasis: boolean,
): string | undefined {
  if (variant === "refund") return "text-primary";
  if (variant === "loss" || negative) return "text-destructive";
  return emphasis ? "text-foreground" : undefined;
}

export interface QuantityProps extends FigureProps {
  value: NumericValue;
  emphasis?: boolean;
  /**
   * Quantities default to showing `0`, unlike money — "0 jars out" is a useful
   * statement, whereas `₹0.00` is noise. Pass `dash` in columns where it isn't.
   */
  zeroAs?: "dash" | "value";
  /** Already-translated unit, e.g. `jars`. Rendered muted after the figure. */
  suffix?: string;
}

export function Quantity({
  value,
  emphasis = false,
  zeroAs = "value",
  suffix,
  className,
  ...props
}: QuantityProps) {
  const count = toNumber(value);

  if (count === null || (count === 0 && zeroAs === "dash")) {
    return <EmptyFigure className={className} {...props} />;
  }

  return (
    <span
      className={cn(
        FIGURE,
        emphasis ? "font-semibold text-foreground" : "font-medium",
        className,
      )}
      {...props}
    >
      {formatQuantity(count)}
      {suffix ? (
        <span className="ml-1 font-sans text-muted-foreground">{suffix}</span>
      ) : null}
    </span>
  );
}

export interface LitresProps extends FigureProps {
  value: NumericValue;
  emphasis?: boolean;
}

/** Up to 3 decimals, trailing zeros trimmed — `20L`, `0.5L`. §13 */
export function Litres({
  value,
  emphasis = false,
  className,
  ...props
}: LitresProps) {
  const litres = toNumber(value);

  if (litres === null) {
    return <EmptyFigure className={className} {...props} />;
  }

  return (
    <span
      className={cn(
        FIGURE,
        emphasis ? "font-semibold text-foreground" : "font-medium",
        className,
      )}
      {...props}
    >
      {formatLitres(litres)}
    </span>
  );
}
