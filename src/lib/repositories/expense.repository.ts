import "server-only";
import type {
  EntityManager,
  EntityTarget,
  SelectQueryBuilder,
} from "typeorm";
import { BaseRepository } from "./base.repository";
import { Expense } from "@/lib/db/entities";
import type { ExpensePaymentMode } from "@/lib/db/entities";
import {
  EXPENSE_SORT_COLUMNS,
  type ExpenseSortColumnKey,
} from "@/lib/table/configs/expense";

/**
 * The sort allowlist is imported, never re-declared — one map, shared by the
 * table config and this ORDER BY. The config is client-safe (zod and types
 * only), so this import couples nothing.
 * See .claude/MODULE-RECIPE.md §1 and .claude/ARCHITECTURE.md §6.2
 */
export type { ExpenseSortColumnKey };

export interface ExpenseSearchQuery {
  search?: string;
  categoryId?: string;
  staffId?: string;
  paymentMode?: ExpensePaymentMode;
  /** Inclusive 'YYYY-MM-DD' bounds. */
  fromDate?: string;
  toDate?: string;
  /** Inclusive rupee bounds. Strings, so `numeric` comparison stays exact. */
  minAmount?: string;
  maxAmount?: string;
  /** `true` → only rows with a receipt, `false` → only rows without. */
  hasAttachment?: boolean;
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
 * The sum methods return numbers because SUM over `numeric` comes back as a
 * STRING from the driver (the global type parser keeps it exact rather than
 * letting it become a lossy float). Converting once, here at the boundary, is
 * the only place a monetary value may become a JS number — and it is a total
 * computed by PostgreSQL, never by a `reduce` in TypeScript.
 * See .claude/ARCHITECTURE.md §9.1
 *
 * Nothing here joins `expense_categories`, `staff`, or any order table. A
 * repository queries its own table only; the service calls the second
 * repository and zips the results. See .claude/ARCHITECTURE.md §4.1 rule 4
 */
class ExpenseRepository extends BaseRepository<Expense> {
  protected readonly target: EntityTarget<Expense> = Expense;
  protected readonly alias = "e";

