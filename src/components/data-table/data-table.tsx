"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ListResult } from "@/lib/table/types";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableSkeleton } from "./data-table-skeleton";
import { DataTableToolbar, type QuickChip } from "./data-table-toolbar";
import { useTableParams } from "./use-table-params";

export interface DataTableColumn<T> {
  /** Stable id, also the React key. */
  id: string;
  header: React.ReactNode;
  /** Present = sortable. Must be a key of the module's `TableConfig.sortable`. */
  sortKey?: string;
  align?: "left" | "right" | "center";
  /** Fixed width, e.g. "56px" for the actions column. */
  width?: string;
  /** Hidden below the `md` breakpoint — the card layout takes over there. */
  hideOnMobile?: boolean;
  cell: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  result: ListResult<T>;
  searchPlaceholder: string;
  /** Row → detail href. Makes the whole row navigable. */
  rowHref?: (row: T) => string;
  rowKey: (row: T) => string;
  /** Rendered when there are no rows AND no active filters. */
  emptyState: React.ReactNode;
  /** Rendered when there are no rows BUT filters are active. Different message. */
  noResultsState: React.ReactNode;
  filters?: React.ReactNode;
  quickChips?: QuickChip[];
  /** Toolbar actions, e.g. Export CSV. */
  toolbarActions?: React.ReactNode;
  /** Mobile card renderer. Falls back to a compact column stack. */
  mobileCard?: (row: T) => React.ReactNode;
  /** Extra classes on a row, e.g. dimming a cancelled record. */
  rowClassName?: (row: T) => string | undefined;

  /* ── Optional slots ──────────────────────────────────────────────────
     Every one is optional, and absent means the original behaviour byte
     for byte. They exist because two modules could not express their
     screen and rebuilt the table out of the surrounding primitives —
     Delivery Orders needs two of these at once and would have been the
     third. A shared table that half the modules fork is not shared.     */

  /**
   * Expandable rows. Present ⇒ a 40px chevron column is prepended and each
   * row can reveal a full-width panel beneath it.
   *
   * Expansion is LOCAL state, deliberately not in the URL: an expanded row is
   * a glance, not a destination worth sharing or restoring.
   */
  renderExpanded?: (row: T) => React.ReactNode;

  /**
   * A row pinned directly under the header, above all data — the inline
   * create row in Direct Sales.
   *
   * Rendered even when there are no rows, so the first record can be entered
   * from an empty list.
   */
  leadingRow?: React.ReactNode;

  /**
   * Group bands. A band renders whenever `key` changes between consecutive
   * rows — dates in Direct Sales, carrying that day's running total.
   *
   * The rows must already be ordered by the same key; this groups what it is
   * given rather than sorting.
   */
  groupBy?: {
    key: (row: T) => string;
    render: (key: string, rows: T[]) => React.ReactNode;
  };

  /** A row inside the card, above the pagination — a month or day total. */
  footRow?: React.ReactNode;
}

/**
 * The shared table. Spec: DESIGN-STANDARDS §5
 *
 * Used by every module, so it contains NO module-specific logic — everything
 * varies through `columns`, `filters` and the two empty states.
 *
 * The behaviour most worth preserving: on refilter or repage the existing rows
 * DIM rather than being replaced by a skeleton. Swapping real data for grey
 * bars reads as slower than it is, and loses the user's place. Skeletons are
 * for first load only.
 */
