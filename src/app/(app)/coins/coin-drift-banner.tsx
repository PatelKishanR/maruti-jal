import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatQuantity } from "@/lib/money";
import type { CoinBalanceDriftDto } from "@/lib/dto/coin-drift.dto";

/**
 * The §13 reconciliation drift banner.
 *
 * `coin_types.balance_coins` is a cache the ledger maintains. When it and the
 * sum of every movement disagree, something is seriously wrong and the owner
 * must know BEFORE he acts on any figure on the screen.
 *
 * **NEVER DISMISSIBLE.** There is deliberately no `✕`, no collapse and no
 * "remind me later": the whole point is that it cannot be scrolled past.
 * `role="alert"` with `aria-live="assertive"` so a screen reader meets it
 * before the table. Design §13.1, §13.4
 *
 * No `"use client"`: this is presentation with one link and no state, so it
 * renders inside a server page directly.
 *
 * The `+ Issue coins` action stays enabled while drift exists — blocking work
 * over a display mismatch would push the owner back to the notebook, which is
 * the failure this app exists to prevent. The server lock is the real guard.
 * Design §13.6
 */
export function CoinDriftBanner({ drift }: { drift: CoinBalanceDriftDto[] }) {
  const t = useTranslations("coins.drift");

  // Zero rows is the expected, healthy state, and must render NOTHING — never
  // a green "all clear" the owner would learn to ignore.
  if (drift.length === 0) return null;

  const single = drift.length === 1 ? drift[0] : null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-destructive bg-(--badge-danger-bg) p-4 sm:flex-row sm:items-start"
    >
      <AlertTriangle
        className="size-5 shrink-0 text-(--badge-danger-fg)"
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-(--badge-danger-fg)">
          {single
            ? t("title", { name: single.coinTypeName })
            : t("titleMany", { count: formatQuantity(drift.length) })}
        </p>

        {single ? (
          // Figures are pre-formatted through lib/money so they stay Latin 0–9
          // in both languages. See .claude/I18N.md §4.1
          <p className="mt-1 text-sm leading-relaxed text-(--badge-danger-fg)">
            {t("body", {
              stored: formatQuantity(single.storedCoins),
              ledger: formatQuantity(single.ledgerCoins),
              difference: formatQuantity(single.differenceCoins),
            })}
          </p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {drift.map((row) => (
              <li
                key={row.coinTypeId}
                className="text-sm text-(--badge-danger-fg)"
              >
                {t("line", {
                  name: row.coinTypeName,
                  stored: formatQuantity(row.storedCoins),
                  ledger: formatQuantity(row.ledgerCoins),
                  difference: formatQuantity(row.differenceCoins),
                })}
              </li>
            ))}
          </ul>
        )}

        {/* "Nothing has been changed" is the first thing the owner needs to
            read — the banner reports a disagreement, not a loss. */}
        <p className="mt-1 text-sm text-(--badge-danger-fg)">
          {t("reassurance")}
        </p>
      </div>

      {/* `Recalculate from ledger` is deliberately absent: repairing the cache
          is a write against the coin type and no endpoint exposes one. The
          banner does what it can honestly do — send the owner to the ledger.
          Reported as a gap rather than faked. */}
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link
            href={single ? `/coins/types/${single.coinTypeId}` : "/coins/types"}
          >
            {t("openLedger")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
