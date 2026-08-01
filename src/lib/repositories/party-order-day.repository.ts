import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { PartyOrderDay } from "@/lib/db/entities";

/**
 * Every query that touches the `party_order_days` table lives here.
 *
 * `findByIdForUpdate` is inherited from BaseRepository. Use it before any
 * read-modify-write on a day — marking it delivered, entering actual
 * quantities — and lock the day BEFORE its parent booking: child → parent →
 * grandparent, everywhere, or you get intermittent deadlocks between the
 * schedule triggers and the payment triggers.
 * See .claude/DATA-MODEL.md §7 · .claude/ARCHITECTURE.md §4.3
 */
/** One booking's schedule position, aggregated in SQL. */
export interface PartyOrderDayProgressRow {
  partyOrderId: string;
  totalDays: number;
  deliveredDays: number;
  skippedDays: number;
  cancelledDays: number;
  scheduledDays: number;
  /** Earliest day still SCHEDULED — `next 20 Aug`. */
  nextServiceDate: string | null;
}

/** The calendar footer band and the `PARTY REVENUE THIS MONTH` KPI. */
export interface PartyOrderDayTotals {
  /** Σ of `day_total`. From SQL, because it is money. */
  amount: number;
  days: number;
  bookings: number;
}

class PartyOrderDayRepository extends BaseRepository<PartyOrderDay> {
  protected readonly target: EntityTarget<PartyOrderDay> = PartyOrderDay;
  protected readonly alias = "d";

  /**
   * The schedule, in calendar order.
   *
   * Days only. Line items come from partyOrderItemRepository, and the whole
   * aggregate in one query comes from partyOrderRepository.findByIdWithSchedule
   * — a repository queries its own table. See .claude/ARCHITECTURE.md §4.1
   */
  async findByOrderId(
    partyOrderId: string,
    em?: EntityManager,
  ): Promise<PartyOrderDay[]> {
    const qb = await this.qb(em);
    return qb
      .where("d.partyOrderId = :partyOrderId", { partyOrderId })
      .orderBy("d.serviceDate", "ASC")
      .getMany();
  }

  /**
   * Every scheduled delivery in a window, across all bookings — the calendar
   * view and the "deliveries this week" KPI.
   *
   * Both bounds are INCLUSIVE. Dates are 'YYYY-MM-DD' strings the whole way
   * down, so there is no timezone to get wrong: a `date` decoded as local
   * midnight is how party schedules silently drift by a day.
   * See .claude/ARCHITECTURE.md §9.2
   */
  async findByDateRange(
    from: string,
    to: string,
    em?: EntityManager,
  ): Promise<PartyOrderDay[]> {
    const qb = await this.qb(em);
    return qb
      .where("d.serviceDate BETWEEN :from AND :to", { from, to })
      .orderBy("d.serviceDate", "ASC")
      // Stable tiebreaker: many days share a date.
      .addOrderBy("d.id", "ASC")
      .getMany();
  }

  /**
   * Take a day out of the schedule entirely.
   *
   * A HARD delete, unlike anything with a header: a day extends `LineItemBase`,
   * has no `deleted_at`, and cascades to its items. A tombstone would also
   * break the plain unique `(party_order_id, service_date)` index, which is
   * what stops the same date being scheduled twice.
   *
   * The service refuses this for a DELIVERED day — that one is cancelled
   * instead, so billing history survives. See .claude/DATA-MODEL.md §4, §5.16
   */
  async hardDeleteById(id: string, em?: EntityManager): Promise<void> {
    const repo = await this.repo(em);
    await repo.delete({ id });
  }

  /**
   * `3/5 days` for a whole PAGE of bookings, in one grouped aggregate.
   *
   * The detail page derives the same figures from days it has already loaded
   * (`progressFromDays` in the DTO). The list page cannot: that would mean
   * loading every day of all twenty-five bookings on screen in order to count
   * them. One GROUP BY answers it instead.
   */
  async progressByOrderIds(
    partyOrderIds: readonly string[],
    em?: EntityManager,
  ): Promise<PartyOrderDayProgressRow[]> {
    if (partyOrderIds.length === 0) return [];

    const qb = await this.qb(em);
    const rows = await qb
      .select("d.partyOrderId", "partyOrderId")
      .addSelect("count(*)", "totalDays")
      .addSelect(
        "count(*) FILTER (WHERE d.deliveryStatus = :delivered)",
        "deliveredDays",
      )
      .addSelect(
        "count(*) FILTER (WHERE d.deliveryStatus = :skipped)",
        "skippedDays",
      )
      .addSelect(
        "count(*) FILTER (WHERE d.deliveryStatus = :cancelled)",
        "cancelledDays",
      )
      .addSelect(
        "count(*) FILTER (WHERE d.deliveryStatus = :scheduled)",
        "scheduledDays",
      )
      // The next day still to happen — `next 20 Aug` on the list row.
      .addSelect(
        "min(d.serviceDate) FILTER (WHERE d.deliveryStatus = :scheduled)",
        "nextServiceDate",
      )
      .where("d.partyOrderId IN (:...partyOrderIds)", { partyOrderIds })
      .setParameters({
        delivered: "DELIVERED",
        skipped: "SKIPPED",
        cancelled: "CANCELLED",
        scheduled: "SCHEDULED",
      })
      .groupBy("d.partyOrderId")
      .getRawMany<{
        partyOrderId: string;
        totalDays: string;
        deliveredDays: string;
        skippedDays: string;
        cancelledDays: string;
        scheduledDays: string;
        nextServiceDate: string | null;
      }>();

    return rows.map((row) => ({
      partyOrderId: row.partyOrderId,
      totalDays: Number(row.totalDays),
      deliveredDays: Number(row.deliveredDays),
      skippedDays: Number(row.skippedDays),
      cancelledDays: Number(row.cancelledDays),
      scheduledDays: Number(row.scheduledDays),
      nextServiceDate: row.nextServiceDate,
    }));
  }

