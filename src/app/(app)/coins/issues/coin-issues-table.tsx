"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Plus } from "lucide-react";
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
  useTableParams,
  type QuickChip,
} from "@/components/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Money, Quantity } from "@/components/common/money";
import { formatDate } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type {
  CoinIssueLineDto,
  CoinIssueListItemDto,
  CoinIssueListResponseDto,
} from "@/lib/dto/coin-issue.dto";
import { COIN_ISSUE_FILTERS } from "@/lib/table/configs/coin-issue";
import { ColourDot, PerCoinValue } from "../types/coin-figures";
import {
  CoinIssueStatusBadge,
  RoundingStubBadge,
  rowAccentClass,
} from "./coin-issue-badges";
import { CoinIssueActions } from "./coin-issue-actions";

/**
 * The coin issue register. Spec: design MODULES/04-coins §6
 *
 * **One row tells the whole story:** issued · returned · net payable ·
 * collected · pending. `PENDING` is the column the owner scans, so it is the
 * only header that is not grey, and it is the one figure that can be NEGATIVE —
 * meaning the company owes the staff member a refund. A negative pending
 * renders `(₹500.00)` in PRIMARY BLUE, never red: money pointing the other way
 * is not a loss. §6.3
 *
 * ── Why this table is not `<DataTable>` ──────────────────────────────────
 *
 * The shared table has no expandable-row API, and expansion is the point of
 * this screen — the per-coin-type breakdown has to be readable without leaving
 * the page. Rather than bending the kernel component nine other modules rely
 * on, this composes the same primitives it does — `DataTableToolbar`,
 * `DataTableColumnHeader`, `DataTablePagination`, `useTableParams` — so search,
 * chips, sorting, paging and URL state behave identically. Reported as a kernel
 * gap. See .claude/MODULE-RECIPE.md "If the kernel is missing something"
 */
