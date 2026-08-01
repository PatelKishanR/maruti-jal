import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Ban, ChevronLeft, SearchX, UserPlus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailSummary } from "@/components/common/detail-summary";
import { Litres, Money } from "@/components/common/money";
import { api, ApiError } from "@/lib/api/client";
import { directSalePaths, directSaleRoutes } from "@/lib/api/routes.direct-sale";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { DirectSaleDetailDto } from "@/lib/dto/direct-sale.dto";
import { DirectSaleActions } from "../direct-sale-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sale detail. Spec: design/MODULES/06-direct-sales.md §5
 *
 * One old entry, usually opened because a figure is being checked against the
 * register — plus whether this customer has been in before, which is the only
 * customer history this system has (there is no customer master, §7).
 */
export default async function DirectSaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("directSales");
  const locale = (await getLocale()) as Locale;

  let sale: DirectSaleDetailDto;
  try {
    sale = await api.get<DirectSaleDetailDto>(directSaleRoutes.detail(id));
  } catch (error) {
    // A bad id is a stale bookmark, not a server fault. Everything else
    // rethrows to error.tsx, because they need different fixes.
    if (error instanceof ApiError && error.status === 404) {
      return <DirectSaleNotFound />;
    }
    throw error;
  }

  return (
    <>
      <Link
        href={directSalePaths.list}
        className="inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Mono, unlike a person's or product's name — this IS a document
                code. §5.3 */}
            <h1
              className={cn(
                "font-mono text-h2 font-semibold",
                sale.isVoided ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {sale.code}
            </h1>

            {/* There is no payment status in this module, so the badge states
                the only fact there is. §5.3 */}
            <Badge variant="success" icon={<Wallet aria-hidden />}>
              {t("badges.cash")}
            </Badge>
            {sale.isVoided && (
              <Badge icon={<Ban aria-hidden />}>{t("badges.voided")}</Badge>
            )}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {sale.customerName}
            <span> · {formatDateTime(sale.soldAt, locale)}</span>
            {sale.visitCount > 1 && (
              <span> · {t("detail.visit", { count: sale.visitCount })}</span>
            )}
          </p>
        </div>

        <div className="shrink-0">
          <DirectSaleActions sale={sale} detail={sale} variant="detail" />
        </div>
      </div>

      {/* Not dismissible: it is the explanation for every struck-through
          figure below it. §5.4 */}
      {sale.isVoided && (
        <div className="mt-4 rounded-lg border border-border bg-muted p-4">
          <div className="flex gap-3">
            <Ban className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {t("detail.voidedBanner", {
                  date: sale.voidedAt
                    ? formatDateTime(sale.voidedAt, locale)
                    : "—",
                  name: sale.voidedByName ?? t("detail.someone"),
                })}
              </p>
              {sale.voidReason && (
                <p className="mt-1 text-sm text-foreground">
                  {t("detail.voidedReason", { reason: sale.voidReason })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <DetailSummary
        className="mt-8"
        items={[
          {
            label: t("summary.amount"),
            emphasis: true,
            value: (
              <SummaryFigure context={t("summary.amountContext")}>
                <Money
                  value={sale.amount}
                  emphasis
                  className={cn(
                    "text-left",
                    sale.isVoided && "line-through text-muted-foreground",
                  )}
                />
              </SummaryFigure>
            ),
          },
          {
            label: t("summary.litres"),
            value: (
              <SummaryFigure
                context={sale.note ?? undefined}
              >
                <Litres value={sale.litres} className="text-left" />
              </SummaryFigure>
            ),
          },
          {
            label: t("summary.product"),
            value: (
              <SummaryFigure
                context={
                  sale.perLitre !== null
                    ? t("summary.perLitre", { amount: formatINR(sale.perLitre) })
                    : t("summary.amountOnly")
                }
              >
                {/* A NAME, not a figure — 18px Inter, never 20px mono. §5.3 */}
                <span className="block font-sans text-h4 font-semibold text-foreground">
                  {sale.productTitle ?? t("summary.noProduct")}
                </span>
              </SummaryFigure>
            ),
          },
          {
            label: t("summary.recorded"),
            value: (
              <SummaryFigure
                context={
                  sale.recordedByName
                    ? t("summary.recordedBy", { name: sale.recordedByName })
                    : undefined
                }
              >
                <span className="block text-base">
                  {formatDateTime(sale.soldAt, locale)}
                </span>
              </SummaryFigure>
            ),
          },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-h4 font-semibold text-foreground">
            {t("customer.title")}
          </h2>
          <dl className="mt-4 space-y-3">
            <CustomerField label={t("customer.name")} value={sale.customerName} />
            <CustomerField label={t("customer.phone")} value={sale.phone} mono />
            <CustomerField label={t("customer.address")} value={sale.address} />
            <CustomerField label={t("customer.note")} value={sale.note} />
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-h4 font-semibold text-foreground">
            {t("others.title")}
          </h2>
          {/* Names WHICH match was used, so an empty card is never mistaken for
              "this customer is new". §5.3 */}
          {sale.matchedOn && (
            <p className="mt-1 text-caption text-muted-foreground">
              {sale.matchedOn === "phone"
                ? t("others.matchedPhone", { phone: sale.phone ?? "" })
                : t("others.matchedName", { name: sale.customerName })}
            </p>
          )}

          {sale.siblings.length === 0 ? (
            <div className="flex min-h-45 flex-col items-center justify-center text-center">
              {sale.matchedOn === null || sale.matchedOn === "name" ? (
                <SearchX className="size-12 text-muted-foreground/60" aria-hidden />
              ) : (
                <UserPlus className="size-12 text-muted-foreground/60" aria-hidden />
              )}
              <h3 className="mt-4 text-h4 font-semibold text-foreground">
                {sale.matchedOn === "phone"
                  ? t("others.firstVisit.title")
                  : t("others.unmatchable.title")}
              </h3>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                {sale.matchedOn === "phone"
                  ? t("others.firstVisit.body")
                  : t("others.unmatchable.body")}
              </p>
            </div>
          ) : (
            <>
              <ul className="mt-4">
                {sale.siblings.map((sibling) => (
                  <li key={sibling.id}>
                    <Link
                      href={directSalePaths.detail(sibling.id)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 border-b border-border py-2 text-sm",
                        "transition-colors duration-100 hover:bg-muted",
                        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                        sibling.isVoided && "opacity-60",
                      )}
                    >
                      <span className="w-26 shrink-0 font-mono text-[13px] font-medium text-primary">
                        {sibling.code}
                      </span>
                      <span className="flex-1 text-muted-foreground">
                        {formatDate(sibling.saleDate, locale)}
                      </span>
                      <Litres value={sibling.litres} className="w-16" />
                      <Money
                        value={sibling.amount}
                        emphasis
                        className={cn(
                          "w-24",
                          sibling.isVoided && "line-through text-muted-foreground",
                        )}
                      />
                      {sibling.isVoided && (
                        <Ban className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="flex items-center justify-between gap-3 pt-3 text-sm">
                <span className="font-semibold text-foreground">
                  {t("others.earlier", { count: sale.siblingCount })}
                </span>
                <Money value={sale.siblingTotal} emphasis />
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}

/** A figure with its one-line explanation. */
function SummaryFigure({
  context,
  children,
}: {
  context?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="block">
      {children}
      {context && (
        <span className="mt-1 block font-sans text-caption font-normal text-muted-foreground">
          {context}
        </span>
      )}
    </span>
  );
}

function CustomerField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <dt className="w-25 shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("min-w-0 text-base text-foreground", mono && "font-mono")}>
        {/* Never blank, never `null`, never `N/A`. §5.3 */}
        {value ?? <span className="text-muted-foreground/60">—</span>}
      </dd>
    </div>
  );
}

/**
 * A 404 that helps.
 *
 * Not `notFound()` from next/navigation: the global 404 says nothing about
 * walk-in sales and offers no way back into the list, which is where the
 * answer almost always is.
 */
async function DirectSaleNotFound() {
  const t = await getTranslations("directSales");

  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <SearchX className="size-12 text-muted-foreground/60" aria-hidden />

      <h1 className="mt-4 text-h4 font-semibold text-foreground">
        {t("detail.notFound.title")}
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        {t("detail.notFound.body")}
      </p>

      <Button asChild className="mt-4">
        <Link href={directSalePaths.list}>{t("detail.notFound.cta")}</Link>
      </Button>
    </div>
  );
}
