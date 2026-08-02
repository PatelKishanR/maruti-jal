import "server-only";
import type { EntityManager } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";

/**
 * `v_coins_in_circulation` — per coin type, how many coins are out with staff
 * and what that float is worth.
 *
 * RAW SQL IS ALLOWED HERE. A view has no entity for TypeORM to hydrate, so
 * `src/lib/repositories/insights/*` is the one place in this codebase that
 * writes SQL by hand: bound parameters only, read-only relations only, and
 * every cross-row total a SQL aggregate. Full rationale in
 * `staff-outstanding.repository.ts`.
 *
 * `per_coin_price` is numeric(14,6) and `value_in_circulation` numeric(12,2);
 * both arrive as STRINGS (parser 1700) and are converted once by the mapper in
 * `insights.dto.ts`.
 */
export interface CoinCirculationRow {
  coin_type_id: string;
  coin_type_name: string;
  /** numeric(14,6) — packet_amount / coins_per_packet, generated. */
  per_coin_price: string;
  coins_issued: number;
  coins_returned: number;
  coins_redeemed: number;
  /** Issued less returned less redeemed. What staff are still holding. */
  coins_in_circulation: number;
  /** numeric(12,2) — that float at today's per-coin price. */
  value_in_circulation: string;
  open_issue_count: number;
  /** How many distinct staff members hold coins of this type. */
  staff_holding_count: number;
}

export interface CoinCirculationTotalsRow {
  coins_in_circulation: number;
  value_in_circulation: string;
  coins_issued: number;
  coins_returned: number;
  coins_redeemed: number;
  open_issue_count: number;
}

const COLUMNS = `coin_type_id, coin_type_name, per_coin_price,
                 coins_issued, coins_returned, coins_redeemed,
                 coins_in_circulation, value_in_circulation,
                 open_issue_count, staff_holding_count`;

class CoinCirculationRepository {
  private async run<T>(
    sql: string,
    params: unknown[],
    em?: EntityManager,
  ): Promise<T[]> {
    if (em) return em.query(sql, params) as Promise<T[]>;
    const ds = await getDataSource();
    return ds.query(sql, params) as Promise<T[]>;
  }

  async findAll(em?: EntityManager): Promise<CoinCirculationRow[]> {
    return this.run<CoinCirculationRow>(
      `SELECT ${COLUMNS} FROM v_coins_in_circulation
        ORDER BY value_in_circulation DESC, coin_type_name ASC`,
      [],
      em,
    );
  }

  async findByCoinTypeId(
    coinTypeId: string,
    em?: EntityManager,
  ): Promise<CoinCirculationRow | null> {
    const rows = await this.run<CoinCirculationRow>(
      `SELECT ${COLUMNS} FROM v_coins_in_circulation WHERE coin_type_id = $1`,
      [coinTypeId],
      em,
    );
    return rows[0] ?? null;
  }

  async findByCoinTypeIds(
    coinTypeIds: string[],
    em?: EntityManager,
  ): Promise<CoinCirculationRow[]> {
    if (coinTypeIds.length === 0) return [];
    return this.run<CoinCirculationRow>(
      `SELECT ${COLUMNS} FROM v_coins_in_circulation
        WHERE coin_type_id = ANY($1::uuid[])`,
      [coinTypeIds],
      em,
    );
  }

  /**
   * The float across every coin type — the "out with staff" half of the KPI
   * strip on the coin types list.
   *
   * `value_in_circulation` is already rounded to two decimals per coin type by
   * the view; summing those rounded figures is what makes this total reconcile
   * exactly with the rows underneath it. Rounding after the sum would be off by
   * a paisa on the days it mattered most.
   */
  async totals(em?: EntityManager): Promise<CoinCirculationTotalsRow> {
    const rows = await this.run<CoinCirculationTotalsRow>(
      `SELECT COALESCE(SUM(coins_in_circulation), 0)::integer      AS coins_in_circulation,
              COALESCE(SUM(value_in_circulation), 0)::numeric(12,2) AS value_in_circulation,
              COALESCE(SUM(coins_issued), 0)::integer              AS coins_issued,
              COALESCE(SUM(coins_returned), 0)::integer            AS coins_returned,
              COALESCE(SUM(coins_redeemed), 0)::integer            AS coins_redeemed,
              COALESCE(SUM(open_issue_count), 0)::integer          AS open_issue_count
         FROM v_coins_in_circulation`,
      [],
      em,
    );

    return (
      rows[0] ?? {
        coins_in_circulation: 0,
        value_in_circulation: "0",
        coins_issued: 0,
        coins_returned: 0,
        coins_redeemed: 0,
        open_issue_count: 0,
      }
    );
  }
}

export const coinCirculationRepository = new CoinCirculationRepository();
