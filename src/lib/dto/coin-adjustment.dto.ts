import type { CoinAdjustment } from "@/lib/db/entities";
import type {
  AdjustmentReason,
  PaymentDirection,
} from "@/lib/db/entities/enums";
import type { ListResult } from "@/lib/table/types";

/**
 * Plain shapes for the §11 adjustment register.
 *
 * An adjustment is a statement about physical reality at a moment in time. It
 * has no soft delete and no edit path — you do not un-state it, you state a
 * correcting one — so this DTO is read-only by construction.
 * See .claude/DATA-MODEL.md §5.13
 */
export interface CoinAdjustmentDto {
  id: string;
  /**
   * The document code the design draws as `ADJ-000007`.
   *
   * ALWAYS NULL today: `coin_adjustments` has no identity column and no
   * generated `code`, unlike `coin_issues` and `payments`. Carried on the DTO
   * so the column can appear the day the schema grows one, rather than the
   * table having to change shape. Reported as a schema gap.
   */
  code: string | null;
  coinTypeId: string;
  coinTypeName: string;
  colourHex: string | null;
  adjustmentDate: string;
  /** `IN` adds stock, `OUT` removes it. The sign lives here, never in `coins`. */
  direction: PaymentDirection;
  /** Always positive — a table constraint enforces `coins > 0`. */
  coins: number;
  /**
   * `+1,000` / `−50`, ready for the one column in the app where an explicit
   * sign is required, because direction is the entire point of it. Design §11.3
   */
  signedCoins: number;
  reason: AdjustmentReason;
  /**
   * NOT NULL and non-empty, and the database says so too
   * (`chk_coin_adjustments_note_present`). A stock adjustment with no
   * explanation is how theft hides.
   */
  note: string;
  /**
   * `coins × perCoinPrice`, rounded to 2dp at TODAY's rate.
   *
   * A per-row product for DISPLAY, exactly as `coin-type.dto` computes stock
   * value — not a total, and never summed here. The ledger row this adjustment
   * wrote holds the historical `value_delta`; this column answers "what is that
   * many coins worth", which is what the register is read for.
   */
  value: number;
  createdAt: string;
}

export type CoinAdjustmentListResponseDto = ListResult<CoinAdjustmentDto>;

export function toCoinAdjustmentDto(
  adjustment: CoinAdjustment,
): CoinAdjustmentDto {
  // The coin type is joined by `searchPaginated`; a row read without it still
  // renders every fact that belongs to the adjustment itself.
  const coinType = adjustment.coinType as
    | { name: string; colourHex: string | null; perCoinPrice: number }
    | undefined;

  const perCoinPrice = coinType?.perCoinPrice ?? 0;

  return {
    id: adjustment.id,
    code: null,
    coinTypeId: adjustment.coinTypeId,
    coinTypeName: coinType?.name ?? "",
    colourHex: coinType?.colourHex ?? null,
    adjustmentDate: adjustment.adjustmentDate,
    direction: adjustment.direction,
    coins: adjustment.coins,
    signedCoins: adjustment.direction === "IN" ? adjustment.coins : -adjustment.coins,
    reason: adjustment.reason,
    note: adjustment.note,
    value: Math.round(adjustment.coins * perCoinPrice * 100) / 100,
    createdAt: adjustment.createdAt.toISOString(),
  };
}
