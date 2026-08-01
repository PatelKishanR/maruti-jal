import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { CoinIssueReturnEvent } from "@/lib/db/entities";

/**
 * Every query that touches `coin_issue_return_events` lives here and nowhere
 * else.
 *
 * APPEND-ONLY. There is no update path and no delete path — a mistyped return
 * is corrected by inserting a REVERSAL, so both the error and the correction
 * stay visible. The database enforces this with a BEFORE UPDATE OR DELETE
 * trigger and revoked grants; the overrides below simply move the failure from
 * runtime to compile time. See .claude/DATA-MODEL.md §9
 */
class CoinIssueReturnEventRepository extends BaseRepository<CoinIssueReturnEvent> {
  protected readonly target: EntityTarget<CoinIssueReturnEvent> =
    CoinIssueReturnEvent;
  protected readonly alias = "cire";

  /** The return history of one issue line, newest first. */
  async findByIssueItemId(
    coinIssueItemId: string,
    em?: EntityManager,
  ): Promise<CoinIssueReturnEvent[]> {
    const qb = await this.qb(em);
    return qb
      .where("cire.coinIssueItemId = :coinIssueItemId", { coinIssueItemId })
      .orderBy("cire.returnDate", "DESC")
      .addOrderBy("cire.createdAt", "DESC")
      .getMany();
  }

  /**
   * NET coins and value returned against one line — reversals carry negative
   * quantities, so a plain SUM is already the correct answer.
   *
   * Summed in SQL, never in TypeScript: a `reduce((a, b) => a + b)` over
   * monetary values reintroduces floating-point error and is a code-review
   * failure. `SUM` over a numeric returns a numeric, which the driver hands
   * back as a string, so the conversion is explicit and happens exactly here.
   * See .claude/ARCHITECTURE.md §9.1
   */
  async sumByIssueItem(
    coinIssueItemId: string,
    em?: EntityManager,
  ): Promise<{ coins: number; value: number }> {
    const qb = await this.qb(em);
    const raw = await qb
      .select("COALESCE(SUM(cire.coins_returned), 0)", "coins")
      .addSelect("COALESCE(SUM(cire.value_credited), 0)", "value")
      .where("cire.coinIssueItemId = :coinIssueItemId", { coinIssueItemId })
      .getRawOne<{ coins: string; value: string }>();

    return { coins: Number(raw?.coins ?? 0), value: Number(raw?.value ?? 0) };
  }

  /** The return history of a whole issue — every event on any of its lines. */
  async findByItemIds(
    coinIssueItemIds: string[],
    em?: EntityManager,
  ): Promise<CoinIssueReturnEvent[]> {
    if (coinIssueItemIds.length === 0) return [];
    const qb = await this.qb(em);
    return qb
      .where("cire.coinIssueItemId IN (:...coinIssueItemIds)", {
        coinIssueItemIds,
      })
      .orderBy("cire.returnDate", "DESC")
      .addOrderBy("cire.createdAt", "DESC")
      .getMany();
  }

  /**
   * NET coins and value per line, for MANY lines at once.
   *
   * The register's expanded panel needs a returned VALUE per coin type, and
   * `coin_issue_items.coins_returned` only caches the COUNT. Recomputing the
   * value as `coins × rate` would disagree with the header the moment a rate
   * divides unevenly, because each event stored its own rounded credit.
   * See MODULES/04-coins.md §8.2
   *
   * Grouped and summed in SQL, converted once here. Reversals carry negative
   * quantities, so a plain SUM is already the correct answer.
   */
  async sumByItemIds(
    coinIssueItemIds: string[],
    em?: EntityManager,
  ): Promise<Map<string, { coins: number; value: number }>> {
    const out = new Map<string, { coins: number; value: number }>();
    if (coinIssueItemIds.length === 0) return out;

    const qb = await this.qb(em);
    const rows = await qb
      .select("cire.coin_issue_item_id", "item_id")
      .addSelect("COALESCE(SUM(cire.coins_returned), 0)", "coins")
      .addSelect("COALESCE(SUM(cire.value_credited), 0)", "value")
      .where("cire.coinIssueItemId IN (:...coinIssueItemIds)", {
        coinIssueItemIds,
      })
      .groupBy("cire.coin_issue_item_id")
      .getRawMany<{ item_id: string; coins: string; value: string }>();

    for (const row of rows) {
      out.set(row.item_id, {
        coins: Number(row.coins),
        value: Number(row.value),
      });
    }
    return out;
  }

  /* ── Append-only guards ───────────────────────────────────────────────────
   *
   * Declared with NO parameters on purpose: a caller attempting an update or a
   * delete then fails to COMPILE instead of discovering the trigger in
   * production. Inserts still go through the inherited `create`.
   */

  override async updateById(): Promise<void> {
    throw new Error(
      "coin_issue_return_events is append-only — insert a reversal event instead.",
    );
  }

  override async softDeleteById(): Promise<void> {
    throw new Error(
      "coin_issue_return_events is append-only — it has no deleted_at column.",
    );
  }

  override async restoreById(): Promise<void> {
    throw new Error(
      "coin_issue_return_events is append-only — nothing is ever deleted.",
    );
  }
}

export const coinIssueReturnEventRepository =
  new CoinIssueReturnEventRepository();
