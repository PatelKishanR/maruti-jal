import "server-only";
import type {
  EntityManager,
  EntityTarget,
  SelectQueryBuilder,
} from "typeorm";
import { BaseRepository } from "./base.repository";
import { CoinIssue } from "@/lib/db/entities";
import type { CoinIssueStatus, PaymentStatus } from "@/lib/db/entities/enums";
import {
  COIN_ISSUE_SORT_COLUMNS,
  type CoinIssueSortKey,
} from "@/lib/table/configs/coin-issue";

/**
 * The sort allowlist is imported, never re-declared — one map, shared by the
 * table config and this ORDER BY. The config is client-safe (zod and types
 * only), so this import couples nothing.
 * See .claude/MODULE-RECIPE.md §1 and .claude/ARCHITECTURE.md §6.2
 */
export type { CoinIssueSortKey };

export interface CoinIssueSearchParams {
  /** Free text over issue code, staff name and staff phone. */
  search?: string;
  staffId?: string;
  /** Inclusive, 'YYYY-MM-DD'. See .claude/ARCHITECTURE.md §9.2 */
  dateFrom?: string;
  dateTo?: string;
  status?: CoinIssueStatus[];
  /**
   * The register's money filter — `pending` → UNPAID, `partial` → PARTIAL,
   * `settled` → PAID, `refund due` → REFUND_DUE / OVERPAID.
   *
   * A trigger maintains this column from `outstanding_amount`, so filtering on
   * it is an indexed equality rather than an expression over three columns.
   */
  paymentStatus?: PaymentStatus[];
  /** Issues containing at least one line of this coin type. */
  coinTypeId?: string;
  /** The register's headline filter: anything not fully settled. */
  outstandingOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: CoinIssueSortKey;
  sortDir?: "ASC" | "DESC";
}

/**
 * Every query that touches `coin_issues` lives here and nowhere else.
 *
 * `findByIdForUpdate(id, em)` is inherited from BaseRepository. Lock order in
 * this module is child → parent: coin type rows, then the issue header. Never
 * the reverse, or the coin triggers and this code deadlock intermittently.
 * See .claude/ARCHITECTURE.md §4.3
 */
class CoinIssueRepository extends BaseRepository<CoinIssue> {
  protected readonly target: EntityTarget<CoinIssue> = CoinIssue;
  protected readonly alias = "ci";

  /**
   * ONE predicate set, shared by the page query and the KPI aggregate.
   *
   * Written once because the alternative is a strip that disagrees with the
   * table beneath it — the single most corrosive bug a register can have, and
   * one nobody reports because both numbers look plausible.
   *
   * Every caller must have already joined `ci.staff` as `s`; the free-text
   * search reaches the staff member's name and phone.
   */
  private applyFilters(
    qb: SelectQueryBuilder<CoinIssue>,
    params: CoinIssueSearchParams,
  ): void {
    const {
      search,
      staffId,
      dateFrom,
      dateTo,
      status,
      paymentStatus,
      coinTypeId,
      outstandingOnly,
    } = params;

    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      qb.andWhere(
        "(ci.code ILIKE :q OR s.name ILIKE :q OR s.phone ILIKE :q)",
        { q },
      );
    }
    if (staffId) qb.andWhere("ci.staffId = :staffId", { staffId });
    if (dateFrom) qb.andWhere("ci.issueDate >= :dateFrom", { dateFrom });
    if (dateTo) qb.andWhere("ci.issueDate <= :dateTo", { dateTo });
    if (status?.length) qb.andWhere("ci.status IN (:...status)", { status });
    if (paymentStatus?.length) {
      qb.andWhere("ci.paymentStatus IN (:...paymentStatus)", { paymentStatus });
    }
    if (outstandingOnly) qb.andWhere("ci.outstandingAmount <> 0");

