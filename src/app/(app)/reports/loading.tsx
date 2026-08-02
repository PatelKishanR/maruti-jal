import { Skeleton } from "@/components/ui/skeleton";
import { REPORT_DEFINITIONS } from "@/lib/validation/report";

/**
 * The launcher's first load. Spec: design/MODULES/09-reports.md §3.5
 *
 * SEVEN CARDS RENDER WITH THEIR ICONS AND TITLES — only the footer line
 * shimmers, because that is the only part of this page that has to be fetched.
 * The rest is fixed. Skeletoning a card whose title is a constant makes the
 * page feel slower than it is and moves the grid when the figures land.
 */
export default function ReportsLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {Object.keys(REPORT_DEFINITIONS).map((slug) => (
          <div
            key={slug}
            className="flex min-h-37 flex-col rounded-lg border border-border bg-card p-6 shadow-sm md:min-h-45"
          >
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="mt-3 h-5 w-48 max-w-full" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-2/3" />
            <div className="mt-auto border-t border-border pt-3">
              <Skeleton className="h-3 w-35" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
