import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import { partyOrderPaths, partyOrderRoutes } from "@/lib/api/routes.party-order";
import { formatDateRange } from "@/lib/dates";
import type { Locale } from "@/i18n/config";
import type { PartyOrderDetailDto } from "@/lib/dto/party-order.dto";
import type { ProductListResponseDto } from "@/lib/dto/product.dto";
import type { PartyProductRef } from "../day-items-editor";
import { PartyStatusBadges } from "../party-order-badges";
import { PartyOrderDetail } from "./party-order-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One booking: where it is in its schedule, what has been billed, what has been
 * received and what happened when.
 * Spec: design/MODULES/05-party-orders.md §7
 *
 * The schedule tab reuses the day-card timeline from the wizard — the same
 * component, with `Mark Delivered` in the footer — so nothing new is learned
 * between building a schedule and running one.
 */
export default async function PartyOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const t = await getTranslations("partyOrders");
  const locale = (await getLocale()) as Locale;

  let order: PartyOrderDetailDto;
  try {
    order = await api.get<PartyOrderDetailDto>(partyOrderRoutes.detail(id));
  } catch (error) {
    // A bad id is a stale bookmark, not a server fault. Everything else
    // rethrows to error.tsx, because they need different fixes.
    if (error instanceof ApiError && error.status === 404) {
      return <PartyOrderNotFound />;
    }
    throw error;
  }

  // Base prices for the line-item table's override strip. A failure here leaves
  // the base column as an em dash and blocks nothing. §8.5
  let products: PartyProductRef[] = [];
  try {
    const catalogue = await api.get<ProductListResponseDto>(
      `${apiRoutes.products.list}?pageSize=100`,
    );
    products = catalogue.result.rows.map((product) => ({
      id: product.id,
      title: product.title,
      basePrice: product.basePrice,
    }));
  } catch {
    products = [];
  }

  /**
   * A stale `?tab=` must degrade to the schedule rather than render a page with
   * no tab selected — the URL is shareable, so it will eventually be wrong.
   */
  const requestedTab = typeof query.tab === "string" ? query.tab : undefined;
  const tab = ["schedule", "payments", "activity"].includes(requestedTab ?? "")
    ? requestedTab
    : undefined;
  const day = typeof query.day === "string" ? query.day : undefined;

  return (
    <>
      <Link
        href={partyOrderPaths.list}
        className="inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mono, unlike a party's name — this IS a document code. §7.3 */}
          <h1 className="font-mono text-h2 font-semibold text-foreground">
            {order.code}
          </h1>
          <PartyStatusBadges order={order} className="flex-row items-center" />
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          {order.partyName}
          <span> · </span>
          <a
            href={`tel:${order.phone}`}
            className="font-mono text-primary underline-offset-4 hover:underline"
          >
            {order.phone}
          </a>
          {order.firstServiceDate && order.lastServiceDate && (
            <span>
              {" · "}
              {formatDateRange(
                order.firstServiceDate,
                order.lastServiceDate,
                locale,
              )}
            </span>
          )}
          <span> · {t("meta.days", { count: order.progress.totalDays })}</span>
        </p>
      </div>

      <PartyOrderDetail
        order={order}
        products={products}
        initialTab={tab}
        highlightDay={day}
      />
    </>
  );
}

/**
 * A 404 that helps.
 *
 * Not `notFound()` from next/navigation: the global 404 says nothing about
 * bookings and offers no way back into the list, which is where the answer
 * almost always is.
 */
async function PartyOrderNotFound() {
  const t = await getTranslations("partyOrders.notFound");

  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <SearchX className="size-12 text-muted-foreground/60" aria-hidden />
      <h1 className="mt-4 text-h4 font-semibold text-foreground">
        {t("title")}
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        {t("body")}
      </p>
      <Button asChild className="mt-4">
        <Link href={partyOrderPaths.list}>{t("cta")}</Link>
      </Button>
    </div>
  );
}
