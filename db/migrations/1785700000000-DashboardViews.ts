import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — the dashboard aggregate views. DATA-MODEL §12, migration step 13.
 *
 * WHY VIEWS AND NOT REPOSITORY JOINS
 * ----------------------------------
 * ARCHITECTURE §4.1 rule 4: one repository per entity, and a repository queries
 * its own table only. Every number on a dashboard is a cross-module aggregate —
 * "what does this staff member owe across orders AND coin issues" — which has
 * nowhere to live under that rule. A VIEW is a single relation, so it gets its
 * own repository and the rule holds unbroken. It also keeps every rupee of
 * arithmetic inside PostgreSQL, which DATA-MODEL D-4 requires absolutely:
 * TypeScript formats money, it never adds it.
 *
 * Plain views, not materialised (DATA-MODEL §12). At 10^4–10^5 rows a year the
 * indexed aggregates run in tens of milliseconds, and a materialised view would
 * introduce staleness the owner will not expect from something that behaves
 * like a cash register. Measure before adding one.
 *
 * FOUR RULES THAT EVERY VIEW BELOW OBEYS
 * --------------------------------------
 * 1. CANCELLED IS EXCLUDED FROM EVERY MONEY AND JAR FIGURE.
 *    `delivery_orders.outstanding_amount` is a GENERATED column over
 *    `subtotal - discount - paid + refunded`. Cancelling an order sets
 *    `status = 'CANCELLED'` but touches none of those inputs, so a cancelled
 *    order keeps a positive outstanding balance forever — a known gap in
 *    `fn_recompute_delivery_order` (1785517200000-Rollups.ts). Nothing in the
 *    database filters it for us, so every view filters it explicitly. Same for
 *    `coin_issues.status`, `party_orders.status` and `direct_sales.is_voided`.
 *
 * 2. SOFT DELETES ARE RESPECTED — `deleted_at IS NULL` on every soft-deletable
 *    table (DATA-MODEL D-8). But `order_items`, `coin_issue_items`,
 *    `party_order_items` and `party_order_days` extend `LineItemBase` and have
 *    NO `deleted_at` column: they cascade with their parent. Filtering on it
 *    there is a hard error. Line items are gated by their header instead.
 *
 * 3. THE TRIGGER-MAINTAINED ROLLUPS ARE PREFERRED OVER RE-DERIVING.
 *    `delivery_orders.outstanding_amount`, `.qty_pending` and
 *    `coin_issues.outstanding_amount` are what the list screens display. A view
 *    that re-derived the same number from line items could legitimately
 *    disagree with the screen sitting next to it, and the user would have no
 *    way to tell which one lied. Catching a genuine disagreement is the job of
 *    `v_order_rollup_drift` and `v_coin_balance_drift`, not of a dashboard.
 *    Line items are read only where no rollup exists — per-product revenue and
 *    per-coin-type circulation.
 *
 * 4. NOBODY DISAPPEARS. The per-staff and per-coin-type views drive from the
 *    dimension table through `CROSS JOIN LATERAL` over an *unfiltered
 *    aggregate*, which always yields exactly one row (an aggregate with no
 *    GROUP BY returns one row even over an empty set). A staff member with
 *    nothing outstanding therefore appears with zeros rather than vanishing.
 *    A dashboard that silently omits people is worse than one showing zeros.
 *
 * TODAY IS AN IST DATE. The server runs UTC and displays IST (DATA-MODEL D-5),
 * so `CURRENT_DATE` is the wrong "today" between 00:00 and 05:30 IST — it still
 * reads as yesterday. `(now() AT TIME ZONE 'Asia/Kolkata')::date` is the
 * business day, and matches `todayIST()` in src/lib/dates.ts.
 *
 * DEPENDENCY ORDER. v_coin_type_balance reads v_coins_in_circulation, and
 * v_exec_summary reads four of the others. That is deliberate — a headline
 * number that is computed twice is a number that will eventually be computed
 * two different ways. Views are therefore created in dependency order and
 * dropped in the exact reverse.
 *
 * NOT TOUCHED HERE: `v_order_rollup_drift`, `v_coin_issue_drift`,
 * `v_party_order_drift` and `v_coin_balance_drift` already exist in
 * 1785517200000-Rollups.ts and belong to that migration.
 */
