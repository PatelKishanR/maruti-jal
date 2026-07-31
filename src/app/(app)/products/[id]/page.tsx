import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ChevronLeft,
  ClipboardList,
  Droplet,
  Info,
  Package,
  PackageX,
  PartyPopper,
  Pencil,
  RotateCcw,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailSummary } from "@/components/common/detail-summary";
import { EmptyFigure, Litres, Money, Quantity } from "@/components/common/money";
import { StatusBadge } from "@/components/common/status-badge";
import { Timeline, type TimelineEntry } from "@/components/common/timeline";
import { api, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import { formatINR, formatLitres } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type {
  ProductChannel,
  ProductChannelMovementDto,
  ProductDetailDto,
} from "@/lib/dto/product.dto";
import { ProductActions, ReactivateLink } from "./product-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Product detail. Spec: design/MODULES/02-products.md §4
 *
 * Confirms the specs and the current price, then shows what the product
 * actually does in the field — how much moves, through which channel, and how
 * far the real selling price has drifted below the base price.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("products");
  const locale = (await getLocale()) as Locale;
  const format = await getFormatter();

  let product: ProductDetailDto;
  try {
    product = await api.get<ProductDetailDto>(`/api/products/${id}`);
  } catch (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <>
        <BackLink label={t("backToList")} />
        <div
          role={missing ? undefined : "alert"}
          className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center"
        >
          {missing ? (
            <SearchX className="size-12 text-muted-foreground/60" aria-hidden />
          ) : (
            <AlertTriangle className="size-12 text-destructive" aria-hidden />
          )}
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
      </>
    );
  }

  const monthLabel = format.dateTime(new Date(`${product.movement.month}-01`), {
    month: "long",
    year: "numeric",
  });

  // With no recorded change, the price has stood since the product was added —
  // which is exactly what the price-history card says underneath.
  const priceSetOn =
    product.priceHistory[0]?.changedAt ?? product.createdAt;

  return (
    <>
      <BackLink label={t("backToList")} />

      {/* ---- Header ------------------------------------------------- */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sans, not mono: this is a name, and it may be Gujarati. */}
            <h1 className="text-h2 font-semibold leading-[1.3] text-foreground">
              {product.title}
            </h1>
            <span className="flex flex-wrap items-center gap-1">
              <StatusBadge status={product.isActive ? "active" : "inactive"} />
              {product.isReturnable ? (
                <Badge variant="primary" icon={<RotateCcw aria-hidden />}>
                  {t("detail.returnable")}
                </Badge>
              ) : (
                <Badge icon={<PackageX aria-hidden />}>
                  {t("detail.nonReturnable")}
                </Badge>
              )}
            </span>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono text-[13px]">{product.code}</span>
            {" · "}
            {formatLitres(product.litres)}
            {" · "}
            {product.tagLabel}
            {" · "}
            {product.filterTypeLabel}
            {" · "}
            {t("detail.addedOn", {
              date: formatDate(product.createdAt.slice(0, 10), locale),
            })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild>
            <Link href={`/products/${product.id}/edit`}>
              <Pencil aria-hidden />
              {t("rowActions.edit")}
            </Link>
          </Button>
          <ProductActions
            productId={product.id}
            title={product.title}
            isActive={product.isActive}
          />
        </div>
      </div>

      {/* ---- Inactive banner ---------------------------------------- */}
      {!product.isActive && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          <Info className="mt-px size-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">{t("detail.inactiveBanner")}</p>
          <ReactivateLink productId={product.id} title={product.title} />
        </div>
      )}

      {/* ---- Summary band ------------------------------------------- */}
      <DetailSummary
        className="mb-8"
        items={[
          {
            label: t("detail.summary.basePrice"),
            emphasis: true,
            value: (
              <SummaryValue
                context={t("detail.summary.priceSetOn", {
                  date: formatDate(priceSetOn.slice(0, 10), locale),
                })}
              >
                {product.basePrice === 0 ? (
                  <span className="font-sans text-base">{t("free")}</span>
                ) : (
                  <Money value={product.basePrice} emphasis zeroAs="value" />
                )}
              </SummaryValue>
            ),
          },
          {
            label: t("detail.summary.avgRealised"),
            value: (
              <SummaryValue context={t("detail.summary.noSalesYet")}>
                <Money value={product.movement.avgRealisedPrice} />
              </SummaryValue>
            ),
          },
          {
            label: t("detail.summary.unitsThisMonth"),
            value: (
              <SummaryValue context={t("detail.summary.noSalesYet")}>
                <Quantity value={product.movement.totalUnits} zeroAs="dash" />
              </SummaryValue>
            ),
          },
          {
            label: t("detail.summary.unitsLifetime"),
            value: (
              <SummaryValue
                context={t("detail.summary.sinceAdded", {
                  date: formatDate(product.createdAt.slice(0, 10), locale),
                })}
              >
                <Quantity value={product.movement.lifetimeUnits} zeroAs="dash" />
              </SummaryValue>
            ),
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Specification --------------------------------------- */}
        <Card className="p-6">
          <h2 className="mb-4 text-h4 font-semibold text-foreground">
            {t("detail.specification")}
          </h2>

          <dl className="flex flex-col gap-3">
            <SpecRow label={t("form.titleLabel")}>{product.title}</SpecRow>
            <SpecRow label={t("form.litresLabel")}>
              <Litres value={product.litres} />
            </SpecRow>
            <SpecRow label={t("form.tagLabel")}>{product.tagLabel}</SpecRow>
            <SpecRow label={t("detail.filterLabel")}>
              {product.filterTypeLabel}
            </SpecRow>
            <SpecRow label={t("form.returnableLabel")}>
              {product.isReturnable
                ? t("detail.returnableYesLong")
                : t("detail.returnableNoLong")}
            </SpecRow>
            <SpecRow label={t("form.sortOrderLabel")}>
              <span className="font-mono tabular-nums">{product.sortOrder}</span>
            </SpecRow>
            <SpecRow label={t("form.descriptionLabel")}>
              {product.description ? (
                // Never truncated on a detail page, and line breaks survive.
                <span className="whitespace-pre-line">{product.description}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </SpecRow>
          </dl>
        </Card>

        {/* ---- Movement by channel --------------------------------- */}
        <Card className="p-6">
          <h2 className="mb-4 text-h4 font-semibold text-foreground">
            {t("detail.movementHeading", { month: monthLabel })}
          </h2>

          {product.movement.available ? (
            <MovementTable
              channels={product.movement.channels}
              totalUnits={product.movement.totalUnits}
              totalRevenue={product.movement.totalRevenue}
              avgRealised={product.movement.avgRealisedPrice}
              basePrice={product.basePrice}
              labels={{
                channel: t("detail.movement.channel"),
                units: t("detail.movement.units"),
                revenue: t("detail.movement.revenue"),
                avg: t("detail.movement.avg"),
                total: t("detail.movement.total"),
                delivery: t("detail.channels.delivery"),
                party: t("detail.channels.party"),
                walkIn: t("detail.channels.walkIn"),
              }}
            />
          ) : (
            <div className="flex min-h-50 flex-col items-center justify-center px-4 py-8 text-center">
              <Package className="size-12 text-muted-foreground/60" aria-hidden />
              <p className="mt-4 text-h4 font-semibold text-foreground">
                {t("detail.movementEmptyTitle")}
              </p>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                {t("detail.movementEmptyBody")}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* ---- Price history ------------------------------------------ */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-h4 font-semibold text-foreground">
          {t("detail.priceHistory")}
        </h2>

        {product.priceHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("detail.priceUnchanged", {
              price: formatINR(product.basePrice),
            })}
          </p>
        ) : (
          <Timeline
            entries={product.priceHistory.map<TimelineEntry>((entry) => ({
              id: entry.id,
              tone: "primary",
              title:
                entry.previousPrice === null ? (
                  <span className="font-mono">
                    {t("detail.priceSetAt", {
                      price: formatINR(entry.newPrice),
                    })}
                  </span>
                ) : (
                  <span className="font-mono">
                    <span className="text-muted-foreground">
                      {formatINR(entry.previousPrice)}
                    </span>
                    {" → "}
                    <span className="font-semibold text-foreground">
                      {formatINR(entry.newPrice)}
                    </span>
                  </span>
                ),
              meta: `${format.dateTime(new Date(entry.changedAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}${entry.actorName ? ` · ${entry.actorName}` : ""}`,
            }))}
          />
        )}
      </Card>
    </>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/products"
      className="mb-2 inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

/** A summary figure with its context line underneath. */
function SummaryValue({
  children,
  context,
}: {
  children: React.ReactNode;
  context: string;
}) {
  return (
    <>
      {children}
      <span className="mt-1 block font-sans text-caption font-normal text-muted-foreground">
        {context}
      </span>
    </>
  );
}

function SpecRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <dt className="w-30 shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-base text-foreground">{children}</dd>
    </div>
  );
}

const CHANNEL_ICONS: Record<ProductChannel, LucideIcon> = {
  delivery: ClipboardList,
  party: PartyPopper,
  walkIn: Droplet,
};

/**
 * A plain table inside a card, not the standard list container.
 *
 * A channel with NO movement still renders its row, with an em dash across all
 * three figures. Omitting it would hide the fact that walk-ins never buy this
 * product, which is itself the answer to a question.
 */
function MovementTable({
  channels,
  totalUnits,
  totalRevenue,
  avgRealised,
  basePrice,
  labels,
}: {
  channels: ProductChannelMovementDto[];
  totalUnits: number | null;
  totalRevenue: number | null;
  avgRealised: number | null;
  basePrice: number;
  labels: Record<
    "channel" | "units" | "revenue" | "avg" | "total" | ProductChannel,
    string
  >;
}) {
  /** More than 5% below base is worth the owner's attention — Warning, not Danger. */
  const discounted = (avg: number | null) =>
    avg !== null && basePrice > 0 && avg < basePrice * 0.95;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="h-11 border-b border-border bg-muted px-4 text-left text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              {labels.channel}
            </th>
            {(["units", "revenue", "avg"] as const).map((key) => (
              <th
                key={key}
                className="h-11 border-b border-border bg-muted px-4 text-right text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground"
              >
                {labels[key]}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {channels.map((row) => {
            const Icon = CHANNEL_ICONS[row.channel];
            return (
              <tr key={row.channel} className="h-12">
                <td className="border-b border-border px-4 py-3 text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {labels[row.channel]}
                  </span>
                </td>
                <td className="border-b border-border px-4 py-3 text-right">
                  <Quantity value={row.units} zeroAs="dash" />
                </td>
                <td className="border-b border-border px-4 py-3 text-right">
                  {row.revenue === null ? (
                    <EmptyFigure />
                  ) : (
                    <Money value={row.revenue} zeroAs="value" />
                  )}
                </td>
                <td
                  className={cn(
                    "border-b border-border px-4 py-3 text-right",
                    discounted(row.avgPrice) && "text-[var(--badge-warning-fg)]",
                  )}
                >
                  {row.avgPrice === null ? (
                    <EmptyFigure />
                  ) : (
                    <Money
                      value={row.avgPrice}
                      zeroAs="value"
                      className={cn(
                        discounted(row.avgPrice) &&
                          "text-[var(--badge-warning-fg)]",
                      )}
                    />
                  )}
                </td>
              </tr>
            );
          })}

          <tr className="h-12">
            <td className="border-t border-border px-4 py-3 font-semibold text-foreground">
              {labels.total}
            </td>
            <td className="border-t border-border px-4 py-3 text-right">
              <Quantity value={totalUnits} emphasis zeroAs="dash" />
            </td>
            <td className="border-t border-border px-4 py-3 text-right">
              {totalRevenue === null ? (
                <EmptyFigure />
              ) : (
                <Money value={totalRevenue} emphasis zeroAs="value" />
              )}
            </td>
            <td className="border-t border-border px-4 py-3 text-right">
              {avgRealised === null ? (
                <EmptyFigure />
              ) : (
                <Money value={avgRealised} emphasis zeroAs="value" />
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
