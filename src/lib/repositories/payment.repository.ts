import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { Payment } from "@/lib/db/entities";
import type { PaymentContext } from "@/lib/db/entities/enums";

/**
 * `context_type` → the exclusive-arc column that must be populated for it.
 *
 * A LOOKUP TABLE, never string interpolation. Callers hand us an enum value;
 * it is used as a key into this map and the resolved column name is a literal
 * from this file. Nothing user-supplied ever reaches the SQL text.
 * See .claude/ARCHITECTURE.md §6.2
 */
const CONTEXT_ARC: Record<
  PaymentContext,
  "orderId" | "coinIssueId" | "partyOrderId"
> = {
  ORDER: "orderId",
  COIN_ISSUE: "coinIssueId",
  PARTY_ORDER: "partyOrderId",
};

/**
 * Every query that touches the `payments` table lives here — for delivery
 * orders, coin issues AND party orders alike, because they share one table.
 *
 * APPEND-ONLY. There are no update or delete methods, and the three inherited
 * mutators are overridden to throw. The database enforces this too (a BEFORE
 * UPDATE OR DELETE trigger, plus revoked grants), but failing here gives a
 * readable error at the call site instead of a Postgres exception three layers
 * down. Corrections are INSERTs carrying `reversesPaymentId`.
 * See .claude/DATA-MODEL.md §9
 */
class PaymentRepository extends BaseRepository<Payment> {
  protected readonly target: EntityTarget<Payment> = Payment;
  protected readonly alias = "p";

  /** Newest first — the payment history timeline on an order detail page. */
  async findByOrderId(orderId: string, em?: EntityManager): Promise<Payment[]> {
    const qb = await this.qb(em);
    return qb
      .where("p.orderId = :orderId", { orderId })
      .orderBy("p.paidOn", "DESC")
      .addOrderBy("p.paymentNo", "DESC")
      .getMany();
  }

  async findByCoinIssueId(
    coinIssueId: string,
    em?: EntityManager,
  ): Promise<Payment[]> {
    const qb = await this.qb(em);
    return qb
      .where("p.coinIssueId = :coinIssueId", { coinIssueId })
      .orderBy("p.paidOn", "DESC")
      .addOrderBy("p.paymentNo", "DESC")
      .getMany();
  }

  async findByPartyOrderId(
    partyOrderId: string,
    em?: EntityManager,
  ): Promise<Payment[]> {
    const qb = await this.qb(em);
    return qb
      .where("p.partyOrderId = :partyOrderId", { partyOrderId })
      .orderBy("p.paidOn", "DESC")
      .addOrderBy("p.paymentNo", "DESC")
      .getMany();
  }

  /**
   * Total collected against one document — IN direction only.
   *
   * The sum happens in SQL, never in TypeScript: adding rupee values with
   * `reduce` reintroduces the floating-point error the whole schema is built
   * to avoid. `SUM` over a numeric returns a numeric, which the driver keeps
   * as a string, so this is the one place a conversion is legitimate — at the
   * boundary, explicitly. See .claude/DATA-MODEL.md D-4 · ARCHITECTURE.md §9.1
   *
   * Refunds are deliberately NOT netted off here. `direction` exists so
   * "collected" and "refunded" stay separately answerable; a caller that wants
   * the net figure reads `outstanding_amount` off the header, which the
   * database maintains.
   */
  async sumInByContext(
    contextType: PaymentContext,
    contextId: string,
    em?: EntityManager,
  ): Promise<number> {
    const arc = CONTEXT_ARC[contextType];
    const qb = await this.qb(em);
    const row = await qb
      .select("coalesce(sum(p.amount), 0)", "total")
      .where(`p.${arc} = :contextId`, { contextId })
      .andWhere("p.direction = :direction", { direction: "IN" })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  /**
   * The idempotency check. The client mints one id per form open, so a retry
   * after a timeout carries the same value and this returns true instead of
   * the customer paying twice. See .claude/DATA-MODEL.md §10.11
   */
  async existsByClientRequestId(
    clientRequestId: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const qb = await this.qb(em);
    return qb
      .where("p.clientRequestId = :clientRequestId", { clientRequestId })
      .getExists();
  }

  /* ── Append-only guards ────────────────────────────────────────────────
     Zero-parameter overrides, so calling one is a COMPILE error rather than a
     runtime surprise. Insert new payments with create(). ------------------ */

  override async updateById(): Promise<never> {
    throw new Error(
      "payments is append-only: correct a payment by inserting a reversing row.",
    );
  }

  override async softDeleteById(): Promise<never> {
    throw new Error(
      "payments is append-only: it has no deleted_at. Insert a reversing row.",
    );
  }

  override async restoreById(): Promise<never> {
    throw new Error("payments is append-only: nothing is ever deleted.");
  }
}

export const paymentRepository = new PaymentRepository();
