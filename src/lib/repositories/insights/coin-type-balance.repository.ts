import "server-only";
import type { EntityManager } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";

/**
 * `v_coin_type_balance` — per coin type: what is on the shelf, what is out with
 * staff, and what the two are worth.
 *
 * RAW SQL IS ALLOWED HERE, on the same terms as every other file in
 * `src/lib/repositories/insights/*`: a view has no entity for TypeORM to
 * hydrate, so this is the one place the codebase writes SQL by hand — bound
 * parameters only, read-only relations only, every cross-row total a SQL
 * aggregate. Full rationale in `staff-outstanding.repository.ts`.
 *
 * WHY THIS EXISTS SEPARATELY FROM `coin-circulation.repository.ts`. The
 * circulation view answers "what is out"; this one reads it and adds the
 * trigger-maintained `coin_types.balance_coins` cache, giving stock, float and
 * the total the two make up. The coin reconciliation report needs all three on
 * one line, and re-deriving the stock half from `coin_types` in a service would
 * be the second place that arithmetic lived. See 1785700000000-DashboardViews.
 *
 * `balance_coins` is a cache of the ledger. Whether it still AGREES with the
 * ledger is `v_coin_balance_drift`'s question, not this view's — a dashboard
 * reports, a drift view accuses. The reconciliation report asks the ledger
 * itself (`coinLedgerEntryRepository.reconcileBetween`) and prints both.
 *
 * Money columns arrive as STRINGS (parser 1700); the mapper in `report.dto` /
 * `insights.dto` converts once.
 */
export interface CoinTypeBalanceRow {
  coin_type_id: string;
  coin_type_name: string;
  coins_per_packet: number;
  /** numeric(12,2) */
  packet_amount: string;
  /** numeric(14,6) */
  per_coin_price: string;
  colour_hex: string | null;
  is_active: boolean;
  /** The trigger-maintained ledger cache — coins on the shelf right now. */
  balance_coins: number;
  /** numeric(12,2) — `balance_coins` at today's per-coin price. */
  stock_value: string;
  coins_in_circulation: number;
  /** numeric(12,2) — the float, at today's rate. */
  value_at_risk: string;
  coins_issued: number;
  coins_returned: number;
  coins_redeemed: number;
  open_issue_count: number;
  staff_holding_count: number;
  /** Shelf plus field: every coin the company can still account for. */
  coins_accounted_for: number;
  /** numeric(12,2) */
  total_value: string;
}

export interface CoinTypeBalanceTotalsRow {
  balance_coins: number;
  stock_value: string;
  coins_in_circulation: number;
  value_at_risk: string;
  type_count: number;
}

const COLUMNS = `coin_type_id, coin_type_name, coins_per_packet, packet_amount,
                 per_coin_price, colour_hex, is_active, balance_coins, stock_value,
                 coins_in_circulation, value_at_risk, coins_issued, coins_returned,
                 coins_redeemed, open_issue_count, staff_holding_count,
                 coins_accounted_for, total_value`;

class CoinTypeBalanceRepository {
  private async run<T>(
    sql: string,
    params: unknown[],
    em?: EntityManager,
  ): Promise<T[]> {
    if (em) return em.query(sql, params) as Promise<T[]>;
    const ds = await getDataSource();
    return ds.query(sql, params) as Promise<T[]>;
  }

  /** Every coin type, biggest holding first. */
  async findAll(em?: EntityManager): Promise<CoinTypeBalanceRow[]> {
    return this.run<CoinTypeBalanceRow>(
      `SELECT ${COLUMNS} FROM v_coin_type_balance
        ORDER BY total_value DESC, coin_type_name ASC`,
      [],
      em,
    );
  }

  /** One type — the coin reconciliation report filtered to a single token. */
  async findByCoinTypeId(
    coinTypeId: string,
    em?: EntityManager,
  ): Promise<CoinTypeBalanceRow[]> {
    return this.run<CoinTypeBalanceRow>(
      `SELECT ${COLUMNS} FROM v_coin_type_balance
        WHERE coin_type_id = $1`,
      [coinTypeId],
      em,
    );
  }

  /**
   * The summary band's first three cells.
   *
   * Summing the view's per-type figures — which are themselves already rounded
   * to two decimals — is what makes this total reconcile EXACTLY with the rows
   * printed underneath it. Rounding after the sum would be off by a paisa on
   * precisely the days it mattered.
   */
  async totals(em?: EntityManager): Promise<CoinTypeBalanceTotalsRow> {
    const rows = await this.run<CoinTypeBalanceTotalsRow>(
      `SELECT COALESCE(SUM(balance_coins), 0)::integer            AS balance_coins,
              COALESCE(SUM(stock_value), 0)::numeric(12,2)        AS stock_value,
              COALESCE(SUM(coins_in_circulation), 0)::integer     AS coins_in_circulation,
              COALESCE(SUM(value_at_risk), 0)::numeric(12,2)      AS value_at_risk,
              COUNT(*)::integer                                   AS type_count
         FROM v_coin_type_balance`,
      [],
      em,
    );

    return (
      rows[0] ?? {
        balance_coins: 0,
        stock_value: "0",
        coins_in_circulation: 0,
        value_at_risk: "0",
        type_count: 0,
      }
    );
  }
}

export const coinTypeBalanceRepository = new CoinTypeBalanceRepository();
