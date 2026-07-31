"use client";

import { useRouter } from "next/navigation";
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
}: DataTableProps<T>) {
  const router = useRouter();
  const { isPending, activeCount, get } = useTableParams();

  const filtersActive = activeCount > 0 || !!get("q");
  const isEmpty = result.rows.length === 0;

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
        <div className="px-6 py-16">
          {filtersActive ? noResultsState : emptyState}
        </div>
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
                {result.rows.map((row) => {
                  const href = rowHref?.(row);
                  return (
                    <TableRow
                      key={rowKey(row)}
                      onClick={href ? () => router.push(href) : undefined}
                      className={cn(
                        href && "cursor-pointer",
                        rowClassName?.(row),
                      )}
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={col.id}
                          align={col.align}
                          className={cn(col.hideOnMobile && "hidden lg:table-cell")}
                        >
                          {col.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile — each row becomes a card. DESIGN-STANDARDS §5.7 */}
          <ul className={cn("md:hidden", isPending && "opacity-60")}>
            {result.rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <li
                  key={rowKey(row)}
                  onClick={href ? () => router.push(href) : undefined}
                  className={cn(
                    "border-b border-border p-4 last:border-b-0",
                    href && "cursor-pointer active:bg-muted",
                    rowClassName?.(row),
                  )}
                >
                  {mobileCard?.(row) ?? <DefaultMobileCard row={row} columns={columns} />}
                </li>
              );
            })}
          </ul>

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
