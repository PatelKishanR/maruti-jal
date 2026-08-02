import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Money, Quantity } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { formatINR, formatPerCoinValue, formatQuantity } from "@/lib/money";
import { dashboardPaths } from "@/lib/api/routes.dashboard";
import type {
  DashboardAttentionRowDto,
  DashboardCoinPositionRowDto,
  DashboardScoreboardRowDto,
} from "@/lib/dto/dashboard.dto";

/**
 * Row 4 — the operational tables. Spec: design/MODULES/08 §3.3.5
 *
 * Server components: every figure is already on the server and none of these
 * rows has state. Header 44px, body rows 48px, money right-aligned mono, zero
 * an em dash — the same table shell every module uses.
 *
 * A cell that goes somewhere different from its row carries a dotted underline,
 * so it is visible that `Cash out` opens a filtered order list while the name
 * beside it opens the staff record. §3.6
 */

const HEAD =
  "h-11 px-4 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground";
const CELL = "h-12 border-t border-border px-4";

export async function StaffScoreboard({
  rows,
}: {
  rows: DashboardScoreboardRowDto[];
}) {
  const t = await getTranslations("dashboard.tables");

  return (
    <Card className="overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 px-4 py-4">
        <div>
          <h3 className="text-h3 font-semibold text-foreground">
            {t("scoreboard.title")}
          </h3>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {t("scoreboard.subtitle")}
          </p>
        </div>
        <Link
          href={dashboardPaths().staffWithBalance}
          className="shrink-0 text-body-sm font-medium text-primary hover:underline"
        >
          {t("scoreboard.viewAll")}
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="border-t border-border px-4 py-8 text-center text-body-sm text-muted-foreground">
          {t("scoreboard.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead className="bg-muted">
              <tr>
                <th className={cn(HEAD, "text-left")}>
                  {t("scoreboard.staff")}
                </th>
                <th className={cn(HEAD, "text-right")}>
                  {t("scoreboard.orders")}
                </th>
                <th className={cn(HEAD, "text-right")}>
                  {t("scoreboard.cashOut")}
                </th>
                <th className={cn(HEAD, "text-right")}>
                  {t("scoreboard.jarsOut")}
                </th>
                <th className={cn(HEAD, "text-right")}>
                  {t("scoreboard.coinDues")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.staffId} className="hover:bg-muted">
                  <td className={CELL}>
                    <Link
                      href={dashboardPaths().staff(row.staffId)}
                      className="block hover:underline"
                    >
                      <span className="block text-body-sm font-medium text-foreground">
                        {row.staffName}
                      </span>
                      <span className="block text-caption text-muted-foreground">
                        {row.staffPhone}
                      </span>
                    </Link>
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <Quantity value={row.openOrders} zeroAs="dash" />
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <Link
                      href={dashboardPaths().ordersForStaff(row.staffId)}
                      className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
                    >
                      <Money value={row.cashOut} emphasis />
                    </Link>
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <Link
                      href={dashboardPaths().jarsForStaff(row.staffId)}
                      className="inline-flex items-center justify-end gap-1.5 underline decoration-dotted underline-offset-4 hover:decoration-solid"
                    >
                      {row.jarsOut > 0 ? (
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            row.jarsOldestDays >= 7
                              ? "bg-destructive"
                              : "bg-warning",
                          )}
                          aria-hidden
                        />
                      ) : null}
                      <Quantity value={row.jarsOut} zeroAs="dash" emphasis />
                    </Link>
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    {row.coinDues > 0 ? (
                      <Link
                        href={dashboardPaths().coinIssuesForStaff(row.staffId)}
                        className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
                      >
                        <Money value={row.coinDues} />
                      </Link>
                    ) : (
                      <Money value={0} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-4 py-2 text-caption text-muted-foreground">
        {t("scoreboard.note")}
      </p>
    </Card>
  );
}

export async function CoinPosition({
  rows,
}: {
  rows: DashboardCoinPositionRowDto[];
}) {
  const t = await getTranslations("dashboard.tables");

  return (
    <Card className="overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 px-4 py-4">
        <div>
          <h3 className="text-h3 font-semibold text-foreground">
            {t("coins.title")}
          </h3>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {t("coins.subtitle")}
          </p>
        </div>
        <Link
          href={dashboardPaths().coinTypes}
          className="shrink-0 text-body-sm font-medium text-primary hover:underline"
        >
          {t("coins.viewAll")}
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="border-t border-border px-4 py-8 text-center text-body-sm text-muted-foreground">
          {t("coins.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead className="bg-muted">
              <tr>
                <th className={cn(HEAD, "text-left")}>{t("coins.type")}</th>
                <th className={cn(HEAD, "text-right")}>{t("coins.inStock")}</th>
                <th className={cn(HEAD, "text-right")}>{t("coins.out")}</th>
                <th className={cn(HEAD, "text-right")}>{t("coins.value")}</th>
                <th className={cn(HEAD, "w-10")} aria-hidden />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.coinTypeId} className="hover:bg-muted">
                  <td className={CELL}>
                    <Link
                      href={dashboardPaths().coinType(row.coinTypeId)}
                      className="block hover:underline"
                    >
                      <span className="block text-body-sm font-medium text-foreground">
                        {row.name}
                      </span>
                      <span className="block text-caption text-muted-foreground">
                        {t("coins.perPacket", {
                          count: formatQuantity(row.coinsPerPacket),
                          price: formatPerCoinValue(row.perCoinPrice),
                        })}
                      </span>
                    </Link>
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <Quantity value={row.inStock} />
                    <span className="block text-caption text-muted-foreground">
                      {t("coins.packets", {
                        count: formatQuantity(row.stockPackets),
                      })}
                    </span>
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <Quantity
                      value={row.outWithStaff}
                      zeroAs="dash"
                      className={row.outWithStaff > 0 ? "text-warning" : undefined}
                    />
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <Money value={row.stockValue} emphasis />
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <Link
                      href={dashboardPaths().coinType(row.coinTypeId)}
                      aria-label={row.name}
                    >
                      <ChevronRight
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * T3 — a merged action list, not a table.
 *
 * Six rows visible, the rest inside a `<details>` that expands IN PLACE. A
 * native disclosure keeps this a server component: the whole page would
 * otherwise become a client island to hold one boolean.
 */
export async function AttentionNeeded({
  rows,
  total,
}: {
  rows: DashboardAttentionRowDto[];
  total: number;
}) {
  const t = await getTranslations("dashboard.tables");

  if (rows.length === 0) {
    return (
      <Card className="flex min-h-60 flex-col items-center justify-center px-6 py-10 text-center">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <h3 className="mt-4 text-h4 font-semibold text-foreground">
          {t("attention.emptyTitle")}
        </h3>
        <p className="mt-1 max-w-prose text-body-sm text-muted-foreground">
          {t("attention.emptyBody")}
        </p>
      </Card>
    );
  }

  const visible = rows.slice(0, 6);
  const rest = rows.slice(6);

  return (
    <Card className="overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-4">
        <h3 className="text-h3 font-semibold text-foreground">
          {t("attention.title")}
        </h3>
        <span className="rounded-full bg-(--badge-danger-bg) px-2 py-0.5 text-caption font-semibold text-(--badge-danger-fg)">
          {formatQuantity(total)}
        </span>
      </header>

      <ul>
        {visible.map((row) => (
          <AttentionRow key={row.id} row={row} />
        ))}
      </ul>

      {rest.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer border-t border-border px-4 py-3 text-body-sm font-medium text-primary hover:underline">
            {t("attention.showAll", { count: formatQuantity(total) })}
          </summary>
          <ul className="max-h-100 overflow-y-auto">
            {rest.map((row) => (
              <AttentionRow key={row.id} row={row} />
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

async function AttentionRow({ row }: { row: DashboardAttentionRowDto }) {
  const t = await getTranslations("dashboard.tables.attention");

  const dot =
    row.severity === "danger"
      ? "bg-destructive"
      : row.severity === "warning"
        ? "bg-warning"
        : "bg-primary";

  const age =
    row.ageDays >= 15
      ? "text-destructive"
      : row.ageDays > 7
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <li className="border-t border-border">
      <Link
        href={row.href}
        className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted"
      >
        <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />

        <span className="min-w-0 flex-1">
          {/* Line 1 — the subject and the number, in one readable sentence. */}
          <span className="block truncate text-body-sm text-foreground">
            {row.kind === "cash"
              ? t("cash", {
                  name: row.subject,
                  amount: formatINR(row.amount ?? 0),
                })
              : row.kind === "coins"
                ? t("coins", {
                    name: row.subject,
                    amount: formatINR(row.amount ?? 0),
                  })
                : row.kind === "jars"
                  ? t("jars", {
                      name: row.subject,
                      jars: formatQuantity(row.quantity ?? 0),
                    })
                  : t("party", {
                      name: row.subject,
                      amount: formatINR(row.amount ?? 0),
                    })}
          </span>

          {/* Line 2 — the reference and the ageing, which takes its own tone. */}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            {row.reference ? <span>{row.reference}</span> : null}
            {row.kind !== "party" && row.quantity !== null ? (
              <span>
                {row.kind === "coins"
                  ? t("issues", { count: formatQuantity(row.quantity) })
                  : row.kind === "cash"
                    ? t("orders", { count: formatQuantity(row.quantity) })
                    : null}
              </span>
            ) : null}
            <span className={age}>
              {row.kind === "party"
                ? t("today")
                : t("age", { days: formatQuantity(row.ageDays) })}
            </span>
          </span>
        </span>

        {row.severity === "danger" ? (
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
        ) : null}
      </Link>
    </li>
  );
}
