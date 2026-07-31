import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 — cross-row rollup triggers, the coin-ledger balance guard,
 * drift-detection views and the append-only guards.
 *
 * Generated columns already cover every same-row arithmetic case
 * (`total_amount`, `outstanding_amount`, `pending_qty`, `line_total`,
 * `coins_issued`, `per_coin_price`, `source_id`, `code`). What a generated
 * column cannot express is an aggregate over *other* rows, or a value whose
 * type is an enum — see .claude/DATA-MODEL.md §8.2. Everything in this file
 * is one of those two cases.
 *
 * Written by hand rather than generated: TypeORM cannot express functions,
 * triggers or views, and gets the down-migration wrong for all three.
 * See .claude/DATA-MODEL.md §13 steps 6, 8, 9, 13 and 14.
 *
 * LOCK ORDER — child -> parent -> grandparent, ascending id within a set.
 * Every recompute helper below locks exactly one row, and is only ever called
 * from a trigger on that row's child, so the order holds by construction.
 * Violating it produces intermittent deadlocks (.claude/ARCHITECTURE.md §4.3,
 * DATA-MODEL §10.13).
 */
export class Rollups1785517200000 implements MigrationInterface {
  name = 'Rollups1785517200000';

  public async up(q: QueryRunner): Promise<void> {
    // ==================================================================
    // 0. STATUS HELPERS
    //
    // The status rules live in exactly one place so that delivery orders,
    // coin issues, party orders *and* the drift views cannot disagree about
    // what 'PARTIAL' means. DATA-MODEL §5.5, §5.10, §5.15 and §10.3.
    // ==================================================================

    // outstanding > 0, nothing paid      -> UNPAID
    // outstanding > 0, something paid    -> PARTIAL
    // outstanding = 0                    -> PAID
    // outstanding < 0 on a coin issue    -> REFUND_DUE  (company owes staff, §10.3)
    // outstanding < 0 anywhere else      -> OVERPAID    (deliberately allowed, §10.4)
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_payment_status(
        p_outstanding   numeric,
        p_paid_total    numeric,
        p_is_coin_issue boolean
      ) RETURNS payment_status
      LANGUAGE sql IMMUTABLE AS $fn$
        SELECT CASE
          WHEN p_outstanding > 0 AND p_paid_total = 0 THEN 'UNPAID'::payment_status
          WHEN p_outstanding > 0                      THEN 'PARTIAL'::payment_status
          WHEN p_outstanding = 0                      THEN 'PAID'::payment_status
          WHEN p_is_coin_issue                        THEN 'REFUND_DUE'::payment_status
          ELSE                                             'OVERPAID'::payment_status
        END
      $fn$
    `);

    // no returnable lines       -> NOT_APPLICABLE (checked first: a zero-jar
    //                              order also has pending = issued = 0)
    // nothing back yet          -> NOT_RETURNED
    // nothing outstanding       -> COMPLETE
    // otherwise                 -> PARTIAL
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_return_status(
        p_qty_issued     integer,
        p_qty_pending    integer,
        p_has_returnable boolean
      ) RETURNS return_status
      LANGUAGE sql IMMUTABLE AS $fn$
        SELECT CASE
          WHEN NOT p_has_returnable         THEN 'NOT_APPLICABLE'::return_status
          WHEN p_qty_pending = p_qty_issued THEN 'NOT_RETURNED'::return_status
          WHEN p_qty_pending = 0            THEN 'COMPLETE'::return_status
          ELSE                                   'PARTIAL'::return_status
        END
      $fn$
    `);

    // ==================================================================
    // A. DELIVERY ORDER ROLLUPS
    //
    // Why cached at all: the two headline list filters are "payment pending"
    // and "jars out", combined with search, sort and pagination. Computed on
    // read they become correlated subqueries, which PostgreSQL cannot index.
    // Cached they are an indexed range scan. DATA-MODEL §8.1.
    //
    // Why a trigger and not the service layer: the value must be right no
    // matter who writes — a server action, a future import script, or the
    // owner running an UPDATE in the Neon console. DATA-MODEL §8.2.
    // ==================================================================

    // One recompute for the whole header, called by both the order_items
    // trigger and the payments trigger. Doing items and payments together is
    // deliberate: subtotal_amount feeds outstanding_amount, which feeds
    // payment_status, so an item change must re-derive the payment status too.
    //
    // outstanding_amount is GENERATED, so it cannot be read back inside the
    // same UPDATE that sets its inputs. The same expression is therefore
    // recomputed inline — it must stay byte-identical to the generated column
    // defined in 1785517105623-Schema.ts. DATA-MODEL §5.5.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_recompute_delivery_order(p_order_id uuid)
      RETURNS void
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_discount          numeric(12,2);
        v_subtotal          numeric(12,2);
        v_qty_issued        integer;
        v_qty_empty         integer;
        v_qty_filled        integer;
        v_qty_lost          integer;
        v_qty_pending       integer;
        v_has_returnable    boolean;
        v_paid_cash         numeric(12,2);
        v_paid_coin         numeric(12,2);
        v_paid_other        numeric(12,2);
        v_paid_total        numeric(12,2);
        v_refunded          numeric(12,2);
        v_outstanding       numeric(12,2);
        v_first_payment_at  timestamptz;
        v_last_payment_at   timestamptz;
        v_last_movement_at  timestamptz;
        v_fully_paid_at     timestamptz;
        v_fully_returned_at timestamptz;
      BEGIN
        IF p_order_id IS NULL THEN
          RETURN;
        END IF;

        -- Parent lock. The child row that fired us is already locked by its own
        -- statement, so this is the child -> parent step of the fixed order.
        SELECT o.discount_amount, o.fully_paid_at, o.fully_returned_at
          INTO v_discount, v_fully_paid_at, v_fully_returned_at
          FROM delivery_orders o
         WHERE o.id = p_order_id
           FOR UPDATE;

