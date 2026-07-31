import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 0/1 — extensions, the user_role enum, and the users table.
 *
 * Hand-written rather than generated, because generated migrations cannot
 * express extensions or partial indexes and get the down-migration wrong.
 * See .claude/DATA-MODEL.md §13
 */
export class InitAuth1785456000000 implements MigrationInterface {
  name = 'InitAuth1785456000000';

  public async up(q: QueryRunner): Promise<void> {
    // gen_random_uuid() for primary keys; citext so email casing can never
    // create a duplicate account. Both supported on Neon.
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
    // Trigram search — not used yet, but every module from Phase 2 needs it
    // and creating it now keeps later migrations to pure table DDL.
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    await q.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'VIEWER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await q.query(`
      CREATE TABLE "users" (
        "id"                  uuid         NOT NULL DEFAULT gen_random_uuid(),
        "created_at"          timestamptz  NOT NULL DEFAULT now(),
        "updated_at"          timestamptz  NOT NULL DEFAULT now(),
        "deleted_at"          timestamptz,
        "created_by_id"       uuid,
        "updated_by_id"       uuid,
        "deleted_by_id"       uuid,
        "name"                text         NOT NULL,
        "email"               citext       NOT NULL,
        "password_hash"       text         NOT NULL,
        "role"                "user_role"  NOT NULL DEFAULT 'ADMIN',
        "locale"              varchar(5)   NOT NULL DEFAULT 'en',
        "theme"               varchar(10)  NOT NULL DEFAULT 'system',
        "is_active"           boolean      NOT NULL DEFAULT true,
        "last_login_at"       timestamptz,
        "password_changed_at" timestamptz,
        "session_version"     integer      NOT NULL DEFAULT 1,
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "chk_users_name"   CHECK (length(btrim("name")) > 0),
        CONSTRAINT "chk_users_locale" CHECK ("locale" IN ('en', 'gu')),
        CONSTRAINT "chk_users_theme"  CHECK ("theme" IN ('light', 'dark', 'system'))
      )
    `);

    // Partial unique: a soft-deleted account frees its email for reuse.
    await q.query(`
      CREATE UNIQUE INDEX "uq_users_email"
        ON "users" ("email") WHERE "deleted_at" IS NULL
    `);

    await q.query(`
      CREATE INDEX "idx_users_active"
        ON "users" ("is_active") WHERE "deleted_at" IS NULL
    `);

    // Self-referencing audit FKs, added after the table exists.
    await q.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "fk_users_created_by"
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_users_updated_by"
        FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_users_deleted_by"
        FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // Keep updated_at honest even for writes that bypass the ORM.
    await q.query(`
      CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW."updated_at" = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await q.query(`
      CREATE TRIGGER "trg_users_updated_at"
        BEFORE UPDATE ON "users"
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER IF EXISTS "trg_users_updated_at" ON "users"`);
    await q.query(`DROP TABLE IF EXISTS "users"`);
    await q.query(`DROP FUNCTION IF EXISTS set_updated_at()`);
    await q.query(`DROP TYPE IF EXISTS "user_role"`);
    // Extensions are intentionally NOT dropped — other schemas may use them,
    // and dropping pgcrypto would break any table defaulting to gen_random_uuid().
  }
}
