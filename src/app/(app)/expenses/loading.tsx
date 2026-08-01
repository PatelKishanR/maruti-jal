import { DataTableSkeleton } from "@/components/data-table";

/**
 * FIRST LOAD ONLY. Spec: DESIGN-STANDARDS §5.6 · design §3.5
 *
 * Changing the month, refiltering and repaging DIM the existing rows instead —
 * that behaviour lives in `DataTable` and never reaches this file. Swapping
 * loaded data for grey bars reads as slower than it is and loses the owner's
 * place in a month he was halfway through reading.
 *
 * Eight columns, matching the register, so nothing reflows when the real rows
 * land.
 */
export default function ExpensesLoading() {
  return <DataTableSkeleton columns={8} rows={8} />;
}
