import { cn } from "@/lib/utils";

/**
 * FIRST-LOAD ONLY. Spec: DESIGN-STANDARDS §5.6
 *
 * Refilter and repage dim the existing rows instead (see DataTable) — swapping
 * loaded data for grey bars reads as slower than it is and loses the user's
 * place.
 *
 * Widths are varied so it reads as content rather than a grid.
 */
const WIDTHS = ["w-24", "w-40", "w-16", "w-32", "w-20", "w-28"] as const;

export function DataTableSkeleton({
  columns = 6,
  rows = 8,
  className,
}: {
  columns?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      {/* Toolbar renders for real — only the data is unknown. */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="h-10 w-full max-w-100 skeleton rounded-sm" />
      </div>

      <div className="h-11 border-b border-border bg-muted" />

      <div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex h-12 items-center gap-4 border-b border-border px-4 last:border-b-0"
          >
            {Array.from({ length: columns }).map((__, c) => (
              <div
                key={c}
                className={cn(
                  "h-3.5 skeleton rounded",
                  WIDTHS[(r + c) % WIDTHS.length],
                )}
                style={{ animationDelay: `${(r * columns + c) * 20}ms` }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="h-14 border-t border-border" />
    </div>
  );
}
