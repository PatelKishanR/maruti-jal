import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { reportPaths } from "@/lib/api/routes.report";

/**
 * Archetype E — the shell all seven reports inherit.
 * Spec: design/MODULES/09-reports.md §4
 *
 *   page header → filter panel → summary band → report table(s) → export bar
 *
 * Getting this right once means an eighth report is a table definition rather
 * than a design exercise. Sections 5–11 of the spec describe only what differs;
 * everything they have in common is here.
 *
 * NO `"use client"` IN THIS FILE. Every piece below is presentational and
 * stateless, so a report page stays a server component and its figures never
 * cross the boundary as props for no reason. The two genuinely interactive
 * pieces — the filter panel and the export bar — are their own client islands.
 *
 * ── THE ONE RULE THIS FILE EXISTS TO ENFORCE ───────────────────────────────
 *
 * REPORT TABLES DO NOT BECOME CARDS ON MOBILE. Every other list in this app
 * does (§5.7); these scroll horizontally with the first column pinned. A
 * statement's value IS its column alignment — the reader is scanning a column
 * of figures for the one that looks wrong, and a stack of cards destroys
 * exactly that. DESIGN-STANDARDS §5.7 carries the exception explicitly.
 */

/* ── Page header ─────────────────────────────────────────────────────────── */

