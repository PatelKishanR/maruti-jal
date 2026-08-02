import "server-only";
import type { EntityManager, EntityTarget, SelectQueryBuilder } from "typeorm";
import { BaseRepository } from "./base.repository";
import { DeliveryOrder } from "@/lib/db/entities/delivery-order.entity";
import type {
  OrderStatus,
  PaymentStatus,
  ReturnStatus,
} from "@/lib/db/entities/enums";
import {
  DELIVERY_ORDER_SORT_COLUMNS,
  type DeliveryOrderSortKey,
} from "@/lib/table/configs/delivery-order";

/**
 * The sort allowlist is imported, never re-declared — one map, shared by the
 * table config and this ORDER BY. The config is client-safe (zod and types
 * only), so this import couples nothing.
 * See .claude/MODULE-RECIPE.md §1 and .claude/ARCHITECTURE.md §6.2
 */
export type { DeliveryOrderSortKey };

/** Countable status dimensions, again as an allowlist rather than free text. */
const STATUS_COUNT_COLUMNS = {
  status: "o.status",
  paymentStatus: "o.paymentStatus",
  returnStatus: "o.returnStatus",
} as const;

export type DeliveryOrderStatusField = keyof typeof STATUS_COUNT_COLUMNS;

export interface DeliveryOrderFilters {
  /** Matches order code, staff name or staff phone. */
  search?: string;
  staffId?: string;
  /** Inclusive, 'YYYY-MM-DD'. */
  dateFrom?: string;
  /** Inclusive, 'YYYY-MM-DD'. */
  dateTo?: string;
  status?: OrderStatus[];
  paymentStatus?: PaymentStatus[];
  returnStatus?: ReturnStatus[];
  /** Quick chip: anything still to collect, or to refund. */
  paymentPending?: boolean;
  /** Quick chip: jars still with customers. */
  jarsOut?: boolean;
}

export interface DeliveryOrderSearchParams extends DeliveryOrderFilters {
  sort?: DeliveryOrderSortKey;
  direction?: "ASC" | "DESC";
  page?: number;
  pageSize?: number;
}

export interface DeliveryOrderPage {
  rows: DeliveryOrder[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Every query that touches the `delivery_orders` table lives here and nowhere
 * else. If a service needs orders AND items, it calls two repositories.
 * See .claude/ARCHITECTURE.md §4.1
 */
class DeliveryOrderRepository extends BaseRepository<DeliveryOrder> {
  protected readonly target: EntityTarget<DeliveryOrder> = DeliveryOrder;
  protected readonly alias = "o";

  /**
   * The order list: search + filters + sort + keyset-free offset pagination.
   *
   * Filtering on "money pending" and "jars out" hits `outstanding_amount` and
   * `qty_pending`, which are stored generated columns with their own partial
   * indexes. Computing them on read would turn every page of this query into a
   * correlated subquery that PostgreSQL cannot index — page 20 would
   * re-aggregate 525 orders' worth of items, returns and payments in order to
   * throw 500 of them away. See .claude/DATA-MODEL.md §8.1
   */
  async searchPaginated(
    params: DeliveryOrderSearchParams = {},
    em?: EntityManager,
  ): Promise<DeliveryOrderPage> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE),
    );

    const qb = await this.qb(em);
    qb.leftJoinAndSelect("o.staff", "s");
    this.applyFilters(qb, params);

    const sortColumn = DELIVERY_ORDER_SORT_COLUMNS[params.sort ?? "date"];
    const direction = params.direction === "ASC" ? "ASC" : "DESC";

    /**
     * skip/take, never offset/limit: the moment a to-many relation is joined,
     * LIMIT limits JOINED ROWS and page one shows three orders. skip/take makes
     * TypeORM run a distinct-id subquery and paginate entities.
     * A stable tiebreaker is appended to every sort, or rows with equal values
     * shuffle between pages and users see one record twice and miss another.
     * See .claude/ARCHITECTURE.md §6.3
     */
    const [rows, total] = await qb
      .orderBy(sortColumn, direction)
      .addOrderBy("o.orderNo", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { rows, total, page, pageSize };
  }

