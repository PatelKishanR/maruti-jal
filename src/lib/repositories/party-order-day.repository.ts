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
}

export const partyOrderDayRepository = new PartyOrderDayRepository();
