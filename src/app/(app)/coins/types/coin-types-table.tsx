"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  BookOpen,
  Coins,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
} from "lucide-react";
import { DataTable, useTableParams } from "@/components/data-table";
import type { DataTableColumn, QuickChip } from "@/components/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Money, Quantity } from "@/components/common/money";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api/client";
import { formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  CoinTypeListItemDto,
  CoinTypeListResponseDto,
  DeactivateBlocker,
} from "@/lib/dto/coin-type.dto";
import { ColourDot, PerCoinValue, StockPackets } from "./coin-figures";

/**
 * The stock table. Spec: design MODULES/04-coins §3.3
 *
 * Stock is shown BOTH ways on every row — `2,440` and `24 packets + 40 coins`
 * — because the ledger counts coins and the owner counts packets, and asking
 * him to divide in his head is how a miscount gets recorded.
 *
 * Talks to the API only. See .claude/ARCHITECTURE.md §4.1 rule 1
 */
export function CoinTypesTable({ result }: { result: CoinTypeListResponseDto }) {
  const t = useTranslations("coins.types");
  const tRoot = useTranslations();
  const router = useRouter();
  const { clearAll, get } = useTableParams();

  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<CoinTypeListItemDto | null>(null);

  /**
   * The reasons are itemised, not summarised. "Can't deactivate" tells the
   * owner nothing he can act on; "2,440 coins are still in stock" does.
   */
  function reportBlocked(error: ApiError) {
    const reasons = (error.meta?.reasons as DeactivateBlocker[] | undefined) ?? [];
    toast.error(t("errors.cannotDeactivate"), {
      description: reasons
        .map((reason) =>
          tRoot(reason.key, { coins: formatQuantity(reason.coins) }),
        )
        .join(" · "),
    });
  }

  async function deactivate(row: CoinTypeListItemDto) {
    try {
      await api.del(`/api/coin-types/${row.id}`);
      toast.success(t("deactivate.success", { name: row.name }));
      startTransition(() => router.refresh());
    } catch (error) {
      if (error instanceof ApiError && error.code === "CONFLICT") {
        reportBlocked(error);
        return;
      }
      toast.error(tRoot("common.somethingWentWrong"));
    }
  }

  async function reactivate(row: CoinTypeListItemDto) {
    try {
      await api.post(`/api/coin-types/${row.id}/reactivate`);
      toast.success(t("reactivate.success", { name: row.name }));
      startTransition(() => router.refresh());
    } catch {
      toast.error(tRoot("common.somethingWentWrong"));
    }
  }

  const columns: DataTableColumn<CoinTypeListItemDto>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortKey: "name",
      width: "220px",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ColourDot colour={row.colourHex} />
          <span className="truncate font-medium text-foreground">{row.name}</span>
        </span>
      ),
    },
    {
      id: "coinsPerPacket",
      header: t("columns.coinsPerPacket"),
      sortKey: "coinsPerPacket",
      align: "right",
      width: "110px",
      hideOnMobile: true,
      cell: (row) => <Quantity value={row.coinsPerPacket} />,
    },
    {
      id: "packetAmount",
      header: t("columns.packetAmount"),
      sortKey: "packetAmount",
      align: "right",
      width: "130px",
      hideOnMobile: true,
      cell: (row) => <Money value={row.packetAmount} zeroAs="value" />,
    },
    {
      id: "perCoinPrice",
      header: t("columns.perCoinPrice"),
      sortKey: "perCoinPrice",
      align: "right",
      width: "140px",
      hideOnMobile: true,
      // Six decimals, always. ₹500 across 45 coins is ₹11.111111, and rounding
      // that to ₹11.11 on the master screen is how the five-paise gap of §8.2
      // becomes invisible. MODULES/04-coins.md §8.2
      cell: (row) => <PerCoinValue value={row.perCoinPrice} />,
    },
    {
      id: "balanceCoins",
      header: t("columns.stockCoins"),
      sortKey: "balanceCoins",
      align: "right",
      width: "120px",
      cell: (row) => (
        <Link
          href={`/coins/types/${row.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-end gap-1 hover:text-primary hover:underline"
        >
          <Quantity
            value={row.balanceCoins}
            emphasis
            zeroAs="dash"
            className={cn(row.lowStock && "text-[var(--badge-warning-fg)]")}
          />
        </Link>
      ),
    },
    {
      id: "stockPackets",
      header: t("columns.stockPackets"),
      align: "right",
      width: "180px",
      hideOnMobile: true,
      cell: (row) => (
        <span className="inline-flex items-center justify-end gap-2">
          <StockPackets
            coins={row.balanceCoins}
            coinsPerPacket={row.coinsPerPacket}
          />
          {row.lowStock && (
            <Badge variant="warning" icon={<AlertTriangle aria-hidden />}>
              {t("stock.low")}
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "stockValue",
      header: t("columns.stockValue"),
      align: "right",
      width: "130px",
      hideOnMobile: true,
      cell: (row) => <Money value={row.stockValue} />,
    },
    {
      id: "status",
      header: t("columns.status"),
      align: "center",
      width: "110px",
      // Zero stock is a FACT, not an inactive state — the row is never dimmed
      // for it. Only `isActive` drives this badge. Design §3.5
      cell: (row) => (
        <StatusBadge status={row.isActive ? "active" : "inactive"} />
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "center",
      width: "56px",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={t("actions.rowMenu", { name: row.name })}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem asChild>
              <Link href={`/coins/types/${row.id}`}>
                <BookOpen aria-hidden />
                {t("actions.viewLedger")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/coins/types/${row.id}/edit`}>
                <Pencil aria-hidden />
                {t("actions.edit")}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {row.isActive ? (
              <DropdownMenuItem
                destructive
                onSelect={() => setConfirming(row)}
              >
                <PowerOff aria-hidden />
                {t("actions.deactivate")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => void reactivate(row)}>
                <Power aria-hidden />
                {t("actions.reactivate")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const quickChips: QuickChip[] = [
    { id: "active", label: t("chips.active"), params: { status: "active" } },
    { id: "inactive", label: t("chips.inactive"), params: { status: "inactive" } },
  ];

  const activeFilters = [
    get("status") === "active" ? t("chips.active") : undefined,
    get("status") === "inactive" ? t("chips.inactive") : undefined,
    get("q") ? `${t("searchPlaceholder")}: ${get("q")}` : undefined,
  ].filter((v): v is string => !!v);

  return (
    <>
      <DataTable
        columns={columns}
        result={result}
        rowKey={(row) => row.id}
        // The owner comes here to read a ledger, so the row opens on it. §3.6
        rowHref={(row) => `/coins/types/${row.id}`}
        searchPlaceholder={t("searchPlaceholder")}
        quickChips={quickChips}
        emptyState={
          <EmptyState
            icon={Coins}
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              <Button asChild>
                <Link href="/coins/types/new">
                  <Plus aria-hidden />
                  {t("new")}
                </Link>
              </Button>
            }
          />
        }
        noResultsState={
          <EmptyState
            variant="no-results"
            title={t("noResults.title")}
            filters={activeFilters}
            onClearFilters={clearAll}
          />
        }
        mobileCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <ColourDot colour={row.colourHex} />
                <span className="truncate font-medium text-foreground">
                  {row.name}
                </span>
              </span>
              <StatusBadge status={row.isActive ? "active" : "inactive"} />
            </div>

            <p className="text-xs text-muted-foreground">
              {t("mobileMeta", {
                coinsPerPacket: formatQuantity(row.coinsPerPacket),
              })}{" "}
              · <PerCoinValue value={row.perCoinPrice} />
            </p>

            <StockPackets
              coins={row.balanceCoins}
              coinsPerPacket={row.coinsPerPacket}
            />

            <div className="flex items-baseline justify-between gap-3">
              <Quantity value={row.balanceCoins} emphasis zeroAs="dash" />
              <Money value={row.stockValue} />
            </div>
          </div>
        )}
      />

      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={t("deactivate.title", { name: confirming.name })}
          description={t("deactivate.body")}
          confirmLabel={t("deactivate.confirm")}
          onConfirm={() => deactivate(confirming)}
        />
      )}
    </>
  );
}
