import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { CoinIssueItem } from "@/lib/db/entities";

/**
 * Every query that touches `coin_issue_items` lives here and nowhere else.
 *
 * `findByIdForUpdate(id, em)` is inherited from BaseRepository. Recording a
 * return locks the LINE first, then its issue header — child → parent, always
 * in that order. See .claude/DATA-MODEL.md §7 and .claude/ARCHITECTURE.md §4.3
 */
class CoinIssueItemRepository extends BaseRepository<CoinIssueItem> {
  protected readonly target: EntityTarget<CoinIssueItem> = CoinIssueItem;
  protected readonly alias = "cii";

  /**
   * The lines of one handover, with each line's live coin type for the badge.
   *
   * There is deliberately no `deleted_at` predicate: `CoinIssueItem` extends
   * `LineItemBase`, which has NO soft-delete column — a line has no life
   * without its header and cascades with it. See DATA-MODEL §4.
   */
  async findByIssueId(
    coinIssueId: string,
    em?: EntityManager,
  ): Promise<CoinIssueItem[]> {
    const qb = await this.qb(em);
    return qb
      .leftJoinAndSelect("cii.coinType", "ct")
      .where("cii.coinIssueId = :coinIssueId", { coinIssueId })
      .orderBy("cii.createdAt", "ASC")
      .getMany();
  }

  /**
   * The lines of a WHOLE PAGE of the register, in one query.
   *
   * The expandable row shows a per-coin-type breakdown, and fetching it per row
   * would be 25 round trips for a table that has to feel instant. One `IN`
   * against the indexed foreign key answers all of them.
   */
  async findByIssueIds(
    coinIssueIds: string[],
    em?: EntityManager,
  ): Promise<CoinIssueItem[]> {
    if (coinIssueIds.length === 0) return [];
    const qb = await this.qb(em);
    return qb
      .leftJoinAndSelect("cii.coinType", "ct")
      .where("cii.coinIssueId IN (:...coinIssueIds)", { coinIssueIds })
      .orderBy("cii.createdAt", "ASC")
      .getMany();
  }

  /**
   * Every line of one handover, ROW-LOCKED IN ASCENDING ID ORDER.
   *
   * The order is not cosmetic. Two admins recording returns against the same
   * issue take the same locks, and taking them in different orders deadlocks
   * intermittently — the kind of failure that never reproduces on demand.
   * PostgreSQL locks rows in the order the query yields them, so the ORDER BY
   * is the fix. See .claude/ARCHITECTURE.md §4.3
   */
  async findByIssueIdForUpdate(
    coinIssueId: string,
    em: EntityManager,
  ): Promise<CoinIssueItem[]> {
    return em
      .getRepository(CoinIssueItem)
      .createQueryBuilder("cii")
      .setLock("pessimistic_write")
      .where("cii.coinIssueId = :coinIssueId", { coinIssueId })
      .orderBy("cii.id", "ASC")
      .getMany();
  }
}

export const coinIssueItemRepository = new CoinIssueItemRepository();
