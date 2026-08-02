import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { APP_ICONS } from "@/components/common/icons";
import { api, ApiError } from "@/lib/api/client";
import { reportRoutes, reportPaths } from "@/lib/api/routes.report";
import { formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import { REPORT_DEFINITIONS, type ReportSlug } from "@/lib/validation/report";
import type { ReportIndexDto } from "@/lib/dto/report.dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The report launcher. Spec: design/MODULES/09-reports.md §3
 *
 * SEVEN FIXED REPORTS, NOT A BUILDER. The index exists so the owner picks by
 * QUESTION rather than by name — "Everything one staff member owes" is found
 * faster than "Statement" — so every card leads with what it answers and states
 * which filters it will ask for BEFORE it is clicked.
 *
 * THE ALERT FOOTER IS WHAT STOPS THIS BEING A MENU. Coin reconciliation and jar
 * reconciliation surface their own bad news here, so the owner opens the report
 * because the card told him to, not because he remembered to. §3.3
 *
 * A failed alert fetch renders the cards WITHOUT footers and shows no error
 * banner: a missing last-run line is not worth an alarm, and the seven reports
 * still work. §3.5
 */
export default async function ReportsIndexPage() {
  const t = await getTranslations("reports");

  let index: ReportIndexDto | null = null;
  try {
    index = await api.get<ReportIndexDto>(reportRoutes.index);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }

  return (
    <>
      <PageHeader title={t("index.title")} subtitle={t("index.subtitle")} />

      {/* 3 columns on xl, 2 on lg and md, 1 below. Equal heights, 24px gap. §3.3 */}
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {reportPaths.all.map((slug) => (
          <ReportCard key={slug} slug={slug} index={index} />
        ))}
      </div>
    </>
  );
}

async function ReportCard({
  slug,
  index,
}: {
  slug: ReportSlug;
  index: ReportIndexDto | null;
}) {
  const t = await getTranslations("reports");
  const definition = REPORT_DEFINITIONS[slug];
  const Icon = APP_ICONS[definition.icon];

  /**
   * The two reports that carry their own bad news.
   *
   * Deliberately not a generic mechanism: only these two have a condition the
   * owner must be told about before opening anything, and inventing footers for
   * the other five would turn a signal back into decoration. §3.3
   */
  const alert =
    index === null
      ? null
      : slug === "coin-reconciliation" && index.alerts.coinTypesNotTying > 0
        ? t("index.alerts.coinsNotTying", {
            count: formatQuantity(index.alerts.coinTypesNotTying),
            total: formatQuantity(index.alerts.coinTypesTotal),
          })
        : slug === "jar-reconciliation" && index.alerts.jarsOverdue > 0
          ? t("index.alerts.jarsOverdue", {
              jars: formatQuantity(index.alerts.jarsOverdue),
              staff: formatQuantity(index.alerts.jarsOverdueStaff),
            })
          : null;

  return (
    <Link
      href={reportPaths.report(slug)}
      className={cn(
        "group flex min-h-37 flex-col rounded-lg border border-border bg-card p-6 shadow-sm md:min-h-45",
        // Cards never lift; the border turning Nova Blue is the whole hover. §3.3
        "transition-colors duration-100 hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Icon className="size-6 shrink-0 text-primary" aria-hidden />
        {definition.printable ? (
          <span className="rounded-full bg-(--badge-primary-bg) px-2 py-0.5 text-caption font-medium text-(--badge-primary-fg)">
            {t("index.pdfBadge")}
          </span>
        ) : null}
      </div>

      {/* Gujarati titles run 25–40% longer, so the card grows rather than
          clipping — no fixed height anywhere on this grid. §3.4 */}
      <h2 className="mt-3 text-h4 font-semibold text-foreground">
        {t(`${slug}.title`)}
      </h2>
      <p className="mt-1 text-body-sm leading-relaxed text-muted-foreground">
        {t(`${slug}.description`)}
      </p>

      <p className="mt-auto pt-4 text-caption text-muted-foreground">
        {t(`${slug}.filterHint`)}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        {alert ? (
          <span className="flex items-center gap-1.5 text-caption font-medium text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            {alert}
          </span>
        ) : (
          <span className="text-caption text-muted-foreground">
            {index ? t("index.ready") : ""}
          </span>
        )}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </div>
    </Link>
  );
}

