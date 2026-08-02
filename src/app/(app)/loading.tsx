import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * First paint only. Spec: design/MODULES/08 §3.5
 *
 * **No full-page spinner, ever.** The header and both section labels render
 * immediately and the cards keep their final geometry, so nothing moves when
 * the figures land — a layout that reflows reads as slower than one that waits.
 *
 * Changing the date filter does NOT come through here: that path dims rows 1
 * and 3 in place while rows 2 and 4 stay live, which is a transition inside the
 * page rather than a fresh navigation.
 */
export default async function DashboardLoading() {
  const t = await getTranslations("dashboard");

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-80" />
      </header>

      <div className="flex flex-col gap-8">
        <SkeletonKpiRow label={t("sections.today")} />
        <SkeletonKpiRow label={t("sections.risk")} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonChart />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SkeletonTable rows={5} />
          <SkeletonTable rows={3} />
        </div>

        <SkeletonTable rows={5} />
      </div>
    </>
  );
}

function SkeletonKpiRow({ label }: { label: string }) {
  return (
    <section>
      <p className="mb-3 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </p>
      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index} className="p-5">
            <Skeleton className="h-3 w-28" />
            {/* The value slot keeps its 32px height so the card cannot jump. */}
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-3 h-3 w-24" />
          </Card>
        ))}
      </div>
    </section>
  );
}

function SkeletonChart() {
  return (
    <Card className="p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      {/* Axes are drawn in their final position; only the plot shimmers. */}
      <div className="mt-4 flex h-70 gap-3">
        <div className="flex w-12 flex-col justify-between py-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-3 w-10" />
          ))}
        </div>
        <div className="flex-1">
          <Skeleton className="h-62 w-full" />
          <div className="mt-3 flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function SkeletonTable({ rows }: { rows: number }) {
  const widths = ["60%", "40%", "80%", "50%", "70%"];

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-2 h-3 w-28" />
      </div>
      <div className="h-11 bg-muted" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex h-12 items-center border-t border-border px-4"
        >
          <Skeleton
            className="h-3"
            style={{ width: widths[index % widths.length] }}
          />
        </div>
      ))}
    </Card>
  );
}
