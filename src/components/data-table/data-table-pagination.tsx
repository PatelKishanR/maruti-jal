"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_SIZES, TABLE_PARAMS, type ListResult } from "@/lib/table/types";
import { useTableParams } from "./use-table-params";

/** Spec: DESIGN-STANDARDS §5.5 */
export function DataTablePagination<T>({ result }: { result: ListResult<T> }) {
  const t = useTranslations("table");
  const { setParams, isPending } = useTableParams();

  const { page, pageSize, total, pageCount } = result;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex h-14 flex-wrap items-center justify-between gap-3 border-t border-border px-4">
      <p className="text-xs text-muted-foreground">
        {t("showing", { from, to, total })}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only sm:not-sr-only">{t("rowsPerPage")}</span>
          <select
            value={pageSize}
            disabled={isPending}
            onChange={(e) =>
              setParams({ [TABLE_PARAMS.pageSize]: e.target.value })
            }
            className="h-8 rounded-sm border border-input bg-transparent px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <nav className="flex items-center gap-1" aria-label={t("pagination")}>
          <PageButton
            disabled={page <= 1 || isPending}
            onClick={() => setParams({ [TABLE_PARAMS.page]: page - 1 })}
            label={t("previous")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </PageButton>

          {pageWindow(page, pageCount).map((p, i) =>
            p === null ? (
              <span
                key={`gap-${i}`}
                className="px-1 text-xs text-muted-foreground"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                disabled={isPending}
                onClick={() => setParams({ [TABLE_PARAMS.page]: p })}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "size-8 rounded-sm text-xs transition-colors duration-100",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  p === page
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {p}
              </button>
            ),
          )}

          <PageButton
            disabled={page >= pageCount || isPending}
            onClick={() => setParams({ [TABLE_PARAMS.page]: page + 1 })}
            label={t("next")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </PageButton>
        </nav>
      </div>
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

/** `1 2 3 … 13` — always shows first, last, and a window around the current. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);
  if (current <= 3) pages.add(2).add(3);
  if (current >= total - 2) pages.add(total - 1).add(total - 2);

  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push(null);
    out.push(p);
    previous = p;
  }
  return out;
}
