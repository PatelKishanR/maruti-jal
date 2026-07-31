/**
 * The §13 reconciliation drift banner's payload.
 *
 * `coin_types.balance_coins` is a CACHE maintained by a trigger on every
 * `coin_ledger_entries` insert. Three independent statements of the same number
 * must agree: the cache, the sum of every movement, and the running balance the
 * ledger itself recorded. `v_coin_balance_drift` returns one row per coin type
 * where they do NOT, and is expected to return zero rows forever.
 *
 * A non-empty result is a Sev-1, which is why the banner it drives is
 * non-dismissible and takes focus on render.
 * See .claude/DATA-MODEL.md §8.3 and design MODULES/04-coins §13
 */
export interface CoinBalanceDriftDto {
  coinTypeId: string;
  coinTypeName: string;
  /** What `coin_types` says it holds. */
  storedCoins: number;
  /** Σ of every `coins_delta`, recomputed from the ledger. */
  ledgerCoins: number;
  /** `balance_after_coins` on the most recent entry. */
  latestBalanceAfter: number;
  entryCount: number;
  /** Always positive — the direction is not the point, the disagreement is. */
  differenceCoins: number;
}
