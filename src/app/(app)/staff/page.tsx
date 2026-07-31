import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PackageX, Plus, UserCheck, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard, KpiRow } from "@/components/common/kpi-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { staffPaths, staffRoutes } from "@/lib/api/routes.staff";
import type { StaffListDto } from "@/lib/dto/staff.dto";
import { StaffTable } from "./staff-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staff list. Spec: design/MODULES/01-staff.md §3
 *
 * A server component that fetches through `lib/api/client` like every other
 * screen — cookies forwarded, no service import, no repository, no DataSource.
 * See ARCHITECTURE §4.1 rule 1
 */
export default async function StaffListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("staff");

  // Reads the URL, so it re-runs per request. Table state lives in the URL:
  // shareable, bookmarkable, back-button-safe.
  const { result, stats } = await api.get<StaffListDto>(
    staffRoutes.list(params),
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button asChild>
            <Link href={staffPaths.new}>
              <Plus aria-hidden />
              {t("actions.add")}
            </Link>
          </Button>
        }
      />

      {/* Every number is a door: each card lands on the list it describes. §8 */}
      <KpiRow className="mb-6">
        <KpiCard
          label={t("kpi.total")}
          icon="staff"
          value={stats.totalStaff}
          format="count"
          href={staffPaths.all}
          breakdown={
            stats.inactiveStaff > 0
              ? t("kpi.totalBreakdown", { count: stats.inactiveStaff })
              : undefined
          }
          zeroHint={t("kpi.totalZero")}
        />

        <KpiCard
          label={t("kpi.active")}
          icon="staffActive"
          value={stats.activeStaff}
          format="count"
          href={staffPaths.active}
          breakdown={
            stats.totalStaff > 0
              ? t("kpi.activeBreakdown", {
                  percent: Math.round(
                    (stats.activeStaff / stats.totalStaff) * 100,
                  ),
                })
              : undefined
          }
          zeroHint={t("kpi.activeZero")}
        />

        <KpiCard
          label={t("kpi.cash")}
          icon="cash"
          value={stats.cashOutstanding}
          format="money"
          href={staffPaths.withBalance}
          // Money owed is always a problem — the alert border says so before
          // the figure is read. §3.3
          variant={stats.cashOutstanding > 0 ? "alert" : "default"}
          breakdown={
            stats.cashOutstanding > 0
              ? t("kpi.cashBreakdown", { count: stats.staffWithBalance })
              : undefined
          }
          zeroHint={t("kpi.cashZero")}
        />

        <KpiCard
          label={t("kpi.jars")}
          icon="jarsOut"
          value={stats.jarsOut}
          format="count"
          href={staffPaths.withJars}
          variant={stats.jarsOut > 0 ? "alert" : "default"}
          breakdown={
            stats.jarsOut > 0
              ? t("kpi.jarsBreakdown", { count: stats.staffWithJars })
              : undefined
          }
          zeroHint={t("kpi.jarsZero")}
        />
      </KpiRow>

      <StaffTable result={result} totalStaff={stats.totalStaff} />
    </>
  );
}
