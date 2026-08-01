import { DataTableSkeleton } from "@/components/data-table";

/**
 * First load only. Refilter and repage DIM the loaded rows instead of coming
 * back here — swapping real figures for grey bars reads as slower than it is,
 * loses the user's place, and would close every expanded row.
 * DESIGN-STANDARDS §5.6 · design MODULES/04-coins §6.5
 *
 * Eleven columns, matching the register including its chevron column, so the
 * skeleton does not change shape when the data lands.
 */
export default function Loading() {
  return <DataTableSkeleton columns={9} rows={8} />;
}
