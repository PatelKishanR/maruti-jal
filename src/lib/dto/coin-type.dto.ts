import type { CoinLedgerEntry, CoinType } from "@/lib/db/entities";
import type {
  LedgerMovementType,
  LedgerSourceType,
} from "@/lib/db/entities/enums";
import type { ListResult } from "@/lib/table/types";
import { LOW_STOCK_PACKETS } from "@/lib/validation/coin-type";

/**
 * Plain shapes crossing the server → client boundary.
 *
 * TypeORM entities are CLASS INSTANCES and React's server-component serialiser
 * rejects them outright ("Only plain objects can be passed to Client
 * Components"). Mapping once here is also the only place a field can be kept
 * off the wire. See .claude/ARCHITECTURE.md §4.1 rule 8
 */

/* ── Money note ───────────────────────────────────────────────────────────
 *
 * Stock value is `balance_coins × per_coin_price`, and per-coin price is held
 * to six decimals precisely because packets rarely divide cleanly. There is no
 * generated column for it, so the PRODUCT is computed here and rounded to two
 * decimals exactly as MODULES/04-coins.md §8.2 prescribes for row-level
 * amounts.
 *
 * This is a per-row product for DISPLAY, not a total. Every TOTAL in this
 * module — the KPI strip, the ledger reconciliation — is summed in SQL by the
 * repository, because `reduce((a, b) => a + b)` over money is a code-review
 * failure. See .claude/ARCHITECTURE.md §9.1
 */
function stockValueOf(coins: number, perCoinPrice: number): number {
  return Math.round(coins * perCoinPrice * 100) / 100;
}

/** Whole packets plus the loose remainder — the owner counts in packets. */
export function packetBreakdown(
  coins: number,
  coinsPerPacket: number,
): { packets: number; looseCoins: number } {
  if (!Number.isFinite(coinsPerPacket) || coinsPerPacket <= 0) {
    return { packets: 0, looseCoins: coins };
  }
  return {
    packets: Math.floor(coins / coinsPerPacket),
    looseCoins: coins % coinsPerPacket,
  };
}

