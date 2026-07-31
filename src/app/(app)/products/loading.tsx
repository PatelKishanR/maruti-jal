import { DataTableSkeleton } from "@/components/data-table";

/**
 * First load only. Spec: DESIGN-STANDARDS §5.6
 *
 * Refiltering and repaging DIM the existing rows instead — that behaviour lives
 * in `DataTable` and never reaches this file. Swapping loaded data for grey
 * bars reads as slower than it is and loses the owner's place.
 *
 * Nine columns, matching the catalogue table, so nothing reflows when the real
 * rows land.
 */
export default function ProductsLoading() {
  return <DataTableSkeleton columns={9} rows={8} />;
}
