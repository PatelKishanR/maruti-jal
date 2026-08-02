import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { CoinLedgerEntry } from "@/lib/db/entities";
import type { LedgerMovementType } from "@/lib/db/entities/enums";

/**
 * One coin type's movement over a window — the coin reconciliation report's
 * row, computed entirely by PostgreSQL. Signs are the ledger's own: issues
 * negative, returns and receipts positive.
 */
export interface CoinReconciliationRow {
  coinTypeId: string;
  opening: number;
  issued: number;
  returned: number;
  received: number;
  adjusted: number;
  /** `opening` plus every movement above, added by PostgreSQL. */
  closing: number;
  /** The `balance_after_coins` the ledger itself carried at `to`. */
  ledgerBalance: number;
  /** `closing - ledgerBalance`. Non-zero is a Sev-1. */
  difference: number;
  /** Σ `value_delta` inside the window, in rupees. */
  valueDelta: number;
  entryCount: number;
  adjustmentCount: number;
}

export interface CoinLedgerSearchParams {
  movementType?: LedgerMovementType[];
  /** Inclusive, 'YYYY-MM-DD'. */
  dateFrom?: string;
  dateTo?: string;
  /** "Coins that passed through staff member X". */
  staffId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Every query that touches `coin_ledger_entries` lives here and nowhere else.
 *
 * APPEND-ONLY, and the auditable spine of the coin module: one row per stock
 * movement, no exceptions. There is no update path and no delete path — a
 * mistake is corrected by inserting a reversing entry. The database enforces it
 * with a BEFORE UPDATE OR DELETE trigger and revoked grants; the overrides
 * below move the failure to compile time. See .claude/DATA-MODEL.md §5.14, §9
 *
 * This repository deliberately does NOT resolve a movement's human reference
 * (CIS-000012, ORD-000044). Those live in other tables, and repositories never
 * call each other — the SERVICE composes the ledger rows with whatever it needs
 * from the issue and payment repositories.
 * See .claude/ARCHITECTURE.md §4.1 rules 4 and 5
 */
class CoinLedgerEntryRepository extends BaseRepository<CoinLedgerEntry> {
  protected readonly target: EntityTarget<CoinLedgerEntry> = CoinLedgerEntry;
  protected readonly alias = "cle";