  /**
   * Every predicate the list, the foot-row total and the KPI strip share.
   *
   * Written once so the total under the table can never disagree with the rows
   * above it — the classic version of this bug is a filtered list showing an
   * unfiltered sum, which quietly makes the owner distrust every figure.
   */
  private applyFilters(
    qb: SelectQueryBuilder<Expense>,
    query: ExpenseSearchQuery,
  ): SelectQueryBuilder<Expense> {
    qb.where("e.deletedAt IS NULL");

    if (query.categoryId) {
      qb.andWhere("e.categoryId = :categoryId", {
        categoryId: query.categoryId,
      });
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
    // Bound as text and cast in SQL, so the comparison happens in `numeric`
    // rather than in float — `4850.10` must not become `4850.099999`.
    if (query.minAmount !== undefined) {
      qb.andWhere("e.amount >= CAST(:minAmount AS numeric)", {
        minAmount: query.minAmount,
      });
    }
    if (query.maxAmount !== undefined) {
      qb.andWhere("e.amount <= CAST(:maxAmount AS numeric)", {
        maxAmount: query.maxAmount,
      });
    }
    if (query.hasAttachment !== undefined) {
      qb.andWhere(
        query.hasAttachment
          ? "e.attachmentUrl IS NOT NULL"
          : "e.attachmentUrl IS NULL",
      );
    }

    const term = query.search?.trim();
    if (term) {
      qb.andWhere("(e.searchBlob ILIKE :term OR e.code ILIKE :term)", {
        term: `%${escapeLike(term)}%`,
      });
    }

    return qb;
  }

  /** `skip`/`take`, never `offset`/`limit` — see .claude/ARCHITECTURE.md §6.3 */
  async searchPaginated(
    query: ExpenseSearchQuery,
    em?: EntityManager,
  ): Promise<[Expense[], number]> {
    const qb = this.applyFilters(await this.qb(em), query);

    const column =
      EXPENSE_SORT_COLUMNS[query.sort as ExpenseSortColumnKey] ??
      EXPENSE_SORT_COLUMNS.expenseDate;
    qb.orderBy(column, query.dir === "ASC" ? "ASC" : "DESC");
    // Stable tiebreaker: many expenses share a date, and without this they
    // shuffle between pages — the owner sees one row twice and never sees
    // another. The identity column doubles as "newest recorded first".
    qb.addOrderBy("e.expenseNo", "DESC");

    qb.skip(query.skip ?? 0).take(query.take ?? 20);

    return qb.getManyAndCount();
  }

  /**
   * The foot row under the table: the total of exactly what is on screen.
   *
   * Same predicates as `searchPaginated`, minus paging — so it totals the whole
   * filtered set, not the current page. Both figures come from PostgreSQL.
   */
  async sumFiltered(
    query: ExpenseSearchQuery,
    em?: EntityManager,
  ): Promise<{ total: number; count: number }> {
    const qb = this.applyFilters(await this.qb(em), query);

    const row = await qb
      .select("COALESCE(SUM(e.amount), 0)", "total")
      .addSelect("COUNT(*)", "count")
      .getRawOne<{ total: string; count: string }>();

    // Raw queries bypass the money transformer, and numeric arrives as a
    // string. Convert explicitly, exactly once.
    return { total: Number(row?.total ?? 0), count: Number(row?.count ?? 0) };
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

    return Number(row?.total ?? 0);
  }

  /**
   * This month against last month, in ONE query, with the difference computed
   * by PostgreSQL.
   *
   * The delta could obviously be subtracted in TypeScript. It isn't, for the
   * same reason nothing else here is: the moment one monetary figure is derived
   * in JavaScript, the next one is too, and the rule stops being enforceable.
   * `FILTER (WHERE …)` gives both periods and their difference from a single
   * index scan over the two-month window.
   */
  async monthComparison(
    current: { from: string; to: string },
    previous: { from: string; to: string },
    em?: EntityManager,
  ): Promise<{
    current: number;
    currentCount: number;
    previous: number;
    delta: number;
  }> {
    const qb = await this.qb(em);
    const params = {
      cf: current.from,
      ct: current.to,
      pf: previous.from,
      pt: previous.to,
    };

    const row = await qb
      .select(
        "COALESCE(SUM(e.amount) FILTER (WHERE e.expenseDate BETWEEN :cf AND :ct), 0)",
        "current",
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE e.expenseDate BETWEEN :cf AND :ct)",
        "currentCount",
      )
      .addSelect(
        "COALESCE(SUM(e.amount) FILTER (WHERE e.expenseDate BETWEEN :pf AND :pt), 0)",
        "previous",
      )
      .addSelect(
        "COALESCE(SUM(e.amount) FILTER (WHERE e.expenseDate BETWEEN :cf AND :ct), 0) " +
          "- COALESCE(SUM(e.amount) FILTER (WHERE e.expenseDate BETWEEN :pf AND :pt), 0)",
        "delta",
      )
      .where("e.deletedAt IS NULL")
      // One scan over both windows. `previous.from` is the earlier bound and
      // `current.to` the later one for any pair the service builds.
      .andWhere("e.expenseDate BETWEEN :pf AND :ct")
      .setParameters(params)
      .getRawOne<{
        current: string;
        currentCount: string;
        previous: string;
        delta: string;
      }>();

    return {
      current: Number(row?.current ?? 0),
      currentCount: Number(row?.currentCount ?? 0),
      previous: Number(row?.previous ?? 0),
      delta: Number(row?.delta ?? 0),
    };
  }

  /**
   * Spend broken down by category — the biggest-category KPI in one query.
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
   *
   * Soft-deleted expenses are counted DELIBERATELY: a restored expense must not
   * come back pointing at a category that was switched off while it was gone.
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

  /**
   * Including soft-deleted rows.
   *
   * The detail page has to render a deleted expense — grey banner, `Restore`
   * button — so it cannot use the default scope, which hides them.
   */
  async findByIdWithDeleted(
    id: string,
    em?: EntityManager,
  ): Promise<Expense | null> {
    const qb = await this.qb(em);
    return qb.withDeleted().where("e.id = :id", { id }).getOne();
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
