"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, BookOpen, CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination, useTableParams } from "@/components/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { EmptyFigure, Money } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { formatDate, formatDateRelative } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type { ListResult } from "@/lib/table/types";
import type {
  CoinTypeDetailDto,
  LedgerEntryDto,
} from "@/lib/dto/coin-type.dto";
import { MovementBadge } from "../coin-figures";

/**
 * The register book. Spec: design MODULES/04-coins §5
 *
 * This is the physical ledger the owner is replacing, so it keeps the things a
 * ruled page has and a data table does not:
 *
 *  · vertical hairlines around the IN / OUT / BALANCE money block — the only
 *    vertical rules anywhere in this app
 *  · an inset tint down the running-balance column
 *  · date-band rows grouping the day's movements
 *  · a pinned opening-balance row that never paginates away
 *  · an accountant's double-underlined carried-forward foot
 *
 * It is READ-ONLY everywhere, by design. The ledger is append-only: mistakes
 * are corrected by adding a reversing entry, so the history stays honest.
 * MODULES/04-coins.md §7
 */

/** The money block. Every cell in these three columns carries the left rule. */
const MONEY_CELL = "border-l border-border text-right";
const BALANCE_CELL = cn(MONEY_CELL, "bg-background dark:bg-[#0F172A]");

const MOVEMENT_CHIPS = [
  { id: "all", movement: undefined },
  { id: "issuedOut", movement: "ISSUE" },
  { id: "returnedIn", movement: "ISSUE_RETURN" },
  { id: "orderReceipts", movement: "ORDER_RECEIPT" },
  { id: "adjustments", movement: "ADJUSTMENT_IN,ADJUSTMENT_OUT" },
] as const;

