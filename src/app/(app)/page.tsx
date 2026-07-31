import { getTranslations } from "next-intl/server";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { countAccounts } from "@/lib/services/auth.service";

export const runtime = "nodejs";

/**
 * Dashboard placeholder.
 *
 * It reads from the database on purpose: Phase 0's exit criteria require a
 * page that proves the full TypeORM path works in dev AND in a production
 * build. Replaced by the real dashboard in Phase 8.
 */
export default async function DashboardPage() {
  const t = await getTranslations();

  const accountCount = await countAccounts();

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

        {/* Phase 0 proof: this number came out of Postgres via TypeORM. */}
        <p className="mt-6 text-xs text-muted-foreground">
          Database connected ·{" "}
          <span className="figure">{accountCount}</span> account
          {accountCount === 1 ? "" : "s"}
        </p>
      </Card>
    </>
  );
}
