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
}

export const partyOrderItemRepository = new PartyOrderItemRepository();
