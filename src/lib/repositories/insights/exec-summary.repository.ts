import "server-only";
import type { EntityManager } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";

/**
 * `v_exec_summary` — the top of the dashboard, in exactly one row.
 *
 * RAW SQL IS ALLOWED HERE. A view has no entity for TypeORM to hydrate, so
 * `src/lib/repositories/insights/*` is the one place in this codebase that
 * writes SQL by hand: bound parameters only, read-only relations only, and
 * every cross-row total a SQL aggregate. Full rationale in
 * `staff-outstanding.repository.ts`.
 *
 * ALWAYS ONE ROW, NEVER ZERO. Every metric in the view is a scalar subquery
 * wrapped in COALESCE, hung off a one-row derived table, so an empty database
 * yields a row of zeros rather than no row at all. That is what lets `find()`
 * return a non-nullable value — the dashboard renders zeros instead of
 * disappearing. The `?? ZERO` below exists only so a dropped view surfaces as
 * an obviously-empty dashboard rather than a crash on `rows[0].revenue_today`.
 *
 * The metrics read the other four views rather than the base tables, so the
 * headline number and the chart underneath it cannot disagree.
 *
 * `as_of_date` is TODAY IN IST, not `CURRENT_DATE` — between 00:00 and 05:30
 * IST the server's UTC date still reads as yesterday. See DATA-MODEL D-5.
 */
export interface ExecSummaryRow {
  /** `'YYYY-MM-DD'` — today, as an IST business day. */
  as_of_date: string;
  /** First day of the current month. */
  month_start: string;

  /** numeric(12,2) — billed today / month to date. */
  revenue_today: string;
  revenue_mtd: string;
  /** numeric(12,2) — received today / month to date. Different dates. */
  collection_today: string;
  collection_mtd: string;

  /** numeric(12,2) — what is owed, split by where it is owed from. */
  receivable_orders: string;
  receivable_coins: string;
  receivable_party: string;
  total_receivable: string;

  jars_out: number;
  staff_with_jars_out: number;

  /** Coins sitting in the company's own stock, and their value. */
  coin_stock_coins: number;
  coin_stock_value: string;
  /** Coins out with staff — the float — and its value. */
  coin_float_coins: number;
  coin_float_value: string;

  upcoming_deliveries_7d: number;
  /** `'YYYY-MM-DD'` or null when nothing is scheduled. */
  next_service_date: string | null;
}

const ZERO: ExecSummaryRow = {
  as_of_date: "",
  month_start: "",
  revenue_today: "0",
  revenue_mtd: "0",
  collection_today: "0",
  collection_mtd: "0",
  receivable_orders: "0",
  receivable_coins: "0",
  receivable_party: "0",
  total_receivable: "0",
  jars_out: 0,
  staff_with_jars_out: 0,
  coin_stock_coins: 0,
  coin_stock_value: "0",
  coin_float_coins: 0,
  coin_float_value: "0",
  upcoming_deliveries_7d: 0,
  next_service_date: null,
};

class ExecSummaryRepository {
  private async run<T>(
    sql: string,
    params: unknown[],
    em?: EntityManager,
  ): Promise<T[]> {
    if (em) return em.query(sql, params) as Promise<T[]>;
    const ds = await getDataSource();
    return ds.query(sql, params) as Promise<T[]>;
  }

  /** The single row. */
  async find(em?: EntityManager): Promise<ExecSummaryRow> {
    const rows = await this.run<ExecSummaryRow>(
      `SELECT as_of_date, month_start,
              revenue_today, revenue_mtd, collection_today, collection_mtd,
              receivable_orders, receivable_coins, receivable_party, total_receivable,
              jars_out, staff_with_jars_out,
              coin_stock_coins, coin_stock_value, coin_float_coins, coin_float_value,
              upcoming_deliveries_7d, next_service_date
         FROM v_exec_summary`,
      [],
      em,
    );

    return rows[0] ?? ZERO;
  }
}

export const execSummaryRepository = new ExecSummaryRepository();
