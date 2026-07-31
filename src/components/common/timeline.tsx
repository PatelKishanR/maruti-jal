import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Timeline. Spec: DESIGN-STANDARDS §9 · COMPONENT-INVENTORY §13
 *
 * │ ● 16 Aug 2026 · 11:40         Recorded by Admin
 * │ │  Returned 8 empty · 2 filled
 * │ │  Note: "Sharma ji's jars"
 * │ ○ 14 Aug 2026 · 18:05
 * │    Returned 22 empty
 *
 * Newest first — always. Used for returns, payments, activity and the product
 * price history. 8px dot in the semantic colour, 1px connecting line, 16px
 * between entries, and the most recent dot is filled so "what changed last" is
 * the first thing the eye lands on.
 *
 * `title` / `meta` / `note` are nodes rather than strings so an entry can carry
 * a `<Money>` figure or a struck-through old price without this component
 * knowing anything about money.
 */

export type TimelineTone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger";

export interface TimelineEntry {
  id: string;
  /** 14px/500. The thing that happened. */
  title: React.ReactNode;
  /** 12px muted. Timestamp, actor — `16 Aug 2026 · 11:40 · Admin`. */
  meta?: React.ReactNode;
  /** 12px muted, optional free-text note. */
  note?: React.ReactNode;
  tone?: TimelineTone;
}

const DOT_FILL: Record<TimelineTone, string> = {
  default: "bg-primary border-primary",
  primary: "bg-primary border-primary",
  success: "bg-success border-success",
  warning: "bg-warning border-warning",
  danger: "bg-destructive border-destructive",
};

const DOT_OUTLINE: Record<TimelineTone, string> = {
  default: "bg-card border-border",
  primary: "bg-card border-primary",
  success: "bg-card border-success",
  warning: "bg-card border-warning",
  danger: "bg-card border-destructive",
};

export interface TimelineProps {
  /** Newest first — this component does not sort. */
  entries: TimelineEntry[];
  /** Already translated. Falls back to a generic "No activity yet". */
  emptyLabel?: string;
  className?: string;
}

export function Timeline({ entries, emptyLabel, className }: TimelineProps) {
  const t = useTranslations("common.timeline");

  if (entries.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyLabel ?? t("empty")}
      </p>
    );
  }

  return (
    <ol className={cn("flex flex-col", className)}>
      {entries.map((entry, index) => {
        const tone = entry.tone ?? "default";
        const newest = index === 0;

        return (
          <li key={entry.id} className="group flex gap-3">
            <div className="relative flex w-2 shrink-0 justify-center">
              <span
                className={cn(
                  "z-10 mt-1.5 size-2 shrink-0 rounded-full border",
                  newest ? DOT_FILL[tone] : DOT_OUTLINE[tone],
                )}
                aria-hidden
              />
              {/* Runs to the next dot; hidden on the last entry so the rail
                  stops rather than trailing into nothing. */}
              <span
                className="absolute left-1/2 top-1.5 h-full w-px -translate-x-1/2 bg-border group-last:hidden"
                aria-hidden
              />
            </div>

            {/* 16px between entries. Nothing here has a fixed height —
                Gujarati notes wrap to as many lines as they need. */}
            <div className="min-w-0 flex-1 pb-4 group-last:pb-0">
              <p className="text-sm font-medium text-foreground">
                {entry.title}
              </p>
              {entry.meta ? (
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {entry.meta}
                </p>
              ) : null}
              {entry.note ? (
                <p className="mt-1 text-caption text-muted-foreground">
                  {entry.note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
