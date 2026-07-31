import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Coins, IndianRupee, Plus, Users } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatINR, formatQuantity } from "@/lib/money";
import type { CoinTypeListResponseDto } from "@/lib/dto/coin-type.dto";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard, KpiRow } from "@/components/common/kpi-card";
import { ErrorState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { CoinTypesTable } from "./coin-types-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Coin type list — the float at a glance.
 * Spec: .claude/design/MODULES/04-coins.md §3
 *
 * Reads through `lib/api/client`, like every other screen: no page in this app
 * imports a service, a repository or the DataSource.
 * See .claude/ARCHITECTURE.md §4.1 rule 1
 */
export default async function CoinTypesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("coins.types");
  const params = await searchParams;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) query.set(key, single);
  }

  const queryString = query.toString();

  let data: CoinTypeListResponseDto;
  try {
    data = await api.get<CoinTypeListResponseDto>(
      `/api/coin-types${queryString ? `?${queryString}` : ""}`,
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
            <Link href="/coins/types/new">
              <Plus aria-hidden />
              {t("new")}
            </Link>
          </Button>
        }
      />

      {/* Every number is a door — each card lands on the list it describes. §1.4 */}
      <KpiRow className="mb-8">
        <KpiCard
          label={t("kpi.count")}
          icon={Coins}
          value={summary.total}
          format="count"
          href="/coins/types"
          breakdown={t("kpi.countBreakdown", {
            active: formatQuantity(summary.active),
            inactive: formatQuantity(summary.inactive),
          })}
          zeroHint={t("kpi.noneYet")}
        />
        <KpiCard
          label={t("kpi.coinsInStock")}
          icon={Coins}
          value={summary.coinsInStock}
          format="count"
          href="/coins/types?sort=balanceCoins&dir=desc"
          breakdown={
            summary.looseCoinsInStock > 0
              ? t("stock.packetsPlusCoinsPlain", {
                  packets: formatQuantity(summary.packetsInStock),
                  coins: formatQuantity(summary.looseCoinsInStock),
                })
              : t("stock.packetsPlain", {
                  packets: formatQuantity(summary.packetsInStock),
                })
          }
          zeroHint={t("kpi.noStockYet")}
        />
        <KpiCard
          label={t("kpi.valueInStock")}
          icon={IndianRupee}
          value={summary.valueInStock}
          format="money"
          href="/coins/types?sort=balanceCoins&dir=desc"
          breakdown={t("kpi.valueBreakdown", {
            count: formatQuantity(summary.total),
          })}
          zeroHint={t("kpi.noStockYet")}
        />
        {/* TODO(wave-3): coin issues supply both figures and the href. Until
            then the card states zero honestly rather than linking nowhere. */}
        <KpiCard
          label={t("kpi.outWithStaff")}
          icon={Users}
          value={summary.coinsOutWithStaff}
          format="count"
          breakdown={t("kpi.outWithStaffBreakdown", {
            amount: formatINR(summary.valueOutWithStaff),
          })}
          zeroHint={t("kpi.nothingOut")}
        />
      </KpiRow>

      <CoinTypesTable result={data} />
    </>
  );
}
