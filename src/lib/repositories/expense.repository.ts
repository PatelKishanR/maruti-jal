import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { Expense } from "@/lib/db/entities";
import type { ExpensePaymentMode } from "@/lib/db/entities";

/**
 * Public sort key → hard-coded SQL. User input is only a lookup key into this
 * map. See .claude/ARCHITECTURE.md §6.2
 */
const SORT_COLUMNS = {
  expenseDate: "e.expenseDate",
  /** The identity number, not the text code — 'EXP-9' must precede 'EXP-10'. */
  code: "e.expenseNo",
  amount: "e.amount",
  paidTo: "e.paidTo",
  createdAt: "e.createdAt",
} as const;

export type ExpenseSortKey = keyof typeof SORT_COLUMNS;

export interface ExpenseSearchQuery {
  search?: string;
  categoryId?: string;
  staffId?: string;
  paymentMode?: ExpensePaymentMode;
  /** Inclusive 'YYYY-MM-DD' bounds. */
  fromDate?: string;
  toDate?: string;
  sort?: string;
  dir?: "ASC" | "DESC";
  skip?: number;
  take?: number;
}

/** ILIKE treats % and _ as wildcards; escape them or "50%" matches everything. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Every query that touches the `expenses` table lives here and nowhere else.
 *
 * The two sum methods return numbers because SUM over `numeric` comes back as
 * a STRING from the driver (the global type parser keeps it exact rather than
 * letting it become a lossy float). Converting once, here at the boundary, is
 * the only place a monetary value may become a JS number — and it is a total
 * computed by PostgreSQL, never by a `reduce` in TypeScript.
 * See .claude/ARCHITECTURE.md §9.1
 */
class ExpenseRepository extends BaseRepository<Expense> {
  protected readonly target: EntityTarget<Expense> = Expense;
  protected readonly alias = "e";

  /** `skip`/`take`, never `offset`/`limit` — see .claude/ARCHITECTURE.md §6.3 */
  async searchPaginated(
    query: ExpenseSearchQuery,
    em?: EntityManager,
  ): Promise<[Expense[], number]> {
    const qb = await this.qb(em);
    qb.where("e.deletedAt IS NULL");

    if (query.categoryId) {
      qb.andWhere("e.categoryId = :categoryId", { categoryId: query.categoryId });
    }
    if (query.staffId) {
      qb.andWhere("e.staffId = :staffId", { staffId: query.staffId });
    }
    if (query.paymentMode) {
      qb.andWhere("e.paymentMode = :paymentMode", {
        paymentMode: query.paymentMode,
      });
    }
    if (query.fromDate) {
      qb.andWhere("e.expenseDate >= :fromDate", { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere("e.expenseDate <= :toDate", { toDate: query.toDate });
    }

    const term = query.search?.trim();
    if (term) {
      qb.andWhere("(e.searchBlob ILIKE :term OR e.code ILIKE :term)", {
        term: `%${escapeLike(term)}%`,
      });
    }

    const column =
      SORT_COLUMNS[query.sort as ExpenseSortKey] ?? SORT_COLUMNS.expenseDate;
    qb.orderBy(column, query.dir === "ASC" ? "ASC" : "DESC");
    // Stable tiebreaker: many expenses share a date, and without this they
    // shuffle between pages.
    qb.addOrderBy("e.expenseNo", "DESC");

    qb.skip(query.skip ?? 0).take(query.take ?? 20);

    return qb.getManyAndCount();
  }

  /**
   * Total spend over an inclusive date range. The sum is computed by
   * PostgreSQL — a `reduce` over amounts in TypeScript is a code-review
   * failure. See .claude/DATA-MODEL.md D-4
   */
  async sumBetween(
    fromDate: string,
    toDate: string,
    em?: EntityManager,
  ): Promise<number> {
    const qb = await this.qb(em);
    const row = await qb
      .select("COALESCE(SUM(e.amount), 0)", "total")
      .where("e.deletedAt IS NULL")
      .andWhere("e.expenseDate BETWEEN :fromDate AND :toDate", {
        fromDate,
        toDate,
      })
      .getRawOne<{ total: string }>();

    // Raw queries bypass the money transformer, and numeric arrives as a
    // string. Convert explicitly, exactly once.
    return Number(row?.total ?? 0);
  }

  /**
   * Spend broken down by category — the expense pie chart in one query.
   *
   * Returns category IDs, not names: joining `expense_categories` would make
   * this repository query another entity's table. The service calls
   * ExpenseCategoryRepository and zips the two together.
   * See .claude/ARCHITECTURE.md §4.1 rule 4
   */
  async sumByCategoryBetween(
    fromDate: string,
    toDate: string,
    em?: EntityManager,
  ): Promise<Array<{ categoryId: string; total: number; count: number }>> {
    const qb = await this.qb(em);
    const rows = await qb
      .select("e.categoryId", "categoryId")
      .addSelect("COALESCE(SUM(e.amount), 0)", "total")
      .addSelect("COUNT(*)", "count")
      .where("e.deletedAt IS NULL")
      .andWhere("e.expenseDate BETWEEN :fromDate AND :toDate", {
        fromDate,
        toDate,
      })
      .groupBy("e.categoryId")
      .orderBy("total", "DESC")
      .getRawMany<{ categoryId: string; total: string; count: string }>();

    return rows.map((r) => ({
      categoryId: r.categoryId,
      total: Number(r.total),
      count: Number(r.count),
    }));
  }

  /**
   * Does anything still reference this category? The FK is ON DELETE RESTRICT,
   * so the database would refuse anyway — this exists so the UI can say why
   * instead of surfacing a constraint violation.
   */
  async countByCategory(
    categoryId: string,
    em?: EntityManager,
  ): Promise<number> {
    const qb = await this.qb(em);
    return qb
      .where("e.categoryId = :categoryId", { categoryId })
      .andWhere("e.deletedAt IS NULL")
      .getCount();
  }

  async findByCode(code: string, em?: EntityManager): Promise<Expense | null> {
    const qb = await this.qb(em);
    return qb
      .where("e.code = :code", { code })
      .andWhere("e.deletedAt IS NULL")
      .getOne();
  }
}

export const expenseRepository = new ExpenseRepository();
