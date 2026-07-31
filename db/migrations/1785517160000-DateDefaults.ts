import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Defaults for NOT NULL business dates.
 *
 * Every one of these was NOT NULL with no default, so an insert that omitted
 * it failed rather than landing on today — caught when a walk-in sale, which
 * the design deliberately reduces to "name + amount + Enter", could not be
 * inserted without also supplying `sold_at`.
 *
 * DATA-MODEL specifies `CURRENT_DATE` on these columns (§5.5, §5.10, §5.18 and
 * others); the generator dropped the defaults because the entities express
 * them as application-side values.
 *
 * `party_order_days.service_date` is deliberately EXCLUDED — a scheduled
 * delivery day must always be chosen explicitly. Defaulting it to today would
 * quietly create a delivery nobody asked for.
 */
export class DateDefaults1785517160000 implements MigrationInterface {
  name = "DateDefaults1785517160000";

  private static readonly DATE_COLUMNS: [string, string][] = [
    ["coin_adjustments", "adjustment_date"],
    ["coin_issue_return_events", "return_date"],
    ["coin_issues", "issue_date"],
    ["coin_ledger_entries", "entry_date"],
    ["direct_sales", "sale_date"],
    ["expenses", "expense_date"],
    ["order_item_return_events", "return_date"],
    ["payments", "paid_on"],
  ];

  private static readonly TIMESTAMP_COLUMNS: [string, string][] = [
    ["coin_ledger_entries", "occurred_at"],
    // Walk-ins cluster by hour, which is useful for deciding when to staff the
    // counter — so the instant is recorded, not just the calendar date. §5.18
    ["direct_sales", "sold_at"],
  ];

  public async up(q: QueryRunner): Promise<void> {
    for (const [table, column] of DateDefaults1785517160000.DATE_COLUMNS) {
      await q.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT CURRENT_DATE`,
      );
    }
    for (const [table, column] of DateDefaults1785517160000.TIMESTAMP_COLUMNS) {
      await q.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT now()`,
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const [table, column] of [
      ...DateDefaults1785517160000.DATE_COLUMNS,
      ...DateDefaults1785517160000.TIMESTAMP_COLUMNS,
    ]) {
      await q.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`,
      );
    }
  }
}
