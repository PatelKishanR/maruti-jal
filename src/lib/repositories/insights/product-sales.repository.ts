import "server-only";
import type { EntityManager } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";

/**
 * `v_product_sales` — product × month → quantity, revenue, realised vs base
 * price.
 *
 * RAW SQL IS ALLOWED HERE. A view has no entity for TypeORM to hydrate, so
 * `src/lib/repositories/insights/*` is the one place in this codebase that
 * writes SQL by hand: bound parameters only, read-only relations only, and
 * every cross-row total a SQL aggregate. Full rationale in
 * `staff-outstanding.repository.ts`.
 *
 * TWO QUANTITIES, BOTH REAL. `qty_issued` is what physically left the plant;
 * `qty_billed` is what was charged for, which on a delivery line is
 * `quantity - returned_filled_qty` because decision D5 bills the staff member
 * only for what he sold. `avg_realised_price` is revenue ÷ `qty_billed`, so any
 * caller pairing units with revenue or an average price must use `qty_billed`
 * or the three figures will not multiply out.
 *
 * WALK-INS ARE ABSENT BY CONSTRUCTION. `direct_sales` carries an amount but no
 * quantity and no unit price, so it cannot contribute a single column here.
 * Walk-in revenue lives in `v_daily_sales` under the WALK_IN channel.
 *
 * `month` is the FIRST DAY of the month as a date (`'2026-08-01'`), not
 * `'YYYY-MM'` — parser 1082 keeps it a string, and callers that speak in
 * `'YYYY-MM'` must pass `${month}-01`.
 */
export interface ProductSalesRow {
  product_id: string;
  product_code: string;
  product_title: string;
  /** numeric(12,2) — TODAY's list price, for comparison against what was got. */
  current_base_price: string;
  /** First day of the month, `'YYYY-MM-01'`. */
  month: string;
  qty_issued: number;
  qty_billed: number;
  /** numeric(12,2) — the sum of `line_total`, so it ties to v_daily_sales. */
  revenue: string;
  /** numeric(12,2) — what it would have come to at the snapshot list price. */
  base_value: string;
  /** numeric(12,2) — `base_value - revenue`. Negative means sold above list. */
  discount_value: string;
  /** numeric(14,6), NULL when nothing was billed — never a divide by zero. */
  avg_realised_price: string | null;
  avg_base_price: string | null;
  line_count: number;
  document_count: number;
}

/** Lifetime figures for one product, across every month. */
export interface ProductSalesLifetimeRow {
  qty_issued: number;
  qty_billed: number;
  revenue: string;
  line_count: number;
  document_count: number;
  /** The most recent month with any movement, or null. */
  last_month: string | null;
}

/**
 * One product's whole movement over a MONTH RANGE, with the channel split
 * pivoted into columns — the product movement report's row. §9
 */
export interface ProductMovementRow {
  product_id: string;
  product_code: string;
  product_title: string;
  current_base_price: string;
  delivery_qty: number;
  party_qty: number;
  qty_issued: number;
  qty_billed: number;
  revenue: string;
  base_value: string;
  discount_value: string;
  avg_realised_price: string | null;
  avg_base_price: string | null;
  line_count: number;
  document_count: number;
}

export interface ProductMovementTotalsRow {
  delivery_qty: number;
  party_qty: number;
  qty_billed: number;
  revenue: string;
  base_value: string;
  discount_value: string;
  /** numeric(6,1) — how far below list the period ran, as a percentage. */
  discount_percent: string | null;
}

/** One row of the top-by-X KPI cards. */
export interface ProductSalesLeaderRow {
  product_id: string;
  product_title: string;
  qty_billed: number;
  revenue: string;
}

const COLUMNS = `product_id, product_code, product_title, current_base_price, month,
                 qty_issued, qty_billed, revenue, base_value, discount_value,
                 avg_realised_price, avg_base_price, line_count, document_count`;

class ProductSalesRepository {
  private async run<T>(
    sql: string,
    params: unknown[],
    em?: EntityManager,
  ): Promise<T[]> {
    if (em) return em.query(sql, params) as Promise<T[]>;
    const ds = await getDataSource();
    return ds.query(sql, params) as Promise<T[]>;
  }

  /** Every product that moved in `month` (`'YYYY-MM-01'`), best seller first. */
  async findByMonth(
    month: string,
    em?: EntityManager,
  ): Promise<ProductSalesRow[]> {
    return this.run<ProductSalesRow>(
      `SELECT ${COLUMNS} FROM v_product_sales
        WHERE month = $1::date
        ORDER BY revenue DESC, product_code ASC`,
      [month],
      em,
    );
  }

