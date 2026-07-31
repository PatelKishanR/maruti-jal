import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api/client";
import type {
  ProductDetailDto,
  ProductLookupsDto,
} from "@/lib/dto/product.dto";
import { ProductForm, blankProduct } from "../product-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Add product. Spec: design/MODULES/02-products.md §5
 *
 * `?duplicate=<id>` pre-fills from an existing row with ` (copy)` appended —
 * the fastest way to add "20L Jar (Cold)" once "20L Jar" exists.
 *
 * Only the ACTIVE lookups are offered: a retired tag must not be selectable on
 * a brand-new product.
 */
export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("products");
  const params = await searchParams;

  const duplicateId =
    typeof params.duplicate === "string" ? params.duplicate : undefined;

  const [lookups, source] = await Promise.all([
    api.get<ProductLookupsDto>("/api/products/lookups"),
    duplicateId
      ? api
          .get<ProductDetailDto>(`/api/products/${duplicateId}`)
          // A bad `?duplicate=` is not worth an error page — the owner still
          // wanted the Add form, so they get a blank one.
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  return (
    <div className="max-w-180">
      <Link
        href="/products"
        className="mb-2 inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("backToList")}
      </Link>

      <h1 className="text-h2 font-semibold text-foreground">
        {t("create.title")}
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        {t("create.subtitle")}
      </p>

      <ProductForm
        mode="create"
        initial={blankProduct(source, t("form.copySuffix"))}
        tags={lookups.tags}
        filterTypes={lookups.filterTypes}
      />
    </div>
  );
}
