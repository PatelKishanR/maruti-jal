import { getTranslations } from "next-intl/server";
import { api } from "@/lib/api/client";
import type { CoinAdjustmentListResponseDto } from "@/lib/dto/coin-adjustment.dto";
import type { CoinTypeListResponseDto } from "@/lib/dto/coin-type.dto";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/empty-state";
import { CoinAdjustmentsTable } from "./coin-adjustments-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stock adjustments. Spec: .claude/design/MODULES/04-coins.md §11
 *
 * There is deliberately NO KPI strip here. An adjustment total is a number
 * nobody should watch go up: the point of the screen is that each individual
 * correction carries a readable reason, and a headline figure would invite
 * exactly the summarising this register exists to prevent.
 *
 * Active coin types are fetched alongside so the new-adjustment modal opens
 * instantly with its picker, its per-coin rate and its live "new balance"
 * already populated. §12.3
 */
export default async function CoinAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("coins.adjustments");
  const params = await searchParams;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) query.set(key, single);
  }
  const queryString = query.toString();

  let data: CoinAdjustmentListResponseDto;
  let coinTypes: CoinTypeListResponseDto;
  try {
    [data, coinTypes] = await Promise.all([
      api.get<CoinAdjustmentListResponseDto>(
        `/api/coin-adjustments${queryString ? `?${queryString}` : ""}`,
      ),
      api.get<CoinTypeListResponseDto>(
        "/api/coin-types?status=active&pageSize=100",
      ),
    ]);
  } catch {
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <ErrorState title={t("error.title")} description={t("error.body")} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* No drift banner here on purpose. §13.3 places it on the coin type
          list, the coin type detail and the issue register — the three screens
          whose figures the owner acts on. This one is a history of corrections
          already made, and a banner on it would warn about a decision he has
          no way to take from this page. */}
      <CoinAdjustmentsTable result={data} coinTypes={coinTypes.rows} />
    </>
  );
}
