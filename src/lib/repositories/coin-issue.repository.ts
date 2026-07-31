import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { CoinIssue } from "@/lib/db/entities";
import type { CoinIssueStatus } from "@/lib/db/entities/enums";
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
      search,
      staffId,
      dateFrom,
      dateTo,
      status,
      coinTypeId,
      outstandingOnly,
      page = 1,
      pageSize = 25,
      sortBy = "issueDate",
      sortDir = "DESC",
    } = params;

    const qb = await this.qb(em);
    // Joined, not queried: the register displays the staff member and searches
    // his name and phone. Staff CRUD still belongs to StaffRepository.
    qb.leftJoinAndSelect("ci.staff", "s").where("ci.deletedAt IS NULL");

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
    if (outstandingOnly) qb.andWhere("ci.outstandingAmount <> 0");

    if (coinTypeId) {
      // EXISTS rather than a join: a join would multiply header rows by their
      // lines and quietly break the page size.
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM coin_issue_items cii
           WHERE cii.coin_issue_id = ci.id
             AND cii.coin_type_id = :coinTypeId
             AND cii.deleted_at IS NULL
         )`,
        { coinTypeId },
      );
    }

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

  /** The detail screen: header, staff, lines and each line's coin type. */
  async findByIdWithItems(
    id: string,
    em?: EntityManager,
  ): Promise<CoinIssue | null> {
    const qb = await this.qb(em);
    return qb
      .leftJoinAndSelect("ci.staff", "s")
      // The soft-delete filter belongs in the JOIN condition, not the WHERE —
      // in the WHERE it silently turns the left join into an inner one and an
      // issue whose lines were all removed vanishes from its own detail page.
      .leftJoinAndSelect("ci.items", "item", "item.deletedAt IS NULL")
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
