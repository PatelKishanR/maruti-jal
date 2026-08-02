import "server-only";
import type { EntityManager } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";

/**
 * `v_staff_outstanding` — one row per staff member, "what does this person owe
 * us, in total?", across delivery orders AND coin issues.
 *
 * ── RAW SQL LIVES HERE, AND ONLY HERE ───────────────────────────────────────
 *
 * Every other repository in this codebase goes through TypeORM because it maps
 * an ENTITY. A database view has no entity: there is no class to decorate, no
 * primary key TypeORM would accept, and nothing it could hydrate. Registering a
 * `@ViewEntity` would buy nothing but a second place for the column list to
 * drift from the migration.
 *
 * So `src/lib/repositories/insights/*` is the ONE PLACE in this application
 * where raw SQL is correct. The rules that make it safe:
 *
 *   1. Every value is a BOUND PARAMETER (`$1`, `$2`). Nothing is interpolated
 *      into a query string, ever — not an id, not a sort key, not a date.
 *   2. These are READ-ONLY views. There is no INSERT, UPDATE or DELETE path
 *      here, so the blast radius of a mistake is a wrong number, not lost data.
 *   3. NOT ONE RUPEE IS ADDED UP IN TYPESCRIPT. The view already did the
 *      arithmetic; where a total across rows is needed it is a SQL aggregate in
 *      this file. See .claude/DATA-MODEL.md D-4.
 *
 * ── numeric ARRIVES AS A STRING ─────────────────────────────────────────────
 *
 * `src/lib/db/data-source.ts` installs `types.setTypeParser(1700, v => v)`, so
 * every `numeric` column reaches JavaScript as a string and float error can
 * never creep in. Raw queries bypass the entity transformers, so the row types
 * below say `string` and the mapper in `insights.dto.ts` converts ONCE. Typing
 * them as `number` would make `a + b` silently concatenate — "3557.00" plus
 * "2000.00" is "3557.002000.00", which looks like a number and is not one.
 *
 * `date` columns are strings too (parser 1082), which is the whole business-date
 * rule — see ARCHITECTURE §9.2. `integer` and `boolean` need no help.
 */
export interface StaffOutstandingRow {
  staff_id: string;
  staff_code: string;
  staff_name: string;
  staff_phone: string;
  staff_is_active: boolean;
  /** numeric(12,2) — net dues across delivery orders. */
  order_dues: string;
  open_order_count: number;
  /** `'YYYY-MM-DD'` or null when nothing is open. */
  oldest_order_due_date: string | null;
  /** numeric(12,2) — net dues across coin issues. */
  coin_dues: string;
  open_issue_count: number;
  oldest_issue_due_date: string | null;
  /** numeric(12,2) — `order_dues + coin_dues`, summed by PostgreSQL. */
  total_dues: string;
  days_outstanding: number;
}

/** The KPI strip above the staff list. Every figure is a SQL aggregate. */
export interface StaffOutstandingTotalsRow {
  order_dues: string;
  coin_dues: string;
  total_dues: string;
  staff_with_balance: number;
  open_order_count: number;
  open_issue_count: number;
}

const COLUMNS = `staff_id, staff_code, staff_name, staff_phone, staff_is_active,
                 order_dues, open_order_count, oldest_order_due_date,
                 coin_dues, open_issue_count, oldest_issue_due_date,
                 total_dues, days_outstanding`;

class StaffOutstandingRepository {
  /**
   * Join the caller's transaction when one is supplied — the deactivation
   * guard reads this view inside the same locked transaction that flips
   * `is_active`, so it must see that transaction's snapshot and not a second
   * connection's.
   */
  private async run<T>(
    sql: string,
    params: unknown[],
    em?: EntityManager,
  ): Promise<T[]> {
    if (em) return em.query(sql, params) as Promise<T[]>;
    const ds = await getDataSource();
    return ds.query(sql, params) as Promise<T[]>;
  }

  /** Everyone, biggest debt first. Staff with nothing owing still appear. */
  async findAll(em?: EntityManager): Promise<StaffOutstandingRow[]> {
    return this.run<StaffOutstandingRow>(
      `SELECT ${COLUMNS} FROM v_staff_outstanding
        ORDER BY total_dues DESC, staff_code ASC`,
      [],
      em,
    );
  }

  async findByStaffId(
    staffId: string,
    em?: EntityManager,
  ): Promise<StaffOutstandingRow | null> {
    const rows = await this.run<StaffOutstandingRow>(
      `SELECT ${COLUMNS} FROM v_staff_outstanding WHERE staff_id = $1`,
      [staffId],
      em,
    );
    return rows[0] ?? null;
  }

  /**
   * One round trip for a whole page of staff.
   *
   * `= ANY($1::uuid[])` rather than a generated `IN (…)` list: one bound
   * parameter regardless of page size, so the plan is cached and there is no
   * string building anywhere near the query.
   */
  async findByStaffIds(
    staffIds: string[],
    em?: EntityManager,
  ): Promise<StaffOutstandingRow[]> {
    if (staffIds.length === 0) return [];
    return this.run<StaffOutstandingRow>(
      `SELECT ${COLUMNS} FROM v_staff_outstanding WHERE staff_id = ANY($1::uuid[])`,
      [staffIds],
      em,
    );
  }

  /**
   * The `?hasBalance=1` predicate, as a set of ids.
   *
   * `total_dues > 0` — money the staff member owes US. A NEGATIVE total means
   * the company owes HIM a refund (DATA-MODEL §10.3/§10.4); that person has an
   * open item but not an outstanding balance, and putting him under a filter
   * labelled "has outstanding balance" would read as a demand for money he does
   * not owe.
   */
  async findStaffIdsWithDues(em?: EntityManager): Promise<string[]> {
    const rows = await this.run<{ staff_id: string }>(
      `SELECT staff_id FROM v_staff_outstanding WHERE total_dues > 0`,
      [],
      em,
    );
    return rows.map((r) => r.staff_id);
  }

  /** Roster-wide totals — summed in SQL, never in TypeScript. */
  async totals(em?: EntityManager): Promise<StaffOutstandingTotalsRow> {
    const rows = await this.run<StaffOutstandingTotalsRow>(
      `SELECT COALESCE(SUM(order_dues), 0)::numeric(12,2)      AS order_dues,
              COALESCE(SUM(coin_dues), 0)::numeric(12,2)       AS coin_dues,
              COALESCE(SUM(total_dues), 0)::numeric(12,2)      AS total_dues,
              COUNT(*) FILTER (WHERE total_dues > 0)::integer  AS staff_with_balance,
              COALESCE(SUM(open_order_count), 0)::integer      AS open_order_count,
              COALESCE(SUM(open_issue_count), 0)::integer      AS open_issue_count
         FROM v_staff_outstanding`,
      [],
      em,
    );

    // An aggregate with no GROUP BY returns one row even over an empty table,
    // so this fallback is belt-and-braces rather than a real branch.
    return (
      rows[0] ?? {
        order_dues: "0",
        coin_dues: "0",
        total_dues: "0",
        staff_with_balance: 0,
        open_order_count: 0,
        open_issue_count: 0,
      }
    );
  }
}

export const staffOutstandingRepository = new StaffOutstandingRepository();