  /**
   * The calendar's footer band and the `PARTY REVENUE THIS MONTH` KPI.
   *
   * `amount` is a SQL `sum` because it is money — adding `day_total` values in
   * TypeScript reintroduces exactly the float error `numeric` exists to avoid,
   * and this figure is read as revenue. SKIPPED and CANCELLED days are excluded
   * from it, matching `fn_recompute_party_order`, so the month total and the
   * booking totals it is made of cannot disagree.
   * See .claude/ARCHITECTURE.md §9.1
   *
   * `partyOrderIds` narrows the aggregate to bookings the caller has already
   * established are live. A cancelled BOOKING's days would otherwise be counted
   * here, and a repository may not join another entity's table to find out.
   */
  async summariseBetween(
    from: string,
    to: string,
    partyOrderIds?: readonly string[],
    em?: EntityManager,
  ): Promise<PartyOrderDayTotals> {
    if (partyOrderIds && partyOrderIds.length === 0) {
      return { amount: 0, days: 0, bookings: 0 };
    }

    const qb = await this.qb(em);
    qb.select(
      "coalesce(sum(d.dayTotal) FILTER (WHERE d.deliveryStatus NOT IN (:skipped, :cancelled)), 0)",
      "amount",
    )
      .addSelect("count(*) FILTER (WHERE d.deliveryStatus <> :cancelled)", "days")
      .addSelect(
        "count(DISTINCT d.partyOrderId) FILTER (WHERE d.deliveryStatus <> :cancelled)",
        "bookings",
      )
      .where("d.serviceDate BETWEEN :from AND :to", { from, to })
      .setParameters({ skipped: "SKIPPED", cancelled: "CANCELLED" });

    if (partyOrderIds) {
      qb.andWhere("d.partyOrderId IN (:...partyOrderIds)", { partyOrderIds });
    }

    const row = await qb.getRawOne<{
      amount: string;
      days: string;
      bookings: string;
    }>();

    return {
      amount: Number(row?.amount ?? 0),
      days: Number(row?.days ?? 0),
      bookings: Number(row?.bookings ?? 0),
    };
  }

  /**
   * One money total per DATE — the figure in the corner of each calendar cell.
   *
   * A grouped SQL aggregate rather than a `reduce` over the deliveries the page
   * already holds: `day_total` is money, and a column of cell totals that
   * disagrees with the footer band by a paisa is worse than no cell totals at
   * all. Cancelled days are excluded, matching the band and the booking totals.
   * See .claude/ARCHITECTURE.md §9.1
   */
  async totalsByDate(
    from: string,
    to: string,
    partyOrderIds?: readonly string[],
    em?: EntityManager,
  ): Promise<{ serviceDate: string; amount: number }[]> {
    if (partyOrderIds && partyOrderIds.length === 0) return [];

    const qb = await this.qb(em);
    qb.select("d.serviceDate", "serviceDate")
      .addSelect("coalesce(sum(d.dayTotal), 0)", "amount")
      .where("d.serviceDate BETWEEN :from AND :to", { from, to })
      .andWhere("d.deliveryStatus <> :cancelled", { cancelled: "CANCELLED" })
      .groupBy("d.serviceDate");

    if (partyOrderIds) {
      qb.andWhere("d.partyOrderId IN (:...partyOrderIds)", { partyOrderIds });
    }

    const rows = await qb.getRawMany<{ serviceDate: string; amount: string }>();
    return rows.map((row) => ({
      serviceDate: row.serviceDate,
      amount: Number(row.amount),
    }));
  }

  /**
   * `24 days scheduled` — every day still to be delivered, from `from` onwards.
   *
   * Cancelling a booking cancels its remaining days (the service does that in
   * the same transaction), so a status filter here is enough and no join to
   * `party_orders` is needed.
   */
  async countScheduledFrom(from: string, em?: EntityManager): Promise<number> {
    const qb = await this.qb(em);
    return qb
      .where("d.serviceDate >= :from", { from })
      .andWhere("d.deliveryStatus = :scheduled", { scheduled: "SCHEDULED" })
      .getCount();
  }
}

export const partyOrderDayRepository = new PartyOrderDayRepository();
