import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, Info } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { DetailSummary } from "@/components/common/detail-summary";
import { Money, Quantity } from "@/components/common/money";
import { api } from "@/lib/api/client";
import { staffPaths, staffRoutes } from "@/lib/api/routes.staff";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/i18n/config";
import type { StaffDetailDto } from "@/lib/dto/staff.dto";
import { StaffActions, StaffReactivateLink } from "../staff-actions";
import { StaffStatusBadges } from "../staff-badges";
import { StaffDetailTabs } from "./staff-detail-tabs";
import { isNotFound, StaffNotFound } from "./staff-not-found";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staff detail. Spec: design/MODULES/01-staff.md §4
 *
 * Everything about one delivery person: what they owe, what they are holding,
 * and the records behind those figures. The four summary figures sit above the
 * tabs so they stay on screen whichever tab is open.
 */
export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("staff");
  const locale = (await getLocale()) as Locale;

  let staff: StaffDetailDto;
  try {
    staff = await api.get<StaffDetailDto>(staffRoutes.detail(id));
  } catch (error) {
    if (isNotFound(error)) return <StaffNotFound />;
    throw error;
  }

  const meta = [
    staff.code,
    staff.phone,
    staff.joinedOn
      ? t("detail.joined", { date: formatDate(staff.joinedOn, locale) })
      : null,
    staff.isActive ? t("filters.status.active") : t("filters.status.inactive"),
  ].filter(Boolean);

  return (
    <>
      <Link
        href={staffPaths.list}
        className="inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sans, not mono — a person's name is not a document code. §4.3 */}
            <h1 className="text-h2 font-semibold text-foreground">
              {staff.name}
            </h1>
            <StaffStatusBadges staff={staff} />
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono text-[13px]">{meta[0]}</span>
            {meta.slice(1).map((part) => (
              <span key={String(part)}> · {part}</span>
            ))}
          </p>
        </div>

        <div className="shrink-0">
          <StaffActions staff={staff} variant="detail" />
        </div>
      </div>

      {!staff.isActive && (
        <Alert icon={<Info aria-hidden />} className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("detail.inactiveBanner")}</span>
            <StaffReactivateLink staffId={staff.id} name={staff.name} />
          </div>
        </Alert>
      )}

      {/* Every figure is a door into the tab that explains it. §4.3 */}
      <DetailSummary
        className="mt-8"
        items={[
          {
            label: t("summary.cash"),
            emphasis: true,
            value: (
              <SummaryFigure
                href={`${staffPaths.detail(staff.id)}?tab=payments`}
                context={t("summary.cashContext", {
                  count: staff.openOrderCount,
                })}
              >
                <Money value={staff.cashOutstanding} emphasis className="text-left" />
              </SummaryFigure>
            ),
          },
          {
            label: t("summary.jars"),
            value: (
              <SummaryFigure
                href={`${staffPaths.detail(staff.id)}?tab=orders`}
                context={t("summary.jarsContext", { total: staff.jarsTotal })}
              >
                <Quantity value={staff.jarsOut} className="text-left" />
              </SummaryFigure>
            ),
          },
          {
            label: t("summary.coins"),
            value: (
              <SummaryFigure
                href={`${staffPaths.detail(staff.id)}?tab=coins`}
                context={t("summary.coinsContext", {
                  count: staff.openIssueCount,
                })}
              >
                <Money value={staff.coinDues} className="text-left" />
              </SummaryFigure>
            ),
          },
          {
            label: t("summary.revenue"),
            value: (
              <SummaryFigure
                context={
                  staff.joinedOn
                    ? t("summary.revenueContext", {
                        date: formatDate(staff.joinedOn, locale),
                      })
                    : undefined
                }
              >
                <Money value={staff.lifetimeRevenue} className="text-left" />
              </SummaryFigure>
            ),
          },
        ]}
      />

      <StaffDetailTabs staff={staff} />
    </>
  );
}

/** A figure with its one-line explanation, optionally linked to its tab. */
function SummaryFigure({
  href,
  context,
  children,
}: {
  href?: string;
  context?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="block">
      {href ? (
        <Link
          href={href}
          className="block w-fit hover:text-primary hover:underline"
        >
          {children}
        </Link>
      ) : (
        children
      )}
      {context && (
        <span className="mt-1 block font-sans text-caption font-normal text-muted-foreground">
          {context}
        </span>
      )}
    </span>
  );
}
