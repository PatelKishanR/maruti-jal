import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type {
  ProductDetailDto,
  ProductLookupsDto,
} from "@/lib/dto/product.dto";
import { ProductForm, toFormInitial } from "../../product-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Edit product. Spec: design/MODULES/02-products.md §6
 *
 * The same form as Add, plus the non-dismissible snapshot banner, the live
 * price-delta chip and the Status section — all of which live in
 * `ProductForm`, so the two screens cannot drift.
 *
 * Lookups are fetched with `includeInactive=true`: a product whose tag was
 * retired last week must still show its own tag, or saving an unrelated field
 * would silently move it to whatever happens to be first in the list.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("products");
  const locale = (await getLocale()) as Locale;

  let product: ProductDetailDto;
  let lookups: ProductLookupsDto;

  try {
    [product, lookups] = await Promise.all([
      api.get<ProductDetailDto>(`/api/products/${id}`),
      api.get<ProductLookupsDto>("/api/products/lookups?includeInactive=true"),
    ]);
  } catch (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
        <SearchX className="size-12 text-muted-foreground/60" aria-hidden />
        <h1 className="mt-4 text-h4 font-semibold text-foreground">
          {missing ? t("detail.notFoundTitle") : t("detail.errorTitle")}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {missing ? t("detail.notFoundBody") : t("detail.errorBody")}
        </p>
        <Button asChild className="mt-4">
          <Link href="/products">{t("detail.backToProducts")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-180">
      {/* Back goes to the DETAIL page, not the list — that is where the owner
          came from, and it is where Save lands them. */}
      <Link
        href={`/products/${product.id}`}
        className="mb-2 inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {product.title}
      </Link>

      <h1 className="text-h2 font-semibold text-foreground">
        {t("edit.title")}
      </h1>

      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        <span className="font-mono text-[13px]">{product.code}</span>
        {" · "}
        {t("detail.addedOn", {
          date: formatDate(product.createdAt.slice(0, 10), locale),
        })}
        {" · "}
        {t("edit.usedOnLines", {
          count: formatQuantity(product.usageCount),
        })}
      </p>

      <ProductForm
        mode="edit"
        productId={product.id}
        initial={toFormInitial(product)}
        tags={lookups.tags}
        filterTypes={lookups.filterTypes}
      />
    </div>
  );
}
