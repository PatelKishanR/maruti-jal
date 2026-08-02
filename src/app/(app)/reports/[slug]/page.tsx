import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PartyPopper, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { reportRoutes } from "@/lib/api/routes.report";
import { formatDate, formatDateRange, formatDateTime } from "@/lib/dates";
import {
  isReportSlug,
  REPORT_DEFINITIONS,
  reportQuerySchema,
  resolveReportFilters,
} from "@/lib/validation/report";
import type { Locale } from "@/i18n/config";
import type { ReportResultDto } from "@/lib/dto/report.dto";
import { ExportBar, PrintButton } from "../export-bar";
import { ReportFilters } from "../report-filters";
import { ReportHeader, ReportPrompt } from "../report-shell";
import { DailyCollectionReport } from "./daily-collection";
import { StaffOutstandingReport } from "./staff-outstanding";
import { CoinReconciliationReport } from "./coin-reconciliation";
import { PartyStatementReport } from "./party-statement";
import { ProductMovementReport } from "./product-movement";
import { ProfitLossReport } from "./profit-loss";
import { JarReconciliationReport } from "./jar-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The shared report screen — Archetype E. Spec: design/MODULES/09-reports.md §4
 *
 * ONE SCREEN, SEVEN COLUMN DEFINITIONS. This file owns everything the seven
 * reports have in common — the header, the filter panel, the prompt state and
 * the export bar — and hands the middle to one component per slug. That is the
 * whole point of the archetype: an eighth report is a table definition, not a
 * design exercise.
 *
 * Fetched through `lib/api/client` like every other screen: no service import,
 * no repository, no DataSource. ARCHITECTURE §4.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!isReportSlug(slug)) notFound();

  const raw = await searchParams;
  const t = await getTranslations("reports");
  const locale = (await getLocale()) as Locale;
  const definition = REPORT_DEFINITIONS[slug];

  // A stale bookmark degrades to the report's defaults rather than 422-ing —
  // every member of the schema carries `.catch(undefined)`. MODULE-RECIPE §2.
  const query = reportQuerySchema.parse({
    preset: first(raw.preset),
    date: first(raw.date),
    from: first(raw.from),
    to: first(raw.to),
    staffId: first(raw.staffId),
    partyOrderId: first(raw.partyOrderId),
    coinTypeId: first(raw.coinTypeId),
    productIds: first(raw.productIds),
  });
  const filters = resolveReportFilters(slug, query);

  let report: ReportResultDto;
  try {
    report = await api.get<ReportResultDto>(reportRoutes.run(slug, raw));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // A missing subject is a 404 from the service — the record was deleted
    // between the link being copied and it being opened. Everything else is
    // rethrown to the segment's error boundary. MODULE-RECIPE §7.
    if (error.status === 404) notFound();
    throw error;
  }

  const { meta } = report;

  return (
    <>
      <ReportHeader
        title={t(`${slug}.title`)}
        subtitle={subtitle(report, locale, t)}
        backLabel={t("index.back")}
        actions={definition.printable ? <PrintButton /> : undefined}
      />

      <ReportFilters
        slug={slug}
        meta={meta}
        staffId={filters.staffId}
        partyOrderId={filters.partyOrderId}
        coinTypeId={filters.coinTypeId}
        productIds={filters.productIds}
      />

      {meta.awaitingSubject ? (
        <ReportPrompt
          icon={definition.requires === "staff" ? Users : PartyPopper}
          title={t(`${slug}.prompt.title`)}
          body={t(`${slug}.prompt.body`)}
        />
      ) : (
        <ReportBody report={report} />
      )}

      <ExportBar
        filters={filters}
        generatedAt={formatDateTime(meta.generatedAt, locale)}
        rowCount={meta.rowCount}
        printable={definition.printable}
        disabled={meta.awaitingSubject || meta.rowCount === 0}
      />
    </>
  );
}

/**
 * The switch is total on the slug union, so an eighth report is a compile error
 * here until it has a screen.
 */
function ReportBody({ report }: { report: ReportResultDto }) {
  switch (report.slug) {
    case "daily-collection":
      return <DailyCollectionReport report={report} />;
    case "staff-outstanding":
      return <StaffOutstandingReport report={report} />;
    case "coin-reconciliation":
      return <CoinReconciliationReport report={report} />;
    case "party-statement":
      return <PartyStatementReport report={report} />;
    case "product-movement":
      return <ProductMovementReport report={report} />;
    case "profit-loss":
      return <ProfitLossReport report={report} />;
    case "jar-reconciliation":
      return <JarReconciliationReport report={report} />;
  }
}

/**
 * `<what> <for whom> <over what period>` — the subtitle restates the applied
 * filters IN PROSE, so a screenshot of this screen is self-explanatory and a
 * printed copy cannot be mistaken for a different period. §4.4
 */
function subtitle(
  report: ReportResultDto,
  locale: Locale,
  t: Awaited<ReturnType<typeof getTranslations<"reports">>>,
): string {
  const { meta } = report;

  if (meta.awaitingSubject) return t(`${meta.slug}.subtitleEmpty`);

  const range = formatDateRange(meta.from, meta.to, locale);

  switch (report.slug) {
    case "daily-collection":
      return t("daily-collection.subtitle", {
        date: formatDate(meta.date, locale),
      });
    case "staff-outstanding":
      return t("staff-outstanding.subtitle", {
        name: report.staff?.name ?? "",
        date: formatDate(meta.to, locale),
      });
    case "party-statement":
      return t("party-statement.subtitle", {
        name: report.party?.name ?? "",
        code: report.party?.code ?? "",
        range,
      });
    default:
      return t(`${meta.slug}.subtitle`, { range });
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
