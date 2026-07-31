import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { PartyOrder } from "@/lib/db/entities";
import type {
  PartyOrderStatus,
  PaymentStatus,
} from "@/lib/db/entities/enums";
import {
  PARTY_ORDER_SORT_COLUMNS,
  type PartyOrderSortKey,
} from "@/lib/table/configs/party-order";

/**
 * The sort allowlist is imported, never re-declared — one map, shared by the
 * table config and this ORDER BY. The config is client-safe (zod and types
 * only), so this import couples nothing.
 * See .claude/MODULE-RECIPE.md §1 and .claude/ARCHITECTURE.md §6.2
 */
export type { PartyOrderSortKey };

export interface PartyOrderSearchParams {
  /** Matches code, party name, phone or address. */
  search?: string;
  status?: PartyOrderStatus[];
  paymentStatus?: PaymentStatus[];
  /** Bookings whose service window OVERLAPS [dateFrom, dateTo]. 'YYYY-MM-DD'. */
  dateFrom?: string;
  dateTo?: string;
  /** True → only bookings with money outstanding. The headline list filter. */
  outstandingOnly?: boolean;
  sort?: PartyOrderSortKey;
  direction?: "ASC" | "DESC";
  page?: number;
  pageSize?: number;
}

export interface PartyOrderSearchResult {
  rows: PartyOrder[];
  total: number;
}

/**
 * Every query that touches the `party_orders` table lives here.
 *
 * `findByIdForUpdate` is inherited from BaseRepository — party orders carry a
 * `@VersionColumn`, so any read-modify-write on the header (recording a
 * payment, cancelling a day) locks the row first. Lock order is child → parent
 * → grandparent everywhere. See .claude/ARCHITECTURE.md §4.3
 */
class PartyOrderRepository extends BaseRepository<PartyOrder> {
  protected readonly target: EntityTarget<PartyOrder> = PartyOrder;
  protected readonly alias = "po";

  /**
   * The list page: search + filters + sort + pagination in one round trip.
   *
   * Every predicate here reads a CACHED column on the header —
   * `outstanding_amount`, `first_service_date` — rather than aggregating over
   * days and payments. That is the entire reason those rollups exist: computed
   * on read, page 3 of this list would re-aggregate every booking's schedule
   * in order to throw most of it away. See .claude/DATA-MODEL.md §8.1
   */
  async searchPaginated(
    params: PartyOrderSearchParams = {},
    em?: EntityManager,
  ): Promise<PartyOrderSearchResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

    const qb = await this.qb(em);
    qb.where("po.deletedAt IS NULL");

    if (params.search?.trim()) {
      // Trigram-accelerated: idx_po_search_trgm covers search_blob, and a
      // separate trigram index covers code — which cannot be folded into
      // search_blob because one generated column may not reference another.
      const like = `%${params.search.trim()}%`;
      qb.andWhere("(po.searchBlob ILIKE :like OR po.code ILIKE :like)", {
        like,
      });
    }

    if (params.status?.length) {
      qb.andWhere("po.status IN (:...status)", { status: params.status });
    }

    if (params.paymentStatus?.length) {
      qb.andWhere("po.paymentStatus IN (:...paymentStatus)", {
        paymentStatus: params.paymentStatus,
      });
    }

    // Overlap, not containment: a five-day booking straddling the window edge
    // is still a booking in that window.
    if (params.dateFrom) {
      qb.andWhere("po.lastServiceDate >= :dateFrom", {
        dateFrom: params.dateFrom,
      });
    }
    if (params.dateTo) {
      qb.andWhere("po.firstServiceDate <= :dateTo", { dateTo: params.dateTo });
    }

    if (params.outstandingOnly) {
      qb.andWhere("po.outstandingAmount > 0");
    }

    const sortColumn = PARTY_ORDER_SORT_COLUMNS[params.sort ?? "startDate"];
    const direction = params.direction === "ASC" ? "ASC" : "DESC";

    qb.orderBy(sortColumn, direction)
      // A STABLE TIEBREAKER on every sort. Without one, rows with equal sort
      // values shuffle between pages and the user sees one record twice while
      // missing another entirely. See .claude/ARCHITECTURE.md §6.3
      .addOrderBy("po.partyNo", "DESC")
      // skip/take, never offset/limit — the shared-helper rule, kept here so
      // adding a to-many join later cannot silently break page sizes.
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    return { rows, total };
  }

  /**
   * The detail page: booking + every scheduled day + every day's lines.
   *
   * Joins stay inside the party-order AGGREGATE — days and items have no
   * meaning apart from their booking and cascade with it. Anything outside the
   * aggregate (payments, staff, products) is a second repository call.
   * See .claude/ARCHITECTURE.md §4.1 rule 4
   */
  async findByIdWithSchedule(
    id: string,
    em?: EntityManager,
  ): Promise<PartyOrder | null> {
    const qb = await this.qb(em);
    return qb
      .leftJoinAndSelect("po.days", "d")
      .leftJoinAndSelect("d.items", "i")
      .where("po.id = :id", { id })
      .andWhere("po.deletedAt IS NULL")
      .orderBy("d.serviceDate", "ASC")
      .addOrderBy("i.lineNo", "ASC")
      .getOne();
  }

  /**
   * "What party deliveries are going out on this date?" — the dashboard strip
   * and the day sheet.
   *
   * Only the matching day is joined, so the caller gets exactly the schedule
   * row it needs rather than the whole booking. Cancelled bookings and
   * cancelled days are excluded: they are not going anywhere.
   */
  async findWithDeliveriesOn(
    date: string,
    em?: EntityManager,
  ): Promise<PartyOrder[]> {
    const qb = await this.qb(em);
    return qb
      .innerJoinAndSelect("po.days", "d", "d.serviceDate = :date", { date })
      .leftJoinAndSelect("d.items", "i")
      .where("po.deletedAt IS NULL")
      .andWhere("po.status <> :cancelledOrder", {
        cancelledOrder: "CANCELLED",
      })
      .andWhere("d.deliveryStatus <> :cancelledDay", {
        cancelledDay: "CANCELLED",
      })
      .orderBy("po.partyName", "ASC")
      .addOrderBy("i.lineNo", "ASC")
      .getMany();
  }
}

export const partyOrderRepository = new PartyOrderRepository();
