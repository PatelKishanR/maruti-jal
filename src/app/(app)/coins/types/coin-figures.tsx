import { useTranslations } from "next-intl";
import {
  Ban,
  BookOpen,
  ClipboardList,
  Coins,
  PackageX,
  Plus,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyFigure } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { formatQuantity, formatRupeesPlain } from "@/lib/money";
import { packetBreakdown } from "@/lib/dto/coin-type.dto";
import type { LedgerMovementType } from "@/lib/db/entities/enums";

/**
 * The figures that are specific to coins.
 *
 * `<Money>` renders every amount in this app at two decimals, which is right
 * for every amount except one: a coin's per-coin value is a DIVISION and rarely
 * lands clean, so it is held at six. Everything else here is about the second
 * distinctive thing — the owner counts coins in packets, and the ledger counts
 * them in coins, so stock is always shown both ways.
 *
 * See MODULES/04-coins.md §8.2 and design MODULES/04-coins §3.3
 */

/**
 * `₹10.00` when it divides evenly, `₹11.111111` when it doesn't.
 *
 * Trailing zeros are trimmed back to a minimum of two decimals, so an even rate
 * reads like every other amount on the page and an uneven one shows its full
 * precision rather than lying at `₹11.11`.
 *
 * Grouping comes from `lib/money` rather than `Intl` directly — see the note at
 * the top of that file. It has no six-decimal formatter yet; when it grows one,
 * this collapses to a call.
 */
export function formatPerCoinValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  const negative = value < 0;
  const [whole, fraction = "000000"] = Math.abs(value).toFixed(6).split(".");
  const decimals = fraction.replace(/0+$/, "").padEnd(2, "0");
  const grouped = formatRupeesPlain(Number(whole)).split(".")[0];

  return `${negative ? "-" : ""}₹${grouped}.${decimals}`;
}

/** Right-aligned, mono, muted. Design §3.3: the per-coin column is secondary. */
export function PerCoinValue({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined) return <EmptyFigure />;

  return (
    <span
      className={cn(
        "font-mono text-right font-medium tabular-nums text-muted-foreground",
        className,
      )}
    >
      {formatPerCoinValue(value)}
    </span>
  );
}

/**
 * `24 packets + 40 coins`, or `32 packets` when it divides exactly.
 *
 * Never `32 packets + 0 coins` — the owner reads this to know what to carry,
 * and a trailing zero is noise he has to parse past every time. Design §3.3
 */
export function StockPackets({
  coins,
  coinsPerPacket,
  className,
}: {
  coins: number;
  coinsPerPacket: number;
  className?: string;
}) {
  const t = useTranslations("coins.types.stock");

  if (!coins) return <EmptyFigure />;

  const { packets, looseCoins } = packetBreakdown(coins, coinsPerPacket);

  // Figures are pre-formatted through lib/money so they stay Latin 0–9 in both
  // languages. Handing next-intl a raw number would let it apply the locale's
  // own numbering system, and `gu-IN` can render ૨૪. See .claude/I18N.md §4.1
  const figure = (chunks: React.ReactNode) => (
    <span className="font-mono font-medium tabular-nums text-foreground">
      {chunks}
    </span>
  );

  return (
    <span className={cn("text-sm text-muted-foreground", className)}>
      {looseCoins > 0
        ? t.rich("packetsPlusCoins", {
            packets: formatQuantity(packets),
            coins: formatQuantity(looseCoins),
            fig: figure,
          })
        : t.rich("packets", {
            packets: formatQuantity(packets),
            fig: figure,
          })}
    </span>
  );
}

/** The 10px colour dot before a coin type's name. Raw hex in both themes. */
export function ColourDot({
  colour,
  size = 10,
  className,
}: {
  colour: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: colour ?? "var(--muted-foreground)",
      }}
    />
  );
}

/* ── Ledger movements ─────────────────────────────────────────────────────
 *
 * All seven, each with a badge variant AND an icon AND a direction column.
 * Two signals, never one: the badge says which movement, the column says which
 * way the coins went, so a colour-blind reader still reads it correctly.
 * Design MODULES/04-coins §5.4
 */

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

export const MOVEMENT_META: Record<
  LedgerMovementType,
  { variant: BadgeVariant; icon: LucideIcon }
> = {
  OPENING: { variant: "default", icon: BookOpen },
  ISSUE: { variant: "danger", icon: Coins },
  ISSUE_RETURN: { variant: "success", icon: RotateCcw },
  ORDER_RECEIPT: { variant: "primary", icon: ClipboardList },
  ADJUSTMENT_IN: { variant: "success", icon: Plus },
  ADJUSTMENT_OUT: { variant: "danger", icon: PackageX },
  ISSUE_CANCELLED: { variant: "warning", icon: Ban },
};

export function MovementBadge({ movement }: { movement: LedgerMovementType }) {
  const t = useTranslations("coins.ledger.movements");
  const { variant, icon: Icon } = MOVEMENT_META[movement];

  return (
    <Badge variant={variant} icon={<Icon aria-hidden />}>
      {t(movement)}
    </Badge>
  );
}
