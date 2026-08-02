import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Add `channel` to `v_product_sales`.
 *
 * The view already UNIONs delivery-order lines with party-order lines — it just
 * discarded which branch a row came from, so the product detail page's
 * "movement by channel" table had nothing to split on and rendered three null
 * rows. The data was always there; only the discriminator was missing.
 *
 * Walk-ins are still deliberately absent. `direct_sales` records an amount and
 * nothing else — no quantity, no unit price, and in practice no product either
 * (0 of 129 seeded rows carry a product_id). Folding a row with no quantity
 * into `qty_billed` and `avg_realised_price` would corrupt both. Walk-in
 * revenue lives in `v_daily_sales` under `WALK_IN`, which is the honest place
 * for a channel that sells rupees rather than units.
 *
 * Grouping now includes `channel`, so a product sold through both channels in
 * one month yields two rows. Callers wanting the old shape sum across them —
 * which is what `lifetimeForProduct` and the KPI leaders already do.
 */
export class ProductSalesChannel1785700100000 implements MigrationInterface {
  name = "ProductSalesChannel1785700100000";

  public async up(q: QueryRunner): Promise<void> {
    /*
     * DROP then CREATE, not CREATE OR REPLACE.
     *
     * `CREATE OR REPLACE VIEW` may only APPEND columns — it matches the new
     * select list against the old one positionally, so inserting `channel`
     * after `month` reads as an attempt to rename `qty_issued`, and Postgres
     * refuses. Nothing depends on this view (checked with pg_depend), so
     * dropping it is safe; a dependent would need CASCADE and its own recreate.
     */
    await q.query(`DROP VIEW IF EXISTS v_product_sales`);
    await q.query(`
      CREATE VIEW v_product_sales AS
      SELECT
        src.product_id,
        p.code  AS product_code,
        p.title AS product_title,
        p.base_price AS current_base_price,
        src.month,
        src.channel,
        sum(src.qty_issued)::integer  AS qty_issued,
        sum(src.qty_billed)::integer  AS qty_billed,
        sum(src.revenue)::numeric(12,2)    AS revenue,
        sum(src.base_value)::numeric(12,2) AS base_value,
        (sum(src.base_value) - sum(src.revenue))::numeric(12,2) AS discount_value,
        CASE WHEN sum(src.qty_billed) > 0
             THEN round(sum(src.revenue) / sum(src.qty_billed)::numeric, 6)
        END::numeric(14,6) AS avg_realised_price,
        CASE WHEN sum(src.qty_billed) > 0
             THEN round(sum(src.base_value) / sum(src.qty_billed)::numeric, 6)
        END::numeric(14,6) AS avg_base_price,
        sum(src.line_count)::integer AS line_count,
        count(DISTINCT src.document_id)::integer AS document_count
      FROM (
        SELECT
          i.product_id,
          date_trunc('month', o.order_date::timestamptz)::date AS month,
          'DELIVERY'::text AS channel,
          o.id AS document_id,
          i.quantity AS qty_issued,
          -- Billed quantity is what was SOLD: filled jars coming back are
          -- unsold stock and come off the bill. Decision D5.
          i.quantity - i.returned_filled_qty AS qty_billed,
          i.line_total AS revenue,
          round((i.quantity - i.returned_filled_qty)::numeric * i.product_base_price, 2) AS base_value,
          1 AS line_count
        FROM order_items i
        JOIN delivery_orders o ON o.id = i.order_id
        WHERE o.deleted_at IS NULL
          AND o.status <> 'CANCELLED'::order_status

        UNION ALL

        SELECT
          pi.product_id,
          date_trunc('month', d.service_date::timestamptz)::date,
          'PARTY'::text,
          d.party_order_id,
          COALESCE(pi.delivered_quantity, pi.quantity),
          COALESCE(pi.delivered_quantity, pi.quantity),
          pi.line_total,
          round(COALESCE(pi.delivered_quantity, pi.quantity)::numeric * pi.product_base_price, 2),
          1
        FROM party_order_items pi
        JOIN party_order_days d ON d.id = pi.party_order_day_id
        JOIN party_orders po    ON po.id = d.party_order_id
        WHERE po.deleted_at IS NULL
          AND po.status <> 'CANCELLED'::party_order_status
          AND d.delivery_status <> ALL (ARRAY['SKIPPED'::day_delivery_status,
                                              'CANCELLED'::day_delivery_status])
      ) src
      LEFT JOIN products p ON p.id = src.product_id
      GROUP BY src.product_id, p.code, p.title, p.base_price, src.month, src.channel
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Restore the channel-less shape — same positional constraint applies.
    await q.query(`DROP VIEW IF EXISTS v_product_sales`);
    await q.query(`
      CREATE VIEW v_product_sales AS
      SELECT
        src.product_id,
        p.code  AS product_code,
        p.title AS product_title,
        p.base_price AS current_base_price,
        src.month,
        sum(src.qty_issued)::integer  AS qty_issued,
        sum(src.qty_billed)::integer  AS qty_billed,
        sum(src.revenue)::numeric(12,2)    AS revenue,
        sum(src.base_value)::numeric(12,2) AS base_value,
        (sum(src.base_value) - sum(src.revenue))::numeric(12,2) AS discount_value,
        CASE WHEN sum(src.qty_billed) > 0
             THEN round(sum(src.revenue) / sum(src.qty_billed)::numeric, 6)
        END::numeric(14,6) AS avg_realised_price,
        CASE WHEN sum(src.qty_billed) > 0
             THEN round(sum(src.base_value) / sum(src.qty_billed)::numeric, 6)
        END::numeric(14,6) AS avg_base_price,
        sum(src.line_count)::integer AS line_count,
        count(DISTINCT src.document_id)::integer AS document_count
      FROM (
        SELECT i.product_id,
               date_trunc('month', o.order_date::timestamptz)::date AS month,
               o.id AS document_id,
               i.quantity AS qty_issued,
               i.quantity - i.returned_filled_qty AS qty_billed,
               i.line_total AS revenue,
               round((i.quantity - i.returned_filled_qty)::numeric * i.product_base_price, 2) AS base_value,
               1 AS line_count
        FROM order_items i
        JOIN delivery_orders o ON o.id = i.order_id
        WHERE o.deleted_at IS NULL AND o.status <> 'CANCELLED'::order_status
        UNION ALL
        SELECT pi.product_id,
               date_trunc('month', d.service_date::timestamptz)::date,
               d.party_order_id,
               COALESCE(pi.delivered_quantity, pi.quantity),
               COALESCE(pi.delivered_quantity, pi.quantity),
               pi.line_total,
               round(COALESCE(pi.delivered_quantity, pi.quantity)::numeric * pi.product_base_price, 2),
               1
        FROM party_order_items pi
        JOIN party_order_days d ON d.id = pi.party_order_day_id
        JOIN party_orders po    ON po.id = d.party_order_id
        WHERE po.deleted_at IS NULL
          AND po.status <> 'CANCELLED'::party_order_status
          AND d.delivery_status <> ALL (ARRAY['SKIPPED'::day_delivery_status,
                                              'CANCELLED'::day_delivery_status])
      ) src
      LEFT JOIN products p ON p.id = src.product_id
      GROUP BY src.product_id, p.code, p.title, p.base_price, src.month
    `);
  }
}