export interface CoinTypeDto {
  id: string;
  name: string;
  coinsPerPacket: number;
  packetAmount: number;
  /**
   * GENERATED in PostgreSQL as `round(packet_amount / coins_per_packet, 6)`.
   * Never written by the app — display it, never post it.
   */
  perCoinPrice: number;
  /**
   * A CACHE of the ledger balance, maintained by a trigger on every ledger
   * insert. Nothing in the application may write it.
   */
  balanceCoins: number;
  /** `balanceCoins × perCoinPrice`, rounded to 2dp. Display only. */
  stockValue: number;
  /** `24 packets + 40 coins` — the readable half of the stock figure. */
  stockPackets: number;
  stockLooseCoins: number;
  colourHex: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoinTypeListItemDto extends CoinTypeDto {
  /** Below 5 packets. Drives the amber `Low` badge on the row. Design §3.5 */
  lowStock: boolean;
}

/**
 * The reconciliation band at the top of the ledger. Design §5.4:
 *
 *   Opening 3,000 + In 640 − Out 1,200 = Balance 2,440 coins (₹24,400.00)
 *
 * Every figure here is summed in SQL. `driftCoins` is the whole reason the
 * band exists: the cached balance and an independent re-sum of the ledger must
 * agree, and a non-zero difference replaces the green band with the
 * non-dismissible §13 danger banner.
 */
export interface CoinReconciliationDto {
  openingCoins: number;
  inCoins: number;
  outCoins: number;
  /** The trigger-maintained cache on `coin_types`. */
  balanceCoins: number;
  /** Σ of every `coins_delta`, recomputed from the ledger. */
  ledgerBalanceCoins: number;
  /** What the current balance is worth at today's per-coin price. */
  balanceValue: number;
  entryCount: number;
  /** cache − ledger. Non-zero is a Sev-1. */
  driftCoins: number;
}

export interface CoinTypeDetailDto extends CoinTypeDto {
  ledgerEntryCount: number;
  /**
   * Coins issued to staff and not yet returned or redeemed.
   * Issues less returns less redemptions, aggregated by
   * `v_coins_in_circulation`.
   */
  coinsOutWithStaff: number;
  reconciliation: CoinReconciliationDto;
  /** Itemised reasons this coin type cannot be deactivated. Empty = allowed. */
  deactivateBlockers: DeactivateBlocker[];
}

/** A single itemised reason, as a catalogue key plus its figure. */
export interface DeactivateBlocker {
  /** e.g. `coins.types.deactivate.blockedBalance` */
  key: string;
  coins: number;
}

/** The §3.2 KPI strip. Summed in SQL across every non-deleted coin type. */
export interface CoinTypeSummaryDto {
  total: number;
  active: number;
  inactive: number;
  coinsInStock: number;
  valueInStock: number;
  /** The same stock read the way it is physically counted. */
  packetsInStock: number;
  looseCoinsInStock: number;
  /**
   * The float: coins out with staff across every type, and what it is worth.
   * Summed in SQL over `v_coins_in_circulation`, whose per-type values are
   * already rounded — so this total reconciles with the rows beneath it.
   */
  coinsOutWithStaff: number;
  valueOutWithStaff: number;
}

/**
 * What `GET /api/coin-types` returns: the page AND its KPI strip.
 *
 * One payload rather than two round trips — the strip and the table are read
 * together every time, and a KPI that lands a beat after its table reads as the
 * page still loading.
 */
export interface CoinTypeListResponseDto extends ListResult<CoinTypeListItemDto> {
  summary: CoinTypeSummaryDto;
}

/** One line of the register. Append-only — there is no update path. */
export interface LedgerEntryDto {
  id: string;
  /** Per-coin-type sequence. The register's row number, and its sort order. */
  entrySeq: number;
  entryDate: string;
  occurredAt: string;
  movementType: LedgerMovementType;
  /** SIGNED and never zero. Negative means coins left company stock. */
  coinsDelta: number;
  /** Split out so the register can rule its In and Out money columns. */
  inCoins: number | null;
  outCoins: number | null;
  balanceAfterCoins: number;
  unitValue: number;
  valueDelta: number;
  sourceType: LedgerSourceType;
  sourceId: string | null;
  /**
   * The clickable document code — `CIS-000012`, `ORD-000044`.
   * TODO(wave-3): resolved by the service from the issue / payment
   * repositories. Adjustments have no code column at all, so `OPENING` rows
   * legitimately render an em dash.
   */
  reference: string | null;
  staffId: string | null;
  note: string | null;
}

/** Totals as the ledger repository returns them, summed in SQL. */
export interface CoinLedgerTotals {
  openingCoins: number;
  inCoins: number;
  outCoins: number;
  netCoins: number;
  entryCount: number;
}

/* ── Mappers ──────────────────────────────────────────────────────────── */

export function toCoinTypeDto(entity: CoinType): CoinTypeDto {
  const { packets, looseCoins } = packetBreakdown(
    entity.balanceCoins,
    entity.coinsPerPacket,
  );

  return {
    id: entity.id,
    name: entity.name,
    coinsPerPacket: entity.coinsPerPacket,
    packetAmount: entity.packetAmount,
    perCoinPrice: entity.perCoinPrice,
    balanceCoins: entity.balanceCoins,
    stockValue: stockValueOf(entity.balanceCoins, entity.perCoinPrice),
    stockPackets: packets,
    stockLooseCoins: looseCoins,
    colourHex: entity.colourHex,
    isActive: entity.isActive,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export function toCoinTypeListItemDto(entity: CoinType): CoinTypeListItemDto {
  const base = toCoinTypeDto(entity);
  return {
    ...base,
    lowStock:
      base.balanceCoins > 0 && base.stockPackets < LOW_STOCK_PACKETS,
  };
}

export function toCoinTypeDetailDto(
  entity: CoinType,
  totals: CoinLedgerTotals,
  coinsOutWithStaff: number,
  deactivateBlockers: DeactivateBlocker[],
): CoinTypeDetailDto {
  const base = toCoinTypeDto(entity);

  return {
    ...base,
    ledgerEntryCount: totals.entryCount,
    coinsOutWithStaff,
    deactivateBlockers,
    reconciliation: {
      openingCoins: totals.openingCoins,
      inCoins: totals.inCoins,
      outCoins: totals.outCoins,
      balanceCoins: entity.balanceCoins,
      ledgerBalanceCoins: totals.netCoins,
      // What the stock is worth NOW, not the historical sum of value deltas —
      // old entries snapshot the rate they moved at, which is the right answer
      // for the ledger and the wrong one for "what is in the store room".
      balanceValue: base.stockValue,
      entryCount: totals.entryCount,
      driftCoins: entity.balanceCoins - totals.netCoins,
    },
  };
}

export function toLedgerEntryDto(entry: CoinLedgerEntry): LedgerEntryDto {
  return {
    id: entry.id,
    entrySeq: entry.entrySeq,
    entryDate: entry.entryDate,
    occurredAt: entry.occurredAt.toISOString(),
    movementType: entry.movementType,
    coinsDelta: entry.coinsDelta,
    // Two signals, never one: the badge says which movement, the COLUMN says
    // which direction. A colour-blind reader still reads it correctly.
    inCoins: entry.coinsDelta > 0 ? entry.coinsDelta : null,
    outCoins: entry.coinsDelta < 0 ? -entry.coinsDelta : null,
    balanceAfterCoins: entry.balanceAfterCoins,
    unitValue: entry.unitValue,
    valueDelta: entry.valueDelta,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId ?? null,
    // TODO(wave-3): coin issues and orders carry the document code.
    reference: null,
    staffId: entry.staffId,
    note: entry.note,
  };
}

/** Option shape for `<EntityCombobox>`. Deliberately structural — the service
 *  must not import a client component. Coin issues and payments consume this. */
export interface CoinTypeOptionDto {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}
