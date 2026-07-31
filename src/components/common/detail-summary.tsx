import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Detail-page summary card. Spec: DESIGN-STANDARDS §9
 *
 * ┌── Summary ──────────────────────────────────────────┐
 * │  Order total   Collected    Balance      Jars out   │
 * │  ₹2,480.00     ₹2,030.00    ₹450.00      8 of 62    │
 * └─────────────────────────────────────────────────────┘
 *
 * Subtle background rather than a white card — it is a band of context above
 * the tabs, not a panel competing with them. Four columns on `lg`, two on `md`,
 * one below.
 *
 * **One figure carries the weight.** The balance (or whatever the owner opened
 * the page to check) gets `emphasis` and renders in `text-foreground`; the rest
 * stay muted. Emphasising all four emphasises none.
 *
 * Values are nodes, so pass `<Money emphasis />` and get the mono/tabular
 * treatment and the zero-as-em-dash rule for free.
 */

export interface DetailSummaryItem {
  /** Already translated. Caption, muted, above the value. */
  label: string;
  value: React.ReactNode;
  /** The critical figure — exactly one per card, normally the balance. */
  emphasis?: boolean;
}

export interface DetailSummaryProps {
  items: DetailSummaryItem[];
  className?: string;
}

export function DetailSummary({ items, className }: DetailSummaryProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-6 rounded-lg border border-border bg-muted p-6",
        "md:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-caption text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 font-mono text-xl font-semibold tabular-nums",
              item.emphasis ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