export function ReportHeader({
  title,
  subtitle,
  backLabel,
  actions,
}: {
  title: string;
  /** Restates the applied filters IN PROSE, so a screenshot explains itself. §4.3 */
  subtitle: string;
  backLabel: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Link
          href={reportPaths.index}
          className="inline-flex items-center gap-0.5 text-body-sm font-medium text-primary hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
        <h1 className="mt-2 text-h2 font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">{subtitle}</p>
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/* ── Summary band ────────────────────────────────────────────────────────── */

/**
 * The band, not a KPI strip.
 *
 * Values are **20px mono 600** — smaller than a KPI card's 28px, because this
 * is a band inside a report rather than the home screen. The single critical
 * figure per report is `emphasis`; the rest sit a shade back. §4.3
 */
export function SummaryBand({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: 4 | 5;
}) {
  return (
    <div
      className={cn(
        "mb-6 grid grid-cols-1 gap-x-4 gap-y-5 rounded-lg border border-border bg-muted p-5 print:hidden md:grid-cols-2",
        columns === 5 ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

export function SummaryCell({
  label,
  value,
  context,
  tone = "default",
  emphasis = false,
  href,
  badge,
}: {
  label: string;
  /** Already formatted — every figure comes through `<Money>` / `lib/money`. */
  value: React.ReactNode;
  context?: React.ReactNode;
  tone?: "default" | "danger" | "warning" | "success";
  /** The one figure the report was opened for. Gray 900 against Gray 700. */
  emphasis?: boolean;
  href?: string;
  /** The ageing sub-count — `312 out 7+ days` — as a Danger pill. §4.3 */
  badge?: React.ReactNode;
}) {
  const body = (
    <>
      <p className="text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-mono text-[1.25rem] font-semibold leading-tight tabular-nums",
          tone === "danger"
            ? "text-destructive"
            : tone === "warning"
              ? "text-warning"
              : tone === "success"
                ? "text-success"
                : emphasis
                  ? "text-foreground"
                  : "text-foreground/80",
        )}
      >
        {value}
      </p>
      {context || badge ? (
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
          {context}
          {badge}
        </p>
      ) : null}
    </>
  );

  // Every number is a door — but only where a destination genuinely exists. §4.3
  return href ? (
    <Link
      href={href}
      className="-m-2 rounded-md p-2 transition-colors duration-100 hover:bg-border/60"
    >
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

/* ── Report table ────────────────────────────────────────────────────────── */

export function ReportSection({
  title,
  meta,
  note,
  children,
  className,
}: {
  title?: string;
  /** Right-aligned caption — `6 orders · ₹48,600.00`. §6.3 */
  meta?: React.ReactNode;
  /** A caption under the heading, e.g. Section C's "regardless of the range". */
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("mb-6 overflow-hidden print:hidden", className)}>
      {title ? (
        <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-h4 font-semibold text-foreground">{title}</h2>
            {note ? (
              <p className="mt-0.5 text-caption text-muted-foreground">{note}</p>
            ) : null}
          </div>
          {meta ? (
            <p className="shrink-0 text-caption text-muted-foreground">{meta}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </Card>
  );
}

/**
 * The scroll container.
 *
 * `minWidth` is the point below which the columns start to crowd; under it the
 * table scrolls sideways rather than reflowing, and the first column stays
 * pinned. Above `md` the hint disappears because nothing scrolls. §4.7
 */
export function ReportTable({
  children,
  minWidth = 760,
  hint,
}: {
  children: React.ReactNode;
  minWidth?: number;
  /** `Swipe the table sideways to see all columns ›` — shown only on mobile. */
  hint?: string;
}) {
  return (
    <>
      {hint ? (
        <p className="border-t border-border px-4 py-2 text-caption text-muted-foreground md:hidden">
          {hint}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table
          className="w-full border-separate border-spacing-0 text-body-sm"
          style={{ minWidth }}
        >
          {children}
        </table>
      </div>
    </>
  );
}

/** 44px, muted, Caption 12/600 uppercase, sticky under the 64px topbar. §4.3 */
const HEAD_CELL =
  "h-11 whitespace-nowrap bg-muted px-4 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground";

/** 48px, 1px bottom border, Body SM. No zebra striping anywhere. §4.3 */
const BODY_CELL = "h-12 border-t border-border px-4 align-middle";

/**
 * The pinned first column.
 *
 * A 1px right border and a shadow once scrolled, so it is visible that the
 * column is holding still rather than that the table is broken. The background
 * has to be repeated on the cell itself — a sticky cell sits above its row, so
 * it would otherwise be transparent over the scrolled content behind it.
 */
const PIN = "sticky left-0 z-10 border-r border-border shadow-[4px_0_6px_-4px_rgba(0,0,0,0.12)]";

export function RHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-16 z-20">
      <tr>{children}</tr>
    </thead>
  );
}

export function RTh({
  children,
  align = "left",
  pinned = false,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
  pinned?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        HEAD_CELL,
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left",
        pinned && cn(PIN, "z-30"),
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function RRow({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("group hover:bg-muted", className)} {...props}>
      {children}
    </tr>
  );
}

export function RTd({
  children,
  align = "left",
  pinned = false,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
  pinned?: boolean;
}) {
  return (
    <td
      className={cn(
        BODY_CELL,
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left",
        pinned && cn(PIN, "bg-card group-hover:bg-muted"),
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * A group row is a heading AND a subtotal.
 *
 * Reading it alone answers the question, which is what makes a collapsed
 * report a per-group summary rather than a list of names. §4.3
 */
export function RGroupRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("bg-muted/70 text-body-sm font-semibold", className)}>
      {children}
    </tr>
  );
}

export const GROUP_CELL =
  "h-10 border-t border-border px-4 align-middle font-semibold text-foreground";

/** 44px, 1px Gray 400 top rule, label in Gray 600, figures Gray 900 mono 600. */
export function RSubtotalRow({ children }: { children: React.ReactNode }) {
  return <tr className="text-body-sm font-semibold">{children}</tr>;
}

export const SUBTOTAL_CELL =
  "h-11 border-t border-muted-foreground/40 px-4 align-middle";

/** 52px, muted fill, 2px Gray 900 top rule, figures 16px mono 700. §4.3 */
export function RTotalRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="bg-muted text-body-sm font-semibold">{children}</tr>
  );
}

export const TOTAL_CELL =
  "h-13 border-t-2 border-foreground/70 px-4 align-middle text-foreground";

/* ── The states every report shares ──────────────────────────────────────── */

/**
 * The prompt state — a required filter is unset, so nothing has been run.
 *
 * Not an empty state and not an error: the report is fine, it just does not
 * know who it is about yet. The filter panel stays live above it. §4.5
 */
export function ReportPrompt({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Card className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center print:hidden">
      <Icon className="size-12 text-muted-foreground/60" aria-hidden />
      <h2 className="mt-4 text-h4 font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-prose text-body-sm text-muted-foreground">
        {body}
      </p>
    </Card>
  );
}

/** No rows for the applied filters. Names the filters so the owner can loosen. */
export function ReportEmpty({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center border-t border-border px-6 py-10 text-center">
      <Icon className="size-12 text-muted-foreground/60" aria-hidden />
      <h3 className="mt-4 text-h4 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-prose text-body-sm text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

/** A non-dismissible banner above a table — the coin drift and P&L warnings. */
export function ReportBanner({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "danger" | "warning" | "info";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "mb-6 flex items-start gap-3 rounded-lg border p-4 print:hidden",
        tone === "danger"
          ? "border-destructive bg-(--badge-danger-bg) text-(--badge-danger-fg)"
          : tone === "warning"
            ? "border-warning bg-(--badge-warning-bg) text-(--badge-warning-fg)"
            : "border-primary bg-(--badge-primary-bg) text-(--badge-primary-fg)",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-body-sm font-semibold">{title}</p>
        {body ? <p className="mt-0.5 text-body-sm">{body}</p> : null}
      </div>
    </div>
  );
}

/**
 * The card under a table that writes the arithmetic out as a sentence.
 *
 * The collection sheet's drawer line, the party statement's closing balance and
 * the P&L net card all use it: a figure the owner is about to check against
 * something physical reads better as a sentence than as another table row.
 */
export function ReportFootnoteCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 rounded-lg border border-border bg-muted p-5 print:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A caption under a table — the notes §5.3, §7.3, §9.3 and §11.3 require. */
export function ReportNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-border px-4 py-2.5 text-caption text-muted-foreground">
      {children}
    </p>
  );
}
