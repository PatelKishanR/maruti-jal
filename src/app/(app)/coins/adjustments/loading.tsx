import { DataTableSkeleton } from "@/components/data-table";

/**
 * First load only. Refilter and repage DIM the loaded rows instead — swapping
 * real figures for grey bars reads as slower than it is and loses the user's
 * place. DESIGN-STANDARDS §5.6 · design MODULES/04-coins §11.5
 */
export default function Loading() {
  return <DataTableSkeleton columns={6} rows={8} />;
}
