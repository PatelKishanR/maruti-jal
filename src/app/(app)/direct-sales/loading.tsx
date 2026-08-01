import { Skeleton } from "@/components/ui/skeleton";

/**
 * FIRST LOAD ONLY. Spec: §3.5
 *
 * Refiltering, repaging, sorting and recording a sale never reach this file —
 * those are transitions inside the table, which dims the rows it already has.
 * Replacing loaded data with grey bars reads as slower than it is.
 *
 * The KPI labels are unknown until the translations resolve, but the SHAPE is
 * known, so nothing moves when the figures land. The one thing this file
 * cannot render is the entry row: it is live, focused and stateful, and a
 * skeleton of it would steal the first keystrokes of a sale.
 */
export default function DirectSalesLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-44" />
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

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {/* Toolbar and chips render at their real height, so the table below
            them does not jump when the data arrives. */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Skeleton className="h-10 w-100 max-w-full" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="flex min-h-11 items-center gap-2 border-b border-border px-4 py-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>

        {/* A real 44px header row, then the 56px entry row's footprint, then
            eight sale rows. §3.5 */}
        <div className="h-11 border-b border-border bg-muted" />
        <div className="h-14 border-b border-border border-l-[3px] border-l-primary bg-muted" />

        <div className="divide-y divide-border">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex h-12 items-center gap-4 px-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
