"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Table. Spec: .claude/design/DESIGN-STANDARDS.md §5.2
 *
 * Header row 44px · body row 48px · cells 12px vertical / 16px horizontal.
 * Row hover is `bg-muted` over 100ms. **No zebra striping** — the 1px rules are
 * enough, and stripes fight the status colours in the badge columns.
 *
 * Two implementation notes worth keeping:
 *
 * 1. `border-separate border-spacing-0` rather than the default
 *    `border-collapse`. A sticky `<thead>` loses its borders under
 *    `border-collapse` in Chrome, so the rules live on the cells instead —
 *    which is also why `TableRow` carries no border of its own.
 * 2. Heights are `h-*`, not `min-h-*`. CSS treats `height` on a table cell as a
 *    MINIMUM, so a wrapped Gujarati name grows the row rather than being
 *    clipped — 20–40% longer text is the norm here.
 *
 * Sticky header only sticks when an ancestor scrolls; give the container a
 * `max-h-*` via `containerClassName` where that is wanted.
 */
export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement> & {
    /** Classes for the scroll container the sticky header sticks to. */
    containerClassName?: string;
  }
>(({ className, containerClassName, ...props }, ref) => (
  <div className={cn("relative w-full overflow-auto", containerClassName)}>
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom border-separate border-spacing-0 text-sm",
        className,
      )}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("sticky top-0 z-10", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    // The last row's rule would double up against a footer or the container
    // edge, so it is dropped.
    className={cn("[&_tr:last-child>td]:border-b-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("bg-muted font-medium [&>tr>td]:border-t [&>tr>td]:border-border", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

export interface TableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Primary tint. Only used where bulk actions exist. */
  selected?: boolean;
  /** Cancelled or voided records read at 60% opacity. */
  cancelled?: boolean;
  /** 2px Danger left border — a row that needs the owner to look at it. */
  attention?: boolean;
  /** Whole-row navigation to the detail page. */
  clickable?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected, cancelled, attention, clickable, ...props }, ref) => (
    <tr
      ref={ref}
      data-state={selected ? "selected" : undefined}
      className={cn(
        "h-12 transition-colors duration-100",
        "hover:bg-muted",
        selected && "bg-[var(--badge-primary-bg)] hover:bg-[var(--badge-primary-bg)]",
        cancelled && "opacity-60",
        // Borders on a <tr> never paint under `border-separate`, so the
        // needs-attention rule goes on the first cell.
        attention && "[&>td:first-child]:border-l-2 [&>td:first-child]:border-l-destructive",
        clickable &&
          "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, scope = "col", ...props }, ref) => (
  <th
    ref={ref}
    scope={scope}
    className={cn(
      "h-11 border-b border-border bg-muted px-4 py-3 text-left align-middle",
      "text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground",
      "whitespace-nowrap",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "border-b border-border px-4 py-3 align-middle text-sm text-foreground",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

/**
 * Every table carries one — §18 requires it. Add `className="sr-only"` where it
 * would duplicate a visible heading.
 */
export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("px-4 py-3 text-left text-caption text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";
