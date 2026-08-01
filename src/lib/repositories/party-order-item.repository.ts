import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { PartyOrderItem } from "@/lib/db/entities";

/**
 * Every query that touches the `party_order_items` table lives here.
 */
class PartyOrderItemRepository extends BaseRepository<PartyOrderItem> {
  protected readonly target: EntityTarget<PartyOrderItem> = PartyOrderItem;
  protected readonly alias = "i";

  /** One day's lines, in the order the admin entered them. */
  async findByDayId(
    partyOrderDayId: string,
    em?: EntityManager,
  ): Promise<PartyOrderItem[]> {
    const qb = await this.qb(em);
    return qb
      .where("i.partyOrderDayId = :partyOrderDayId", { partyOrderDayId })
      .orderBy("i.lineNo", "ASC")
      .getMany();
  }

  /**
   * Clears a day's lines so they can be re-inserted.
   *
   * A HARD delete, and the exception proves the rule: line items extend
   * `LineItemBase` and have no `deleted_at`, because they are children of the
   * party-order aggregate rather than independently owned rows — removing a
   * line is recorded as a revision on the booking, not as a tombstone.
   * The snapshot columns are immutable, so "change what is on this day" is
   * always delete-then-insert. See .claude/DATA-MODEL.md §4, §6
   *
   * One statement rather than one per line: `(day, line_no)` is a plain unique
   * index, so every old line must be gone before the new line 1 arrives.
   */
  async deleteByDayId(
    partyOrderDayId: string,
    em?: EntityManager,
  ): Promise<void> {
    const repo = await this.repo(em);
    await repo.delete({ partyOrderDayId });
  }
}

export const partyOrderItemRepository = new PartyOrderItemRepository();
