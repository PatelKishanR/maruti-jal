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

  /** The lines of one handover, with each line's live coin type for the badge. */
  async findByIssueId(
    coinIssueId: string,
    em?: EntityManager,
  ): Promise<CoinIssueItem[]> {
    const qb = await this.qb(em);
    return qb
      .leftJoinAndSelect("cii.coinType", "ct")
      .where("cii.coinIssueId = :coinIssueId", { coinIssueId })
      .andWhere("cii.deletedAt IS NULL")
      .orderBy("cii.createdAt", "ASC")
      .getMany();
  }
}

export const coinIssueItemRepository = new CoinIssueItemRepository();