        -- Header already gone: we are inside an ON DELETE CASCADE.
        IF NOT FOUND THEN
          RETURN;
        END IF;

        SELECT COALESCE(SUM(i.line_total), 0),
               COALESCE(SUM(i.quantity) FILTER (WHERE i.is_returnable), 0)::integer,
               COALESCE(SUM(i.returned_empty_qty), 0)::integer,
               COALESCE(SUM(i.returned_filled_qty), 0)::integer,
               COALESCE(SUM(i.lost_qty), 0)::integer,
               COALESCE(bool_or(i.is_returnable), false)
          INTO v_subtotal, v_qty_issued, v_qty_empty, v_qty_filled, v_qty_lost,
               v_has_returnable
          FROM order_items i
         WHERE i.order_id = p_order_id;

        -- direction = 'IN' adds to paid, 'OUT' adds to refunded. Amounts are
        -- always positive; the sign lives in the direction. DATA-MODEL §5.8.
        SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.mode = 'CASH'), 0),
               COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.mode = 'COIN'), 0),
               COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.mode NOT IN ('CASH', 'COIN')), 0),
               COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0),
               COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0),
               MIN(p.created_at) FILTER (WHERE p.direction = 'IN'),
               MAX(p.created_at) FILTER (WHERE p.direction = 'IN'),
               MAX(p.created_at)
          INTO v_paid_cash, v_paid_coin, v_paid_other, v_paid_total, v_refunded,
               v_first_payment_at, v_last_payment_at, v_last_movement_at
          FROM payments p
         WHERE p.order_id = p_order_id;

        v_qty_pending := v_qty_issued - v_qty_empty - v_qty_filled - v_qty_lost;
        v_outstanding := v_subtotal - v_discount - v_paid_total + v_refunded;

        -- Timeline stamps power the "days outstanding" ageing report (§5.5).
        -- Sticky once set, cleared if an OUT refund reopens the balance.
        IF v_outstanding <= 0 AND v_paid_total > 0 THEN
          v_fully_paid_at := COALESCE(v_fully_paid_at, v_last_movement_at, now());
        ELSE
          v_fully_paid_at := NULL;
        END IF;

        IF v_has_returnable AND v_qty_issued > 0 AND v_qty_pending = 0 THEN
          v_fully_returned_at := COALESCE(v_fully_returned_at, now());
        ELSE
          v_fully_returned_at := NULL;
        END IF;

        -- The row-wise IS DISTINCT FROM stops a no-op write, so a payment on an
        -- order whose items did not move does not churn a dead tuple.
        UPDATE delivery_orders AS o
           SET subtotal_amount     = v_subtotal,
               qty_issued          = v_qty_issued,
               qty_returned_empty  = v_qty_empty,
               qty_returned_filled = v_qty_filled,
               qty_lost            = v_qty_lost,
               paid_cash_amount    = v_paid_cash,
               paid_coin_amount    = v_paid_coin,
               paid_other_amount   = v_paid_other,
               paid_total_amount   = v_paid_total,
               refunded_amount     = v_refunded,
               payment_status      = fn_payment_status(v_outstanding, v_paid_total, false),
               return_status       = fn_return_status(v_qty_issued, v_qty_pending, v_has_returnable),
               first_payment_at    = v_first_payment_at,
               last_payment_at     = v_last_payment_at,
               fully_paid_at       = v_fully_paid_at,
               fully_returned_at   = v_fully_returned_at
         WHERE o.id = p_order_id
           AND (o.subtotal_amount, o.qty_issued, o.qty_returned_empty,
                o.qty_returned_filled, o.qty_lost, o.paid_cash_amount,
                o.paid_coin_amount, o.paid_other_amount, o.paid_total_amount,
                o.refunded_amount, o.payment_status, o.return_status,
                o.first_payment_at, o.last_payment_at, o.fully_paid_at,
                o.fully_returned_at)
               IS DISTINCT FROM
               (v_subtotal, v_qty_issued, v_qty_empty,
                v_qty_filled, v_qty_lost, v_paid_cash,
                v_paid_coin, v_paid_other, v_paid_total,
                v_refunded,
                fn_payment_status(v_outstanding, v_paid_total, false),
                fn_return_status(v_qty_issued, v_qty_pending, v_has_returnable),
                v_first_payment_at, v_last_payment_at, v_fully_paid_at,
                v_fully_returned_at);
      END;
      $fn$
    `);

    // Caches the three return counters on the line from the append-only event
    // table. The FOR UPDATE is what makes concurrent returns safe: two clerks
    // recording against a mutable counter is a classic lost update, appending
    // two rows and recomputing under a lock is correct under any interleaving.
    // DATA-MODEL §7 and §10.1.
    //
    // The resulting UPDATE is also what the over-return check constraint
    // (chk_order_items_returns_within_quantity) fires on — 12 empties against a
    // 10-jar line is rejected by the database, not by the UI.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_recompute_order_item(p_order_item_id uuid)
      RETURNS void
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_empty  integer;
        v_filled integer;
        v_lost   integer;
      BEGIN
        IF p_order_item_id IS NULL THEN
          RETURN;
        END IF;

        -- Child lock first, before anything touches the header.
        PERFORM 1 FROM order_items WHERE id = p_order_item_id FOR UPDATE;
        IF NOT FOUND THEN
          RETURN;
        END IF;

        SELECT COALESCE(SUM(e.empty_qty), 0)::integer,
               COALESCE(SUM(e.filled_qty), 0)::integer,
               COALESCE(SUM(e.lost_qty), 0)::integer
          INTO v_empty, v_filled, v_lost
          FROM order_item_return_events e
         WHERE e.order_item_id = p_order_item_id;

        UPDATE order_items AS i
           SET returned_empty_qty  = v_empty,
               returned_filled_qty = v_filled,
               lost_qty            = v_lost,
               updated_at          = now()
         WHERE i.id = p_order_item_id
           AND (i.returned_empty_qty, i.returned_filled_qty, i.lost_qty)
               IS DISTINCT FROM (v_empty, v_filled, v_lost);
      END;
      $fn$
    `);

    // pending_qty and line_total are generated and recompute themselves; the
    // header rollup is not, so it has to be pushed. DATA-MODEL §7.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_order_items_rollup()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          PERFORM fn_recompute_delivery_order(NEW.order_id);
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM fn_recompute_delivery_order(OLD.order_id);
        ELSIF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
          -- A line moved between orders: two parents. Lock ascending by id,
          -- never in arrival order, or two concurrent moves deadlock (§10.13).
          PERFORM fn_recompute_delivery_order(LEAST(OLD.order_id, NEW.order_id));
          PERFORM fn_recompute_delivery_order(GREATEST(OLD.order_id, NEW.order_id));
        ELSE
          PERFORM fn_recompute_delivery_order(NEW.order_id);
        END IF;
        RETURN NULL;
      END;
      $fn$
    `);

    // child -> parent -> grandparent, in that order and no other.
    // The explicit grandparent call is belt and braces: if a reversal event
    // nets to zero change on the line, fn_recompute_order_item writes nothing
    // and the cascade would stop there. Recomputing the header is idempotent.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_order_item_return_events_rollup()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_order_id uuid;
      BEGIN
        PERFORM fn_recompute_order_item(NEW.order_item_id);

        SELECT i.order_id INTO v_order_id
          FROM order_items i WHERE i.id = NEW.order_item_id;
        PERFORM fn_recompute_delivery_order(v_order_id);

        RETURN NULL;
      END;
      $fn$
    `);

    // ==================================================================
    // B. PAYMENT ROLLUPS
    //
    // One append-only table serves three arcs (DATA-MODEL §5.8). Exactly one
    // context FK is set; dispatch on whichever it is. INSERT only, because
    // UPDATE and DELETE are blocked outright further down (§9).
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_payments_rollup()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        IF NEW.order_id IS NOT NULL THEN
          PERFORM fn_recompute_delivery_order(NEW.order_id);
        END IF;
        IF NEW.coin_issue_id IS NOT NULL THEN
          PERFORM fn_recompute_coin_issue(NEW.coin_issue_id);
        END IF;
        IF NEW.party_order_id IS NOT NULL THEN
          PERFORM fn_recompute_party_order(NEW.party_order_id);
        END IF;
        RETURN NULL;
      END;
      $fn$
    `);

    // ==================================================================
    // C. COIN ISSUE ROLLUPS
    //
    // This is the owner's register row rendered directly on one table:
    // issued / returned / collected / pending, no joins, sortable and
    // filterable. DATA-MODEL §5.10.
    // ==================================================================

    // returned_value is summed from the events' stored value_credited rather
    // than derived from coins x rate. Rounding happens once, at write time,
    // which is what keeps the issue's arithmetic internally consistent —
    // 45 coins returned singly credits Rs 499.95, not Rs 500. DATA-MODEL §10.5.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_recompute_coin_issue(p_coin_issue_id uuid)
      RETURNS void
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_coins_issued     integer;
        v_coins_returned   integer;
        v_total_amount     numeric(12,2);
        v_returned_value   numeric(12,2);
        v_paid             numeric(12,2);
        v_refunded         numeric(12,2);
        v_outstanding      numeric(12,2);
        v_last_movement_at timestamptz;
        v_settled_at       timestamptz;
      BEGIN
        IF p_coin_issue_id IS NULL THEN
          RETURN;
        END IF;

        SELECT ci.settled_at
          INTO v_settled_at
          FROM coin_issues ci
         WHERE ci.id = p_coin_issue_id
           FOR UPDATE;

        IF NOT FOUND THEN
          RETURN;
        END IF;

        SELECT COALESCE(SUM(it.coins_issued), 0)::integer,
               COALESCE(SUM(it.coins_returned), 0)::integer,
               COALESCE(SUM(it.line_amount), 0)
          INTO v_coins_issued, v_coins_returned, v_total_amount
          FROM coin_issue_items it
         WHERE it.coin_issue_id = p_coin_issue_id;

        SELECT COALESCE(SUM(e.value_credited), 0)
          INTO v_returned_value
          FROM coin_issue_return_events e
          JOIN coin_issue_items it ON it.id = e.coin_issue_item_id
         WHERE it.coin_issue_id = p_coin_issue_id;

        SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0),
               COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0),
               MAX(p.created_at)
          INTO v_paid, v_refunded, v_last_movement_at
          FROM payments p
         WHERE p.coin_issue_id = p_coin_issue_id;

        -- Mirrors the generated coin_issues.outstanding_amount exactly.
        v_outstanding := v_total_amount - v_returned_value - v_paid + v_refunded;

        IF v_outstanding = 0 AND (v_paid > 0 OR v_returned_value > 0) THEN
          v_settled_at := COALESCE(v_settled_at, v_last_movement_at, now());
        ELSE
          v_settled_at := NULL;
        END IF;

        UPDATE coin_issues AS ci
           SET total_coins_issued   = v_coins_issued,
               total_coins_returned = v_coins_returned,
               total_amount         = v_total_amount,
               returned_value       = v_returned_value,
               paid_amount          = v_paid,
               refunded_amount      = v_refunded,
               payment_status       = fn_payment_status(v_outstanding, v_paid, true),
               settled_at           = v_settled_at
         WHERE ci.id = p_coin_issue_id
           AND (ci.total_coins_issued, ci.total_coins_returned, ci.total_amount,
                ci.returned_value, ci.paid_amount, ci.refunded_amount,
                ci.payment_status, ci.settled_at)
               IS DISTINCT FROM
               (v_coins_issued, v_coins_returned, v_total_amount,
                v_returned_value, v_paid, v_refunded,
                fn_payment_status(v_outstanding, v_paid, true), v_settled_at);
      END;
      $fn$
    `);

    // Same event-sourced shape as order returns; the check constraint on
    // coins_returned <= coins_issued is the over-return guard. DATA-MODEL §5.11.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_recompute_coin_issue_item(p_coin_issue_item_id uuid)
      RETURNS void
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_coins_returned integer;
      BEGIN
        IF p_coin_issue_item_id IS NULL THEN
          RETURN;
        END IF;

        PERFORM 1 FROM coin_issue_items WHERE id = p_coin_issue_item_id FOR UPDATE;
        IF NOT FOUND THEN
          RETURN;
        END IF;

        SELECT COALESCE(SUM(e.coins_returned), 0)::integer
          INTO v_coins_returned
          FROM coin_issue_return_events e
         WHERE e.coin_issue_item_id = p_coin_issue_item_id;

        UPDATE coin_issue_items AS it
           SET coins_returned = v_coins_returned,
               updated_at     = now()
         WHERE it.id = p_coin_issue_item_id
           AND it.coins_returned IS DISTINCT FROM v_coins_returned;
      END;
      $fn$
    `);

    await q.query(`
      CREATE OR REPLACE FUNCTION fn_coin_issue_items_rollup()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          PERFORM fn_recompute_coin_issue(NEW.coin_issue_id);
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM fn_recompute_coin_issue(OLD.coin_issue_id);
        ELSIF NEW.coin_issue_id IS DISTINCT FROM OLD.coin_issue_id THEN
          PERFORM fn_recompute_coin_issue(LEAST(OLD.coin_issue_id, NEW.coin_issue_id));
          PERFORM fn_recompute_coin_issue(GREATEST(OLD.coin_issue_id, NEW.coin_issue_id));
        ELSE
          PERFORM fn_recompute_coin_issue(NEW.coin_issue_id);
        END IF;
        RETURN NULL;
      END;
      $fn$
    `);

    // child -> parent. The explicit parent call is required here, not merely
    // defensive: returned_value comes from value_credited on the events, so an
    // event can change the issue's money without changing the item's coin count.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_coin_issue_return_events_rollup()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_coin_issue_id uuid;
      BEGIN
        PERFORM fn_recompute_coin_issue_item(NEW.coin_issue_item_id);

        SELECT it.coin_issue_id INTO v_coin_issue_id
          FROM coin_issue_items it WHERE it.id = NEW.coin_issue_item_id;
        PERFORM fn_recompute_coin_issue(v_coin_issue_id);

        RETURN NULL;
      END;
      $fn$
    `);

    // ==================================================================
    // D. COIN LEDGER — the spine
    //
    // Every change in coin stock writes exactly one row here and nothing else
    // may change coin_types.balance_coins. DATA-MODEL §5.14.
    //
    // This trigger pair is what makes negative stock structurally impossible
    // under concurrency (§10.2): the coin_types row lock serialises every
    // writer for that type, so two concurrent issues cannot both read the same
    // balance and both pass. Opening stock is not a column — it is an OPENING
    // row in this table (§5.9).
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_coin_ledger_assign_seq()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_coin_name      text;
        v_prev_balance   integer;
        v_next_seq       bigint;
        v_allow_negative boolean;
      BEGIN
        IF NEW.coins_delta IS NULL THEN
          RAISE EXCEPTION 'coin_ledger_entries.coins_delta must not be null'
            USING ERRCODE = 'not_null_violation';
        END IF;

        -- 1. Serialise every writer for this coin type.
        SELECT ct.name INTO v_coin_name
          FROM coin_types ct
         WHERE ct.id = NEW.coin_type_id
           FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'coin_ledger_entries.coin_type_id % does not exist', NEW.coin_type_id
            USING ERRCODE = 'foreign_key_violation';
        END IF;

        -- 2. Per-coin-type sequence, assigned under that lock (§5.14).
        SELECT COALESCE(MAX(e.entry_seq), 0) + 1
          INTO v_next_seq
          FROM coin_ledger_entries e
         WHERE e.coin_type_id = NEW.coin_type_id;

        -- 3. The running balance comes from the ledger itself, never from the
        --    coin_types cache — the ledger is the single source of truth, and
        --    reading it here means a tampered cache self-heals on the next entry.
        SELECT e.balance_after_coins
          INTO v_prev_balance
          FROM coin_ledger_entries e
         WHERE e.coin_type_id = NEW.coin_type_id
         ORDER BY e.entry_seq DESC
         LIMIT 1;

        v_prev_balance := COALESCE(v_prev_balance, 0);

        NEW.entry_seq           := v_next_seq;
        NEW.balance_after_coins := v_prev_balance + NEW.coins_delta;

        -- 4. Stock cannot go negative unless the owner has explicitly opted in.
        IF NEW.balance_after_coins < 0 THEN
          SELECT COALESCE(
                   (SELECT (s.value #>> '{}') = 'true'
                      FROM app_settings s
                     WHERE s.key = 'coins.allow_negative_balance'
                       AND s.deleted_at IS NULL),
                   false)
            INTO v_allow_negative;

          IF NOT v_allow_negative THEN
            RAISE EXCEPTION
              'Coin stock for "%" would go negative: balance %, movement %, result %',
              v_coin_name, v_prev_balance, NEW.coins_delta, NEW.balance_after_coins
              USING ERRCODE = 'check_violation';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $fn$
    `);

    // 5. Publish the new balance to the cache. A different table from the one
    //    the append-only guard protects, so the two never collide.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_coin_ledger_apply_balance()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        UPDATE coin_types AS ct
           SET balance_coins = NEW.balance_after_coins,
               updated_at    = now()
         WHERE ct.id = NEW.coin_type_id
           AND ct.balance_coins IS DISTINCT FROM NEW.balance_after_coins;
        RETURN NULL;
      END;
      $fn$
    `);

    // ==================================================================
    // E. PARTY ORDER ROLLUPS
    //
    // One row per service date rather than a recurrence rule, because dates
    // may be consecutive, alternate or arbitrarily spaced. DATA-MODEL §5.16.
    // Lock order is party_order_items -> party_order_days -> party_orders.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_recompute_party_order_day(p_day_id uuid)
      RETURNS void
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_day_total numeric(12,2);
      BEGIN
        IF p_day_id IS NULL THEN
          RETURN;
        END IF;

        PERFORM 1 FROM party_order_days WHERE id = p_day_id FOR UPDATE;
        IF NOT FOUND THEN
          RETURN;
        END IF;

        -- line_total is generated as delivered_quantity, falling back to the
        -- planned quantity until actuals are entered. DATA-MODEL §5.17.
        SELECT COALESCE(SUM(i.line_total), 0)
          INTO v_day_total
          FROM party_order_items i
         WHERE i.party_order_day_id = p_day_id;

        UPDATE party_order_days AS d
           SET day_total  = v_day_total,
               updated_at = now()
         WHERE d.id = p_day_id
           AND d.day_total IS DISTINCT FROM v_day_total;
      END;
      $fn$
    `);

    // total_amount excludes SKIPPED and CANCELLED days — a day the party did
    // not take is not billed. total_days, first_service_date and
    // last_service_date describe the schedule as planned and therefore count
    // every row. DATA-MODEL §5.15, §5.16.
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_recompute_party_order(p_party_order_id uuid)
      RETURNS void
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_total_amount numeric(12,2);
        v_total_days   integer;
        v_first_date   date;
        v_last_date    date;
        v_paid         numeric(12,2);
        v_advance      numeric(12,2);
        v_refunded     numeric(12,2);
        v_outstanding  numeric(12,2);
      BEGIN
        IF p_party_order_id IS NULL THEN
          RETURN;
        END IF;

        PERFORM 1 FROM party_orders WHERE id = p_party_order_id FOR UPDATE;
        IF NOT FOUND THEN
          RETURN;
        END IF;

        SELECT COALESCE(SUM(d.day_total)
                        FILTER (WHERE d.delivery_status NOT IN ('SKIPPED', 'CANCELLED')), 0),
               COUNT(*)::integer,
               MIN(d.service_date),
               MAX(d.service_date)
          INTO v_total_amount, v_total_days, v_first_date, v_last_date
          FROM party_order_days d
         WHERE d.party_order_id = p_party_order_id;

        -- advance_amount is a breakdown of paid_amount, not a second bucket:
        -- party_orders.outstanding_amount is generated as
        -- total_amount - paid_amount + refunded_amount, so an advance that did
        -- not land in paid_amount would never reduce what is owed.
        SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0),
               COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.is_advance), 0),
               COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0)
          INTO v_paid, v_advance, v_refunded
          FROM payments p
         WHERE p.party_order_id = p_party_order_id;

        v_outstanding := round(v_total_amount - v_paid + v_refunded, 2);

        UPDATE party_orders AS po
           SET total_amount       = v_total_amount,
               total_days         = v_total_days,
               first_service_date = v_first_date,
               last_service_date  = v_last_date,
               paid_amount        = v_paid,
               advance_amount     = v_advance,
               refunded_amount    = v_refunded,
               payment_status     = fn_payment_status(v_outstanding, v_paid, false)
         WHERE po.id = p_party_order_id
           AND (po.total_amount, po.total_days, po.first_service_date,
                po.last_service_date, po.paid_amount, po.advance_amount,
                po.refunded_amount, po.payment_status)
               IS DISTINCT FROM
               (v_total_amount, v_total_days, v_first_date,
                v_last_date, v_paid, v_advance,
                v_refunded, fn_payment_status(v_outstanding, v_paid, false));
      END;
      $fn$
    `);

    await q.query(`
      CREATE OR REPLACE FUNCTION fn_party_order_items_rollup()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_day_a uuid;
        v_day_b uuid;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          v_day_a := NEW.party_order_day_id;
        ELSIF TG_OP = 'DELETE' THEN
          v_day_a := OLD.party_order_day_id;
        ELSIF NEW.party_order_day_id IS DISTINCT FROM OLD.party_order_day_id THEN
          v_day_a := LEAST(OLD.party_order_day_id, NEW.party_order_day_id);
          v_day_b := GREATEST(OLD.party_order_day_id, NEW.party_order_day_id);
        ELSE
          v_day_a := NEW.party_order_day_id;
        END IF;

        PERFORM fn_recompute_party_order_day(v_day_a);
        IF v_day_b IS NOT NULL THEN
          PERFORM fn_recompute_party_order_day(v_day_b);
        END IF;

        RETURN NULL;
      END;
      $fn$
    `);

    await q.query(`
      CREATE OR REPLACE FUNCTION fn_party_order_days_rollup()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          PERFORM fn_recompute_party_order(NEW.party_order_id);
        ELSIF TG_OP = 'DELETE' THEN
          PERFORM fn_recompute_party_order(OLD.party_order_id);
        ELSIF NEW.party_order_id IS DISTINCT FROM OLD.party_order_id THEN
          PERFORM fn_recompute_party_order(LEAST(OLD.party_order_id, NEW.party_order_id));
          PERFORM fn_recompute_party_order(GREATEST(OLD.party_order_id, NEW.party_order_id));
        ELSE
          PERFORM fn_recompute_party_order(NEW.party_order_id);
        END IF;
        RETURN NULL;
      END;
      $fn$
    `);

    // ==================================================================
    // H. APPEND-ONLY GUARDS
    //
    // On payments, the two *_return_events tables, coin_ledger_entries,
    // audit_logs and document_revisions an UPDATE or DELETE raises
    // unconditionally. Corrections are reversing inserts. This is the
    // difference between an accounting system and a spreadsheet.
    // DATA-MODEL §9. (Revoking UPDATE/DELETE from the application role is the
    // second half of that control and belongs to the grants migration.)
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_append_only_guard()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        RAISE EXCEPTION
          '% is append-only: % is not permitted. Insert a reversing row instead.',
          TG_TABLE_NAME, TG_OP
          USING ERRCODE = 'restrict_violation';
        RETURN NULL;
      END;
      $fn$
    `);

    // ==================================================================
    // TRIGGERS
    //
    // DROP IF EXISTS before CREATE so the whole migration is re-runnable
    // during development, matching the CREATE OR REPLACE on every function.
    // ==================================================================
    const triggers: Array<[string, string, string]> = [
      // [trigger name, table, definition tail]
      [
        'trg_order_items_rollup',
        'order_items',
        `AFTER INSERT OR UPDATE OR DELETE ON "order_items"
         FOR EACH ROW EXECUTE FUNCTION fn_order_items_rollup()`,
      ],
      [
        'trg_order_item_return_events_rollup',
        'order_item_return_events',
        `AFTER INSERT ON "order_item_return_events"
         FOR EACH ROW EXECUTE FUNCTION fn_order_item_return_events_rollup()`,
      ],
      [
        'trg_payments_rollup',
        'payments',
        `AFTER INSERT ON "payments"
         FOR EACH ROW EXECUTE FUNCTION fn_payments_rollup()`,
      ],
      [
        'trg_coin_issue_items_rollup',
        'coin_issue_items',
        `AFTER INSERT OR UPDATE OR DELETE ON "coin_issue_items"
         FOR EACH ROW EXECUTE FUNCTION fn_coin_issue_items_rollup()`,
      ],
      [
        'trg_coin_issue_return_events_rollup',
        'coin_issue_return_events',
        `AFTER INSERT ON "coin_issue_return_events"
         FOR EACH ROW EXECUTE FUNCTION fn_coin_issue_return_events_rollup()`,
      ],
      [
        'trg_coin_ledger_entries_assign_seq',
        'coin_ledger_entries',
        `BEFORE INSERT ON "coin_ledger_entries"
         FOR EACH ROW EXECUTE FUNCTION fn_coin_ledger_assign_seq()`,
      ],
      [
        'trg_coin_ledger_entries_apply_balance',
        'coin_ledger_entries',
        `AFTER INSERT ON "coin_ledger_entries"
         FOR EACH ROW EXECUTE FUNCTION fn_coin_ledger_apply_balance()`,
      ],
      [
        'trg_party_order_items_rollup',
        'party_order_items',
        `AFTER INSERT OR UPDATE OR DELETE ON "party_order_items"
         FOR EACH ROW EXECUTE FUNCTION fn_party_order_items_rollup()`,
      ],
      [
        'trg_party_order_days_rollup',
        'party_order_days',
        `AFTER INSERT OR UPDATE OR DELETE ON "party_order_days"
         FOR EACH ROW EXECUTE FUNCTION fn_party_order_days_rollup()`,
      ],
    ];

    for (const [name, table, tail] of triggers) {
      await q.query(`DROP TRIGGER IF EXISTS "${name}" ON "${table}"`);
      await q.query(`CREATE TRIGGER "${name}" ${tail}`);
    }

    for (const table of Rollups1785517200000.APPEND_ONLY_TABLES) {
      const name = `trg_${table}_append_only`;
      await q.query(`DROP TRIGGER IF EXISTS "${name}" ON "${table}"`);
      await q.query(`
        CREATE TRIGGER "${name}"
          BEFORE UPDATE OR DELETE ON "${table}"
          FOR EACH ROW EXECUTE FUNCTION fn_append_only_guard()
      `);
    }

    // ==================================================================
    // G. DRIFT DETECTION
    //
    // Views whose job is to return zero rows, checked nightly and surfaced on
    // the dashboard. A non-empty drift view is a Sev-1. DATA-MODEL §8.3, §12.
    //
    // Each view compares the cached header against the *deepest* source rows —
    // the return events, not the line-item counters that cache them — so a
    // header that agrees with a drifted cache is still caught.
    // ==================================================================
    await q.query(`DROP VIEW IF EXISTS "v_order_rollup_drift"`);
    await q.query(`
      CREATE VIEW "v_order_rollup_drift" AS
      SELECT o.id   AS order_id,
             o.code AS order_code,
             o.subtotal_amount,      src.expected_subtotal,
             o.qty_issued,           src.expected_qty_issued,
             o.qty_returned_empty,   src.expected_qty_returned_empty,
             o.qty_returned_filled,  src.expected_qty_returned_filled,
             o.qty_lost,             src.expected_qty_lost,
             o.paid_cash_amount,     pay.expected_paid_cash,
             o.paid_coin_amount,     pay.expected_paid_coin,
             o.paid_other_amount,    pay.expected_paid_other,
             o.paid_total_amount,    pay.expected_paid_total,
             o.refunded_amount,      pay.expected_refunded,
             o.payment_status,
             fn_payment_status(
               src.expected_subtotal - o.discount_amount
                 - pay.expected_paid_total + pay.expected_refunded,
               pay.expected_paid_total, false)              AS expected_payment_status,
             o.return_status,
             fn_return_status(
               src.expected_qty_issued,
               src.expected_qty_issued - src.expected_qty_returned_empty
                 - src.expected_qty_returned_filled - src.expected_qty_lost,
               src.expected_has_returnable)                 AS expected_return_status
        FROM delivery_orders o
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(round((i.quantity - ev.filled)::numeric * i.unit_price, 2)), 0)::numeric(12,2)
                   AS expected_subtotal,
                 COALESCE(SUM(i.quantity) FILTER (WHERE i.is_returnable), 0)::integer
                   AS expected_qty_issued,
                 COALESCE(SUM(ev.empty),  0)::integer AS expected_qty_returned_empty,
                 COALESCE(SUM(ev.filled), 0)::integer AS expected_qty_returned_filled,
                 COALESCE(SUM(ev.lost),   0)::integer AS expected_qty_lost,
                 COALESCE(bool_or(i.is_returnable), false) AS expected_has_returnable
            FROM order_items i
            CROSS JOIN LATERAL (
              SELECT COALESCE(SUM(e.empty_qty),  0)::integer AS empty,
                     COALESCE(SUM(e.filled_qty), 0)::integer AS filled,
                     COALESCE(SUM(e.lost_qty),   0)::integer AS lost
                FROM order_item_return_events e
               WHERE e.order_item_id = i.id
            ) ev
           WHERE i.order_id = o.id
        ) src
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.mode = 'CASH'), 0)::numeric(12,2)
                   AS expected_paid_cash,
                 COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.mode = 'COIN'), 0)::numeric(12,2)
                   AS expected_paid_coin,
                 COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.mode NOT IN ('CASH', 'COIN')), 0)::numeric(12,2)
                   AS expected_paid_other,
                 COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0)::numeric(12,2)
                   AS expected_paid_total,
                 COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0)::numeric(12,2)
                   AS expected_refunded
            FROM payments p
           WHERE p.order_id = o.id
        ) pay
       WHERE (o.subtotal_amount, o.qty_issued, o.qty_returned_empty,
              o.qty_returned_filled, o.qty_lost, o.paid_cash_amount,
              o.paid_coin_amount, o.paid_other_amount, o.paid_total_amount,
              o.refunded_amount, o.payment_status, o.return_status)
             IS DISTINCT FROM
             (src.expected_subtotal, src.expected_qty_issued, src.expected_qty_returned_empty,
              src.expected_qty_returned_filled, src.expected_qty_lost, pay.expected_paid_cash,
              pay.expected_paid_coin, pay.expected_paid_other, pay.expected_paid_total,
              pay.expected_refunded,
              fn_payment_status(
                src.expected_subtotal - o.discount_amount
                  - pay.expected_paid_total + pay.expected_refunded,
                pay.expected_paid_total, false),
              fn_return_status(
                src.expected_qty_issued,
                src.expected_qty_issued - src.expected_qty_returned_empty
                  - src.expected_qty_returned_filled - src.expected_qty_lost,
                src.expected_has_returnable))
    `);

    // Three independent statements of the same number must agree: the cache,
    // the sum of every movement, and the running balance the ledger itself
    // recorded. DATA-MODEL §8.3.
    await q.query(`DROP VIEW IF EXISTS "v_coin_balance_drift"`);
    await q.query(`
      CREATE VIEW "v_coin_balance_drift" AS
      SELECT ct.id   AS coin_type_id,
             ct.name AS coin_type_name,
             ct.balance_coins,
             led.ledger_sum,
             led.latest_balance_after,
             led.latest_entry_seq,
             led.entry_count
        FROM coin_types ct
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(e.coins_delta), 0)::integer AS ledger_sum,
                 COALESCE(MAX(e.entry_seq), 0)            AS latest_entry_seq,
                 COUNT(*)                                 AS entry_count,
                 COALESCE((SELECT e2.balance_after_coins
                             FROM coin_ledger_entries e2
                            WHERE e2.coin_type_id = ct.id
                            ORDER BY e2.entry_seq DESC
                            LIMIT 1), 0)                  AS latest_balance_after
            FROM coin_ledger_entries e
           WHERE e.coin_type_id = ct.id
        ) led
       WHERE ct.balance_coins IS DISTINCT FROM led.ledger_sum
          OR ct.balance_coins IS DISTINCT FROM led.latest_balance_after
    `);

    await q.query(`DROP VIEW IF EXISTS "v_coin_issue_drift"`);
    await q.query(`
      CREATE VIEW "v_coin_issue_drift" AS
      SELECT ci.id   AS coin_issue_id,
             ci.code AS coin_issue_code,
             ci.total_coins_issued,   src.expected_total_coins_issued,
             ci.total_coins_returned, src.expected_total_coins_returned,
             ci.total_amount,         src.expected_total_amount,
             ci.returned_value,       src.expected_returned_value,
             ci.paid_amount,          pay.expected_paid,
             ci.refunded_amount,      pay.expected_refunded,
             ci.payment_status,
             fn_payment_status(
               src.expected_total_amount - src.expected_returned_value
                 - pay.expected_paid + pay.expected_refunded,
               pay.expected_paid, true) AS expected_payment_status
        FROM coin_issues ci
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(it.coins_issued), 0)::integer      AS expected_total_coins_issued,
                 COALESCE(SUM(ev.coins), 0)::integer             AS expected_total_coins_returned,
                 COALESCE(SUM(it.line_amount), 0)::numeric(12,2) AS expected_total_amount,
                 COALESCE(SUM(ev.value), 0)::numeric(12,2)       AS expected_returned_value
            FROM coin_issue_items it
            CROSS JOIN LATERAL (
              SELECT COALESCE(SUM(e.coins_returned), 0)::integer AS coins,
                     COALESCE(SUM(e.value_credited), 0)          AS value
                FROM coin_issue_return_events e
               WHERE e.coin_issue_item_id = it.id
            ) ev
           WHERE it.coin_issue_id = ci.id
        ) src
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0)::numeric(12,2)  AS expected_paid,
                 COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0)::numeric(12,2) AS expected_refunded
            FROM payments p
           WHERE p.coin_issue_id = ci.id
        ) pay
       WHERE (ci.total_coins_issued, ci.total_coins_returned, ci.total_amount,
              ci.returned_value, ci.paid_amount, ci.refunded_amount, ci.payment_status)
             IS DISTINCT FROM
             (src.expected_total_coins_issued, src.expected_total_coins_returned,
              src.expected_total_amount, src.expected_returned_value,
              pay.expected_paid, pay.expected_refunded,
              fn_payment_status(
                src.expected_total_amount - src.expected_returned_value
                  - pay.expected_paid + pay.expected_refunded,
                pay.expected_paid, true))
    `);

    await q.query(`DROP VIEW IF EXISTS "v_party_order_drift"`);
    await q.query(`
      CREATE VIEW "v_party_order_drift" AS
      SELECT po.id   AS party_order_id,
             po.code AS party_order_code,
             po.total_amount,       src.expected_total_amount,
             po.total_days,         src.expected_total_days,
             po.first_service_date, src.expected_first_service_date,
             po.last_service_date,  src.expected_last_service_date,
             po.paid_amount,        pay.expected_paid,
             po.advance_amount,     pay.expected_advance,
             po.refunded_amount,    pay.expected_refunded,
             po.payment_status,
             fn_payment_status(
               round(src.expected_total_amount - pay.expected_paid + pay.expected_refunded, 2),
               pay.expected_paid, false)     AS expected_payment_status,
             src.day_total_drift_count
        FROM party_orders po
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(items.day_sum)
                          FILTER (WHERE d.delivery_status NOT IN ('SKIPPED', 'CANCELLED')), 0)::numeric(12,2)
                   AS expected_total_amount,
                 COUNT(*)::integer  AS expected_total_days,
                 MIN(d.service_date) AS expected_first_service_date,
                 MAX(d.service_date) AS expected_last_service_date,
                 COUNT(*) FILTER (WHERE d.day_total IS DISTINCT FROM items.day_sum)::integer
                   AS day_total_drift_count
            FROM party_order_days d
            CROSS JOIN LATERAL (
              SELECT COALESCE(SUM(i.line_total), 0)::numeric(12,2) AS day_sum
                FROM party_order_items i
               WHERE i.party_order_day_id = d.id
            ) items
           WHERE d.party_order_id = po.id
        ) src
        CROSS JOIN LATERAL (
          SELECT COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0)::numeric(12,2) AS expected_paid,
                 COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.is_advance), 0)::numeric(12,2) AS expected_advance,
                 COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0)::numeric(12,2) AS expected_refunded
            FROM payments p
           WHERE p.party_order_id = po.id
        ) pay
       WHERE src.day_total_drift_count > 0
          OR (po.total_amount, po.total_days, po.first_service_date,
              po.last_service_date, po.paid_amount, po.advance_amount,
              po.refunded_amount, po.payment_status)
             IS DISTINCT FROM
             (src.expected_total_amount, src.expected_total_days, src.expected_first_service_date,
              src.expected_last_service_date, pay.expected_paid, pay.expected_advance,
              pay.expected_refunded,
              fn_payment_status(
                round(src.expected_total_amount - pay.expected_paid + pay.expected_refunded, 2),
                pay.expected_paid, false))
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // Reverse order: triggers, then views, then functions.
    //
    // Views must go before functions, not after: v_order_rollup_drift and its
    // siblings depend on fn_payment_status and fn_return_status, and PostgreSQL
    // refuses to drop a function a view still references. Dropping functions
    // with CASCADE would silently take the views with them, which is exactly
    // the kind of quiet destruction a down-migration must not do.
    const triggers: Array<[string, string]> = [
      ['trg_party_order_days_rollup', 'party_order_days'],
      ['trg_party_order_items_rollup', 'party_order_items'],
      ['trg_coin_ledger_entries_apply_balance', 'coin_ledger_entries'],
      ['trg_coin_ledger_entries_assign_seq', 'coin_ledger_entries'],
      ['trg_coin_issue_return_events_rollup', 'coin_issue_return_events'],
      ['trg_coin_issue_items_rollup', 'coin_issue_items'],
      ['trg_payments_rollup', 'payments'],
      ['trg_order_item_return_events_rollup', 'order_item_return_events'],
      ['trg_order_items_rollup', 'order_items'],
    ];

    for (const table of [...Rollups1785517200000.APPEND_ONLY_TABLES].reverse()) {
      await q.query(`DROP TRIGGER IF EXISTS "trg_${table}_append_only" ON "${table}"`);
    }
    for (const [name, table] of triggers) {
      await q.query(`DROP TRIGGER IF EXISTS "${name}" ON "${table}"`);
    }

    await q.query(`DROP VIEW IF EXISTS "v_party_order_drift"`);
    await q.query(`DROP VIEW IF EXISTS "v_coin_issue_drift"`);
    await q.query(`DROP VIEW IF EXISTS "v_coin_balance_drift"`);
    await q.query(`DROP VIEW IF EXISTS "v_order_rollup_drift"`);

    await q.query(`DROP FUNCTION IF EXISTS fn_append_only_guard()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_party_order_days_rollup()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_party_order_items_rollup()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_recompute_party_order(uuid)`);
    await q.query(`DROP FUNCTION IF EXISTS fn_recompute_party_order_day(uuid)`);
    await q.query(`DROP FUNCTION IF EXISTS fn_coin_ledger_apply_balance()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_coin_ledger_assign_seq()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_coin_issue_return_events_rollup()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_coin_issue_items_rollup()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_recompute_coin_issue_item(uuid)`);
    await q.query(`DROP FUNCTION IF EXISTS fn_recompute_coin_issue(uuid)`);
    await q.query(`DROP FUNCTION IF EXISTS fn_payments_rollup()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_order_item_return_events_rollup()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_order_items_rollup()`);
    await q.query(`DROP FUNCTION IF EXISTS fn_recompute_order_item(uuid)`);
    await q.query(`DROP FUNCTION IF EXISTS fn_recompute_delivery_order(uuid)`);
    await q.query(`DROP FUNCTION IF EXISTS fn_return_status(integer, integer, boolean)`);
    await q.query(`DROP FUNCTION IF EXISTS fn_payment_status(numeric, numeric, boolean)`);
  }

  /** DATA-MODEL §9 — reversals are inserts, never edits. */
  private static readonly APPEND_ONLY_TABLES = [
    'payments',
    'order_item_return_events',
    'coin_issue_return_events',
    'coin_ledger_entries',
    'audit_logs',
    'document_revisions',
  ] as const;
}
