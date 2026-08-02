import "server-only";
import { In } from "typeorm";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { OrderItem } from "@/lib/db/entities/order-item.entity";

export interface OpenLineFilters {
  /** Ignore lines belonging to this order — the caller is already showing it. */
  excludeOrderId?: string;
  /** Cap the picker list; the modal shows newest-first and paginates by hand. */
  limit?: number;
}

/**
 * Every query that touches the `order_items` table lives here and nowhere else.
 *
 * These methods reach the parent `delivery_orders` row only to filter and sort
 * by it — a line has no meaning apart from its order. Anything needing a THIRD
 * table is two repository calls from a service.
 * See .claude/ARCHITECTURE.md §4.1
 */
class OrderItemRepository extends BaseRepository<OrderItem> {
  protected readonly target: EntityTarget<OrderItem> = OrderItem;
  protected readonly alias = "oi";

  /** Line order is `line_no`, not insertion order — lines are edited in place. */
  async findByOrderId(
    orderId: string,
    em?: EntityManager,
  ): Promise<OrderItem[]> {
    const qb = await this.qb(em);
    return qb
      .where("oi.orderId = :orderId", { orderId })
      .orderBy("oi.lineNo", "ASC")
      .getMany();
  }

  /**
   * Every still-open line for one staff member, across ALL of his orders,
   * newest first.
   *
   * This is what makes cross-order returns work. A customer routinely hands
   * back last week's jar when this week's staff member calls, so the return
   * dialog must offer the line the jar actually went out on — otherwise old
   * orders never close and the jars-out figure inflates forever.
   * See .claude/DATA-MODEL.md §10.9 and MODULES/03-delivery-orders.md §6.2
   *
   * Non-returnable products are excluded outright: disposable bottles are never
   * counted, and `is_returnable` is a SNAPSHOT, so reclassifying the product
   * today cannot retroactively change what an old line owes.
   */
  async findOpenLinesByStaff(
    staffId: string,
    filters: OpenLineFilters = {},
    em?: EntityManager,
  ): Promise<OrderItem[]> {
    const qb = await this.qb(em);
    qb.innerJoinAndSelect("oi.order", "o")
      .where("o.staffId = :staffId", { staffId })
      .andWhere("o.deletedAt IS NULL")
      .andWhere("o.status <> :cancelled", { cancelled: "CANCELLED" })
      .andWhere("oi.isReturnable = true")
      .andWhere("oi.pendingQty > 0");

    if (filters.excludeOrderId) {
      qb.andWhere("oi.orderId <> :excludeOrderId", {
        excludeOrderId: filters.excludeOrderId,
      });
    }
    if (filters.limit) {
      qb.take(filters.limit);
    }

    return qb
      .orderBy("o.orderDate", "DESC")
      .addOrderBy("o.orderNo", "DESC")
      .addOrderBy("oi.lineNo", "ASC")
      .getMany();
  }

  /**
   * Row lock for read-modify-write on the return counters.
   *
   * A line is a CHILD in our lock hierarchy, so it is locked FIRST and the
   * `delivery_orders` header second — child → parent → grandparent, everywhere,
   * without exception. See .claude/ARCHITECTURE.md §4.3
   */
  override async findByIdForUpdate(
    id: string,
    em: EntityManager,
  ): Promise<OrderItem | null> {
    return super.findByIdForUpdate(id, em);
  }

  /**
   * Lock several lines at once — one submission of the return modal touches
   * every row the clerk typed into.
   *
   * Locked in ASCENDING ID ORDER. Two clerks submitting overlapping return
   * sets in different orders is the textbook deadlock; a fixed acquisition
   * order removes it. See .claude/ARCHITECTURE.md §4.3
   */
  async findManyByIdsForUpdate(
    ids: string[],
    em: EntityManager,
  ): Promise<OrderItem[]> {
    if (ids.length === 0) return [];
    return em
      .getRepository(OrderItem)
      .createQueryBuilder("oi")
      .setLock("pessimistic_write")
      .where({ id: In(ids) })
      .orderBy("oi.id", "ASC")
      .getMany();
  }

