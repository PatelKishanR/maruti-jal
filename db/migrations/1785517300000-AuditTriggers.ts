import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — make `audit_logs` actually record something.
 *
 * The table, its append-only guard and its repository all shipped in phase 1;
 * nothing ever wrote to it, so the Activity tab renders empty. This migration
 * adds the generic row-audit trigger that DATA-MODEL §5.21 and §9 describe:
 *
 *   "Written by a generic trigger. The actor comes from a per-request session
 *    variable, which is what allows a database-level trigger to record *who*
 *    without every statement remembering to set it."
 *
 * WHY A TRIGGER AND NOT THE SERVICE LAYER — the same reason as the rollups.
 * An application-level audit only records the writes the application happens
 * to know about, which is precisely the wrong set on the day it matters: a
 * migration, an import script, or the owner running an UPDATE in the Neon
 * console at 11pm. The audit row is written inside the same transaction as the
 * change it records, so it cannot be lost independently of that change.
 *
 * NOT ATTACHED TO the append-only tables — `payments`, `*_return_events`,
 * `coin_ledger_entries`, `audit_logs`, `document_revisions`. Those rows are
 * already immutable facts; an audit row would be a byte-for-byte duplicate of
 * the record itself. Nor to `party_order_items`, which is out of scope for
 * this pass.
 *
 * DOCUMENT REVISIONS are deliberately NOT touched here — see the note at the
 * foot of this file.
 */
export class AuditTriggers1785517300000 implements MigrationInterface {
  name = 'AuditTriggers1785517300000';