  /**
   * The per-coin-type ledger view with its running balance.
   *
   * Ordered by `entry_seq`, never by date or `created_at`: the sequence is the
   * order the balances were computed in, so `balance_after_coins` only reads
   * correctly down the page when sorted this way. `uq_ledger_seq` serves the
   * sort directly. See .claude/DATA-MODEL.md §11
   */
  async findByCoinTypePaginated(
    coinTypeId: string,
    params: CoinLedgerSearchParams = {},
    em?: EntityManager,
  ): Promise<{ rows: CoinLedgerEntry[]; total: number }> {
    const {
      movementType,
      dateFrom,
      dateTo,
      staffId,
      page = 1,
      pageSize = 50,
    } = params;

    const qb = await this.qb(em);
    qb.where("cle.coinTypeId = :coinTypeId", { coinTypeId });

    if (movementType?.length) {
      qb.andWhere("cle.movementType IN (:...movementType)", { movementType });
    }
    if (dateFrom) qb.andWhere("cle.entryDate >= :dateFrom", { dateFrom });
    if (dateTo) qb.andWhere("cle.entryDate <= :dateTo", { dateTo });
    if (staffId) qb.andWhere("cle.staffId = :staffId", { staffId });

    const [rows, total] = await qb
      // entry_seq is unique per coin type, so it is its own tiebreaker.
      .orderBy("cle.entrySeq", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { rows, total };
  }

  /**
   * The next sequence number for this coin type.
   *
   * MUST be called inside a transaction that ALREADY HOLDS the coin type's row
   * lock (`coinTypeRepository.findByIdForUpdate`) — hence the required
   * EntityManager. Without that lock two concurrent issues both read the same
   * max and race; with it, the second waits and reads the first's committed
   * value. The unique index on (coin_type_id, entry_seq) is the backstop if
   * anyone ever calls this unlocked.
   *
   * A per-coin-type MAX rather than a shared PostgreSQL sequence, because a
   * sequence gaps on rollback and interleaves coin types — neither of which an
   * auditable register may do. See .claude/DATA-MODEL.md §5.14 and §10.2
   */
  async nextEntrySeq(coinTypeId: string, em: EntityManager): Promise<number> {
    const raw = await em
      .getRepository(CoinLedgerEntry)
      .createQueryBuilder("cle")
      .select("COALESCE(MAX(cle.entry_seq), 0) + 1", "next")
      .where("cle.coinTypeId = :coinTypeId", { coinTypeId })
      .getRawOne<{ next: string | number }>();

    return Number(raw?.next ?? 1);
  }

  /**
   * The balance carried by the most recent entry — the number the next
   * movement's `balance_after_coins` is computed from.
   *
   * Read under the same row lock as `nextEntrySeq`, in the same transaction as
   * the insert. That is the entire negative-stock defence: two people issuing
   * the last ten coins serialise here, and the `balance_after_coins >= 0`
   * constraint rejects the loser. Returns 0 for a coin type with no movements
   * yet — which is correct, an unstocked type genuinely holds nothing.
   * See .claude/DATA-MODEL.md §10.2
   */
  async latestBalance(coinTypeId: string, em: EntityManager): Promise<number> {
    const raw = await em
      .getRepository(CoinLedgerEntry)
      .createQueryBuilder("cle")
      .select("cle.balance_after_coins", "balance")
      .where("cle.coinTypeId = :coinTypeId", { coinTypeId })
      .orderBy("cle.entrySeq", "DESC")
      .limit(1)
      .getRawOne<{ balance: string | number }>();

    return Number(raw?.balance ?? 0);
  }

  /**
   * Σ of every movement for this coin type — the independent recomputation that
   * `coin_types.balance_coins` and the latest `balance_after_coins` are checked
   * against. A disagreement is what `v_coin_balance_drift` surfaces, and a
   * non-empty drift view is a Sev-1. See .claude/DATA-MODEL.md §8.3
   *
   * Summed in SQL, converted once here: `SUM` over a numeric returns a numeric,
   * which the driver hands back as a string. See .claude/ARCHITECTURE.md §9.1
   */
  async sumDeltas(
    coinTypeId: string,
    em?: EntityManager,
  ): Promise<{ coins: number; value: number }> {
    const qb = await this.qb(em);
    const raw = await qb
      .select("COALESCE(SUM(cle.coins_delta), 0)", "coins")
      .addSelect("COALESCE(SUM(cle.value_delta), 0)", "value")
      .where("cle.coinTypeId = :coinTypeId", { coinTypeId })
      .getRawOne<{ coins: string | number; value: string | number }>();

    return { coins: Number(raw?.coins ?? 0), value: Number(raw?.value ?? 0) };
  }

  /**
   * The four figures the reconciliation band is built from:
   *
   *   Opening 3,000 + In 640 − Out 1,200 = Balance 2,440 coins
   *
   * `OPENING` is excluded from `in` because the band states it separately —
   * counting it twice is exactly the arithmetic the band exists to disprove.
   * `net` is the independent re-sum that `coin_types.balance_coins` is checked
   * against; a disagreement is what the §13 drift banner surfaces.
   *
   * One query, every figure aggregated in SQL. Coins are integers, but the
   * counts still come back from the driver as strings, so they are converted
   * once, here. See MODULES/04-coins.md §7.1 and .claude/DATA-MODEL.md §8.3
   */
  async sumMovements(
    coinTypeId: string,
    em?: EntityManager,
  ): Promise<{
    openingCoins: number;
    inCoins: number;
    outCoins: number;
    netCoins: number;
    entryCount: number;
  }> {
    const qb = await this.qb(em);
    const raw = await qb
      .select(
        "COALESCE(SUM(cle.coins_delta) FILTER (WHERE cle.movement_type = 'OPENING'), 0)",
        "opening",
      )
      .addSelect(
        "COALESCE(SUM(cle.coins_delta) FILTER (WHERE cle.coins_delta > 0 AND cle.movement_type <> 'OPENING'), 0)",
        "coins_in",
      )
      // Negated inside the SUM so the column reads as a positive magnitude —
      // the direction is carried by which column it lands in, never by a sign.
      .addSelect(
        "COALESCE(SUM(-cle.coins_delta) FILTER (WHERE cle.coins_delta < 0), 0)",
        "coins_out",
      )
      .addSelect("COALESCE(SUM(cle.coins_delta), 0)", "net")
      .addSelect("COUNT(*)", "entries")
      .where("cle.coinTypeId = :coinTypeId", { coinTypeId })
      .getRawOne<{
        opening: string | number;
        coins_in: string | number;
        coins_out: string | number;
        net: string | number;
        entries: string | number;
      }>();

    return {
      openingCoins: Number(raw?.opening ?? 0),
      inCoins: Number(raw?.coins_in ?? 0),
      outCoins: Number(raw?.coins_out ?? 0),
      netCoins: Number(raw?.net ?? 0),
      entryCount: Number(raw?.entries ?? 0),
    };
  }

  /**
   * The coin reconciliation report, in one query per period.
   * design/MODULES/09-reports.md §7
   *
   *   opening + issued + returned + received + adjusted = closing
   *
   * and, separately, whether that computed closing equals the balance the
   * ledger itself was carrying at `to`. Those two agreeing is the whole point
   * of the report: the left-hand side re-sums the movements by DATE, the
   * right-hand side is the running balance each row was stamped with, in
   * `entry_seq` order, when it was written. A disagreement means one of two
   * things, and both are worth the owner's attention — the ledger's own
   * arithmetic broke, or an entry was written with a date that does not match
   * its position in the sequence.
   *
   * WHY OPENING IS A RE-SUM AND NOT A STAMPED BALANCE. The obvious shape is
   * "the `balance_after_coins` of the last entry before the window", and it is
   * wrong: `entry_seq` is insertion order while `entry_date` is a business
   * date, and a BACKDATED entry makes the two disagree. The stamped balance at
   * the window's left edge then includes movements the window is about to count
   * again, `opening + movements <> closing`, and the report's own table stops
   * adding up — which destroys the document before it has said anything about
   * the data. Summing `coins_delta` by date keeps the identity true by
   * construction on every window, and leaves the sequence-versus-date
   * disagreement to be surfaced by `difference`, where it belongs.
   *
   * MOVEMENT BUCKETS map one-to-one onto the report's columns. An `OPENING`
   * stock entry landing INSIDE the window is bucketed as an adjustment,
   * because from the window's point of view that is exactly what it is — stock
   * arriving that no issue or return explains. Bucketing it as "opening" would
   * break the identity above by counting it twice.
   *
   * `entry_seq` is the sort, never `entry_date` or `created_at`: the sequence
   * is the order the balances were computed in, so `balance_after_coins` only
   * reads correctly along it. `uq_ledger_seq` serves the DISTINCT ON directly.
   * See .claude/DATA-MODEL.md §5.14, §11
   *
   * Coin types with NO ledger entries at all are absent — the service drives
   * from the coin type list and fills them with zeros, so nobody disappears.
   */
  async reconcileBetween(
    from: string,
    to: string,
    coinTypeId?: string | null,
    em?: EntityManager,
  ): Promise<CoinReconciliationRow[]> {
    const repo = await this.repo(em);

    // Raw SQL: DISTINCT ON and the LEFT JOINs below have no query-builder
    // expression, and every value is a bound parameter. Same licence as the
    // insights repositories, and for the same reason.
    const rows = (await repo.query(
      `
      WITH bounds AS (
        SELECT $1::date AS d_from, $2::date AS d_to, $3::uuid AS only_type
      ),
      keys AS (
        SELECT DISTINCT cle.coin_type_id
          FROM coin_ledger_entries cle, bounds b
         WHERE b.only_type IS NULL OR cle.coin_type_id = b.only_type
      ),
      opening AS (
        SELECT cle.coin_type_id,
               COALESCE(SUM(cle.coins_delta), 0)::integer AS balance
          FROM coin_ledger_entries cle, bounds b
         WHERE cle.entry_date < b.d_from
           AND (b.only_type IS NULL OR cle.coin_type_id = b.only_type)
         GROUP BY cle.coin_type_id
      ),
      stamped AS (
        SELECT DISTINCT ON (cle.coin_type_id)
               cle.coin_type_id,
               cle.balance_after_coins AS balance
          FROM coin_ledger_entries cle, bounds b
         WHERE cle.entry_date <= b.d_to
           AND (b.only_type IS NULL OR cle.coin_type_id = b.only_type)
         ORDER BY cle.coin_type_id, cle.entry_seq DESC
      ),
      moved AS (
        SELECT cle.coin_type_id,
               COALESCE(SUM(cle.coins_delta) FILTER (WHERE cle.movement_type = 'ISSUE'), 0)::integer          AS issued,
               COALESCE(SUM(cle.coins_delta) FILTER (WHERE cle.movement_type = 'ISSUE_RETURN'), 0)::integer   AS returned,
               COALESCE(SUM(cle.coins_delta) FILTER (WHERE cle.movement_type = 'ORDER_RECEIPT'), 0)::integer  AS received,
               COALESCE(SUM(cle.coins_delta) FILTER (
                 WHERE cle.movement_type IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT','ISSUE_CANCELLED','OPENING')
               ), 0)::integer                                                                                AS adjusted,
               COALESCE(SUM(cle.value_delta), 0)::numeric(12,2)                                              AS value_delta,
               COUNT(*)::integer                                                                             AS entry_count,
               COUNT(*) FILTER (WHERE cle.movement_type IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT'))::integer      AS adjustment_count
          FROM coin_ledger_entries cle, bounds b
         WHERE cle.entry_date BETWEEN b.d_from AND b.d_to
           AND (b.only_type IS NULL OR cle.coin_type_id = b.only_type)
         GROUP BY cle.coin_type_id
      )
      SELECT k.coin_type_id,
             COALESCE(o.balance, 0)::integer        AS opening,
             COALESCE(m.issued, 0)::integer         AS issued,
             COALESCE(m.returned, 0)::integer       AS returned,
             COALESCE(m.received, 0)::integer       AS received,
             COALESCE(m.adjusted, 0)::integer       AS adjusted,
             (COALESCE(o.balance, 0) + COALESCE(m.issued, 0) + COALESCE(m.returned, 0)
                + COALESCE(m.received, 0) + COALESCE(m.adjusted, 0))::integer AS closing,
             COALESCE(c.balance, COALESCE(o.balance, 0))::integer AS ledger_balance,
             ((COALESCE(o.balance, 0) + COALESCE(m.issued, 0) + COALESCE(m.returned, 0)
                + COALESCE(m.received, 0) + COALESCE(m.adjusted, 0))
              - COALESCE(c.balance, COALESCE(o.balance, 0)))::integer AS difference,
             COALESCE(m.value_delta, 0)::numeric(12,2) AS value_delta,
             COALESCE(m.entry_count, 0)::integer       AS entry_count,
             COALESCE(m.adjustment_count, 0)::integer  AS adjustment_count
        FROM keys k
        LEFT JOIN opening o ON o.coin_type_id = k.coin_type_id
        LEFT JOIN stamped c ON c.coin_type_id = k.coin_type_id
        LEFT JOIN moved   m ON m.coin_type_id = k.coin_type_id
      `,
      [from, to, coinTypeId ?? null],
    )) as Array<{
      coin_type_id: string;
      opening: number;
      issued: number;
      returned: number;
      received: number;
      adjusted: number;
      closing: number;
      ledger_balance: number;
      difference: number;
      value_delta: string;
      entry_count: number;
      adjustment_count: number;
    }>;

    // Coin counts are integers; `value_delta` is numeric and arrives as a
    // string. Converted once, here at the boundary. ARCHITECTURE §9.1
    return rows.map((row) => ({
      coinTypeId: row.coin_type_id,
      opening: row.opening,
      issued: row.issued,
      returned: row.returned,
      received: row.received,
      adjusted: row.adjusted,
      closing: row.closing,
      ledgerBalance: row.ledger_balance,
      difference: row.difference,
      valueDelta: Number(row.value_delta),
      entryCount: row.entry_count,
      adjustmentCount: row.adjustment_count,
    }));
  }

  /* ── Append-only guards ───────────────────────────────────────────────────
   *
   * Declared with NO parameters on purpose: a caller attempting an update or a
   * delete fails to COMPILE rather than discovering the trigger in production.
   * Inserts still go through the inherited `create`.
   */

  override async updateById(): Promise<void> {
    throw new Error(
      "coin_ledger_entries is append-only — insert a reversing entry instead.",
    );
  }

  override async softDeleteById(): Promise<void> {
    throw new Error(
      "coin_ledger_entries is append-only — it has no deleted_at column.",
    );
  }

  override async restoreById(): Promise<void> {
    throw new Error(
      "coin_ledger_entries is append-only — nothing is ever deleted.",
    );
  }
}

export const coinLedgerEntryRepository = new CoinLedgerEntryRepository();
