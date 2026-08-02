import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { Payment } from "@/lib/db/entities";
import type { PaymentContext } from "@/lib/db/entities/enums";

/**
 * The daily collection sheet's summary band and cash-reconciliation footer.
 * Every figure netted IN − OUT and added by PostgreSQL.
 */
export interface CollectionSheetTotals {
  total: number;
  cash: number;
  coins: number;
  upi: number;
  bank: number;
  writeOff: number;
  /** UPI + bank + write-off — everything that is neither cash nor a token. */
  other: number;
  /** Cash + UPI + bank. Coins are stock, never drawer money. */
  expectedInDrawer: number;
  receipts: number;
  cashReceipts: number;
  coinsReceipts: number;
  otherReceipts: number;
  /** Tokens handed over, netted. Counted, never valued twice. */
  coinCount: number;
}

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
   * Collection for a period, split into cash, coins and everything else —
   * the dashboard's collection-mix chart (design/MODULES/08 §3.3.4 C4).
   *
   * THE BUCKETING HAPPENS IN SQL, not in the service, and that is the whole
   * point of the method: folding UPI, bank transfer and write-off into "Other"
   * in TypeScript would mean adding three rupee figures together outside
   * PostgreSQL. The CASE arms are literals written here — nothing user-supplied
   * reaches the SQL text. See .claude/ARCHITECTURE.md §6.2, §9.1
   *
   * `SUM(SUM(...)) OVER ()` carries the grand total on every row, so the chart's
   * denominator is also a database figure rather than a `reduce` over the
   * buckets.
   *
   * IN only. A refund is a real event with its own direction, and netting it
   * off here would quietly shrink the day's takings.
   */
  async collectionMixBetween(
    from: string,
    to: string,
    em?: EntityManager,
  ): Promise<
    Array<{ bucket: "CASH" | "COIN" | "OTHER"; total: number; payments: number; grandTotal: number }>
  > {
    const qb = await this.qb(em);
    const rows = await qb
      .select(
        "CASE WHEN p.mode = 'CASH' THEN 'CASH' WHEN p.mode = 'COIN' THEN 'COIN' ELSE 'OTHER' END",
        "bucket",
      )
      .addSelect("COALESCE(SUM(p.amount), 0)", "total")
      .addSelect("COUNT(*)", "payments")
      .addSelect("COALESCE(SUM(SUM(p.amount)) OVER (), 0)", "grand_total")
      .where("p.direction = :direction", { direction: "IN" })
      .andWhere("p.paidOn BETWEEN :from AND :to", { from, to })
      .groupBy(
        "CASE WHEN p.mode = 'CASH' THEN 'CASH' WHEN p.mode = 'COIN' THEN 'COIN' ELSE 'OTHER' END",
      )
      .getRawMany<{
        bucket: "CASH" | "COIN" | "OTHER";
        total: string;
        payments: string;
        grand_total: string;
      }>();

    // numeric arrives as a string from the driver; converted once, here.
    return rows.map((row) => ({
      bucket: row.bucket,
      total: Number(row.total),
      payments: Number(row.payments),
      grandTotal: Number(row.grand_total),
    }));
  }

  /* ── Reports ───────────────────────────────────────────────────────────
   *
   * The daily collection sheet, design/MODULES/09-reports.md §5. Every figure
   * below is aggregated by PostgreSQL; the report service places them and adds
   * nothing. These methods query `payments` ONLY — the reference codes and the
   * names beside them are resolved by the service from the order, coin issue
   * and party repositories, which is "one service, several repositories"
   * working exactly as ARCHITECTURE §4.1 rule 4 intends.
   */

  /**
   * Every receipt in a window, oldest first — the rows of the collection sheet.
   *
   * Ordered by `created_at` rather than `paid_on`, because the sheet is read as
   * a day's chronology and two payments dated the same day are distinguished
   * only by when they were recorded. `paymentNo` is the stable tiebreaker, so
   * two receipts entered in the same second never reshuffle between reloads.
   *
   * Refunds (`direction = 'OUT'`) are INCLUDED. A day that paid ₹500 back is
   * not a day that collected nothing, and hiding the row while netting it off
   * the total is how a sheet stops adding up in front of the person holding it.
   */
  async findBetween(
    from: string,
    to: string,
    em?: EntityManager,
  ): Promise<Payment[]> {
    const qb = await this.qb(em);
    return qb
      .where("p.paidOn BETWEEN :from AND :to", { from, to })
      .orderBy("p.paidOn", "ASC")
      .addOrderBy("p.createdAt", "ASC")
      .addOrderBy("p.paymentNo", "ASC")
      .getMany();
  }

  /**
   * Every figure on the collection sheet's summary band and reconciliation
   * footer, in ONE query — including the walk-ins, which have no payment rows.
   *
   * WHY THE WALK-IN FIGURE IS A PARAMETER. A day's takings span two relations:
   * `payments` carries delivery, party and coin-issue receipts, while walk-ins
   * live entirely in `direct_sales` with no payment row at all (DATA-MODEL
   * §5.18). No single relation holds both, so no query here can reach them —
   * and the alternative, `paymentsCash + walkInCash` in the service, is adding
   * two rupee figures in JavaScript, which this codebase does not do. Binding
   * the walk-in total as a `numeric` keeps the addition inside PostgreSQL at
   * full decimal precision. It is the same contract
   * `dailySalesRepository.profitBetween` uses for the expense side, and for
   * exactly the same reason. See .claude/DATA-MODEL.md D-4
   *
   * Both walk-in parameters are STRINGS for the money and a plain integer for
   * the count, because `(1234.55).toString()` is fine today and a float
   * artefact the day the figure gets large enough.
   *
   * EXPECTED IN DRAWER is cash plus UPI and bank transfer — never coins. A
   * token coming back is stock returning to the shelf, not money entering the
   * drawer, and the sheet's whole purpose is that the counted cash matches this
   * line. §5.3, §12.4
   */
  async collectionSheetTotalsBetween(
    from: string,
    to: string,
    walkInCash: string,
    walkInReceipts: number,
    em?: EntityManager,
  ): Promise<CollectionSheetTotals> {
    /** IN minus OUT for one mode — a refund never inflates a day's takings. */
    const net = (mode: string) =>
      `(COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN' AND p.mode = '${mode}'), 0)` +
      ` - COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT' AND p.mode = '${mode}'), 0))`;

    const cash = `(${net("CASH")} + :walkInCash::numeric)`;
    const coins = net("COIN");
    const upi = net("UPI");
    const bank = net("BANK_TRANSFER");
    const writeOff = net("WRITE_OFF");

    const qb = await this.qb(em);
    const row = await qb
      .select(`(${cash} + ${coins} + ${upi} + ${bank} + ${writeOff})::numeric(12,2)`, "total")
      .addSelect(`${cash}::numeric(12,2)`, "cash")
      .addSelect(`${coins}::numeric(12,2)`, "coins")
      .addSelect(`${upi}::numeric(12,2)`, "upi")
      .addSelect(`${bank}::numeric(12,2)`, "bank")
      .addSelect(`${writeOff}::numeric(12,2)`, "writeOff")
      .addSelect(`(${upi} + ${bank} + ${writeOff})::numeric(12,2)`, "other")
      .addSelect(`(${cash} + ${upi} + ${bank})::numeric(12,2)`, "expectedInDrawer")
      .addSelect(
        "(COUNT(*) + :walkInReceipts::integer)::integer",
        "receipts",
      )
      .addSelect(
        "(COUNT(*) FILTER (WHERE p.mode = 'CASH') + :walkInReceipts::integer)::integer",
        "cashReceipts",
      )
      .addSelect("COUNT(*) FILTER (WHERE p.mode = 'COIN')::integer", "coinsReceipts")
      .addSelect(
        "COUNT(*) FILTER (WHERE p.mode NOT IN ('CASH', 'COIN'))::integer",
        "otherReceipts",
      )
      .addSelect(
        "COALESCE(SUM(p.coin_count) FILTER (WHERE p.direction = 'IN' AND p.mode = 'COIN'), 0)" +
          " - COALESCE(SUM(p.coin_count) FILTER (WHERE p.direction = 'OUT' AND p.mode = 'COIN'), 0)",
        "coinCount",
      )
      .where("p.paidOn BETWEEN :from AND :to")
      .setParameters({ from, to, walkInCash, walkInReceipts })
      .getRawOne<Record<string, string | number | null>>();

    const money = (key: string) => Number(row?.[key] ?? 0);
    const count = (key: string) => Number(row?.[key] ?? 0);

    return {
      total: money("total"),
      cash: money("cash"),
      coins: money("coins"),
      upi: money("upi"),
      bank: money("bank"),
      writeOff: money("writeOff"),
      other: money("other"),
      expectedInDrawer: money("expectedInDrawer"),
      receipts: count("receipts"),
      cashReceipts: count("cashReceipts"),
      coinsReceipts: count("coinsReceipts"),
      otherReceipts: count("otherReceipts"),
      coinCount: count("coinCount"),
    };
  }

  /**
   * Collection by document context — the four group subtotals on the sheet.
   *
   * Walk-ins are absent by construction: `direct_sales` has no payment rows at
   * all (DATA-MODEL §5.18), so that group comes from the direct sale repository
   * and is added to the sheet by the service, not by this query.
   */
  async totalsByContextBetween(
    from: string,
    to: string,
    em?: EntityManager,
  ): Promise<Array<{ contextType: PaymentContext; total: number; receipts: number }>> {
    const qb = await this.qb(em);
    const rows = await qb
      .select("p.contextType", "contextType")
      .addSelect(
        "COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0) " +
          "- COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0)",
        "total",
      )
      .addSelect("COUNT(*)", "receipts")
      .where("p.paidOn BETWEEN :from AND :to", { from, to })
      .groupBy("p.contextType")
      .getRawMany<{ contextType: PaymentContext; total: string; receipts: string }>();

    return rows.map((row) => ({
      contextType: row.contextType,
      total: Number(row.total),
      receipts: Number(row.receipts),
    }));
  }

  /**
   * Coins handed over in a window, per coin type — the sheet's "Coins received,
   * by type" sub-table.
   *
   * `coin_count` and `amount` are both netted IN − OUT, so a coin refund puts
   * the tokens back where they came from. Returns coin type IDS, not names:
   * joining `coin_types` would make this repository query another entity's
   * table, and the service already holds the coin type list.
   * See .claude/ARCHITECTURE.md §4.1 rule 4
   */
  async coinsReceivedBetween(
    from: string,
    to: string,
    em?: EntityManager,
  ): Promise<Array<{ coinTypeId: string; coins: number; value: number }>> {
    const qb = await this.qb(em);
    const rows = await qb
      .select("p.coinTypeId", "coinTypeId")
      .addSelect(
        "COALESCE(SUM(p.coinCount) FILTER (WHERE p.direction = 'IN'), 0) " +
          "- COALESCE(SUM(p.coinCount) FILTER (WHERE p.direction = 'OUT'), 0)",
        "coins",
      )
      .addSelect(
        "COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'IN'), 0) " +
          "- COALESCE(SUM(p.amount) FILTER (WHERE p.direction = 'OUT'), 0)",
        "value",
      )
      .where("p.paidOn BETWEEN :from AND :to", { from, to })
      .andWhere("p.mode = 'COIN'")
      .andWhere("p.coinTypeId IS NOT NULL")
      .groupBy("p.coinTypeId")
      .getRawMany<{ coinTypeId: string; coins: string; value: string }>();

    return rows.map((row) => ({
      coinTypeId: row.coinTypeId,
      coins: Number(row.coins),
      value: Number(row.value),
    }));
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

  /**
   * The row a retry lands on.
   *
   * `existsByClientRequestId` answers "has this been seen?"; this answers "what
   * did it produce?", which is what an idempotent write actually needs — a
   * second tap after a timeout should return the ORIGINAL result, not a
   * conflict the owner has to interpret. See .claude/DATA-MODEL.md §10.11
   */
  async findByClientRequestId(
    clientRequestId: string,
    em?: EntityManager,
  ): Promise<Payment | null> {
    const qb = await this.qb(em);
    return qb
      .where("p.clientRequestId = :clientRequestId", { clientRequestId })
      .getOne();
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
