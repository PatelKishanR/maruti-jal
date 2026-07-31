import type { TableConfig } from "@/lib/table/types";

/**
 * The coin-adjustment table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/04-coins.md
 *
 * Written ahead of the module (wave 3) so the allowlist exists in ONE place
 * from the first line of UI code. `CoinAdjustmentRepository` already imports it.
 *
 * Client-safe by construction — zod and types only, no `server-only`, no
 * entity or repository imports. See .claude/MODULE-RECIPE.md §1
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

export const coinAdjustmentTableConfig = {
  sortable: COIN_ADJUSTMENT_SORT_COLUMNS,
  /** Newest correction first — an adjustment is read as "what changed?". */
  defaultSort: { key: "adjustmentDate", dir: "desc" },
  /**
   * The note, which is mandatory on every adjustment and is the only free text
   * the row carries. See .claude/DATA-MODEL.md §5.13
   */
  searchable: ["ca.note"],
  /**
   * TODO(wave-3): coin type, direction, reason and the date range get their Zod
   * schemas here when the list page ships. The repository already filters on
   * all four.
   */
  filters: {},
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
