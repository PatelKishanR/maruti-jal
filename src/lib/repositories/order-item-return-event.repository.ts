import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { OrderItemReturnEvent } from "@/lib/db/entities/order-item-return-event.entity";

export interface ReturnEventTotals {
  emptyQty: number;
  filledQty: number;
  lostQty: number;
}

/**
 * Every query that touches `order_item_return_events` lives here and nowhere
 * else.
 *
 * THE TABLE IS APPEND-ONLY. There is no update method and no delete method on
 * this class, by design. A mis-keyed 40 that should have been 4 is corrected by
 * INSERTING a reversal row; both stay visible, and the line's counters are
 * recomputed from the sum over events by the trigger.
 *
 * The class-level guards below are a courtesy, not the boundary: the real
 * enforcement is a BEFORE UPDATE OR DELETE trigger that raises unconditionally,
 * plus UPDATE and DELETE revoked from the application role. That is the
 * difference between an accounting system and a spreadsheet.
 * See .claude/DATA-MODEL.md §9
 *
 * Rows are created with the inherited `create()`, inside the service
 * transaction that also locks the parent line.
 */
class OrderItemReturnEventRepository extends BaseRepository<OrderItemReturnEvent> {
  protected readonly target: EntityTarget<OrderItemReturnEvent> =
    OrderItemReturnEvent;
  protected readonly alias = "re";

  /**
   * The returns timeline for one line — reversals included, because hiding
   * them would defeat the point of an append-only log.
   *
   * Sorted by the day the jars physically came back, then by insertion time, so
   * two events recorded for the same date keep the order they were keyed in.
   */
  async findByOrderItemId(
    orderItemId: string,
    em?: EntityManager,
  ): Promise<OrderItemReturnEvent[]> {
    const qb = await this.qb(em);
    return qb
      .where("re.orderItemId = :orderItemId", { orderItemId })
      .orderBy("re.returnDate", "DESC")
      .addOrderBy("re.createdAt", "DESC")
      .getMany();
  }

  /**
   * The whole order's returns timeline in ONE query.
   *
   * The detail page has one timeline, not one per line, and issuing a query per
   * line to build it is an N+1 on the busiest screen in the module. Sorted
   * identically to `findByOrderItemId`, so a single-line view and the whole-order
   * view agree about what "newest" means.
   */
  async findByOrderItemIds(
    orderItemIds: string[],
    em?: EntityManager,
  ): Promise<OrderItemReturnEvent[]> {
    if (orderItemIds.length === 0) return [];
    const qb = await this.qb(em);
    return qb
      .where("re.orderItemId IN (:...orderItemIds)", { orderItemIds })
      .orderBy("re.returnDate", "DESC")
      .addOrderBy("re.createdAt", "DESC")
      .getMany();
  }

  /**
   * The three counters recomputed from the events themselves.
   *
   * `order_items` caches exactly these figures, maintained by a trigger. This
   * method is how a drift check, a reconciliation screen or a test proves the
   * cache still matches its source. Summing in SQL rather than in TypeScript is
   * not optional. See .claude/DATA-MODEL.md §8.3
   */
  async sumByOrderItem(
    orderItemId: string,
    em?: EntityManager,
  ): Promise<ReturnEventTotals> {
    const qb = await this.qb(em);
    const row = await qb
      .select("COALESCE(SUM(re.emptyQty), 0)", "emptyQty")
      .addSelect("COALESCE(SUM(re.filledQty), 0)", "filledQty")
      .addSelect("COALESCE(SUM(re.lostQty), 0)", "lostQty")
      .where("re.orderItemId = :orderItemId", { orderItemId })
      .getRawOne<Record<keyof ReturnEventTotals, string | number>>();

    // SUM over integer returns bigint, which the driver hands back as a number
    // via the global parser; Number() keeps this honest if that ever changes.
    return {
      emptyQty: Number(row?.emptyQty ?? 0),
      filledQty: Number(row?.filledQty ?? 0),
      lostQty: Number(row?.lostQty ?? 0),
    };
  }

  /* ── Append-only guards ─────────────────────────────────────────────────
     These exist so a mistake fails here, with a readable message, rather than
     as a raw PostgreSQL exception from the trigger three layers down. */

  override async updateById(): Promise<never> {
    throw new Error(
      "order_item_return_events is append-only: insert a reversal event instead of updating one.",
    );
  }

  override async softDeleteById(): Promise<never> {
    throw new Error(
      "order_item_return_events is append-only: insert a reversal event instead of deleting one.",
    );
  }

  override async restoreById(): Promise<never> {
    throw new Error(
      "order_item_return_events is append-only: nothing is ever deleted, so nothing is ever restored.",
    );
  }
}

export const orderItemReturnEventRepository =
  new OrderItemReturnEventRepository();
