import "server-only";
import type { EntityManager, Repository } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";
import { AppSetting } from "@/lib/db/entities";
import type { JsonValue } from "@/lib/db/entities";

/**
 * Every query that touches the `app_settings` table lives here and nowhere
 * else.
 *
 * DELIBERATELY NOT extending BaseRepository: DATA-MODEL §5.22 makes `key` the
 * primary key, while `BaseRepository<T>` is constrained to `{ id: string }` and
 * keys every method on a uuid. A setting is addressed by its key everywhere in
 * the codebase, so findById would never be called even if it compiled.
 *
 * The contract that matters is kept: every method takes an optional
 * EntityManager so a settings change commits atomically with the work that
 * triggered it, and nothing here opens a transaction.
 * See .claude/ARCHITECTURE.md §4
 */
class AppSettingRepository {
  private async repo(em?: EntityManager): Promise<Repository<AppSetting>> {
    if (em) return em.getRepository(AppSetting);
    const ds = await getDataSource();
    return ds.getRepository(AppSetting);
  }

  /**
   * Read one setting's value, or null if it has never been written.
   *
   * The generic is a convenience for the caller — jsonb is schemaless, so the
   * SERVICE is responsible for validating the shape before trusting it. A
   * setting the owner edited by hand in the Neon console is exactly the case
   * this must not blow up on.
   */
  async get<T extends JsonValue = JsonValue>(
    key: string,
    em?: EntityManager,
  ): Promise<T | null> {
    const repo = await this.repo(em);
    const row = await repo.findOne({ where: { key } });
    return row ? (row.value as T) : null;
  }

  /**
   * Write one setting.
   *
   * An upsert rather than a read-then-write: two admins saving the settings
   * screen at once would otherwise race, and one of them would insert a
   * duplicate key. `updatedAt` and `updatedById` are passed explicitly because
   * ON CONFLICT DO UPDATE only refreshes the columns present in the insert.
   */
  async set(
    key: string,
    value: JsonValue,
    updatedById: string | null = null,
    em?: EntityManager,
  ): Promise<void> {
    const repo = await this.repo(em);
    await repo.upsert(
      { key, value, updatedById, updatedAt: new Date() },
      { conflictPaths: ["key"] },
    );
  }

  /**
   * One round trip for several keys, so a page that needs three settings does
   * not make three queries. Missing keys are simply absent from the result.
   */
  async getMany(
    keys: string[],
    em?: EntityManager,
  ): Promise<Record<string, JsonValue>> {
    if (keys.length === 0) return {};
    const repo = await this.repo(em);
    const rows = await repo
      // Alias is "aps", not "as" — the latter is a SQL keyword.
      .createQueryBuilder("aps")
      .where("aps.key IN (:...keys)", { keys })
      .getMany();

    const out: Record<string, JsonValue> = {};
    for (const row of rows) out[row.key] = row.value;
    return out;
  }

  /** The settings screen. A handful of rows — never worth paginating. */
  async findAll(em?: EntityManager): Promise<AppSetting[]> {
    const repo = await this.repo(em);
    return repo.find({ order: { key: "ASC" } });
  }

  async exists(key: string, em?: EntityManager): Promise<boolean> {
    const repo = await this.repo(em);
    return repo.exists({ where: { key } });
  }
}

export const appSettingRepository = new AppSettingRepository();
