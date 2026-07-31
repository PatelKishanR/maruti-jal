import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, Pencil } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type { ListResult } from "@/lib/table/types";
import type {
  CoinTypeDetailDto,
  LedgerEntryDto,
} from "@/lib/dto/coin-type.dto";
import { DetailSummary } from "@/components/common/detail-summary";
import { StatusBadge } from "@/components/common/status-badge";
import { Money, Quantity } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import { ColourDot, formatPerCoinValue, StockPackets } from "../coin-figures";
import { CoinTypeLedger } from "./coin-type-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Coin type detail + ledger. Spec: design MODULES/04-coins §5
 *
 * The detail and the first ledger page are fetched together so the
 * reconciliation band, which never depends on the ledger's filters, renders
 * with the page rather than a beat after it.
 */
export default async function CoinTypeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const t = await getTranslations("coins.types");
  const locale = (await getLocale()) as Locale;

  const query = new URLSearchParams();
  for (const key of ["page", "pageSize", "movement", "from", "to"]) {
    const value = search[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) query.set(key, single);
  }
  const queryString = query.toString();

  let coinType: CoinTypeDetailDto;
  let ledger: ListResult<LedgerEntryDto>;
  try {
    [coinType, ledger] = await Promise.all([
      api.get<CoinTypeDetailDto>(`/api/coin-types/${id}`),
      api.get<ListResult<LedgerEntryDto>>(
        `/api/coin-types/${id}/ledger${queryString ? `?${queryString}` : ""}`,
      ),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <Link
        href="/coins/types"
        className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("detail.back")}
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-h2 font-semibold text-foreground">
            <ColourDot colour={coinType.colourHex} size={12} />
            <span className="truncate">{coinType.name}</span>
            <StatusBadge status={coinType.isActive ? "active" : "inactive"} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("detail.meta", {
              coinsPerPacket: formatQuantity(coinType.coinsPerPacket),
              packetAmount: formatINR(coinType.packetAmount),
              perCoin: formatPerCoinValue(coinType.perCoinPrice),
              created: formatDate(coinType.createdAt.slice(0, 10), locale),
            })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/coins/types/${coinType.id}/edit`}>
              <Pencil aria-hidden />
              {t("detail.editAction")}
            </Link>
          </Button>
        </div>
      </div>

      {/* One figure carries the weight — the coins in the store room is what
          the owner opened this page to check. DESIGN-STANDARDS §9 */}
      <DetailSummary
        items={[
          {
            label: t("detail.summary.stockCoins"),
            value: <Quantity value={coinType.balanceCoins} emphasis zeroAs="dash" />,
            emphasis: true,
          },
          {
            label: t("detail.summary.stockPackets"),
            value: (
              <StockPackets
                coins={coinType.balanceCoins}
                coinsPerPacket={coinType.coinsPerPacket}
              />
            ),
          },
          {
            label: t("detail.summary.stockValue"),
            value: <Money value={coinType.stockValue} />,
          },
          {
            // TODO(wave-3): aggregated from coin_issues once they exist.
            label: t("detail.summary.outWithStaff"),
            value: (
              <Quantity value={coinType.coinsOutWithStaff} zeroAs="dash" />
            ),
          },
        ]}
      />

      <CoinTypeLedger coinType={coinType} ledger={ledger} />
    </>
  );
}
