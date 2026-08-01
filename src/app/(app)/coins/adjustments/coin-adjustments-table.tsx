"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  DataTable,
  useTableParams,
  type DataTableColumn,
  type QuickChip,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { formatDate } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { AdjustmentReason } from "@/lib/db/entities/enums";
import type {
  CoinAdjustmentDto,
  CoinAdjustmentListResponseDto,
} from "@/lib/dto/coin-adjustment.dto";
import type { CoinTypeListItemDto } from "@/lib/dto/coin-type.dto";
import { COIN_ADJUSTMENT_FILTERS } from "@/lib/table/configs/coin-adjustment";
import { ColourDot } from "../types/coin-figures";
import { NewAdjustmentDialog } from "./new-adjustment-dialog";

/**
 * Every manual correction to stock, with its reason in the row.
 * Spec: design MODULES/04-coins §11
 *
 * The note is the SECOND LINE of every row rather than a detail-page field.
 * This screen exists so that a stock change without an explanation is
 * impossible to hide, and a reason you have to click to read is a reason nobody
 * reads. §11.3
 *
 * `COINS` is the one column in the app that always shows an explicit sign:
 * `+1,000` in green, `−50` in red. Direction is the entire point of an
 * adjustment, so it is never left to be inferred from a badge.
 */

/** Reason → badge variant. Loss reads Danger, gain Success, a recount Warning. */
const REASON_VARIANT: Record<
  AdjustmentReason,
  "default" | "primary" | "success" | "warning" | "danger"
> = {
  OPENING_STOCK: "default",
  MINTED: "success",
  PURCHASED: "success",
  LOST: "danger",
  DAMAGED: "danger",
  STOLEN: "danger",
  RECONCILIATION: "warning",
};

export function CoinAdjustmentsTable({
  result,
  coinTypes,
}: {
  result: CoinAdjustmentListResponseDto;
  /** Active types, for the new-adjustment modal's picker. */
  coinTypes: CoinTypeListItemDto[];
}) {
  const t = useTranslations("coins.adjustments");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { clearAll, get } = useTableParams();
  const [creating, setCreating] = useState(false);

  const columns: DataTableColumn<CoinAdjustmentDto>[] = [
    {
      id: "adjustmentDate",
      header: t("columns.date"),
      sortKey: "adjustmentDate",
      width: "120px",
      cell: (row) => (
        <span className="text-sm">{formatDate(row.adjustmentDate, locale)}</span>
      ),
    },
    {
      id: "coinType",
      header: t("columns.coinType"),
      width: "180px",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ColourDot colour={row.colourHex} />
          <span className="truncate font-medium text-foreground">
            {row.coinTypeName}
          </span>
        </span>
      ),
    },
    {
      id: "reason",
      header: t("columns.reason"),
      sortKey: "reason",
      width: "150px",
      cell: (row) => (
        <Badge variant={REASON_VARIANT[row.reason]}>
          {tRoot(`coins.adjustments.reasons.${row.reason}`)}
        </Badge>
      ),
    },
    {
      id: "coins",
      header: t("columns.coins"),
      sortKey: "coins",
      align: "right",
      width: "110px",
      cell: (row) => (
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            row.direction === "IN" ? "text-success" : "text-destructive",
          )}
        >
          {row.direction === "IN" ? "+" : "−"}
          {formatQuantity(row.coins)}
        </span>
      ),
    },
    {
      id: "value",
      header: t("columns.value"),
      align: "right",
      width: "130px",
      hideOnMobile: true,
      // Unsigned: the sign is already carried by the coins column, and
      // repeating it here would read as two separate movements.
      cell: (row) => <Money value={row.value} />,
    },
    {
      id: "note",
      header: t("columns.note"),
      cell: (row) => (
        <span className="block truncate text-sm text-muted-foreground" title={row.note}>
          {row.note}
        </span>
      ),
    },
  ];

  const quickChips: QuickChip[] = [
    { id: "in", label: t("chips.increases"), params: { direction: "IN" } },
    { id: "out", label: t("chips.decreases"), params: { direction: "OUT" } },
    {
      id: "reconciliation",
      label: t("chips.reconciliation"),
      params: { reason: "RECONCILIATION" },
    },
  ];

  const activeFilters = [
    get(COIN_ADJUSTMENT_FILTERS.direction) === "IN"
      ? t("chips.increases")
      : undefined,
    get(COIN_ADJUSTMENT_FILTERS.direction) === "OUT"
      ? t("chips.decreases")
      : undefined,
    get(COIN_ADJUSTMENT_FILTERS.reason)
      ? tRoot(
          `coins.adjustments.reasons.${get(COIN_ADJUSTMENT_FILTERS.reason)}`,
        )
      : undefined,
    get("q") ? `${t("searchPlaceholder")}: ${get("q")}` : undefined,
  ].filter((v): v is string => !!v);

  return (
    <>
      <DataTable
        columns={columns}
        result={result}
        rowKey={(row) => row.id}
        // The row opens the ledger it moved, which is where the movement can
        // actually be audited. §11.6
        rowHref={(row) => `/coins/types/${row.coinTypeId}`}
        searchPlaceholder={t("searchPlaceholder")}
        quickChips={quickChips}
        toolbarActions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            {t("new")}
          </Button>
        }
        emptyState={
          <EmptyState
            icon="coin"
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {t("new")}
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
                  {row.coinTypeName}
                </span>
              </span>
              <Badge variant={REASON_VARIANT[row.reason]}>
                {tRoot(`coins.adjustments.reasons.${row.reason}`)}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              {formatDate(row.adjustmentDate, locale)}
            </p>

            {/* Never truncated on mobile — it is the reason the screen exists. */}
            <p className="text-sm text-muted-foreground">{row.note}</p>

            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "font-mono font-semibold tabular-nums",
                  row.direction === "IN" ? "text-success" : "text-destructive",
                )}
              >
                {row.direction === "IN" ? "+" : "−"}
                {formatQuantity(row.coins)}
              </span>
              <Money value={row.value} />
            </div>
          </div>
        )}
      />

      {creating && (
        <NewAdjustmentDialog
          coinTypes={coinTypes}
          open
          onOpenChange={(open) => {
            if (!open) {
              setCreating(false);
              router.refresh();
            }
          }}
        />
      )}

      {/* A cross-link, not a nav item: the two screens are read together, and
          `/coins/adjustments` is absent from `nav-items.ts`. Reported. */}
      <p className="mt-4 text-caption text-muted-foreground">
        <Link href="/coins/types" className="text-primary hover:underline">
          {t("backToTypes")}
        </Link>
      </p>
    </>
  );
}