export class DashboardViews1785700000000 implements MigrationInterface {
  name = 'DashboardViews1785700000000';

  public async up(q: QueryRunner): Promise<void> {
    // ==================================================================
    // 1. v_staff_outstanding — "what does this person owe us, in total?"
    //
    // The register question the owner actually asks, answered in one row per
    // staff member across two otherwise unrelated modules. DATA-MODEL §12.
    //
    // Both dues columns are NET sums of the trigger-maintained
    // `outstanding_amount`, including negative rows. On a coin issue a negative
    // outstanding means the company owes the staff member a refund
    // (DATA-MODEL §10.3); on an order it means OVERPAID (§10.4). Netting them
    // is what makes `total_dues` the true position — showing only the positive
    // side would invoice someone for money already sitting with us.
    //
    // The counts use different predicates on purpose:
    //   open_order_count  — outstanding > 0, the "payment pending" filter that
    //                       `idx_orders_payment_pending` serves.
    //   open_issue_count  — outstanding <> 0, matching `idx_ci_pending`. A
    //                       refund the company still owes is an open item too,
    //                       and `> 0` would hide it.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE VIEW "v_staff_outstanding" AS
      SELECT s.id        AS staff_id,
             s.code      AS staff_code,
             s.name      AS staff_name,
             s.phone     AS staff_phone,
             s.is_active AS staff_is_active,
             ord.order_dues,
             ord.open_order_count,
             ord.oldest_order_due_date,
             coin.coin_dues,
             coin.open_issue_count,
             coin.oldest_issue_due_date,
             (ord.order_dues + coin.coin_dues)::numeric(12,2) AS total_dues,
             -- Ageing: days since the oldest still-open document of either kind.
             GREATEST(
               COALESCE((now() AT TIME ZONE 'Asia/Kolkata')::date - ord.oldest_order_due_date, 0),
               COALESCE((now() AT TIME ZONE 'Asia/Kolkata')::date - coin.oldest_issue_due_date, 0)
             )::integer AS days_outstanding
        FROM staff s
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(o.outstanding_amount), 0)::numeric(12,2)       AS order_dues,
                 COUNT(*) FILTER (WHERE o.outstanding_amount > 0)::integer   AS open_order_count,
                 MIN(o.order_date) FILTER (WHERE o.outstanding_amount > 0)   AS oldest_order_due_date
            FROM delivery_orders o
           WHERE o.staff_id = s.id
             AND o.deleted_at IS NULL
             AND o.status <> 'CANCELLED'
        ) ord
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(ci.outstanding_amount), 0)::numeric(12,2)       AS coin_dues,
                 COUNT(*) FILTER (WHERE ci.outstanding_amount <> 0)::integer  AS open_issue_count,
                 MIN(ci.issue_date) FILTER (WHERE ci.outstanding_amount <> 0) AS oldest_issue_due_date
            FROM coin_issues ci
           WHERE ci.staff_id = s.id
             AND ci.deleted_at IS NULL
             AND ci.status <> 'CANCELLED'
        ) coin
       WHERE s.deleted_at IS NULL
    `);

    // ==================================================================
    // 2. v_staff_jar_balance — the true operational number. DATA-MODEL §10.9.
    //
    // All-time issued minus returned, per staff member, ACROSS orders. Any
    // single order's jar count is a fiction operationally: jars issued on
    // Monday's order come back against Thursday's visit, which is why the
    // return dialog lists every open line for that staff member (decision D7).
    // This view is the number to reconcile against at the gate.
    //
    // `qty_pending` is the generated column
    // `qty_issued - qty_returned_empty - qty_returned_filled - qty_lost`.
    // A LOST jar is not "out with the staff member" — it is written off, and
    // deliberately excluded from jars_out so the operational count matches
    // what a physical recount would find.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE VIEW "v_staff_jar_balance" AS
      SELECT s.id        AS staff_id,
             s.code      AS staff_code,
             s.name      AS staff_name,
             s.phone     AS staff_phone,
             s.is_active AS staff_is_active,
             j.jars_issued,
             j.jars_returned_empty,
             j.jars_returned_filled,
             j.jars_lost,
             j.jars_out,
             j.open_order_count,
             j.oldest_pending_date,
             COALESCE(
               (now() AT TIME ZONE 'Asia/Kolkata')::date - j.oldest_pending_date, 0
             )::integer AS oldest_pending_days
        FROM staff s
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(o.qty_issued),          0)::integer AS jars_issued,
                 COALESCE(SUM(o.qty_returned_empty),  0)::integer AS jars_returned_empty,
                 COALESCE(SUM(o.qty_returned_filled), 0)::integer AS jars_returned_filled,
                 COALESCE(SUM(o.qty_lost),            0)::integer AS jars_lost,
                 COALESCE(SUM(o.qty_pending),         0)::integer AS jars_out,
                 COUNT(*)          FILTER (WHERE o.qty_pending > 0)::integer AS open_order_count,
                 MIN(o.order_date) FILTER (WHERE o.qty_pending > 0)          AS oldest_pending_date
            FROM delivery_orders o
           WHERE o.staff_id = s.id
             AND o.deleted_at IS NULL
             AND o.status <> 'CANCELLED'
        ) j
       WHERE s.deleted_at IS NULL
    `);

    // ==================================================================
    // 3. v_coins_in_circulation — issued − returned by staff − redeemed
    //    via order payments, per coin type. DATA-MODEL §12, §10.8.
    //
    // The three terms are structurally separate and MUST be, or coins get
    // double-counted (§10.8): an ORDER_RECEIPT ledger movement never touches
    // `coin_issue_items.coins_returned`. A coin can come back to the company
    // two ways — handed back as stock (a return event, which increments
    // coins_returned) or spent by the customer against an order (a COIN-mode
    // payment, which does not). Subtracting both is the whole point of this
    // view, and the gap it surfaces is what §10.8 exists to catch.
    //
    // No rollup column exists for this, so it is derived from line items —
    // gated by their headers, since coin_issue_items has no `deleted_at`.
    //
    // OUT-direction COIN payments are subtracted from the redeemed total: a
    // refund paid in coins puts those coins back into circulation. Amounts and
    // counts are always positive; the sign lives in `direction` (§5.8), which
    // is the same convention `fn_recompute_delivery_order` uses.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE VIEW "v_coins_in_circulation" AS
      SELECT ct.id   AS coin_type_id,
             ct.name AS coin_type_name,
             ct.per_coin_price,
             iss.coins_issued,
             iss.coins_returned,
             red.coins_redeemed,
             (iss.coins_issued - iss.coins_returned - red.coins_redeemed)::integer
               AS coins_in_circulation,
             -- Valued at TODAY's rate, not the issue-time snapshot: this is
             -- what the company loses if the coins never come back, and what
             -- it must honour if they do.
             round(
               (iss.coins_issued - iss.coins_returned - red.coins_redeemed)::numeric
               * ct.per_coin_price, 2)::numeric(12,2) AS value_in_circulation,
             iss.open_issue_count,
             iss.staff_holding_count
        FROM coin_types ct
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(it.coins_issued),   0)::integer AS coins_issued,
                 COALESCE(SUM(it.coins_returned), 0)::integer AS coins_returned,
                 COUNT(DISTINCT ci.id)       FILTER (WHERE it.coins_outstanding > 0)::integer
                   AS open_issue_count,
                 COUNT(DISTINCT ci.staff_id) FILTER (WHERE it.coins_outstanding > 0)::integer
                   AS staff_holding_count
            FROM coin_issue_items it
            JOIN coin_issues ci ON ci.id = it.coin_issue_id
           WHERE it.coin_type_id = ct.id
             AND ci.deleted_at IS NULL
             AND ci.status <> 'CANCELLED'
        ) iss
        CROSS JOIN LATERAL (
          SELECT (COALESCE(SUM(p.coin_count) FILTER (WHERE p.direction = 'IN'),  0)
                - COALESCE(SUM(p.coin_count) FILTER (WHERE p.direction = 'OUT'), 0))::integer
                   AS coins_redeemed
            FROM payments p
            LEFT JOIN delivery_orders o  ON o.id  = p.order_id
            LEFT JOIN coin_issues     ci ON ci.id = p.coin_issue_id
            LEFT JOIN party_orders    po ON po.id = p.party_order_id
           WHERE p.coin_type_id = ct.id
             AND p.mode = 'COIN'
             -- Payments are append-only, so a cancelled document's payments
             -- survive it. Exactly one context FK is set (§5.8); each arc is
             -- checked only when it is the populated one.
             AND (p.order_id       IS NULL OR (o.deleted_at  IS NULL AND o.status  <> 'CANCELLED'))
             AND (p.coin_issue_id  IS NULL OR (ci.deleted_at IS NULL AND ci.status <> 'CANCELLED'))
             AND (p.party_order_id IS NULL OR (po.deleted_at IS NULL AND po.status <> 'CANCELLED'))
        ) red
       WHERE ct.deleted_at IS NULL
    `);

    // ==================================================================
    // 4. v_coin_type_balance — balance, circulation, stock value, value at
    //    risk, per type. DATA-MODEL §12.
    //
    // Reads v_coins_in_circulation rather than repeating its arithmetic: the
    // two views are shown side by side on the coin dashboard, and one formula
    // written twice is one formula that will eventually be wrong twice.
    //
    // `balance_coins` is the trigger-maintained cache of the coin ledger, which
    // is the single source of truth for stock (§5.9, §5.14). Whether that cache
    // still agrees with the ledger is `v_coin_balance_drift`'s job, not this
    // view's — a dashboard reports, a drift view accuses.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE VIEW "v_coin_type_balance" AS
      SELECT ct.id   AS coin_type_id,
             ct.name AS coin_type_name,
             ct.coins_per_packet,
             ct.packet_amount,
             ct.per_coin_price,
             ct.colour_hex,
             ct.is_active,
             ct.balance_coins,
             round(ct.balance_coins::numeric * ct.per_coin_price, 2)::numeric(12,2)
               AS stock_value,
             circ.coins_in_circulation,
             circ.value_in_circulation AS value_at_risk,
             circ.coins_issued,
             circ.coins_returned,
             circ.coins_redeemed,
             circ.open_issue_count,
             circ.staff_holding_count,
             -- Every coin the company can still account for: on the shelf plus
             -- out with staff. Should only fall when coins are written off
             -- through a LOST/DAMAGED/STOLEN adjustment.
             (ct.balance_coins + circ.coins_in_circulation)::integer AS coins_accounted_for,
             round((ct.balance_coins + circ.coins_in_circulation)::numeric
                   * ct.per_coin_price, 2)::numeric(12,2) AS total_value
        FROM coin_types ct
        JOIN v_coins_in_circulation circ ON circ.coin_type_id = ct.id
       WHERE ct.deleted_at IS NULL
    `);

    // ==================================================================
    // 5. v_daily_sales — date × channel → revenue and collection.
    //    DATA-MODEL §12.
    //
    // REVENUE and COLLECTION are different events on different dates, so they
    // cannot come from one scan. A UNION ALL of five contributions, summed by
    // (date, channel), is what lets an order billed on the 2nd and paid on the
    // 9th land correctly on both days.
    //
    // Each channel bills its own header rollup — delivery `total_amount`,
    // party `total_amount`, walk-in `amount` — never a re-derivation from line
    // items, so the chart agrees with the list screens.
    //
    // Collection is IN minus OUT. A refund and a reversal are both OUT rows
    // (§5.8, §9: corrections are inserts, never edits), which is exactly how
    // `fn_recompute_delivery_order` computes `paid_total - refunded`.
    //
    // WALK-INS have no payment rows at all: `direct_sales` is constrained to
    // `mode = 'CASH'` with no status column because the owner said they are
    // always paid in full, on the spot (§5.18). Collection therefore equals
    // revenue on the same date, by construction rather than by lookup.
    //
    // PARTY orders are dated on `first_service_date` — the header date the
    // party list and `idx_po_pending` already sort by. A multi-day booking is
    // one commercial event; splitting its `total_amount` across service days
    // would need `party_order_days.day_total`, which is a different (and
    // deliberately more granular) report.
    //
    // COIN_ISSUE payments are absent on purpose: issuing coins to a staff
    // member is a stock movement, not a sale. Counting it as revenue would
    // book the same rupee twice — once on issue, once when the coin is
    // redeemed against an order.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE VIEW "v_daily_sales" AS
      SELECT src.business_date,
             src.channel,
             SUM(src.revenue)::numeric(12,2)    AS revenue,
             SUM(src.collection)::numeric(12,2) AS collection,
             SUM(src.doc_count)::integer        AS doc_count
        FROM (
          -- DELIVERY: billed
          SELECT o.order_date        AS business_date,
                 'DELIVERY'::text    AS channel,
                 o.total_amount      AS revenue,
                 0::numeric          AS collection,
                 1                   AS doc_count
            FROM delivery_orders o
           WHERE o.deleted_at IS NULL
             AND o.status <> 'CANCELLED'

          UNION ALL

          -- DELIVERY: collected
          SELECT p.paid_on, 'DELIVERY', 0::numeric,
                 CASE WHEN p.direction = 'IN' THEN p.amount ELSE -p.amount END,
                 0
            FROM payments p
            JOIN delivery_orders o ON o.id = p.order_id
           WHERE o.deleted_at IS NULL
             AND o.status <> 'CANCELLED'

          UNION ALL

          -- PARTY: billed
          SELECT COALESCE(po.first_service_date,
                          (po.created_at AT TIME ZONE 'Asia/Kolkata')::date),
                 'PARTY', po.total_amount, 0::numeric, 1
            FROM party_orders po
           WHERE po.deleted_at IS NULL
             AND po.status <> 'CANCELLED'

          UNION ALL

          -- PARTY: collected (advances included — an advance is a breakdown of
          -- paid_amount, not a second bucket; see fn_recompute_party_order)
          SELECT p.paid_on, 'PARTY', 0::numeric,
                 CASE WHEN p.direction = 'IN' THEN p.amount ELSE -p.amount END,
                 0
            FROM payments p
            JOIN party_orders po ON po.id = p.party_order_id
           WHERE po.deleted_at IS NULL
             AND po.status <> 'CANCELLED'

          UNION ALL

          -- WALK_IN: billed and collected are the same event
          SELECT ds.sale_date, 'WALK_IN', ds.amount, ds.amount, 1
            FROM direct_sales ds
           WHERE ds.deleted_at IS NULL
             AND ds.is_voided IS NOT TRUE
        ) src
       GROUP BY src.business_date, src.channel
    `);

    // ==================================================================
    // 6. v_product_sales — product × month → quantity, revenue, realised
    //    vs base price. DATA-MODEL §12, §6.
    //
    // Grouped by `product_id`, NOT by the title snapshot: §6 keeps the FK
    // precisely so a renamed product still rolls up to one line. The display
    // title comes from `products` (current name), while the money comes from
    // the immutable snapshots on the line (`product_base_price`, `unit_price`),
    // so changing a price today cannot rewrite last quarter's discount.
    //
    // The only place in this file that reads line items for money, because no
    // per-product rollup column exists. `line_total` is generated on both line
    // tables and is used as-is, so revenue here reconciles exactly with the
    // header totals in v_daily_sales.
    //
    // QUANTITY IS TWO DIFFERENT NUMBERS and both are exposed:
    //   qty_issued — jars that physically left, what the van loaded.
    //   qty_billed — what was charged for. On delivery lines `line_total` is
    //                `(quantity - returned_filled_qty) * unit_price` because
    //                decision D5 bills the staff member only for what he sold;
    //                a full jar handed straight back is not a sale. Dividing
    //                revenue by qty_issued would understate the realised price
    //                on every route that returned stock.
    //
    // WALK-INS ARE ABSENT. `direct_sales` carries an amount and a nullable
    // `product_id` but no quantity and no unit price (§5.18), so it can
    // contribute nothing to any column this view has. Folding it in would
    // silently corrupt `qty_billed` and `avg_realised_price`. Walk-in revenue
    // lives in v_daily_sales under the WALK_IN channel.
    //
    // SKIPPED and CANCELLED party days are excluded, matching
    // `fn_recompute_party_order` — a day the party did not take is not billed,
    // so it must not appear as product revenue either.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE VIEW "v_product_sales" AS
      SELECT src.product_id,
             p.code       AS product_code,
             p.title      AS product_title,
             p.base_price AS current_base_price,
             src.month,
             SUM(src.qty_issued)::integer       AS qty_issued,
             SUM(src.qty_billed)::integer       AS qty_billed,
             SUM(src.revenue)::numeric(12,2)    AS revenue,
             SUM(src.base_value)::numeric(12,2) AS base_value,
             -- What the bargaining cost, at the prices in force at the time.
             -- Negative means the product went out above list.
             (SUM(src.base_value) - SUM(src.revenue))::numeric(12,2) AS discount_value,
             (CASE WHEN SUM(src.qty_billed) > 0
                   THEN round(SUM(src.revenue) / SUM(src.qty_billed), 6)
              END)::numeric(14,6) AS avg_realised_price,
             (CASE WHEN SUM(src.qty_billed) > 0
                   THEN round(SUM(src.base_value) / SUM(src.qty_billed), 6)
              END)::numeric(14,6) AS avg_base_price,
             SUM(src.line_count)::integer            AS line_count,
             COUNT(DISTINCT src.document_id)::integer AS document_count
        FROM (
          -- DELIVERY lines
          SELECT i.product_id,
                 date_trunc('month', o.order_date)::date AS month,
                 o.id                                    AS document_id,
                 i.quantity                              AS qty_issued,
                 (i.quantity - i.returned_filled_qty)    AS qty_billed,
                 i.line_total                            AS revenue,
                 round((i.quantity - i.returned_filled_qty)::numeric
                       * i.product_base_price, 2)        AS base_value,
                 1                                       AS line_count
            FROM order_items i
            JOIN delivery_orders o ON o.id = i.order_id
           WHERE o.deleted_at IS NULL
             AND o.status <> 'CANCELLED'

          UNION ALL

          -- PARTY lines. line_total bills delivered_quantity, falling back to
          -- the planned quantity until actuals are entered (§5.17); there is no
          -- return concept, so issued and billed are the same number.
          SELECT pi.product_id,
                 date_trunc('month', d.service_date)::date,
                 d.party_order_id,
                 COALESCE(pi.delivered_quantity, pi.quantity),
                 COALESCE(pi.delivered_quantity, pi.quantity),
                 pi.line_total,
                 round(COALESCE(pi.delivered_quantity, pi.quantity)::numeric
                       * pi.product_base_price, 2),
                 1
            FROM party_order_items pi
            JOIN party_order_days d ON d.id = pi.party_order_day_id
            JOIN party_orders    po ON po.id = d.party_order_id
           WHERE po.deleted_at IS NULL
             AND po.status <> 'CANCELLED'
             AND d.delivery_status NOT IN ('SKIPPED', 'CANCELLED')
        ) src
        -- LEFT JOIN and no deleted_at filter: a soft-deleted product still has
        -- history worth reporting, and §10.6 means it can never be hard-deleted
        -- out from under this join anyway.
        LEFT JOIN products p ON p.id = src.product_id
       GROUP BY src.product_id, p.code, p.title, p.base_price, src.month
    `);

    // ==================================================================
    // 7. v_exec_summary — ONE row, the top of the dashboard.
    //    DATA-MODEL §12.
    //
    // EXACTLY ONE ROW ON AN EMPTY DATABASE. Every metric is a scalar subquery
    // wrapped in COALESCE, hung off a one-row derived table. An aggregate over
    // a join would be the tempting shape and the wrong one: the moment a join
    // produces no rows the whole summary disappears and the dashboard renders
    // blank instead of rendering zeros. Scalar subqueries cannot do that — an
    // aggregate subquery over an empty set returns NULL, and COALESCE turns
    // that into 0.
    //
    // The metrics read the four views above rather than the base tables, so the
    // headline number and the chart underneath it are mathematically incapable
    // of disagreeing.
    //
    // "Today" and "month to date" are IST business days, capped at today so
    // a future-dated order cannot inflate month-to-date revenue.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE VIEW "v_exec_summary" AS
      SELECT
        cal.today                                AS as_of_date,
        date_trunc('month', cal.today)::date     AS month_start,

        -- Revenue and collection, from v_daily_sales across all channels.
        (SELECT COALESCE(SUM(ds.revenue), 0)::numeric(12,2)
           FROM v_daily_sales ds
          WHERE ds.business_date = cal.today)               AS revenue_today,
        (SELECT COALESCE(SUM(ds.revenue), 0)::numeric(12,2)
           FROM v_daily_sales ds
          WHERE ds.business_date >= date_trunc('month', cal.today)::date
            AND ds.business_date <= cal.today)              AS revenue_mtd,
        (SELECT COALESCE(SUM(ds.collection), 0)::numeric(12,2)
           FROM v_daily_sales ds
          WHERE ds.business_date = cal.today)               AS collection_today,
        (SELECT COALESCE(SUM(ds.collection), 0)::numeric(12,2)
           FROM v_daily_sales ds
          WHERE ds.business_date >= date_trunc('month', cal.today)::date
            AND ds.business_date <= cal.today)              AS collection_mtd,

        -- Receivable. Staff dues come from v_staff_outstanding; party orders
        -- have no staff member, so they are read from their own header rollup.
        (SELECT COALESCE(SUM(so.order_dues), 0)::numeric(12,2)
           FROM v_staff_outstanding so)                     AS receivable_orders,
        (SELECT COALESCE(SUM(so.coin_dues), 0)::numeric(12,2)
           FROM v_staff_outstanding so)                     AS receivable_coins,
        (SELECT COALESCE(SUM(po.outstanding_amount), 0)::numeric(12,2)
           FROM party_orders po
          WHERE po.deleted_at IS NULL
            AND po.status <> 'CANCELLED')                   AS receivable_party,
        ( (SELECT COALESCE(SUM(so.order_dues + so.coin_dues), 0)
             FROM v_staff_outstanding so)
        + (SELECT COALESCE(SUM(po.outstanding_amount), 0)
             FROM party_orders po
            WHERE po.deleted_at IS NULL
              AND po.status <> 'CANCELLED')
        )::numeric(12,2)                                    AS total_receivable,

        -- Jars physically out with staff, right now.
        (SELECT COALESCE(SUM(jb.jars_out), 0)::integer
           FROM v_staff_jar_balance jb)                     AS jars_out,
        (SELECT COUNT(*)::integer
           FROM v_staff_jar_balance jb
          WHERE jb.jars_out > 0)                            AS staff_with_jars_out,

        -- Coin float: on the shelf, and out in the field.
        (SELECT COALESCE(SUM(cb.balance_coins), 0)::integer
           FROM v_coin_type_balance cb)                     AS coin_stock_coins,
        (SELECT COALESCE(SUM(cb.stock_value), 0)::numeric(12,2)
           FROM v_coin_type_balance cb)                     AS coin_stock_value,
        (SELECT COALESCE(SUM(cb.coins_in_circulation), 0)::integer
           FROM v_coin_type_balance cb)                     AS coin_float_coins,
        (SELECT COALESCE(SUM(cb.value_at_risk), 0)::numeric(12,2)
           FROM v_coin_type_balance cb)                     AS coin_float_value,

        -- Upcoming events: the party schedule is the only forward-dated thing
        -- in the domain (§5.16 — one row per date, so arbitrary gaps work).
        (SELECT COUNT(*)::integer
           FROM party_order_days pd
           JOIN party_orders po ON po.id = pd.party_order_id
          WHERE po.deleted_at IS NULL
            AND po.status <> 'CANCELLED'
            AND pd.delivery_status = 'SCHEDULED'
            AND pd.service_date >= cal.today
            AND pd.service_date <  cal.today + 7)           AS upcoming_deliveries_7d,
        (SELECT MIN(pd.service_date)
           FROM party_order_days pd
           JOIN party_orders po ON po.id = pd.party_order_id
          WHERE po.deleted_at IS NULL
            AND po.status <> 'CANCELLED'
            AND pd.delivery_status = 'SCHEDULED'
            AND pd.service_date >= cal.today)               AS next_service_date

      FROM (SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS today) cal
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Exact reverse of the creation order. v_exec_summary reads four of the
    // others and v_coin_type_balance reads v_coins_in_circulation, so a
    // dependant must go before the view it depends on. No CASCADE anywhere:
    // a down-migration that quietly drops objects it was not asked about is
    // how a rollback becomes an outage.
    await q.query(`DROP VIEW IF EXISTS "v_exec_summary"`);
    await q.query(`DROP VIEW IF EXISTS "v_product_sales"`);
    await q.query(`DROP VIEW IF EXISTS "v_daily_sales"`);
    await q.query(`DROP VIEW IF EXISTS "v_coin_type_balance"`);
    await q.query(`DROP VIEW IF EXISTS "v_coins_in_circulation"`);
    await q.query(`DROP VIEW IF EXISTS "v_staff_jar_balance"`);
    await q.query(`DROP VIEW IF EXISTS "v_staff_outstanding"`);
  }
}