  /** One product's whole history, newest month first. */
  async findByProductId(
    productId: string,
    em?: EntityManager,
  ): Promise<ProductSalesRow[]> {
    return this.run<ProductSalesRow>(
      `SELECT ${COLUMNS} FROM v_product_sales
        WHERE product_id = $1
        ORDER BY month DESC`,
      [productId],
      em,
    );
  }

  async findByProductAndMonth(
    productId: string,
    month: string,
    em?: EntityManager,
  ): Promise<ProductSalesRow | null> {
    const rows = await this.run<ProductSalesRow>(
      `SELECT ${COLUMNS} FROM v_product_sales
        WHERE product_id = $1 AND month = $2::date`,
      [productId, month],
      em,
    );
    return rows[0] ?? null;
  }

  /**
   * Lifetime totals for one product.
   *
   * `document_count` is summed across months rather than counted distinctly —
   * an order belongs to exactly one month, so the sum IS the distinct count and
   * the view has already paid for the DISTINCT.
   */
  async lifetimeForProduct(
    productId: string,
    em?: EntityManager,
  ): Promise<ProductSalesLifetimeRow> {
    const rows = await this.run<ProductSalesLifetimeRow>(
      `SELECT COALESCE(SUM(qty_issued), 0)::integer     AS qty_issued,
              COALESCE(SUM(qty_billed), 0)::integer     AS qty_billed,
              COALESCE(SUM(revenue), 0)::numeric(12,2)  AS revenue,
              COALESCE(SUM(line_count), 0)::integer     AS line_count,
              COALESCE(SUM(document_count), 0)::integer AS document_count,
              MAX(month)                                AS last_month
         FROM v_product_sales
        WHERE product_id = $1`,
      [productId],
      em,
    );

    return (
      rows[0] ?? {
        qty_issued: 0,
        qty_billed: 0,
        revenue: "0",
        line_count: 0,
        document_count: 0,
        last_month: null,
      }
    );
  }

  /**
   * The two KPI leader cards for a month: most units, most money.
   *
   * They are genuinely different products often enough to be worth two cards —
   * the cheap jar wins on volume while the chilled one wins on revenue, which
   * is the whole point of showing both. `product_title` is the tiebreaker so a
   * dead heat renders the same product on every reload rather than alternating.
   */
  async leadersForMonth(
    month: string,
    em?: EntityManager,
  ): Promise<{
    byVolume: ProductSalesLeaderRow | null;
    byRevenue: ProductSalesLeaderRow | null;
  }> {
    const [volume, revenue] = await Promise.all([
      this.run<ProductSalesLeaderRow>(
        `SELECT product_id, product_title, qty_billed, revenue
           FROM v_product_sales
          WHERE month = $1::date AND qty_billed > 0
          ORDER BY qty_billed DESC, product_title ASC
          LIMIT 1`,
        [month],
        em,
      ),
      this.run<ProductSalesLeaderRow>(
        `SELECT product_id, product_title, qty_billed, revenue
           FROM v_product_sales
          WHERE month = $1::date AND revenue > 0
          ORDER BY revenue DESC, product_title ASC
          LIMIT 1`,
        [month],
        em,
      ),
    ]);

    return { byVolume: volume[0] ?? null, byRevenue: revenue[0] ?? null };
  }

