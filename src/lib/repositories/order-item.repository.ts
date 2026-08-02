import "server-only";
import { In } from "typeorm";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { OrderItem } from "@/lib/db/entities/order-item.entity";

/**
 * One staff × product cell of the jar reconciliation, aggregated by PostgreSQL.
 * `productTitle` is the line SNAPSHOT, used only when the product row itself
 * has gone; the report prefers the live title so a renamed product still reads
 * correctly.
 */
export interface JarMovementAggregateRow {
  staffId: string;
  productId: string;
  productTitle: string;
  issued: number;
  empty: number;
  filled: number;
  lost: number;
  stillOut: number;
  oldestDays: number;
  /** `(empty + filled) / issued`, to one decimal. Null when nothing issued. */
  returnRatePercent: number | null;
}

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

  /* ── Reports ───────────────────────────────────────────────────────────
   * Jar reconciliation (§11) and Section C of the staff statement (§6.3).
   */

  /**
   * Jar movement per staff member per product — the whole jar reconciliation
   * table, in one grouped aggregate.
   *
   * GROUPING BY THE PARENT'S `staff_id` is the one thing here worth flagging.
   * This repository's contract is "reach `delivery_orders` only to filter and
   * sort by it"; grouping is a third verb. It is allowed because there is no
   * alternative that respects the other rules: `order_items` carries no staff
   * column, a view for it does not exist, and the alternative — pulling every
   * line into the service and folding them there — would be re-deriving the
   * plant's jar position in TypeScript, one row at a time.
   *
   * NON-RETURNABLE LINES ARE EXCLUDED. A disposable bottle is never "out", and
   * `is_returnable` is a SNAPSHOT, so reclassifying a product today cannot
   * retroactively put last month's bottles into the jar count.
   *
   * `oldest_days` ages the ORDER, not the individual jar — the same basis
   * `v_staff_jar_balance.oldest_pending_days` uses, so the two agree. Today is
   * the IST business day, matching `todayIST()`.
   *
   * The return rate is a RATIO of counts, not money, and it is still computed
   * in SQL so that the row, the group and the grand total are all divisions of
   * SQL sums rather than averages of averages. §11.3
   */
  async jarMovementByStaffProduct(
    filters: {
      from: string;
      to: string;
      staffId?: string | null;
      productIds?: readonly string[];
    },
    em?: EntityManager,
  ): Promise<JarMovementAggregateRow[]> {
    const qb = await this.qb(em);
    qb.innerJoin("oi.order", "o")
      .where("o.deletedAt IS NULL")
      .andWhere("o.status <> :cancelled", { cancelled: "CANCELLED" })
      .andWhere("oi.isReturnable = true")
      .andWhere("o.orderDate BETWEEN :from AND :to", {
        from: filters.from,
        to: filters.to,
      });

    if (filters.staffId) {
      qb.andWhere("o.staffId = :staffId", { staffId: filters.staffId });
    }
    if (filters.productIds && filters.productIds.length > 0) {
      qb.andWhere("oi.productId IN (:...productIds)", {
        productIds: [...filters.productIds],
      });
    }

    const rows = await qb
      .select("o.staff_id", "staffId")
      .addSelect("oi.product_id", "productId")
      .addSelect("MIN(oi.product_title)", "productTitle")
      .addSelect("COALESCE(SUM(oi.quantity), 0)", "issued")
      .addSelect("COALESCE(SUM(oi.returned_empty_qty), 0)", "empty")
      .addSelect("COALESCE(SUM(oi.returned_filled_qty), 0)", "filled")
      .addSelect("COALESCE(SUM(oi.lost_qty), 0)", "lost")
      .addSelect("COALESCE(SUM(oi.pending_qty), 0)", "stillOut")
      .addSelect(
        "COALESCE(MAX((now() AT TIME ZONE 'Asia/Kolkata')::date - o.order_date) " +
          "FILTER (WHERE oi.pending_qty > 0), 0)",
        "oldestDays",
      )
      .addSelect(
        "CASE WHEN COALESCE(SUM(oi.quantity), 0) > 0 " +
          "THEN round(100.0 * (COALESCE(SUM(oi.returned_empty_qty), 0) " +
          "+ COALESCE(SUM(oi.returned_filled_qty), 0)) " +
          "/ SUM(oi.quantity), 1) END",
        "returnRate",
      )
      .groupBy("o.staff_id")
      .addGroupBy("oi.product_id")
      .orderBy("COALESCE(SUM(oi.pending_qty), 0)", "DESC")
      .getRawMany<{
        staffId: string;
        productId: string;
        productTitle: string;
        issued: string;
        empty: string;
        filled: string;
        lost: string;
        stillOut: string;
        oldestDays: string;
        returnRate: string | null;
      }>();

    return rows.map((row) => ({
      staffId: row.staffId,
      productId: row.productId,
      productTitle: row.productTitle,
      issued: Number(row.issued),
      empty: Number(row.empty),
      filled: Number(row.filled),
      lost: Number(row.lost),
      stillOut: Number(row.stillOut),
      oldestDays: Number(row.oldestDays),
      returnRatePercent: row.returnRate === null ? null : Number(row.returnRate),
    }));
  }

  /**
   * Section C's total: jars still out with one staff member, and how many of
   * them sit behind an order older than a week.
   *
   * NO DATE RANGE. A jar out since June is still out today, and scoping this to
   * the report's range would print a smaller number than the one the owner is
   * about to count at the gate. §6.3 says so explicitly.
   */
  async sumOpenJarsByStaff(
    staffId: string,
    overdueDays: number,
    em?: EntityManager,
  ): Promise<{ qty: number; overdueQty: number; lineCount: number }> {
    const qb = await this.qb(em);
    const row = await qb
      .innerJoin("oi.order", "o")
      .select("COALESCE(SUM(oi.pending_qty), 0)", "qty")
      .addSelect(
        "COALESCE(SUM(oi.pending_qty) FILTER (" +
          "WHERE (now() AT TIME ZONE 'Asia/Kolkata')::date - o.order_date >= :overdueDays" +
          "), 0)",
        "overdueQty",
      )
      .addSelect("COUNT(*)", "lineCount")
      .where("o.staffId = :staffId", { staffId })
      .andWhere("o.deletedAt IS NULL")
      .andWhere("o.status <> :cancelled", { cancelled: "CANCELLED" })
      .andWhere("oi.isReturnable = true")
      .andWhere("oi.pendingQty > 0")
      .setParameters({ staffId, overdueDays, cancelled: "CANCELLED" })
      .getRawOne<{ qty: string; overdueQty: string; lineCount: string }>();

    return {
      qty: Number(row?.qty ?? 0),
      overdueQty: Number(row?.overdueQty ?? 0),
      lineCount: Number(row?.lineCount ?? 0),
    };
  }

  /**
   * Item counts and quantities for a batch of orders — the `3 items · 62 units`
   * cell on Section A, without one query per row.
   */
  async summariseByOrderIds(
    orderIds: readonly string[],
    em?: EntityManager,
  ): Promise<Array<{ orderId: string; itemCount: number; quantity: number }>> {
    if (orderIds.length === 0) return [];
    const qb = await this.qb(em);
    const rows = await qb
      .select("oi.order_id", "orderId")
      .addSelect("COUNT(*)", "itemCount")
      .addSelect("COALESCE(SUM(oi.quantity), 0)", "quantity")
      .where("oi.orderId IN (:...orderIds)", { orderIds: [...orderIds] })
      .groupBy("oi.order_id")
      .getRawMany<{ orderId: string; itemCount: string; quantity: string }>();

    return rows.map((row) => ({
      orderId: row.orderId,
      itemCount: Number(row.itemCount),
      quantity: Number(row.quantity),
    }));
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