  public async up(q: QueryRunner): Promise<void> {
    // ==================================================================
    // fn_audit_row() — ONE function, attached to every business table.
    //
    // Everything table-specific arrives through TG_TABLE_NAME and TG_ARGV,
    // so there is exactly one copy of the diffing, the action classification
    // and the actor resolution to get right. See EXCLUDED_COLUMNS below for
    // what TG_ARGV carries.
    //
    // SECURITY INVOKER (the default), not DEFINER: DATA-MODEL §9 revokes
    // UPDATE and DELETE on audit_logs from the application role but leaves
    // INSERT, which is all this needs. A DEFINER function here would be a
    // privilege-escalation surface bought for nothing.
    // ==================================================================
    await q.query(`
      CREATE OR REPLACE FUNCTION fn_audit_row()
      RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      DECLARE
        v_old        jsonb;
        v_new        jsonb;
        v_diff_old   jsonb;
        v_diff_new   jsonb;
        v_action     audit_action;
        v_record_id  uuid;
        v_changed    text[];
        v_excluded   text[];
        v_actor_id   uuid;
        v_actor_name text;
        v_actor_role text;
        v_request_id text;
        v_ip         inet;
        v_raw        text;
        v_u_name     text;
        v_u_role     text;
      BEGIN
        /* ── 1. The two row images ───────────────────────────────────────
           to_jsonb(OLD/NEW) rather than a hand-written column list: the
           function must not need editing every time a column is added. */
        IF TG_OP = 'INSERT' THEN
          v_old := NULL;
          v_new := to_jsonb(NEW);
        ELSIF TG_OP = 'DELETE' THEN
          v_old := to_jsonb(OLD);
          v_new := NULL;
        ELSE
          v_old := to_jsonb(OLD);
          v_new := to_jsonb(NEW);

          /* FAST PATH — an UPDATE that changed nothing at all.
             Every recompute helper in the Rollups migration already guards
             its write with IS DISTINCT FROM, but TypeORM save() and any
             hand-written UPDATE will happily rewrite a row with identical
             values. Without this, "who changed this figure" drowns in rows
             that changed no figure. Cheap equality test, no key arrays
             built, no INSERT. */
          IF v_old = v_new THEN
            RETURN NULL;
          END IF;
        END IF;

        v_record_id := COALESCE(v_new ->> 'id', v_old ->> 'id')::uuid;

        /* ── 2. changed_fields ───────────────────────────────────────────
           Global exclusions:
             id             — already the record_id of this very audit row.
             created_at     — already the created_at of this very audit row.
             created_by_id  — already the actor of the INSERT row.
             updated_at     — changes on literally every write; listing it
                              would make changed_fields useless as a filter.
             updated_by_id  — the same fact as actor_id, recorded twice.
             version        — the optimistic-lock counter, not a business value.
           Per-table exclusions arrive in TG_ARGV: STORED generated columns
           and trigger-maintained rollups. See EXCLUDED_COLUMNS in the
           migration source for the full list and the reasoning.

           jsonb_strip_nulls on both sides is what makes one expression
           correct for all three operations: a NULL column simply is not a
           key, so an INSERT lists only the columns that were actually given
           a value, a DELETE only the columns that held one, and an UPDATE
           still sees NULL -> value and value -> NULL as changes because one
           side has the key and the other does not. */
        v_excluded := ARRAY[
                        'id', 'created_at', 'created_by_id',
                        'updated_at', 'updated_by_id', 'version'
                      ] || COALESCE(TG_ARGV, ARRAY[]::text[]);

        v_diff_old := COALESCE(jsonb_strip_nulls(v_old), '{}'::jsonb);
        v_diff_new := COALESCE(jsonb_strip_nulls(v_new), '{}'::jsonb);

        SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
          INTO v_changed
          FROM (
            SELECT jsonb_object_keys(v_diff_old) AS k
            UNION
            SELECT jsonb_object_keys(v_diff_new)
          ) keys
         WHERE NOT (k = ANY (v_excluded))
           AND (v_diff_old -> k) IS DISTINCT FROM (v_diff_new -> k);

        /* ── 3. The action ───────────────────────────────────────────────
           audit_action has no DELETE member by design: this schema soft
           deletes. A hard DELETE — which should only ever come from a
           migration — is therefore recorded as SOFT_DELETE and is told apart
           by "after IS NULL", exactly as the entity comment says.

           jsonb_exists() rather than the jsonb key-exists operator, so the
           SQL survives any driver that reads that character as a bind
           placeholder. */
        IF TG_OP = 'INSERT' THEN
          v_action := 'INSERT';
        ELSIF TG_OP = 'DELETE' THEN
          v_action := 'SOFT_DELETE';
        ELSE
          v_action := 'UPDATE';

          IF jsonb_exists(v_old, 'deleted_at') THEN
            IF  (v_old ->> 'deleted_at') IS NULL
            AND (v_new ->> 'deleted_at') IS NOT NULL THEN
              v_action := 'SOFT_DELETE';
            ELSIF (v_old ->> 'deleted_at') IS NOT NULL
              AND (v_new ->> 'deleted_at') IS NULL THEN
              v_action := 'RESTORE';
            END IF;
          END IF;

          -- A cancellation is a business event, not a field edit. Only the
          -- transition INTO 'CANCELLED' counts; a second UPDATE on an
          -- already-cancelled row is an ordinary UPDATE.
          IF v_action = 'UPDATE'
             AND jsonb_exists(v_new, 'status')
             AND (v_new ->> 'status') = 'CANCELLED'
             AND (v_old ->> 'status') IS DISTINCT FROM 'CANCELLED' THEN
            v_action := 'CANCEL';
          END IF;
        END IF;

        /* ── 4. Rollup noise ─────────────────────────────────────────────
           A plain UPDATE in which every changed column was excluded is a
           machine writing to a machine: fn_recompute_delivery_order pushing
           a new subtotal_amount after a line was edited, or a rollup helper
           stamping updated_at. The line edit itself is already audited on
           order_items, and the money movement is already an immutable row in
           payments or a *_return_events table, so nothing is lost. A
           SOFT_DELETE, RESTORE or CANCEL is always recorded, whatever else
           did or did not change alongside it. */
        IF v_action = 'UPDATE' AND cardinality(v_changed) = 0 THEN
          RETURN NULL;
        END IF;

        /* ── 5. The actor ────────────────────────────────────────────────
           Transaction-scoped GUCs, set by withTx() in
           src/lib/db/data-source.ts. NULLABLE ON PURPOSE: a migration, a
           seed script or a psql session legitimately has no actor, and an
           audit that refuses to record such a change is worse than one that
           records it anonymously.

           actor_id is regex-checked rather than cast inside an exception
           block so the hot path never opens a subtransaction. The second
           argument to current_setting() being true means "return NULL if
           unset" instead of raising. */
        v_raw := NULLIF(current_setting('app.actor_id', true), '');
        IF v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          v_actor_id := v_raw::uuid;
        END IF;

        v_actor_name := NULLIF(current_setting('app.actor_name', true), '');
        v_actor_role := NULLIF(current_setting('app.actor_role', true), '');
        v_request_id := NULLIF(current_setting('app.request_id', true), '');

        v_raw := NULLIF(current_setting('app.ip', true), '');
        IF v_raw IS NOT NULL THEN
          -- inet rejects the raw comma-separated X-Forwarded-For chain. A bad
          -- value must not abort the business write, so it is swallowed here
          -- rather than validated by regex, which cannot cover IPv6 honestly.
          BEGIN
            v_ip := v_raw::inet;
          EXCEPTION WHEN others THEN
            v_ip := NULL;
          END;
        END IF;

        -- SNAPSHOT, not a foreign key: history must survive the deletion of
        -- the account that made it (DATA-MODEL §5.20, §5.21). Filled from the
        -- GUC when the app set one; otherwise looked up once, so that a psql
        -- session that sets only app.actor_id still produces a readable row.
        IF v_actor_id IS NOT NULL AND (v_actor_name IS NULL OR v_actor_role IS NULL) THEN
          SELECT u.name, u.role::text
            INTO v_u_name, v_u_role
            FROM users u
           WHERE u.id = v_actor_id;

          v_actor_name := COALESCE(v_actor_name, v_u_name);
          v_actor_role := COALESCE(v_actor_role, v_u_role);
        END IF;

        /* ── 6. Redact secrets before they are copied ────────────────────
           audit_logs is read by the Activity tab. A password hash duplicated
           into it is a second place to steal it from, and one with no
           rotation story. The CHANGE is still auditable — 'password_hash'
           is in changed_fields, computed above from the real values. */
        IF TG_TABLE_NAME = 'users' THEN
          IF v_old IS NOT NULL AND jsonb_exists(v_old, 'password_hash') THEN
            v_old := jsonb_set(v_old, '{password_hash}', '"[redacted]"'::jsonb);
          END IF;
          IF v_new IS NOT NULL AND jsonb_exists(v_new, 'password_hash') THEN
            v_new := jsonb_set(v_new, '{password_hash}', '"[redacted]"'::jsonb);
          END IF;
        END IF;

        INSERT INTO audit_logs (
          table_name, record_id, action, before, after, changed_fields,
          actor_id, actor_name, actor_role, request_id, ip
        ) VALUES (
          TG_TABLE_NAME, v_record_id, v_action, v_old, v_new, v_changed,
          v_actor_id, v_actor_name, v_actor_role, v_request_id, v_ip
        );

        RETURN NULL;  -- AFTER trigger: the return value is discarded.
      END;
      $fn$
    `);

    // ==================================================================
    // TRIGGERS
    //
    // DROP IF EXISTS before CREATE so the whole migration is re-runnable
    // during development, matching the CREATE OR REPLACE on the function
    // and the convention set by the Rollups migration.
    //
    // AFTER, so the row is audited exactly as it was committed — including
    // any value a BEFORE trigger or a STORED generated column supplied.
    // Named trg_<table>_audit, which sorts before trg_<table>_rollup, so on
    // a table carrying both the audit row is written first.
    // ==================================================================
    for (const table of AuditTriggers1785517300000.AUDITED_TABLES) {
      const name = `trg_${table}_audit`;
      const excluded = AuditTriggers1785517300000.EXCLUDED_COLUMNS[table] ?? [];
      // Column names, not user input: every one is a literal in this file.
      const args = excluded.map((c) => `'${c}'`).join(', ');

      await q.query(`DROP TRIGGER IF EXISTS "${name}" ON "${table}"`);
      await q.query(`
        CREATE TRIGGER "${name}"
          AFTER INSERT OR UPDATE OR DELETE ON "${table}"
          FOR EACH ROW EXECUTE FUNCTION fn_audit_row(${args})
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    // Reverse order: triggers first, then the function they reference.
    // PostgreSQL would refuse to drop the function while a trigger still
    // points at it, and CASCADE would silently take the triggers with it —
    // exactly the quiet destruction a down-migration must not do.
    for (const table of [...AuditTriggers1785517300000.AUDITED_TABLES].reverse()) {
      await q.query(`DROP TRIGGER IF EXISTS "trg_${table}_audit" ON "${table}"`);
    }

    await q.query(`DROP FUNCTION IF EXISTS fn_audit_row()`);
  }

  /**
   * The business tables worth a change history.
   *
   * Deliberately absent: `payments`, `order_item_return_events`,
   * `coin_issue_return_events`, `coin_ledger_entries`, `audit_logs` and
   * `document_revisions`. All six are append-only (DATA-MODEL §9) and carry
   * a BEFORE UPDATE OR DELETE guard, so their rows are already immutable
   * facts — an audit row would restate the record it audits.
   */
  private static readonly AUDITED_TABLES = [
    'users',
    'staff',
    'products',
    'coin_types',
    'expense_categories',
    'delivery_orders',
    'order_items',
    'coin_issues',
    'coin_issue_items',
    'coin_adjustments',
    'party_orders',
    'party_order_days',
    'direct_sales',
    'expenses',
  ] as const;

  /**
   * Columns kept OUT of `changed_fields`, passed to the trigger as TG_ARGV.
   *
   * They are still recorded in full in `before` and `after` — this only
   * governs the indexed signal column, and with it the "did a human touch
   * this row?" test in §4 of the function above.
   *
   * Three categories, all machine-written:
   *
   *   REGISTER — the `*_no` identity columns. Assigned by the database, never
   *     supplied by the application, and already visible through the `code`
   *     they generate.
   *
   *   GENERATED — STORED generated columns. Pure functions of other columns
   *     in the same row, so they can never be the reason a row changed. Also
   *     the difference between test "rename a staff member" reporting
   *     {name} and reporting {name, search_blob}.
   *
   *   ROLLUP — maintained by the trigger functions in the Rollups migration
   *     from rows in OTHER tables. Every one of them is derived from an
   *     append-only source — payments, *_return_events, coin_ledger_entries
   *     — which is itself the permanent record of the movement. Listing them
   *     would bury one edited discount_amount under sixteen recalculated
   *     columns.
   *
   * Note what is NOT excluded, because it is typed by a human:
   * `delivery_orders.discount_amount`, `order_items.quantity` and
   * `unit_price`, `coin_issue_items.packets`, `party_order_days.notes` and
   * `delivery_status`, `coin_types.coins_per_packet` and `packet_amount`,
   * every `status`, and every `deleted_at` / `deleted_by_id`.
   *
   * `id`, `created_at`, `created_by_id`, `updated_at`, `updated_by_id` and
   * `version` are excluded globally inside the function — each is either
   * already a column of the audit row itself or a lock counter — and are not
   * repeated here.
   *
   * MAINTENANCE: adding a generated or rollup column to one of these tables
   * means adding it here and re-running this migration. The alternative — a
   * catalog lookup inside the trigger — costs a query per audited row to
   * save an entry in a list a reviewer can read.
   */
  private static readonly EXCLUDED_COLUMNS: Record<string, readonly string[]> = {
    users: [],

    staff: [
      /* register  */ 'staff_no',
      /* generated */ 'code', 'search_blob',
    ],

    products: [
      /* register  */ 'product_no',
      /* generated */ 'code', 'search_blob',
    ],

    coin_types: [
      /* generated */ 'per_coin_price',
      /* rollup    */ 'balance_coins', // fn_coin_ledger_apply_balance
    ],

    expense_categories: [],

    delivery_orders: [
      /* register  */ 'order_no',
      /* generated */ 'code', 'total_amount', 'outstanding_amount', 'qty_pending',
      /* rollup    */ 'subtotal_amount',
      'paid_cash_amount', 'paid_coin_amount', 'paid_other_amount',
      'paid_total_amount', 'refunded_amount', 'payment_status',
      'qty_issued', 'qty_returned_empty', 'qty_returned_filled', 'qty_lost',
      'return_status', 'first_payment_at', 'last_payment_at',
      'fully_paid_at', 'fully_returned_at',
    ],

    order_items: [
      /* generated */ 'is_price_overridden', 'pending_qty', 'line_total',
      /* rollup    */ 'returned_empty_qty', 'returned_filled_qty', 'lost_qty',
    ],

    coin_issues: [
      /* register  */ 'issue_no',
      /* generated */ 'code', 'coins_outstanding', 'net_payable', 'outstanding_amount',
      /* rollup    */ 'total_coins_issued', 'total_coins_returned',
      'total_amount', 'returned_value', 'paid_amount', 'refunded_amount',
      'payment_status', 'settled_at',
    ],

    coin_issue_items: [
      /* generated */ 'coins_issued', 'line_amount', 'coins_outstanding',
      /* rollup    */ 'coins_returned',
    ],

    coin_adjustments: [],

    party_orders: [
      /* register  */ 'party_no',
      /* generated */ 'code', 'outstanding_amount', 'search_blob',
      /* rollup    */ 'first_service_date', 'last_service_date', 'total_days',
      'total_amount', 'advance_amount', 'paid_amount', 'refunded_amount',
      'payment_status',
    ],

    party_order_days: [
      /* rollup */ 'day_total',
    ],

    direct_sales: [
      /* register  */ 'sale_no',
      /* generated */ 'code', 'search_blob',
    ],

    expenses: [
      /* register  */ 'expense_no',
      /* generated */ 'code', 'search_blob',
    ],
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   document_revisions — deliberately left to the service layer.

   DATA-MODEL §5.20 is explicit: ONE ROW PER EDIT SESSION, NOT PER COLUMN.
   A row trigger sees one row of one table at a time. It cannot know that the
   header UPDATE, the four line INSERTs and the two line DELETEs it just
   observed were one human decision, it cannot assemble the `snapshot` of the
   whole aggregate, and it cannot invent the `change_reason` the user typed
   into the dialog. Forcing it into a trigger would produce seven revisions
   of a fragment each — precisely the per-column history the entity comment
   rejects, and the reassembly problem it exists to prevent.

   Nor is anything added for `revision_no`. The obvious candidate — a
   BEFORE INSERT trigger allocating the next number under a lock, mirroring
   fn_coin_ledger_assign_seq — solves a race that cannot occur: an edit
   session already holds a FOR UPDATE row lock on the aggregate root and
   bumps its `version` column (DATA-MODEL §9, §10.10), which serialises
   writers for one document, and uq_document_revisions_doc_rev is the loud
   backstop if that is ever violated. The append-only guard is already in
   place from the Rollups migration.

   What the service layer owes it, inside the same transaction as the edit:

     const rev = await documentRevisionRepository.create({
       documentType: 'ORDER',
       documentId:   order.id,
       revisionNo:   previous + 1,
       snapshot:     aggregate,
       diff:         diffOf(before, aggregate),
       changeReason: input.reason ?? null,
       actorId:      userId,
       actorName:    userName,
     }, em);

   The two mechanisms are complementary, not alternatives: audit_logs answers
   "what changed, when, by whom" and is written by the database whoever writes;
   document_revisions answers "show me the order as it stood on 14 March" and
   can only be written by the code that knows what an order is.
   ═══════════════════════════════════════════════════════════════════════ */
