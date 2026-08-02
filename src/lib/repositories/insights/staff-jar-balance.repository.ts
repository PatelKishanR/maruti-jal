import "server-only";
import type { EntityManager } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";

/**
 * `v_staff_jar_balance` — one row per staff member: jars issued, jars back, and
 * the difference still sitting on his van.
 *
 * RAW SQL IS ALLOWED HERE. A view has no entity for TypeORM to hydrate, so
 * `src/lib/repositories/insights/*` is the one place in this codebase that
 * writes SQL by hand. Every value is a bound parameter, every relation is
 * read-only, and every cross-row total is a SQL aggregate — the view already
 * did the arithmetic and TypeScript must not redo it. The full rationale is in
 * `staff-outstanding.repository.ts`.
 *
 * `numeric` reaches JavaScript as a STRING (parser 1700 in data-source.ts); the
 * mapper in `insights.dto.ts` converts once. This view happens to be all
 * integers and dates, so nothing here needs converting — but the row type still
 * states the wire shape rather than the shape we wish it had.
 */
export interface StaffJarBalanceRow {
  staff_id: string;
  staff_code: string;
  staff_name: string;
  staff_phone: string;
  staff_is_active: boolean;
  /** Every jar ever issued to this person — the "of 402" in "18 of 402". */
  jars_issued: number;
  jars_returned_empty: number;
  jars_returned_filled: number;
  jars_lost: number;
  /** Issued less every kind of return. What he is still holding. */
  jars_out: number;
  /** Orders with jars still pending — the count behind the blocked dialog. */
  open_order_count: number;
  /** `'YYYY-MM-DD'` or null. */
  oldest_pending_date: string | null;
  oldest_pending_days: number;
}

export interface StaffJarBalanceTotalsRow {
  jars_out: number;
  jars_issued: number;
  staff_with_jars: number;
  open_order_count: number;
}

const COLUMNS = `staff_id, staff_code, staff_name, staff_phone, staff_is_active,
                 jars_issued, jars_returned_empty, jars_returned_filled, jars_lost,
                 jars_out, open_order_count, oldest_pending_date, oldest_pending_days`;

class StaffJarBalanceRepository {
  private async run<T>(
    sql: string,
    params: unknown[],
    em?: EntityManager,
  ): Promise<T[]> {
    if (em) return em.query(sql, params) as Promise<T[]>;
    const ds = await getDataSource();
    return ds.query(sql, params) as Promise<T[]>;
  }

  async findAll(em?: EntityManager): Promise<StaffJarBalanceRow[]> {
    return this.run<StaffJarBalanceRow>(
      `SELECT ${COLUMNS} FROM v_staff_jar_balance
        ORDER BY jars_out DESC, staff_code ASC`,
      [],
      em,
    );
  }

  async findByStaffId(
    staffId: string,
    em?: EntityManager,
  ): Promise<StaffJarBalanceRow | null> {
    const rows = await this.run<StaffJarBalanceRow>(
      `SELECT ${COLUMNS} FROM v_staff_jar_balance WHERE staff_id = $1`,
      [staffId],
      em,
    );
    return rows[0] ?? null;
  }

  async findByStaffIds(
    staffIds: string[],
    em?: EntityManager,
  ): Promise<StaffJarBalanceRow[]> {
    if (staffIds.length === 0) return [];
    return this.run<StaffJarBalanceRow>(
      `SELECT ${COLUMNS} FROM v_staff_jar_balance WHERE staff_id = ANY($1::uuid[])`,
      [staffIds],
      em,
    );
  }

  /** The `?hasJars=1` predicate, as a set of ids. */
  async findStaffIdsWithJarsOut(em?: EntityManager): Promise<string[]> {
    const rows = await this.run<{ staff_id: string }>(
      `SELECT staff_id FROM v_staff_jar_balance WHERE jars_out > 0`,
      [],
      em,
    );
    return rows.map((r) => r.staff_id);
  }

  async totals(em?: EntityManager): Promise<StaffJarBalanceTotalsRow> {
    const rows = await this.run<StaffJarBalanceTotalsRow>(
      `SELECT COALESCE(SUM(jars_out), 0)::integer            AS jars_out,
              COALESCE(SUM(jars_issued), 0)::integer         AS jars_issued,
              COUNT(*) FILTER (WHERE jars_out > 0)::integer  AS staff_with_jars,
              COALESCE(SUM(open_order_count), 0)::integer    AS open_order_count
         FROM v_staff_jar_balance`,
      [],
      em,
    );

    return (
      rows[0] ?? {
        jars_out: 0,
        jars_issued: 0,
        staff_with_jars: 0,
        open_order_count: 0,
      }
    );
  }
}

export const staffJarBalanceRepository = new StaffJarBalanceRepository();
