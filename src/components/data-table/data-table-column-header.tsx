"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TABLE_PARAMS, type SortDir } from "@/lib/table/types";
import { useTableParams } from "./use-table-params";

/**
 * Sortable column header. Spec: DESIGN-STANDARDS §5.2
 *
 * Cycle is none → ascending → descending → none, so a user can always get
 * back to the default order without reloading.
 */
export function DataTableColumnHeader({
  sortKey,
  children,
  align = "left",
  className,
}: {
  /** Omit to render a plain, non-sortable header. */
  sortKey?: string;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const { get, toggleSort } = useTableParams();

  const alignClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "justify-start text-left";

  if (!sortKey) {
    return (
      <span className={cn("flex items-center", alignClass, className)}>
        {children}
      </span>
    );
  }

  const currentKey = get(TABLE_PARAMS.sort);
  const currentDir = get(TABLE_PARAMS.dir) as SortDir | undefined;
  const active = currentKey === sortKey;

  const Icon = !active ? ArrowUpDown : currentDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => toggleSort(sortKey, currentKey, currentDir)}
      aria-sort={
        active ? (currentDir === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "flex w-full items-center gap-1 rounded-sm transition-colors duration-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "text-foreground" : "hover:text-foreground",
        alignClass,
        className,
      )}
    >
      <span>{children}</span>
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          active ? "text-primary opacity-100" : "opacity-40",
        )}
        aria-hidden
      />
    </button>
  );
}
