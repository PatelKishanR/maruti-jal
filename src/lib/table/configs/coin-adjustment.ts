import { z } from "zod";
import { ADJUSTMENT_REASONS, PAYMENT_DIRECTIONS } from "@/lib/db/entities/enums";
import type { TableConfig } from "@/lib/table/types";

/**
 * The coin-adjustment table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/04-coins.md §11
 *
 * Client-safe by construction — `entities/enums` is a plain list of const
 * arrays with no database dependency, exactly as `validation/coin-type.ts`
 * imports it. No `server-only`, no entity or repository imports.
 * See .claude/MODULE-RECIPE.md §1
 */

/**
 * Public sort key → hard-coded qualified SQL column.
 *
 * THE INJECTION DEFENCE IS THIS MAP: user input is only ever a lookup KEY into
 * it, so `?sort=id;DROP TABLE coin_adjustments` misses it and falls back to the
 * default. See .claude/ARCHITECTURE.md §6.2
 */
export const COIN_ADJUSTMENT_SORT_COLUMNS = {
  adjustmentDate: "ca.adjustmentDate",
  coins: "ca.coins",
  reason: "ca.reason",
  createdAt: "ca.createdAt",
} as const;

export type CoinAdjustmentSortKey = keyof typeof COIN_ADJUSTMENT_SORT_COLUMNS;

/** True when the parsed key is one the repository can actually order by. */
export function isCoinAdjustmentSortKey(
  key: string,
): key is CoinAdjustmentSortKey {
  return Object.hasOwn(COIN_ADJUSTMENT_SORT_COLUMNS, key);
}

/** Filter param names, so the chips, the URL and the schema cannot drift. */
export const COIN_ADJUSTMENT_FILTERS = {
  direction: "direction",
  reason: "reason",
  coinTypeId: "coinTypeId",
  from: "from",
  to: "to",
} as const;

const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const coinAdjustmentTableConfig = {
  sortable: COIN_ADJUSTMENT_SORT_COLUMNS,
  /** Newest correction first — an adjustment is read as "what changed?". */
  defaultSort: { key: "adjustmentDate", dir: "desc" },
  /**
   * The note, which is mandatory on every adjustment and is the only free text
   * the row carries. See .claude/DATA-MODEL.md §5.13
   */
  searchable: ["ca.note"],
  filters: {
    [COIN_ADJUSTMENT_FILTERS.direction]: z.enum(PAYMENT_DIRECTIONS),
    [COIN_ADJUSTMENT_FILTERS.reason]: z.enum(ADJUSTMENT_REASONS),
    [COIN_ADJUSTMENT_FILTERS.coinTypeId]: z.string().uuid(),
    [COIN_ADJUSTMENT_FILTERS.from]: businessDate,
    [COIN_ADJUSTMENT_FILTERS.to]: businessDate,
  },
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