  /**
   * The list's `3 items / 62 units` chip AND the header's half of the D5
   * explanation, for a whole page of orders in ONE grouped query.
   *
   * `grossAmount` is what the order was raised at; `filledReturnCredit` is what
   * came off it when unsold jars came home. `delivery_orders.subtotal_amount`
   * — trigger-maintained — is their difference, and that identity is the whole
   * point: the screen can say "₹1,400 issued − ₹70 unsold returned = ₹1,330"
   * without ever adding rupees in TypeScript.
   * See .claude/MODULES/03-delivery-orders.md §9 · ARCHITECTURE.md §9.1
   *
   * `unitCount` counts EVERY line; `delivery_orders.qty_issued` counts only the
   * returnable ones. Both are wanted, and on an order carrying disposable
   * bottles they legitimately differ.
   */
  async aggregateByOrderIds(
    orderIds: string[],
    em?: EntityManager,
  ): Promise<
    Map<
      string,
      {
        lineCount: number;
        unitCount: number;
        grossAmount: number;
        filledReturnCredit: number;
      }
    >
  > {
    const out = new Map<
      string,
      {
        lineCount: number;
        unitCount: number;
        grossAmount: number;
        filledReturnCredit: number;
      }
    >();
    if (orderIds.length === 0) return out;

    const qb = await this.qb(em);
    const rows = await qb
      .select("oi.order_id", "order_id")
      .addSelect("COUNT(*)", "line_count")
      .addSelect("COALESCE(SUM(oi.quantity), 0)", "unit_count")
      // round() per line, then SUM — the same order of operations the generated
      // `line_total` column uses, so the two can never disagree by a paisa.
      .addSelect(
        "COALESCE(SUM(round(oi.quantity::numeric * oi.unit_price, 2)), 0)",
        "gross_amount",
      )
      .addSelect(
        "COALESCE(SUM(round(oi.returned_filled_qty::numeric * oi.unit_price, 2)), 0)",
        "filled_credit",
      )
      .where("oi.orderId IN (:...orderIds)", { orderIds })
      .groupBy("oi.order_id")
      .getRawMany<Record<string, string | number>>();

    for (const row of rows) {
      // SUM over numeric returns a string from the driver; this is the boundary
      // where converting it once is legitimate.
      out.set(String(row.order_id), {
        lineCount: Number(row.line_count ?? 0),
        unitCount: Number(row.unit_count ?? 0),
        grossAmount: Number(row.gross_amount ?? 0),
        filledReturnCredit: Number(row.filled_credit ?? 0),
      });
    }

    return out;
  }

  /**
   * A HARD delete, and the exception proves the rule: line items extend
   * `LineItemBase` and have no `deleted_at`, because they are children of an
   * aggregate rather than independently owned rows. Removing a line from an
   * order is recorded as a `document_revisions` diff on the ORDER, not as a
   * tombstone. See .claude/DATA-MODEL.md §4, §9
   *
   * CALLERS MUST CHECK FOR RETURN HISTORY FIRST. `order_item_return_events`
   * is `ON DELETE CASCADE`, so deleting a line that has ever had jars come back
   * against it would silently destroy append-only history — the one thing this
   * schema exists to make impossible. `updateDeliveryOrder` refuses that case
   * with a 409 naming the line.
   */
  async deleteById(id: string, em?: EntityManager): Promise<void> {
    const repo = await this.repo(em);
    await repo.delete({ id });
  }

  /** Next free line number, so appending a line never collides on the unique key. */
  async nextLineNo(orderId: string, em?: EntityManager): Promise<number> {
    const qb = await this.qb(em);
    const row = await qb
      .select("COALESCE(MAX(oi.lineNo), 0)", "maxLineNo")
      .where("oi.orderId = :orderId", { orderId })
      .getRawOne<{ maxLineNo: string | number }>();
    return Number(row?.maxLineNo ?? 0) + 1;
  }
}

export const orderItemRepository = new OrderItemRepository();