export function CoinIssuesTable({
  result,
}: {
  result: CoinIssueListResponseDto;
}) {
  const t = useTranslations("coins.issues");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { clearAll, get, isPending } = useTableParams();
  const panelId = useId();

  /**
   * Several rows may be open at once, and they stay open across refilter and
   * repage — the owner is comparing them. Design §6.6
   */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtersActive =
    !!get("q") ||
    Object.values(COIN_ISSUE_FILTERS).some((key) => !!get(key));

  const quickChips: QuickChip[] = [
    { id: "pending", label: t("chips.pending"), params: { status: "pending" } },
    { id: "partial", label: t("chips.partial"), params: { status: "partial" } },
    { id: "settled", label: t("chips.settled"), params: { status: "settled" } },
    {
      id: "refund_due",
      label: t("chips.refundDue"),
      params: { status: "refund_due" },
    },
  ];

  const activeFilters = [
    get("status") ? t(`chips.${chipKey(get("status"))}`) : undefined,
    get("q") ? `${t("searchPlaceholder")}: ${get("q")}` : undefined,
  ].filter((v): v is string => !!v);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <DataTableToolbar
        searchPlaceholder={t("searchPlaceholder")}
        quickChips={quickChips}
      />

      {result.rows.length === 0 ? (
        <div className="px-6 py-16">
          {filtersActive ? (
            <EmptyState
              variant="no-results"
              title={t("noResults.title")}
              filters={activeFilters}
              onClearFilters={clearAll}
            />
          ) : (
            <EmptyState
              icon="coin"
              title={t("empty.title")}
              description={t("empty.body")}
              action={
                <Button asChild>
                  <Link href="/coins/issues/new">
                    <Plus aria-hidden />
                    {t("new")}
                  </Link>
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <>
          {/* Desktop. Rows DIM on refilter rather than being replaced by a
              skeleton — that keeps the user's place, and keeps open panels
              open. DESIGN-STANDARDS §5.6 */}
          <div
            className={cn(
              "relative hidden md:block",
              isPending && "pointer-events-none opacity-60",
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: "40px" }}>
                    <span className="sr-only">{t("columns.expand")}</span>
                  </TableHead>
                  <TableHead style={{ width: "120px" }}>
                    <DataTableColumnHeader sortKey="code">
                      {t("columns.issue")}
                    </DataTableColumnHeader>
                  </TableHead>
                  <TableHead style={{ width: "110px" }}>
                    <DataTableColumnHeader sortKey="issueDate">
                      {t("columns.date")}
                    </DataTableColumnHeader>
                  </TableHead>
                  <TableHead style={{ width: "180px" }}>
                    <DataTableColumnHeader sortKey="staff">
                      {t("columns.staff")}
                    </DataTableColumnHeader>
                  </TableHead>
                  <TableHead style={{ width: "120px" }}>
                    <DataTableColumnHeader
                      sortKey="totalCoinsIssued"
                      align="right"
                    >
                      {t("columns.issued")}
                    </DataTableColumnHeader>
                  </TableHead>
                  <TableHead style={{ width: "120px" }}>
                    <DataTableColumnHeader align="right">
                      {t("columns.returned")}
                    </DataTableColumnHeader>
                  </TableHead>
                  <TableHead style={{ width: "120px" }}>
                    <DataTableColumnHeader sortKey="netPayable" align="right">
                      {t("columns.netPayable")}
                    </DataTableColumnHeader>
                  </TableHead>
                  <TableHead style={{ width: "120px" }}>
                    <DataTableColumnHeader align="right">
                      {t("columns.collected")}
                    </DataTableColumnHeader>
                  </TableHead>
                  {/* The only header that is not grey — it is the column the
                      owner came here to read. §6.3 */}
                  <TableHead style={{ width: "130px" }}>
                    <DataTableColumnHeader
                      sortKey="outstandingAmount"
                      align="right"
                      className="font-semibold text-foreground"
                    >
                      {t("columns.pending")}
                    </DataTableColumnHeader>
                  </TableHead>
                  <TableHead style={{ width: "150px" }} className="text-center">
                    {t("columns.status")}
                  </TableHead>
                  <TableHead style={{ width: "56px" }}>
                    <span className="sr-only">{t("columns.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {result.rows.map((issue) => {
                  const open = expanded.has(issue.id);
                  const rowPanelId = `${panelId}-${issue.id}`;

                  return [
                    <TableRow
                      key={issue.id}
                      onClick={() => router.push(`/coins/issues/${issue.id}`)}
                      className={cn("cursor-pointer", rowAccentClass(issue))}
                    >
                      <TableCell>
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={rowPanelId}
                          aria-label={t("columns.expandRow", {
                            code: issue.code,
                          })}
                          // Clicking the chevron must NOT navigate. §6.6
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(issue.id);
                          }}
                          className="flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <ChevronRight
                            className={cn(
                              "size-4 transition-transform duration-100",
                              open && "rotate-90 text-primary",
                            )}
                            aria-hidden
                          />
                        </button>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-caption font-medium text-primary">
                          {issue.code}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm">
                          {formatDate(issue.issueDate, locale)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="block truncate text-sm font-medium text-foreground">
                          {issue.staffName}
                        </span>
                        <span className="block truncate text-caption text-muted-foreground">
                          {issue.staffPhone}
                        </span>
                      </TableCell>

                      <TableCell align="right">
                        <Money value={issue.totalAmount} />
                        <span className="block text-caption text-muted-foreground">
                          {t("coinsCount", {
                            coins: formatQuantity(issue.totalCoinsIssued),
                          })}
                        </span>
                      </TableCell>

                      <TableCell align="right">
                        <Money value={issue.returnedValue} />
                        {issue.totalCoinsReturned > 0 && (
                          <span className="block text-caption text-muted-foreground">
                            {t("coinsCount", {
                              coins: formatQuantity(issue.totalCoinsReturned),
                            })}
                          </span>
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <Money value={issue.netPayable} />
                      </TableCell>

                      <TableCell align="right">
                        <Money value={issue.paidAmount} />
                      </TableCell>

                      <TableCell align="right">
                        <PendingFigure issue={issue} />
                      </TableCell>

                      <TableCell align="center">
                        <span className="inline-flex flex-wrap items-center justify-center gap-1">
                          <CoinIssueStatusBadge issue={issue} />
                          {issue.roundingStub && <RoundingStubBadge />}
                        </span>
                      </TableCell>

                      <TableCell align="center">
                        <CoinIssueActions issue={issue} />
                      </TableCell>
                    </TableRow>,

                    open ? (
                      <TableRow
                        key={`${issue.id}-panel`}
                        className="hover:bg-transparent"
                      >
                        <TableCell colSpan={11} className="p-0">
                          <div
                            id={rowPanelId}
                            className="border-l-[3px] border-l-primary bg-muted p-4"
                          >
                            <LineBreakdown issue={issue} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null,
                  ];
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile — `Pending` is the last line and the biggest figure on the
              card, because it is the only one that tells him what to do. §6.7 */}
          <ul className={cn("md:hidden", isPending && "opacity-60")}>
            {result.rows.map((issue) => {
              const open = expanded.has(issue.id);
              return (
                <li
                  key={issue.id}
                  className={cn(
                    "border-b border-border p-4 last:border-b-0",
                    rowAccentClass(issue),
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/coins/issues/${issue.id}`}
                      className="font-mono text-sm font-medium text-primary"
                    >
                      {issue.code}
                    </Link>
                    <CoinIssueStatusBadge issue={issue} />
                  </div>

                  <p className="mt-1 text-caption text-muted-foreground">
                    {issue.staffName} · {formatDate(issue.issueDate, locale)}
                  </p>

                  <dl className="mt-2 space-y-1 text-sm">
                    <MobileRow
                      label={t("columns.issued")}
                      value={<Money value={issue.totalAmount} />}
                    />
                    <MobileRow
                      label={t("columns.returned")}
                      value={<Money value={issue.returnedValue} />}
                    />
                    <MobileRow
                      label={t("columns.collected")}
                      value={<Money value={issue.paidAmount} />}
                    />
                    <div className="flex items-baseline justify-between gap-3 pt-1">
                      <dt className="text-muted-foreground">
                        {t("columns.pending")}
                      </dt>
                      <dd>
                        <PendingFigure issue={issue} className="text-base" />
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(issue.id)}
                    className="mt-2 flex min-h-11 items-center gap-1 text-sm text-primary"
                  >
                    <ChevronRight
                      className={cn("size-4", open && "rotate-90")}
                      aria-hidden
                    />
                    {t("coinTypeCount", {
                      count: formatQuantity(issue.lines.length),
                    })}
                  </button>

                  {open && (
                    <div className="mt-2 rounded-md bg-muted p-3">
                      <LineBreakdown issue={issue} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <DataTablePagination result={result} />
        </>
      )}
    </div>
  );
}

/**
 * The register's headline figure.
 *
 * Negative renders `(₹500.00)` in blue with a tooltip that says, in words, who
 * owes whom. The parentheses carry the sign so colour is never the only signal.
 * DESIGN-STANDARDS §13 · design §6.3
 */
function PendingFigure({
  issue,
  className,
}: {
  issue: CoinIssueListItemDto;
  className?: string;
}) {
  const t = useTranslations("coins.issues");

  return (
    <Money
      value={issue.outstandingAmount}
      emphasis
      variant={issue.refundDue ? "refund" : "default"}
      className={className}
      title={
        issue.refundDue
          ? t("refundTooltip", { staff: issue.staffName })
          : undefined
      }
    />
  );
}

/**
 * The expanded panel: one row per coin type, then the total.
 *
 * Travels with the register row rather than being fetched on expand, so the
 * panel appears instantly with no height animation — an animated 200px reveal
 * on a 25-row list reads as slowness. §6.6
 */
function LineBreakdown({ issue }: { issue: CoinIssueListItemDto }) {
  const t = useTranslations("coins.issues");

  if (issue.lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("breakdown.empty")}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-160 text-sm">
        <thead>
          <tr className="text-caption uppercase tracking-[0.04em] text-muted-foreground">
            <th className="py-1.5 text-left font-semibold">
              {t("breakdown.coinType")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("breakdown.packets")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("breakdown.coins")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("breakdown.rate")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("breakdown.issuedValue")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("breakdown.returned")}
            </th>
            <th className="py-1.5 text-right font-semibold">
              {t("breakdown.net")}
            </th>
          </tr>
        </thead>
        <tbody>
          {issue.lines.map((line) => (
            <tr key={line.id} className="border-t border-border">
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <ColourDot colour={line.colourHex} />
                  <Link
                    href={`/coins/types/${line.coinTypeId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-primary hover:underline"
                  >
                    {line.coinTypeName}
                  </Link>
                </span>
              </td>
              <td className="py-2 text-right">
                <Quantity value={line.packets} />
              </td>
              <td className="py-2 text-right">
                <Quantity value={line.coinsIssued} />
              </td>
              <td className="py-2 text-right">
                <PerCoinValue value={line.perCoinPrice} />
              </td>
              <td className="py-2 text-right">
                <Money value={line.lineAmount} zeroAs="value" />
              </td>
              <td className="py-2 text-right">
                {/* Coins and value together: "0 / —" says both that nothing
                    came back and that nothing was credited. §6.3 */}
                <span className="font-mono text-caption text-muted-foreground">
                  {formatQuantity(line.coinsReturned)}
                </span>
                {" / "}
                <Money value={line.returnedValue} className="inline" />
              </td>
              <td className="py-2 text-right">
                <Money value={line.netAmount} emphasis zeroAs="value" />
              </td>
            </tr>
          ))}

          <tr className="border-t-2 border-t-foreground font-semibold">
            <td className="py-2">{t("breakdown.total")}</td>
            <td className="py-2 text-right">
              <Quantity value={totalOf(issue.lines, "packets")} emphasis />
            </td>
            <td className="py-2 text-right">
              <Quantity value={issue.totalCoinsIssued} emphasis />
            </td>
            <td />
            <td className="py-2 text-right">
              <Money value={issue.totalAmount} emphasis zeroAs="value" />
            </td>
            <td className="py-2 text-right">
              <Money value={issue.returnedValue} emphasis />
            </td>
            <td className="py-2 text-right">
              <Money value={issue.netPayable} emphasis zeroAs="value" />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("breakdown.paymentLine", {
            collected: formatMoneyInline(issue.paidAmount),
            pending: formatMoneyInline(issue.outstandingAmount),
          })}
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/coins/issues/${issue.id}`}>
            {t("actions.openIssue")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Packets are a COUNT, not money — adding them in the browser is fine and is
 * what the sub-total row of §6.3 asks for. Every rupee figure on this panel
 * comes from a column the database computed.
 */
function totalOf(lines: CoinIssueLineDto[], key: "packets"): number {
  return lines.reduce((total, line) => total + line[key], 0);
}

/**
 * `₹500.00`, or `(₹500.00)` when the company owes it.
 *
 * Goes through `lib/money` rather than `Intl` directly, so digits stay Latin
 * 0–9 in Gujarati too. The parentheses carry the sign — a bare minus inside a
 * sentence is easy to miss. See .claude/I18N.md §4.2
 */
function formatMoneyInline(value: number): string {
  const text = formatINR(Math.abs(value));
  return value < 0 ? `(${text})` : text;
}

function MobileRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** `refund_due` → `refundDue`, so the chip label key matches the URL value. */
function chipKey(status: string | undefined): string {
  return status === "refund_due" ? "refundDue" : (status ?? "");
}
