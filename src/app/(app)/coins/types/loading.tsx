import { DataTableSkeleton } from "@/components/data-table";

/**
 * First load only. The toolbar and header render for real — only the data is
 * unknown — and refilter/repage DIM the loaded rows instead of coming back
 * here. Swapping real figures for grey bars reads as slower than it is.
 * DESIGN-STANDARDS §5.6
 */
export default function Loading() {
  return <DataTableSkeleton columns={8} rows={8} />;
}