export function CoinTypeLedger({
  coinType,
  ledger,
}: {
  coinType: CoinTypeDetailDto;
  ledger: ListResult<LedgerEntryDto>;
}) {
  const t = useTranslations("coins.ledger");
  const tDetail = useTranslations("coins.types.detail");
  const locale = useLocale() as Locale;
  const { get, setParams, isPending } = useTableParams();

  const { reconciliation } = coinType;
  const drifted = reconciliation.driftCoins !== 0;
  const filtered = !!get("movement") || !!get("from") || !!get("to");
  const activeChip = get("movement") ?? "all";

  return (
    <Tabs defaultValue="ledger" className="mt-8">
      <TabsList>
        <TabsTrigger value="ledger" count={coinType.ledgerEntryCount}>
          {tDetail("tabs.ledger")}
        </TabsTrigger>
        {/* TODO(wave-3): issues, adjustments and circulation all read from
            coin_issues, which does not exist yet. Rendered disabled so the
            shape of the finished page is visible without faking data. */}
        <TabsTrigger value="issues" disabled title={tDetail("tabs.soon")}>
          {tDetail("tabs.issues")}
        </TabsTrigger>
        <TabsTrigger value="adjustments" disabled title={tDetail("tabs.soon")}>
          {tDetail("tabs.adjustments")}
        </TabsTrigger>
        <TabsTrigger value="circulation" disabled title={tDetail("tabs.soon")}>
          {tDetail("tabs.circulation")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ledger">
        {drifted ? (
          <DriftBanner coinType={coinType} />
        ) : (
          <ReconciliationBand coinType={coinType} filtered={filtered} shown={ledger.total} />
        )}

        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {/* Multi-state chips. Each one narrows the register; the band above
              deliberately never follows them — it is the full-ledger balance. */}
          <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
            {MOVEMENT_CHIPS.map((chip) => {
              const active = (chip.movement ?? "all") === activeChip;
              return (
                <button
                  key={chip.id}
                  type="button"
                  disabled={isPending}
                  aria-pressed={active}
                  onClick={() => setParams({ movement: chip.movement })}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-[13px] transition-colors duration-100",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active
                      ? "border border-primary bg-[var(--badge-primary-bg)] text-[var(--badge-primary-fg)]"
                      : "border border-transparent bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`chips.${chip.id}`)}
                </button>
              );
            })}
          </div>

          {ledger.rows.length === 0 && !filtered ? (
            <EmptyState
              icon={BookOpen}
              title={t("empty.title")}
              description={t("empty.body")}
            />
          ) : ledger.rows.length === 0 ? (
            <EmptyState
              variant="no-results"
              title={t("noResults.title")}
              onClearFilters={() =>
                setParams({ movement: undefined, from: undefined, to: undefined })
              }
            />
          ) : (
            <>
              <div className={cn("relative", isPending && "pointer-events-none opacity-60")}>
                <Register
                  coinType={coinType}
                  ledger={ledger}
                  locale={locale}
                  // Pinned to the top of page 1 and never paginated away — but
                  // only when there IS an opening balance; a synthetic "0" row
                  // would be a statement nobody made.
                  showOpeningRow={
                    ledger.page === 1 &&
                    !filtered &&
                    reconciliation.openingCoins > 0
                  }
                />
              </div>
              <DataTablePagination result={ledger} />
            </>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

/* ── The reconciliation band ─────────────────────────────────────────────── */

/**
 * `Opening 3,000 + In 640 − Out 1,200 = Balance 2,440 coins (₹24,400.00)`
 *
 * Every figure comes from a SQL aggregate over the whole ledger, never from the
 * page on screen — which is why the amber caveat appears the moment a filter is
 * applied. Sticky beneath the tabs: the arithmetic is what the owner came to
 * check, so it should not scroll away from him.
 */
function ReconciliationBand({
  coinType,
  filtered,
  shown,
}: {
  coinType: CoinTypeDetailDto;
  filtered: boolean;
  shown: number;
}) {
  const t = useTranslations("coins.ledger");
  const { reconciliation } = coinType;

  return (
    <div className="sticky top-2 z-20">
      <Alert variant="success" icon={<CheckCircle2 aria-hidden />}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="font-mono text-base font-semibold tabular-nums">
            {t("reconciled", {
              opening: formatQuantity(reconciliation.openingCoins),
              coinsIn: formatQuantity(reconciliation.inCoins),
              coinsOut: formatQuantity(reconciliation.outCoins),
              balance: formatQuantity(reconciliation.balanceCoins),
            })}
            <span className="ml-2">
              (
              <Money
                value={reconciliation.balanceValue}
                zeroAs="value"
                className="inline"
              />
              )
            </span>
          </p>
          <p className="shrink-0 text-caption opacity-80">
            {t("reconciledMeta", {
              count: formatQuantity(reconciliation.entryCount),
            })}
          </p>
        </div>

        {filtered && (
          <p className="mt-1 text-caption text-[var(--badge-warning-fg)]">
            {t("filteredCaveat", {
              shown: formatQuantity(shown),
              total: formatQuantity(reconciliation.entryCount),
            })}
          </p>
        )}
      </Alert>
    </div>
  );
}

/**
 * The §13 drift banner.
 *
 * Non-dismissible, and it takes focus on render: the owner must meet it before
 * the table. `Recalculate from ledger` is deliberately absent — nothing in the
 * application may write `coin_types.balance_coins`, which is the whole reason
 * this check is trustworthy. See .claude/DATA-MODEL.md §5.9
 */
function DriftBanner({ coinType }: { coinType: CoinTypeDetailDto }) {
  const t = useTranslations("coins.drift");
  const ref = useRef<HTMLDivElement>(null);
  const { reconciliation } = coinType;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div ref={ref} tabIndex={-1} aria-live="assertive" className="sticky top-2 z-20">
      <Alert variant="danger" icon={<AlertTriangle aria-hidden />}>
        <p className="font-medium">{t("title", { name: coinType.name })}</p>
        <p className="mt-0.5">
          {t("body", {
            stored: formatQuantity(reconciliation.balanceCoins),
            ledger: formatQuantity(reconciliation.ledgerBalanceCoins),
            difference: formatQuantity(Math.abs(reconciliation.driftCoins)),
          })}
        </p>
        <p className="mt-0.5">{t("reassurance")}</p>
      </Alert>
    </div>
  );
}

/* ── The register itself ─────────────────────────────────────────────────── */

function Register({
  coinType,
  ledger,
  locale,
  showOpeningRow,
}: {
  coinType: CoinTypeDetailDto;
  ledger: ListResult<LedgerEntryDto>;
  locale: Locale;
  showOpeningRow: boolean;
}) {
  const t = useTranslations("coins.ledger");
  const tCommon = useTranslations("common");
  const { reconciliation } = coinType;

  const dateLabels = {
    today: tCommon("today"),
    yesterday: tCommon("yesterday"),
  };

  // Entries arrive newest first, which is the order the owner reads them in.
  // Bands are emitted whenever the day changes rather than by grouping first,
  // so the sequence on screen is exactly the sequence in the array.
  let currentBand: string | null = null;

  return (
    <Table>
      <TableCaption className="sr-only">
        {t("caption", { name: coinType.name })}
      </TableCaption>

      <TableHeader>
        <TableRow>
          <TableHead className="w-14">{t("columns.seq")}</TableHead>
          <TableHead className="w-[110px]">{t("columns.date")}</TableHead>
          <TableHead className="w-[180px]">{t("columns.movement")}</TableHead>
          <TableHead className="w-[130px]">{t("columns.reference")}</TableHead>
          <TableHead>{t("columns.note")}</TableHead>
          <TableHead className={cn(MONEY_CELL, "w-[110px]")}>
            {t("columns.in")}
          </TableHead>
          <TableHead className={cn(MONEY_CELL, "w-[110px]")}>
            {t("columns.out")}
          </TableHead>
          {/* Deliberately not sortable: a running balance sorted out of order
              is meaningless. Design §5.6 */}
          <TableHead
            className={cn(BALANCE_CELL, "w-[130px]")}
            title={t("balanceNotSortable")}
          >
            {t("columns.balance")}
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {showOpeningRow && (
          <TableRow className="h-12 bg-muted hover:bg-muted">
            <TableCell colSpan={5} className="italic text-muted-foreground">
              {t("openingRow", {
                date: formatDate(coinType.createdAt.slice(0, 10), locale),
              })}
            </TableCell>
            <TableCell className={MONEY_CELL}>
              <EmptyFigure />
            </TableCell>
            <TableCell className={MONEY_CELL}>
              <EmptyFigure />
            </TableCell>
            <TableCell className={BALANCE_CELL}>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatQuantity(reconciliation.openingCoins)}
              </span>
            </TableCell>
          </TableRow>
        )}

        {ledger.rows.map((entry) => {
          const band = entry.entryDate !== currentBand ? entry.entryDate : null;
          currentBand = entry.entryDate;

          return (
            <RegisterRows
              key={entry.id}
              entry={entry}
              band={band}
              locale={locale}
              dateLabels={dateLabels}
            />
          );
        })}
      </TableBody>

      {/* The accountant's rule above a total — heavier and darker than every
          other border on the page, so the eye stops on it. */}
      <TableFooter className="[&>tr>td]:border-t-2 [&>tr>td]:border-t-foreground">
        <TableRow className="h-12 hover:bg-muted">
          <TableCell
            colSpan={5}
            className="text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground"
          >
            {ledger.page >= ledger.pageCount
              ? t("closingBalance")
              : t("carriedForward")}
          </TableCell>
          <TableCell className={MONEY_CELL}>
            <span className="font-mono font-semibold tabular-nums text-success">
              {formatQuantity(reconciliation.inCoins)}
            </span>
          </TableCell>
          <TableCell className={MONEY_CELL}>
            <span className="font-mono font-semibold tabular-nums text-destructive">
              {formatQuantity(reconciliation.outCoins)}
            </span>
          </TableCell>
          <TableCell className={BALANCE_CELL}>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatQuantity(reconciliation.balanceCoins)}
            </span>
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function RegisterRows({
  entry,
  band,
  locale,
  dateLabels,
}: {
  entry: LedgerEntryDto;
  band: string | null;
  locale: Locale;
  dateLabels: { today: string; yesterday: string };
}) {
  const t = useTranslations("coins.ledger");

  return (
    <>
      {band && (
        <TableRow className="h-8 bg-muted hover:bg-muted">
          <TableCell
            colSpan={5}
            className="py-1 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground"
          >
            {formatDate(band, locale)}
          </TableCell>
          {/* The money columns stay empty and ruled through a band row. */}
          <TableCell className={MONEY_CELL} />
          <TableCell className={MONEY_CELL} />
          <TableCell className={BALANCE_CELL} />
        </TableRow>
      )}

      <TableRow>
        <TableCell className="font-mono text-caption text-muted-foreground">
          {formatQuantity(entry.entrySeq)}
        </TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground">
          {formatDateRelative(entry.entryDate, locale, dateLabels)}
        </TableCell>
        <TableCell>
          <MovementBadge movement={entry.movementType} />
        </TableCell>
        <TableCell>
          {/* TODO(wave-3): CIS-/ORD- codes become links once coin issues and
              orders exist. Adjustments carry no code at all, so an em dash is
              the honest rendering rather than a placeholder. */}
          {entry.reference ? (
            <span className="font-mono text-[13px] font-medium text-primary">
              {entry.reference}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="max-w-0">
          <span
            className="block truncate text-sm text-muted-foreground"
            title={entry.note ?? undefined}
          >
            {entry.note ?? "—"}
          </span>
        </TableCell>

        <TableCell className={MONEY_CELL}>
          {entry.inCoins === null ? (
            <EmptyFigure />
          ) : (
            <span className="font-mono font-medium tabular-nums text-success">
              {formatQuantity(entry.inCoins)}
            </span>
          )}
        </TableCell>
        <TableCell className={MONEY_CELL}>
          {entry.outCoins === null ? (
            <EmptyFigure />
          ) : (
            <span className="font-mono font-medium tabular-nums text-destructive">
              {formatQuantity(entry.outCoins)}
            </span>
          )}
        </TableCell>
        <TableCell className={BALANCE_CELL} title={t("balanceNotSortable")}>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {formatQuantity(entry.balanceAfterCoins)}
          </span>
        </TableCell>
      </TableRow>
    </>
  );
}
