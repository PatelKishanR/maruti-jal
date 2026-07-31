import { DataTableSkeleton } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * FIRST LOAD ONLY. Spec: §3.5
 *
 * Refiltering, repaging and sorting never reach this file — those are
 * transitions inside the table, which dims the rows it already has. Replacing
 * loaded data with grey bars reads as slower than it is.
 *
 * The header and the KPI labels render for real; only the figures are unknown,
 * so nothing moves when they land.
 */
export default function StaffLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="mb-6 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-8 w-30" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      <DataTableSkeleton columns={7} rows={8} />
    </>
  );
}
