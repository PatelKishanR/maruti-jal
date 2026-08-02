import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `DEFAULT 1` on every optimistic-lock column.
 *
 * All three are `NOT NULL` with no default, so only TypeORM — which supplies 1
 * itself — could ever insert a row. Any path that bypasses the ORM fails with
 * `23502 null value in column "version"`: a CSV import, a restore, a hand-
 * written INSERT in the console, or a future service that builds its row with
 * raw SQL.
 *
 * Found while proving the Delivery Orders create path with raw SQL, which hit
 * exactly that error.
 *
 * The default only supplies the FIRST value; TypeORM still owns the increment,
 * so optimistic locking is unaffected.
 */
export class VersionDefaults1785600000000 implements MigrationInterface {
  name = "VersionDefaults1785600000000";

  private static readonly TABLES = [
    "delivery_orders",
    "coin_issues",
    "party_orders",
  ];

  public async up(q: QueryRunner): Promise<void> {
    for (const table of VersionDefaults1785600000000.TABLES) {
      await q.query(`ALTER TABLE "${table}" ALTER COLUMN "version" SET DEFAULT 1`);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of VersionDefaults1785600000000.TABLES) {
      await q.query(`ALTER TABLE "${table}" ALTER COLUMN "version" DROP DEFAULT`);
    }
  }
}
