import "server-only";
import type { EntityManager } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";

/**
 * `v_daily_sales` — business date × channel → revenue, collection, documents.
 *
 * RAW SQL IS ALLOWED HERE. A view has no entity for TypeORM to hydrate, so
 * `src/lib/repositories/insights/*` is the one place in this codebase that
 * writes SQL by hand: bound parameters only, read-only relations only, and
 * every cross-row total a SQL aggregate. Full rationale in
 * `staff-outstanding.repository.ts`.
 *
 * REVENUE AND COLLECTION ARE DIFFERENT DATES. An order billed on the 2nd and
 * paid on the 9th contributes revenue to the 2nd and collection to the 9th —
 * that is exactly what the view's two-source shape encodes, and why a caller
 * must never treat one as a proxy for the other.
 *
 * `business_date` is `'YYYY-MM-DD'` (parser 1082) and the money columns are
 * strings (parser 1700). The mapper in `insights.dto.ts` converts once.
 */
export type SalesChannel = "DELIVERY" | "PARTY" | "WALK_IN";

export interface DailySalesRow {
  business_date: string;
  channel: SalesChannel;
  /** numeric(12,2) — what was billed on this date. */
  revenue: string;
  /** numeric(12,2) — what was actually received on this date. */
  collection: string;
  doc_count: number;
}

export interface DailySalesTotalsRow {
  revenue: string;
  collection: string;
  doc_count: number;
}

export interface DailySalesChannelTotalsRow extends DailySalesTotalsRow {
  channel: SalesChannel;
}

/** Income and expenses for a period, with the subtraction done by PostgreSQL. */
export interface PeriodProfitRow {
  income: string;
  expenses: string;
  profit: string;
}

/**
 * What was RECEIVED in a period, less what was spent — the dashboard's
 * `TODAY'S NET` card (design/MODULES/08 §3.3.2 card 4).
 *
 * Deliberately a different row type from `PeriodProfitRow`: profit is an
 * accrual question (revenue − expenses) and net is a cash one (collection −
 * expenses). An order billed on the 2nd and paid on the 9th belongs to
 * different days in the two figures, so sharing one shape would invite the
 * wrong one being read.
 */
export interface PeriodNetRow {
  collection: string;
  expenses: string;
  net: string;
}

const COLUMNS = `business_date, channel, revenue, collection, doc_count`;

class DailySalesRepository {
  private async run<T>(
    sql: string,
    params: unknown[],
    em?: EntityManager,
  ): Promise<T[]> {
    if (em) return em.query(sql, params) as Promise<T[]>;
    const ds = await getDataSource();
    return ds.query(sql, params) as Promise<T[]>;
  }

  /** Every date × channel row in the window, oldest first — chart order. */
  async findBetween(
    from: string,
    to: string,
    em?: EntityManager,
  ): Promise<DailySalesRow[]> {
    return this.run<DailySalesRow>(
      `SELECT ${COLUMNS} FROM v_daily_sales
        WHERE business_date BETWEEN $1 AND $2
        ORDER BY business_date ASC, channel ASC`,
      [from, to],
      em,
    );
  }

  async findByDate(
    businessDate: string,
    em?: EntityManager,
  ): Promise<DailySalesRow[]> {
    return this.run<DailySalesRow>(
      `SELECT ${COLUMNS} FROM v_daily_sales
        WHERE business_date = $1
        ORDER BY channel ASC`,
      [businessDate],
      em,
    );
  }

  /** All channels collapsed. One number per column, summed by PostgreSQL. */
  async totalsBetween(
    from: string,
    to: string,
    em?: EntityManager,
  ): Promise<DailySalesTotalsRow> {
    const rows = await this.run<DailySalesTotalsRow>(
      `SELECT COALESCE(SUM(revenue), 0)::numeric(12,2)    AS revenue,
              COALESCE(SUM(collection), 0)::numeric(12,2) AS collection,
              COALESCE(SUM(doc_count), 0)::integer        AS doc_count
         FROM v_daily_sales
        WHERE business_date BETWEEN $1 AND $2`,
      [from, to],
      em,
    );

    return rows[0] ?? { revenue: "0", collection: "0", doc_count: 0 };
  }

  async totalsByChannelBetween(
    from: string,
    to: string,
    em?: EntityManager,
  ): Promise<DailySalesChannelTotalsRow[]> {
    return this.run<DailySalesChannelTotalsRow>(
      `SELECT channel,
              COALESCE(SUM(revenue), 0)::numeric(12,2)    AS revenue,
              COALESCE(SUM(collection), 0)::numeric(12,2) AS collection,
              COALESCE(SUM(doc_count), 0)::integer        AS doc_count
         FROM v_daily_sales
        WHERE business_date BETWEEN $1 AND $2
        GROUP BY channel
        ORDER BY channel ASC`,
      [from, to],
      em,
    );
  }

  /**
   * Income for a period, less an expense total, giving profit.
   *
   * WHY THE EXPENSE FIGURE IS A PARAMETER. Profit spans two modules: income
   * lives in `v_daily_sales`, spend lives in `expenses`, and no single relation
   * holds both — so no view can subtract them. The alternative is
   * `income - expenses` in TypeScript, and this codebase does not add up money
   * in TypeScript (DATA-MODEL D-4): the moment one monetary figure is derived
   * in JavaScript the next one is too, and the rule stops being enforceable.
   * Passing the expense total in as a bound `numeric` keeps the subtraction
   * where every other rupee of arithmetic in this application happens — inside
   * PostgreSQL, at full decimal precision.
   *
   * `expenseTotal` is a STRING for the same reason the money transformer writes
   * strings: `(1234.55).toString()` is fine today and a float artefact the day
   * the figure gets large enough.
   */
  async profitBetween(
    from: string,
    to: string,
    expenseTotal: string,
    em?: EntityManager,
  ): Promise<PeriodProfitRow> {
    const rows = await this.run<PeriodProfitRow>(
      `SELECT COALESCE(SUM(revenue), 0)::numeric(12,2)  AS income,
              $3::numeric(12,2)                         AS expenses,
              (COALESCE(SUM(revenue), 0) - $3::numeric)::numeric(12,2) AS profit
         FROM v_daily_sales
        WHERE business_date BETWEEN $1 AND $2`,
      [from, to, expenseTotal],
      em,
    );

    return rows[0] ?? { income: "0", expenses: expenseTotal, profit: "0" };
  }

  /**
   * Collection for a period, less the same period's spend.
   *
   * Identical reasoning to `profitBetween`, and it exists for the same reason:
   * the subtraction is money, so PostgreSQL does it. The alternative —
   * `collection - expenses` in the service — is the first crack in DATA-MODEL
   * D-4, and the dashboard is exactly where a rupee derived in JavaScript would
   * be read aloud to a bank.
   */
  async netBetween(
    from: string,
    to: string,
    expenseTotal: string,
    em?: EntityManager,
  ): Promise<PeriodNetRow> {
    const rows = await this.run<PeriodNetRow>(
      `SELECT COALESCE(SUM(collection), 0)::numeric(12,2) AS collection,
              $3::numeric(12,2)                           AS expenses,
              (COALESCE(SUM(collection), 0) - $3::numeric)::numeric(12,2) AS net
         FROM v_daily_sales
        WHERE business_date BETWEEN $1 AND $2`,
      [from, to, expenseTotal],
      em,
    );

    return rows[0] ?? { collection: "0", expenses: expenseTotal, net: "0" };
  }
}

export const dailySalesRepository = new DailySalesRepository();