  /**
   * The §7.3 KPI strip, over the SAME filters as the list minus pagination.
   *
   * Summed IN SQL. Adding rupee values with `reduce` in TypeScript reintroduces
   * exactly the float error the `numeric` schema exists to prevent, and a card
   * that disagrees with the table under it is worse than no card.
   * See .claude/ARCHITECTURE.md §9.1
   *
   * CANCELLED ORDERS ARE EXCLUDED FROM EVERY MONEY AND JAR FIGURE, and only
   * from those. `fn_recompute_delivery_order` has no opinion about status, so a
   * cancelled order keeps whatever `outstanding_amount` its lines imply — and
   * cancelling requires payments and returns to be reversed first, which means
   * that figure is always the full total. Counting it would permanently inflate
   * the chase list with money nobody will ever collect.
   */
  async summary(
    filters: DeliveryOrderFilters = {},
    em?: EntityManager,
  ): Promise<{
    orderCount: number;
    cancelledCount: number;
    totalAmount: number;
    collectedAmount: number;
    refundedAmount: number;
    outstandingAmount: number;
    overpaidAmount: number;
    ordersWithMoneyPending: number;
    jarsOut: number;
    ordersWithJarsOut: number;
    staffWithJarsOut: number;
  }> {
    const qb = await this.qb(em);
    // Joined but not selected — `applyFilters` may reference the staff alias.
    qb.leftJoin("o.staff", "s");
    this.applyFilters(qb, filters);

    const LIVE = "o.status <> 'CANCELLED'";

    const raw = await qb
      .select("COUNT(*)", "order_count")
      .addSelect("COUNT(*) FILTER (WHERE o.status = 'CANCELLED')", "cancelled")
      .addSelect(
        `COALESCE(SUM(o.total_amount) FILTER (WHERE ${LIVE}), 0)`,
        "total_amount",
      )
      .addSelect(
        `COALESCE(SUM(o.paid_total_amount) FILTER (WHERE ${LIVE}), 0)`,
        "collected",
      )
      .addSelect(
        `COALESCE(SUM(o.refunded_amount) FILTER (WHERE ${LIVE}), 0)`,
        "refunded",
      )
      .addSelect(
        `COALESCE(SUM(o.outstanding_amount) FILTER (WHERE ${LIVE} AND o.outstanding_amount > 0), 0)`,
        "outstanding",
      )
      // Negated inside the SUM so the card reads as a positive magnitude — the
      // direction is carried by which card it lands on, never by a sign.
      .addSelect(
        `COALESCE(SUM(-o.outstanding_amount) FILTER (WHERE ${LIVE} AND o.outstanding_amount < 0), 0)`,
        "overpaid",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE ${LIVE} AND o.outstanding_amount <> 0)`,
        "orders_money_pending",
      )
      .addSelect(
        `COALESCE(SUM(o.qty_pending) FILTER (WHERE ${LIVE}), 0)`,
        "jars_out",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE ${LIVE} AND o.qty_pending > 0)`,
        "orders_jars_out",
      )
      .addSelect(
        `COUNT(DISTINCT o.staff_id) FILTER (WHERE ${LIVE} AND o.qty_pending > 0)`,
        "staff_jars_out",
      )
      .getRawOne<Record<string, string | number>>();

    // SUM over numeric comes back as a string from the driver; this is the
    // boundary where converting it once is legitimate.
    const num = (key: string) => Number(raw?.[key] ?? 0);

