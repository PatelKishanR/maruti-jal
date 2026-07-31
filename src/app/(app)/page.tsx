import { getTranslations } from "next-intl/server";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import type { DashboardSummaryDto } from "@/lib/dto/dashboard.dto";

export const runtime = "nodejs";

/**
 * Dashboard placeholder.
 *
 * Fetches through the API like every other screen — no service import, no
 * repository, no DataSource. Replaced by the real dashboard in Phase 8.
 */
export default async function DashboardPage() {
  const t = await getTranslations();

  const summary = await api.get<DashboardSummaryDto>(
    apiRoutes.dashboard.summary("today"),
  );

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
      />

      <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <LayoutDashboard
          className="size-12 text-muted-foreground/40"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="mt-4 text-h4 font-semibold text-foreground">
          {t("dashboard.title")}
        </p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {t("dashboard.comingSoon")}
        </p>

        {/* Proof the full path works: page → API → service → repository → Neon. */}
        <p className="mt-6 text-xs text-muted-foreground">
          API connected · <span className="figure">{summary.accountCount}</span>{" "}
          account{summary.accountCount === 1 ? "" : "s"} ·{" "}
          <span className="figure">{summary.pendingModules.length}</span> modules
          pending
        </p>
      </Card>
    </>
  );
}