export function DataTable<T>({
  columns,
  result,
  searchPlaceholder,
  rowHref,
  rowKey,
  emptyState,
  noResultsState,
  filters,
  quickChips,
  toolbarActions,
  mobileCard,
  rowClassName,
  renderExpanded,
  leadingRow,
  groupBy,
  footRow,
}: DataTableProps<T>) {
  const router = useRouter();
  const tableT = useTranslations("table");
  const { isPending, activeCount, get } = useTableParams();
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const filtersActive = activeCount > 0 || !!get("q");
  const isEmpty = result.rows.length === 0;

  const expandable = !!renderExpanded;
  // The chevron column is prepended, so every colSpan below has to account
  // for it or the expanded panel stops short of the last column.
  const totalColumns = columns.length + (expandable ? 1 : 0);

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  /** Rows in order, with a band inserted wherever the group key changes. */
  const grouped = React.useMemo(() => {
    if (!groupBy) return null;
    const out: { key: string; rows: T[] }[] = [];
    for (const row of result.rows) {
      const key = groupBy.key(row);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(row);
      else out.push({ key, rows: [row] });
    }
    return out;
  }, [groupBy, result.rows]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <DataTableToolbar
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        quickChips={quickChips}
      >
        {toolbarActions}
      </DataTableToolbar>

      {isEmpty ? (
        <>
          {/* The create row survives the empty state, so the FIRST record can
              be entered without leaving the page. */}
          {leadingRow && (
            <div className="border-b border-border">{leadingRow}</div>
          )}
          <div className="px-6 py-16">
            {filtersActive ? noResultsState : emptyState}
          </div>
        </>
      ) : (
        <>
          {/* Desktop */}
          <div
            className={cn(
              "relative hidden md:block",
              // Dim, don't replace. Keeps the user's place and their scroll.
              isPending && "pointer-events-none opacity-60",
            )}
          >
            {isPending && (
              <div
                className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/20"
                aria-hidden
              >
                <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] bg-primary" />
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  {expandable && <TableHead style={{ width: "40px" }} />}
                  {columns.map((col) => (
                    <TableHead
                      key={col.id}
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(col.hideOnMobile && "hidden lg:table-cell")}
                    >
                      <DataTableColumnHeader
                        sortKey={col.sortKey}
                        align={col.align}
                      >
                        {col.header}
                      </DataTableColumnHeader>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {leadingRow && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={totalColumns} className="p-0">
                      {leadingRow}
                    </TableCell>
                  </TableRow>
                )}

                {(grouped ?? [{ key: "", rows: result.rows }]).map((group) => (
                  <React.Fragment key={group.key || "__all"}>
                    {groupBy && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={totalColumns}
                          className="h-10 bg-muted p-0 px-4"
                        >
                          {groupBy.render(group.key, group.rows)}
                        </TableCell>
                      </TableRow>
                    )}

                    {group.rows.map((row) => {
                      const key = rowKey(row);
                      const href = rowHref?.(row);
                      const isOpen = expanded.has(key);

                      return (
                        <React.Fragment key={key}>
                          <TableRow
                            onClick={href ? () => router.push(href) : undefined}
                            className={cn(
                              href && "cursor-pointer",
                              rowClassName?.(row),
                            )}
                          >
                            {expandable && (
                              <TableCell
                                align="center"
                                // Stops the row navigating out from under the
                                // control that is meant to open it in place.
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(key);
                                }}
                              >
                                <button
                                  type="button"
                                  aria-expanded={isOpen}
                                  aria-label={
                                    isOpen ? tableT("collapseRow") : tableT("expandRow")
                                  }
                                  className="flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                >
                                  <ChevronRight
                                    className={cn(
                                      // The chevron turns; the panel does not
                                      // slide. §16 forbids animating rows.
                                      "size-4 transition-transform duration-100",
                                      isOpen && "rotate-90",
                                    )}
                                    aria-hidden
                                  />
                                </button>
                              </TableCell>
                            )}

                            {columns.map((col) => (
                              <TableCell
                                key={col.id}
                                align={col.align}
                                className={cn(
                                  col.hideOnMobile && "hidden lg:table-cell",
                                )}
                              >
                                {col.cell(row)}
                              </TableCell>
                            ))}
                          </TableRow>

                          {expandable && isOpen && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell
                                colSpan={totalColumns}
                                className="bg-muted/40 p-0"
                              >
                                {renderExpanded(row)}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                ))}

                {footRow && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={totalColumns}
                      className="border-t border-border bg-muted p-0 px-4"
                    >
                      {footRow}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile — each row becomes a card. DESIGN-STANDARDS §5.7 */}
          <div className={cn("md:hidden", isPending && "opacity-60")}>
            {leadingRow && (
              <div className="border-b border-border">{leadingRow}</div>
            )}

            {(grouped ?? [{ key: "", rows: result.rows }]).map((group) => (
              <React.Fragment key={group.key || "__all"}>
                {/* Bands matter MORE on mobile: without the column headings,
                    the date is the only thing telling you what you're looking
                    at as you scroll. */}
                {groupBy && (
                  <div className="flex min-h-10 items-center border-b border-border bg-muted px-4">
                    {groupBy.render(group.key, group.rows)}
                  </div>
                )}

                <ul>
                  {group.rows.map((row) => {
                    const key = rowKey(row);
                    const href = rowHref?.(row);
                    const isOpen = expanded.has(key);

                    return (
                      <li
                        key={key}
                        className={cn(
                          "border-b border-border last:border-b-0",
                          rowClassName?.(row),
                        )}
                      >
                        <div
                          onClick={href ? () => router.push(href) : undefined}
                          className={cn(
                            "p-4",
                            href && "cursor-pointer active:bg-muted",
                          )}
                        >
                          {mobileCard?.(row) ?? (
                            <DefaultMobileCard row={row} columns={columns} />
                          )}
                        </div>

                        {expandable && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(key)}
                              aria-expanded={isOpen}
                              className="flex w-full items-center gap-1 px-4 pb-3 text-caption text-muted-foreground"
                            >
                              <ChevronRight
                                className={cn(
                                  "size-3.5 transition-transform duration-100",
                                  isOpen && "rotate-90",
                                )}
                                aria-hidden
                              />
                              {isOpen ? tableT("collapseRow") : tableT("expandRow")}
                            </button>
                            {isOpen && (
                              <div className="bg-muted/40 px-4 py-3">
                                {renderExpanded(row)}
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </React.Fragment>
            ))}

            {footRow && (
              <div className="flex min-h-10 items-center border-t border-border bg-muted px-4">
                {footRow}
              </div>
            )}
          </div>

          <DataTablePagination result={result} />
        </>
      )}
    </div>
  );
}

/** Reasonable fallback when a module hasn't defined a mobile card. */
function DefaultMobileCard<T>({
  row,
  columns,
}: {
  row: T;
  columns: DataTableColumn<T>[];
}) {
  return (
    <div className="space-y-1">
      {columns
        .filter((c) => !c.hideOnMobile)
        .map((col) => (
          <div key={col.id} className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">{col.header}</span>
            <span className="min-w-0 text-sm">{col.cell(row)}</span>
          </div>
        ))}
    </div>
  );
}

export { DataTableSkeleton };
export type { QuickChip };
