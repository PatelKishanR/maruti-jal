import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatINR, formatQuantity } from "@/lib/money";
import type { CoinIssueListResponseDto } from "@/lib/dto/coin-issue.dto";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard, KpiRow } from "@/components/common/kpi-card";
import { ErrorState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { CoinDriftBanner } from "../coin-drift-banner";
import { CoinIssuesTable } from "./coin-issues-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The coin issue register — the module's main working screen.
 * Spec: .claude/design/MODULES/04-coins.md §6
 *
 * Reads through `lib/api/client`, like every other screen: no page in this app
 * imports a service, a repository or the DataSource.
 * See .claude/ARCHITECTURE.md §4.1 rule 1
 *
 * The list, its KPI strip and the §13 drift check arrive in ONE payload, so the
 * strip can never render a beat behind the table it describes — or, worse,
 * disagree with it.
 */
export default async function CoinIssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("coins.issues");
  const params = await searchParams;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) query.set(key, single);
  }
  const queryString = query.toString();

  let data: CoinIssueListResponseDto;
  try {
    data = await api.get<CoinIssueListResponseDto>(
      `/api/coin-issues${queryString ? `?${queryString}` : ""}`,
    );
  } catch {
    // Plain language, no stack trace: the owner needs to know his data is
    // untouched, not what the exception was. DESIGN-STANDARDS §5.6
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <ErrorState title={t("error.title")} description={t("error.body")} />
        </div>
      </>
    );
  }

  const { summary } = data;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/coins/issues/new">
              <Plus aria-hidden />
              {t("new")}
            </Link>
          </Button>
        }
      />

      {/* Non-dismissible, and above the KPIs: the owner must know the ledger
          disagrees with itself BEFORE he reads a single figure below. §13.3 */}
      <CoinDriftBanner drift={data.drift} />

      {/* Every number is a door — each card lands on the list it describes. */}
      <KpiRow className="mb-8">
        <KpiCard
          label={t("kpi.openIssues")}
          icon="coin"
          value={summary.openIssues}
          format="count"
          href="/coins/issues?status=pending"
          breakdown={t("kpi.openIssuesBreakdown", {
            total: formatQuantity(summary.totalIssues),
          })}
          zeroHint={t("kpi.nothingOpen")}
        />
        <KpiCard
          label={t("kpi.coinsOut")}
          icon="staff"
          value={summary.coinsOutWithStaff}
          format="count"
          href="/coins/issues?status=pending"
          breakdown={t("kpi.coinsOutBreakdown", {
            staff: formatQuantity(summary.staffWithCoins),
          })}
          zeroHint={t("kpi.nothingOut")}
        />
        {/* Outstanding money is the one card where UP is bad news, which is why
            it takes the alert variant above ₹5,000. Design §6.3 */}
        <KpiCard
          label={t("kpi.pending")}
          icon="rupee"
          value={summary.pendingAmount}
          format="money"
          href="/coins/issues?status=partial"
          variant={summary.pendingAmount > PENDING_ALERT_LIMIT ? "alert" : "default"}
          invertTrend
          zeroHint={t("kpi.nothingPending")}
        />
        <KpiCard
          label={t("kpi.refundsDue")}
          icon="refund"
          value={summary.refundsDueAmount}
          format="money"
          href="/coins/issues?status=refund_due"
          breakdown={t("kpi.refundsDueBreakdown", {
            staff: formatQuantity(summary.staffWithRefunds),
            amount: formatINR(summary.refundsDueAmount),
          })}
          zeroHint={t("kpi.noRefunds")}
        />
      </KpiRow>

      <CoinIssuesTable result={data} />
    </>
  );
}

/**
 * Above this, `PENDING` turns red. Design §6.3 states the figure literally;
 * it lives here rather than in the service because it is a display threshold,
 * not a business rule — nothing behaves differently either side of it.
 */
const PENDING_ALERT_LIMIT = 5000;