    if (coinTypeId) {
      // EXISTS rather than a join: a join would multiply header rows by their
      // lines and quietly break the page size.
      //
      // No `deleted_at` predicate: `coin_issue_items` extends LineItemBase and
      // has NO soft-delete column — lines cascade with their header. Filtering
      // on a column that does not exist is a Postgres error, not a no-op.
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM coin_issue_items cii
           WHERE cii.coin_issue_id = ci.id
             AND cii.coin_type_id = :coinTypeId
         )`,
        { coinTypeId },
      );
    }
  }

  /**
   * The register list — issued · returned · collected · pending, one row each.
   *
   * Every filterable number is a cached column on `coin_issues`, so this stays
   * an indexed range scan instead of re-aggregating items, returns and payments
   * for rows it is about to discard. See .claude/DATA-MODEL.md §8.1
   */
  async searchPaginated(
    params: CoinIssueSearchParams = {},
    em?: EntityManager,
  ): Promise<{ rows: CoinIssue[]; total: number }> {
    const {
      page = 1,
      pageSize = 25,
      sortBy = "issueDate",
      sortDir = "DESC",
    } = params;

    const qb = await this.qb(em);
    // Joined, not queried: the register displays the staff member and searches
    // his name and phone. Staff CRUD still belongs to StaffRepository.
    qb.leftJoinAndSelect("ci.staff", "s").where("ci.deletedAt IS NULL");
    this.applyFilters(qb, params);

    const [rows, total] = await qb
      .orderBy(
        COIN_ISSUE_SORT_COLUMNS[sortBy] ?? COIN_ISSUE_SORT_COLUMNS.issueDate,
        sortDir,
      )
      // Stable tiebreaker — without one, equal dates shuffle between pages.
      .addOrderBy("ci.issueNo", "DESC")
      // skip/take, never offset/limit: with a joined relation, LIMIT limits
      // JOINED ROWS. See .claude/ARCHITECTURE.md §6.3
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { rows, total };
  }

  /**
   * The §6.2 KPI strip, over the SAME filter set as `searchPaginated` minus
   * the pagination.
   *
   * Every figure is aggregated in SQL. A `reduce((a, b) => a + b)` here would
   * be both wrong — it only ever sees 25 rows — and a code-review failure:
   * money never adds up in TypeScript. `SUM` over a numeric returns a numeric,
   * which the driver hands back as a string, so the conversion happens exactly
   * once, at this boundary. See .claude/ARCHITECTURE.md §9.1
   *
   * `pending` and `refundsDue` are deliberately NOT netted against each other.
   * "₹8,450 to collect" and "₹1,700 to hand back" are two different jobs on two
   * different days, and a single net figure answers neither.
   */
  async summary(
    params: CoinIssueSearchParams = {},
    em?: EntityManager,
  ): Promise<{
    openIssues: number;
    totalIssues: number;
    coinsOutWithStaff: number;
    staffWithCoins: number;
    pendingAmount: number;
    refundsDueAmount: number;
    netOutstanding: number;
    staffWithRefunds: number;
  }> {
    const qb = await this.qb(em);
    qb.leftJoin("ci.staff", "s").where("ci.deletedAt IS NULL");
    this.applyFilters(qb, params);

    const raw = await qb
      .select("COUNT(*) FILTER (WHERE ci.outstanding_amount <> 0)", "open_issues")
      .addSelect("COUNT(*)", "total_issues")
      // A cancelled issue's coins went back into stock, so they are not out
      // with anyone — counting them would overstate the float on the road.
      .addSelect(
        "COALESCE(SUM(ci.coins_outstanding) FILTER (WHERE ci.status <> 'CANCELLED'), 0)",
        "coins_out",
      )
      .addSelect(
        "COUNT(DISTINCT ci.staff_id) FILTER (WHERE ci.coins_outstanding > 0 AND ci.status <> 'CANCELLED')",
        "staff_with_coins",
      )
      .addSelect(
        "COALESCE(SUM(ci.outstanding_amount) FILTER (WHERE ci.outstanding_amount > 0), 0)",
        "pending",
      )
      // Negated inside the SUM so the card reads as a positive magnitude — the
      // direction is carried by which card it lands on, never by a sign.
      .addSelect(
        "COALESCE(SUM(-ci.outstanding_amount) FILTER (WHERE ci.outstanding_amount < 0), 0)",
        "refunds_due",
      )
      // The SIGNED net, for the create form's "Ramesh currently owes …" line.
      // Summed in SQL rather than subtracting the two figures above: those are
      // display magnitudes, and deriving a third number from them in TypeScript
      // is how the two stop agreeing.
      .addSelect("COALESCE(SUM(ci.outstanding_amount), 0)", "net_outstanding")
      .addSelect(
        "COUNT(DISTINCT ci.staff_id) FILTER (WHERE ci.outstanding_amount < 0)",
        "staff_with_refunds",
      )
      .getRawOne<Record<string, string | number>>();

    const num = (key: string) => Number(raw?.[key] ?? 0);

    return {
      openIssues: num("open_issues"),
      totalIssues: num("total_issues"),
      coinsOutWithStaff: num("coins_out"),
      staffWithCoins: num("staff_with_coins"),
      pendingAmount: num("pending"),
      refundsDueAmount: num("refunds_due"),
      netOutstanding: num("net_outstanding"),
      staffWithRefunds: num("staff_with_refunds"),
    };
  }

  /** The detail screen: header, staff, lines and each line's coin type. */
  async findByIdWithItems(
    id: string,
    em?: EntityManager,
  ): Promise<CoinIssue | null> {
    const qb = await this.qb(em);
    return qb
      .leftJoinAndSelect("ci.staff", "s")
      // No soft-delete condition on the lines: `coin_issue_items` extends
      // LineItemBase, which deliberately has NO `deleted_at` — a line has no
      // life without its header and cascades with it. See DATA-MODEL §4.
      .leftJoinAndSelect("ci.items", "item")
      .leftJoinAndSelect("item.coinType", "ct")
      .where("ci.id = :id", { id })
      .andWhere("ci.deletedAt IS NULL")
      .orderBy("item.createdAt", "ASC")
      .getOne();
  }

  /**
   * Open handovers for one staff member — what the return dialog lists, and the
   * basis of "coins still out with him".
   */
  async findOpenByStaff(
    staffId: string,
    em?: EntityManager,
  ): Promise<CoinIssue[]> {
    const qb = await this.qb(em);
    return qb
      .where("ci.staffId = :staffId", { staffId })
      .andWhere("ci.status = 'OPEN'")
      .andWhere("ci.deletedAt IS NULL")
      .orderBy("ci.issueDate", "DESC")
      .addOrderBy("ci.issueNo", "DESC")
      .getMany();
  }
}

export const coinIssueRepository = new CoinIssueRepository();
