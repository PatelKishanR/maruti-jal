import { z } from "zod";
import type { TableConfig } from "@/lib/table/types";

/**
 * Coin type table contract. Spec: .claude/ARCHITECTURE.md §6.1
 *
 * `sortable` is the SQL-injection defence, and it is STRUCTURAL rather than
 * escaping-based: user input is only ever a lookup KEY into this map, and the
 * values are string literals written by us. `?sort=id;DROP TABLE coin_types`
 * misses the map and falls back to `name`, so there is nothing to escape
 * wrongly. §6.2
 *
 * THE SINGLE SOURCE OF TRUTH: `CoinTypeRepository` imports this map rather than
 * keeping a second copy. The service hands `query.sort.key` straight to the
 * repository, so a key here the repository did not know would silently fall
 * back to its default and the two views of "sorted by" would disagree.
 * See .claude/MODULE-RECIPE.md §1
 */
export const COIN_TYPE_SORT_COLUMNS = {
  name: "ct.name",
  coinsPerPacket: "ct.coinsPerPacket",
  packetAmount: "ct.packetAmount",
  perCoinPrice: "ct.perCoinPrice",
  balanceCoins: "ct.balanceCoins",
  createdAt: "ct.createdAt",
} as const;

export type CoinTypeSortKey = keyof typeof COIN_TYPE_SORT_COLUMNS;

export const coinTypeTableConfig = {
  sortable: COIN_TYPE_SORT_COLUMNS,
  defaultSort: { key: "name", dir: "asc" },
  /**
   * Name only. A coin type has no code, no phone and no note — the one thing
   * the owner searches for is what he called it.
   */
  searchable: ["ct.name"],
  filters: {
    status: z.enum(["active", "inactive"]),
  },
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;

/** True when the parsed key is one the repository can actually order by. */
export function isCoinTypeSortKey(key: string): key is CoinTypeSortKey {
  return Object.hasOwn(COIN_TYPE_SORT_COLUMNS, key);
}