    return {
      orderCount: num("order_count"),
      cancelledCount: num("cancelled"),
      totalAmount: num("total_amount"),
      collectedAmount: num("collected"),
      refundedAmount: num("refunded"),
      outstandingAmount: num("outstanding"),
      overpaidAmount: num("overpaid"),
      ordersWithMoneyPending: num("orders_money_pending"),
      jarsOut: num("jars_out"),
      ordersWithJarsOut: num("orders_jars_out"),
      staffWithJarsOut: num("staff_jars_out"),
    };
  }

  /**
   * The detail page aggregate.
   *
   * Items are NOT joined to `products`: every value the screen displays comes
   * from the line's own snapshot columns, so a renamed product still reprints
   * as it was issued. See .claude/DATA-MODEL.md §6
   */
  async findByIdWithItems(
    id: string,
    em?: EntityManager,
  ): Promise<DeliveryOrder | null> {
    const qb = await this.qb(em);
    return qb
      .leftJoinAndSelect("o.staff", "s")
      .leftJoinAndSelect("o.items", "i")
      .where("o.id = :id", { id })
      .orderBy("i.lineNo", "ASC")
      .getOne();
  }

  /**
   * Row lock for read-modify-write — payments, returns and edits.
   *
   * The header is the PARENT in our lock hierarchy, so it is acquired AFTER any
   * `order_items` lock and never before one. Violating that ordering produces
   * intermittent deadlocks between the order and coin triggers that are
   * miserable to reproduce. See .claude/ARCHITECTURE.md §4.3
   */
  override async findByIdForUpdate(
    id: string,
    em: EntityManager,
  ): Promise<DeliveryOrder | null> {
    return super.findByIdForUpdate(id, em);
  }

  /**
   * Every order for a staff member that is still unfinished — money left to
   * collect (or refund), or jars still out. Drives the per-staff chase list and
   * the cross-order return picker's header.
   *
   * `<> 0` rather than `> 0`: a negative outstanding means the company owes the
   * staff member a refund, which is just as open. See .claude/DATA-MODEL.md §10.3
   */
  async findOpenByStaff(
    staffId: string,
    em?: EntityManager,
  ): Promise<DeliveryOrder[]> {
    const qb = await this.qb(em);
    return qb
      .where("o.staffId = :staffId", { staffId })
      .andWhere("o.status <> :cancelled", { cancelled: "CANCELLED" })
      .andWhere("(o.outstandingAmount <> 0 OR o.qtyPending > 0)")
      .orderBy("o.orderDate", "DESC")
      .addOrderBy("o.orderNo", "DESC")
      .getMany();
  }

  /**
   * Counts grouped by one status dimension — the list page's KPI strip and
   * filter-chip badges in a single round trip.
   *
   * COUNT(*) comes back as int8, which the global pg parser already coerces to
   * a number; `Number()` here is belt-and-braces, not arithmetic on money.
   */
  async countByStatus(
    field: DeliveryOrderStatusField,
    filters: DeliveryOrderFilters = {},
    em?: EntityManager,
  ): Promise<Record<string, number>> {
    const column = STATUS_COUNT_COLUMNS[field];
    const qb = await this.qb(em);
    // Joined but not selected — `applyFilters` may reference the staff alias.
    qb.leftJoin("o.staff", "s");
    this.applyFilters(qb, filters);

    const raw = await qb
      .select(column, "value")
      .addSelect("COUNT(*)", "count")
      .groupBy(column)
      .getRawMany<{ value: string; count: string | number }>();

    const counts: Record<string, number> = {};
    for (const row of raw) counts[row.value] = Number(row.count);
    return counts;
  }

  /**
   * Shared predicate builder, so the list and its KPI counts can never drift
   * apart. Unknown filter keys cannot reach here — the caller's type forbids
   * them and the service validates with Zod before that.
   */
  private applyFilters(
    qb: SelectQueryBuilder<DeliveryOrder>,
    filters: DeliveryOrderFilters,
  ): void {
    if (filters.search) {
      /**
       * Both sides are trigram-indexed: `code` on the order, and staff's
       * generated `search_blob` (name ‖ phone ‖ alt_phone ‖ address). Matching
       * the blob rather than three separate staff columns is exactly why that
       * column exists — one predicate, one index, instead of three OR-branches.
       * See .claude/DATA-MODEL.md §5.2
       */
      qb.andWhere("(o.code ILIKE :search OR s.searchBlob ILIKE :search)", {
        search: `%${filters.search}%`,
      });
    }
    if (filters.staffId) {
      qb.andWhere("o.staffId = :staffId", { staffId: filters.staffId });
    }
    if (filters.dateFrom) {
      qb.andWhere("o.orderDate >= :dateFrom", { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere("o.orderDate <= :dateTo", { dateTo: filters.dateTo });
    }
    if (filters.status?.length) {
      qb.andWhere("o.status IN (:...status)", { status: filters.status });
    }
    if (filters.paymentStatus?.length) {
      qb.andWhere("o.paymentStatus IN (:...paymentStatus)", {
        paymentStatus: filters.paymentStatus,
      });
    }
    if (filters.returnStatus?.length) {
      qb.andWhere("o.returnStatus IN (:...returnStatus)", {
        returnStatus: filters.returnStatus,
      });
    }
    if (filters.paymentPending) {
      qb.andWhere("o.outstandingAmount <> 0");
    }
    if (filters.jarsOut) {
      qb.andWhere("o.qtyPending > 0");
    }
  }
}

export const deliveryOrderRepository = new DeliveryOrderRepository();
