import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { parseListQuery, TABLE_PARAMS } from "@/lib/table";
import { productTableConfig } from "@/lib/table/configs/product";
import type {
  ProductListResponseDto,
  ProductLookupsDto,
} from "@/lib/dto/product.dto";
import { ProductKpis } from "./products-kpis";
import { ProductsLoadError, ProductsTable } from "./products-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The catalogue. Spec: design/MODULES/02-products.md §3
 *
 * Fetches through the API like every other screen — no service import, no
 * repository, no DataSource. See .claude/ARCHITECTURE.md §4
 *
 * All table state lives in the URL, so this page re-runs per request and the
 * server stays the single source of truth. `parseListQuery` neutralises
 * everything hostile before it becomes a query string: the sort value has to be
 * a KEY of `productTableConfig.sortable` or it falls back to the default.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("products");
  const params = await searchParams;
  const query = parseListQuery(params, productTableConfig);

  const header = (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <Button asChild>
          <Link href="/products/new">
            <Plus aria-hidden />
            {t("actions.add")}
          </Link>
        </Button>
      }
    />
  );

  let data: ProductListResponseDto;
  let lookups: ProductLookupsDto;

  try {
    [data, lookups] = await Promise.all([
      api.get<ProductListResponseDto>(`/api/products?${toApiQuery(query)}`),
      api.get<ProductLookupsDto>("/api/products/lookups"),
    ]);
  } catch {
    // Plain language, no stack trace, and a retry that re-runs this render.
    return (
      <>
        {header}
        <ProductsLoadError />
      </>
    );
  }

  return (
    <>
      {header}
      <ProductKpis kpis={data.kpis} />
      <ProductsTable
        result={data.result}
        tags={lookups.tags}
        filterTypes={lookups.filterTypes}
      />
    </>
  );
}

/**
 * `ListQuery` → the API's search string.
 *
 * Only keys the module declared survive `parseListQuery`, so nothing unknown
 * can be forwarded, and the sort key is already known-good.
 */
function toApiQuery(query: ReturnType<typeof parseListQuery>): string {
  const search = new URLSearchParams();

  search.set(TABLE_PARAMS.page, String(query.page));
  search.set(TABLE_PARAMS.pageSize, String(query.pageSize));
  search.set(TABLE_PARAMS.sort, query.sort.key);
  search.set(TABLE_PARAMS.dir, query.sort.dir);
  if (query.q) search.set(TABLE_PARAMS.q, query.q);

  for (const [key, value] of Object.entries(query.filters)) {
    if (typeof value === "string" && value) search.set(key, value);
  }

  return search.toString();
}
