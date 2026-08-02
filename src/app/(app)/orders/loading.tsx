import { DataTableSkeleton } from "@/components/data-table";

/** First load only. A refilter dims the rows instead. DESIGN-STANDARDS §5.6 */
export default function Loading() {
  return <DataTableSkeleton columns={7} rows={8} />;
}