  /**
   * The product movement report: every product that moved between two months,
   * with its channel split folded into columns. §9
   *
   * THE VIEW KEYS ON THE MONTH, so both bounds are the FIRST DAY of a month and
   * the caller must snap its date range to whole months before calling. A range
   * of 05–20 Aug therefore reports the whole of August. That is stated on the
   * report rather than hidden, because silently widening a period is how a
   * figure gets quoted for the wrong fortnight.
   *
   * `qty_billed`, not `qty_issued`, is what pairs with revenue and the average
   * price — a filled jar handed straight back was never sold (decision D5), and
   * dividing revenue by issued quantity understates the realised rate on every
   * route that took stock back.
   *
   * WALK-INS ARE STRUCTURALLY ABSENT. `direct_sales` records an amount and no
   * quantity, so the view has no walk-in branch and this query cannot invent
   * one. Walk-in revenue is read separately from `v_daily_sales`.
   *
   * The averages are recomputed from the SUMS, never averaged across months —
   * `avg(avg)` is wrong, and a wrong average printed with two decimals is worse
   * than none.
   */
  async findBetweenMonths(
    fromMonth: string,
    toMonth: string,
    productIds?: readonly string[] | null,
    em?: EntityManager,
  ): Promise<ProductMovementRow[]> {
    const ids = productIds && productIds.length > 0 ? [...productIds] : null;

    return this.run<ProductMovementRow>(
      `SELECT product_id,
              MIN(product_code)  AS product_code,
              MIN(product_title) AS product_title,
              MAX(current_base_price)::numeric(12,2) AS current_base_price,
              COALESCE(SUM(qty_billed) FILTER (WHERE channel = 'DELIVERY'), 0)::integer AS delivery_qty,
              COALESCE(SUM(qty_billed) FILTER (WHERE channel = 'PARTY'), 0)::integer    AS party_qty,
              COALESCE(SUM(qty_issued), 0)::integer      AS qty_issued,
              COALESCE(SUM(qty_billed), 0)::integer      AS qty_billed,
              COALESCE(SUM(revenue), 0)::numeric(12,2)   AS revenue,
              COALESCE(SUM(base_value), 0)::numeric(12,2) AS base_value,
              (COALESCE(SUM(base_value), 0) - COALESCE(SUM(revenue), 0))::numeric(12,2) AS discount_value,
              (CASE WHEN SUM(qty_billed) > 0
                    THEN round(SUM(revenue) / SUM(qty_billed), 6) END)::numeric(14,6)   AS avg_realised_price,
              (CASE WHEN SUM(qty_billed) > 0
                    THEN round(SUM(base_value) / SUM(qty_billed), 6) END)::numeric(14,6) AS avg_base_price,
              COALESCE(SUM(line_count), 0)::integer      AS line_count,
              COALESCE(SUM(document_count), 0)::integer  AS document_count
         FROM v_product_sales
        WHERE month BETWEEN $1::date AND $2::date
          AND ($3::uuid[] IS NULL OR product_id = ANY($3::uuid[]))
        GROUP BY product_id
        ORDER BY COALESCE(SUM(qty_billed), 0) DESC,
                 COALESCE(SUM(revenue), 0) DESC,
                 MIN(product_title) ASC`,
      [fromMonth, toMonth, ids],
      em,
    );
  }

  /**
   * The summary band's four cells, aggregated across every product at once.
   *
   * A separate query rather than a fold over the rows above, for the reason
   * every total in this codebase is: summing rupees in TypeScript is how the
   * band and the table start disagreeing by a paisa.
   */
  async totalsBetweenMonths(
    fromMonth: string,
    toMonth: string,
    productIds?: readonly string[] | null,
    em?: EntityManager,
  ): Promise<ProductMovementTotalsRow> {
    const ids = productIds && productIds.length > 0 ? [...productIds] : null;

    const rows = await this.run<ProductMovementTotalsRow>(
      `SELECT COALESCE(SUM(qty_billed) FILTER (WHERE channel = 'DELIVERY'), 0)::integer AS delivery_qty,
              COALESCE(SUM(qty_billed) FILTER (WHERE channel = 'PARTY'), 0)::integer    AS party_qty,
              COALESCE(SUM(qty_billed), 0)::integer      AS qty_billed,
              COALESCE(SUM(revenue), 0)::numeric(12,2)   AS revenue,
              COALESCE(SUM(base_value), 0)::numeric(12,2) AS base_value,
              (COALESCE(SUM(base_value), 0) - COALESCE(SUM(revenue), 0))::numeric(12,2) AS discount_value,
              (CASE WHEN SUM(base_value) > 0
                    THEN round(100.0 * (SUM(base_value) - SUM(revenue)) / SUM(base_value), 1)
               END)::numeric(6,1) AS discount_percent
         FROM v_product_sales
        WHERE month BETWEEN $1::date AND $2::date
          AND ($3::uuid[] IS NULL OR product_id = ANY($3::uuid[]))`,
      [fromMonth, toMonth, ids],
      em,
    );

    return (
      rows[0] ?? {
        delivery_qty: 0,
        party_qty: 0,
        qty_billed: 0,
        revenue: "0",
        base_value: "0",
        discount_value: "0",
        discount_percent: null,
      }
    );
  }

  /** Does this month have any movement at all? Drives `movementAvailable`. */
  async hasMovementForMonth(
    month: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const rows = await this.run<{ present: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM v_product_sales WHERE month = $1::date) AS present`,
      [month],
      em,
    );
    return rows[0]?.present ?? false;
  }
}

export const productSalesRepository = new ProductSalesRepository();
