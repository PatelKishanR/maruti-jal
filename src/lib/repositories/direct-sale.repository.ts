import "server-only";
import type {
  EntityManager,
  EntityTarget,
  SelectQueryBuilder,
} from "typeorm";
import { BaseRepository } from "./base.repository";
import { DirectSale } from "@/lib/db/entities";
import {
  DIRECT_SALE_SORT_COLUMNS,
  type DirectSaleSortKey,
} from "@/lib/table/configs/direct-sale";

/**
 * The sort allowlist is imported, never re-declared — one map, shared by the
 * table config and this ORDER BY. The config is client-safe (zod and types
 * only), so this import couples nothing.
 * See .claude/MODULE-RECIPE.md §1 and .claude/ARCHITECTURE.md §6.2
 */
export type { DirectSaleSortKey };

export interface DirectSaleSearchQuery {
  search?: string;
  productId?: string;
  /** Omitted → live sales only. Voided rows are kept but hidden by default. */
  includeVoided?: boolean;
  /** Inclusive 'YYYY-MM-DD' bounds. */
  fromDate?: string;
  toDate?: string;
  /** Inclusive rupee bounds — the filter popover's `Amount range`. */
  minAmount?: number;
  maxAmount?: number;
  sort?: string;
  dir?: "ASC" | "DESC";
  skip?: number;
  take?: number;
}

/** One day-group band: the cash-drawer tally for a single business date. */
export interface DirectSaleDayTotal {
  date: string;
  count: number;
  voidedCount: number;
  total: number;
}

/** A KPI window — today, yesterday, the month so far. */
export interface DirectSalePeriodTotal {
  count: number;
  total: number;
  average: number;
}

/**
 * How a walk-in is recognised as a returning one.
 *
 * There is no customer master (MODULES/06-direct-sales.md §7), so a customer is
 * a phone number when there is one and an exact name when there isn't. Matching
 * loosely on the name of a customer who HAS a phone would merge two people who
 * share a name, which is the failure this module can least afford — it puts one
 * person's address on another's sale.
 */
export interface DirectSaleCustomerKey {
  phone: string | null;
  customerName: string;
}

/** `{ value, count }` — grouped counts keyed by phone or by name. */
export interface DirectSaleVisitCount {
  value: string;
  count: number;
}

/** ILIKE treats % and _ as wildcards; escape them or "50%" matches everything. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * The one definition of "the same customer", applied to every query that asks
 * the question. Phone when there is one, exact name otherwise — written once so
 * the count on the row, the list on the detail page and its total can never
 * disagree about who the customer is.
 */
function applyCustomerKey(
  qb: SelectQueryBuilder<DirectSale>,
  key: DirectSaleCustomerKey,
): void {
  if (key.phone) {
    qb.andWhere("ds.phone = :customerPhone", { customerPhone: key.phone });
    return;
  }
  qb.andWhere("ds.phone IS NULL").andWhere("ds.customerName = :customerName", {
    customerName: key.customerName,
  });
}

/**
 * Every query that touches the `direct_sales` table lives here and nowhere
 * else.
 *
 * There is no payment join to make: a direct sale is cash-settled at the
 * counter by construction, so the amount on the row IS the collection.
 * See .claude/DATA-MODEL.md §5.18
 */
class DirectSaleRepository extends BaseRepository<DirectSale> {
  protected readonly target: EntityTarget<DirectSale> = DirectSale;
  protected readonly alias = "ds";

  /** `skip`/`take`, never `offset`/`limit` — see .claude/ARCHITECTURE.md §6.3 */
  async searchPaginated(
    query: DirectSaleSearchQuery,
    em?: EntityManager,
  ): Promise<[DirectSale[], number]> {
    const qb = await this.qb(em);
    qb.where("ds.deletedAt IS NULL");

    if (!query.includeVoided) {
      qb.andWhere("ds.isVoided = false");
    }
    if (query.productId) {
      qb.andWhere("ds.productId = :productId", { productId: query.productId });
    }
    if (query.fromDate) {
      qb.andWhere("ds.saleDate >= :fromDate", { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere("ds.saleDate <= :toDate", { toDate: query.toDate });
    }
    if (query.minAmount !== undefined) {
      qb.andWhere("ds.amount >= :minAmount", { minAmount: query.minAmount });
    }
    if (query.maxAmount !== undefined) {
      qb.andWhere("ds.amount <= :maxAmount", { maxAmount: query.maxAmount });
    }

    const term = query.search?.trim();
    if (term) {
      qb.andWhere("(ds.searchBlob ILIKE :term OR ds.code ILIKE :term)", {
        term: `%${escapeLike(term)}%`,
      });
    }

    const column =
      DIRECT_SALE_SORT_COLUMNS[query.sort as DirectSaleSortKey] ??
      DIRECT_SALE_SORT_COLUMNS.saleDate;
    qb.orderBy(column, query.dir === "ASC" ? "ASC" : "DESC");
    // Stable tiebreaker — a busy day produces dozens of rows on one date.
    qb.addOrderBy("ds.saleNo", "DESC");

    qb.skip(query.skip ?? 0).take(query.take ?? 20);

    return qb.getManyAndCount();
  }

  /**
   * The counter total for one business day — the number the owner reconciles
   * the cash box against at closing.
   *
   * Voided rows are excluded: they stay in the register so the receipt
   * numbering is provably untampered, but they were never collected.
   *
   * The sum is computed by PostgreSQL. Adding money in TypeScript reintroduces
   * float error. See .claude/DATA-MODEL.md D-4
   */
  async sumForDate(
    saleDate: string,
    em?: EntityManager,
  ): Promise<{ total: number; count: number }> {
    const qb = await this.qb(em);
    const row = await qb
      .select("COALESCE(SUM(ds.amount), 0)", "total")
      .addSelect("COUNT(*)", "count")
      .where("ds.deletedAt IS NULL")
      .andWhere("ds.isVoided = false")
      .andWhere("ds.saleDate = :saleDate", { saleDate })
      .getRawOne<{ total: string; count: string }>();

    // Raw queries bypass the money transformer and numeric arrives as a string.
    // Convert explicitly, exactly once. See .claude/ARCHITECTURE.md §9.1
    return { total: Number(row?.total ?? 0), count: Number(row?.count ?? 0) };
  }

  /** Same rules as sumForDate, over an inclusive range — the sales report. */
  async sumBetween(
    fromDate: string,
    toDate: string,
    em?: EntityManager,
  ): Promise<number> {
    const qb = await this.qb(em);
    const row = await qb
      .select("COALESCE(SUM(ds.amount), 0)", "total")
      .where("ds.deletedAt IS NULL")
      .andWhere("ds.isVoided = false")
      .andWhere("ds.saleDate BETWEEN :fromDate AND :toDate", {
        fromDate,
        toDate,
      })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  /**
   * Every day-group band on one page, in ONE query.
   *
   * The band is the cash-drawer tally, so it carries the whole day's figure —
   * not the slice of that day visible on this page. A total that changed when
   * you turned the page would be worse than no total at all.
   *
   * `FILTER (WHERE …)` rather than two queries: voided rows are excluded from
   * the money and the count, and counted separately for the `· 1 voided`
   * suffix, in a single pass. See design/MODULES/06-direct-sales.md §3.3
   */
  async summariseDays(
    dates: string[],
    em?: EntityManager,
  ): Promise<DirectSaleDayTotal[]> {
    if (dates.length === 0) return [];

    const qb = await this.qb(em);
    const rows = await qb
      .select("ds.saleDate", "date")
      .addSelect("COUNT(*) FILTER (WHERE ds.is_voided = false)", "count")
      .addSelect("COUNT(*) FILTER (WHERE ds.is_voided)", "voidedCount")
      .addSelect(
        "COALESCE(SUM(ds.amount) FILTER (WHERE ds.is_voided = false), 0)",
        "total",
      )
      .where("ds.deletedAt IS NULL")
      .andWhere("ds.saleDate IN (:...dates)", { dates })
      .groupBy("ds.saleDate")
      .getRawMany<{
        date: string;
        count: string;
        voidedCount: string;
        total: string;
      }>();

    return rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
      voidedCount: Number(row.voidedCount),
      total: Number(row.total),
    }));
  }

  /**
   * Count, total and average over an inclusive range — one KPI card's worth.
   *
   * `AVG` is PostgreSQL's, not a division in TypeScript: the average of a
   * numeric column is exact where `total / count` in floating point is not.
   */
  async summariseBetween(
    fromDate: string,
    toDate: string,
    em?: EntityManager,
  ): Promise<DirectSalePeriodTotal> {
    const qb = await this.qb(em);
    const row = await qb
      .select("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(ds.amount), 0)", "total")
      .addSelect("COALESCE(AVG(ds.amount), 0)", "average")
      .where("ds.deletedAt IS NULL")
      .andWhere("ds.isVoided = false")
      .andWhere("ds.saleDate BETWEEN :fromDate AND :toDate", {
        fromDate,
        toDate,
      })
      .getRawOne<{ count: string; total: string; average: string }>();

    return {
      count: Number(row?.count ?? 0),
      total: Number(row?.total ?? 0),
      average: Number(row?.average ?? 0),
    };
  }

  /**
   * The day total with one sale left out — what the drawer holds once this one
   * is voided.
   *
   * Computed rather than subtracted, so the void dialog's
   * `drops from ₹1,840.00 to ₹1,720.00` never shows a figure produced by
   * arithmetic on two floats. See .claude/ARCHITECTURE.md §9.1
   */
  async sumForDateExcluding(
    saleDate: string,
    excludeId: string,
    em?: EntityManager,
  ): Promise<number> {
    const qb = await this.qb(em);
    const row = await qb
      .select("COALESCE(SUM(ds.amount), 0)", "total")
      .where("ds.deletedAt IS NULL")
      .andWhere("ds.isVoided = false")
      .andWhere("ds.saleDate = :saleDate", { saleDate })
      .andWhere("ds.id != :excludeId", { excludeId })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  /**
   * `4th visit` for a whole page of rows, in one grouped query per key kind.
   *
   * Voided sales do not count as visits — the customer may well have been in,
   * but the record says the sale did not happen, and a badge that contradicts
   * the register is worse than no badge.
   */
  async countVisitsByPhone(
    phones: string[],
    em?: EntityManager,
  ): Promise<DirectSaleVisitCount[]> {
    return this.countVisits("ds.phone", phones, em);
  }

  async countVisitsByName(
    names: string[],
    em?: EntityManager,
  ): Promise<DirectSaleVisitCount[]> {
    return this.countVisits("ds.customerName", names, em);
  }

  /**
   * `column` is one of two hard-coded property paths above — never user input,
   * for the same reason the sort map exists.
   */
  private async countVisits(
    column: "ds.phone" | "ds.customerName",
    values: string[],
    em?: EntityManager,
  ): Promise<DirectSaleVisitCount[]> {
    if (values.length === 0) return [];

    const qb = await this.qb(em);
    qb.select(column, "value")
      .addSelect("COUNT(*)", "count")
      .where("ds.deletedAt IS NULL")
      .andWhere("ds.isVoided = false")
      .andWhere(`${column} IN (:...values)`, { values });

    // Name matching applies only where there is no number to match on, exactly
    // as `applyCustomerKey` does — otherwise a row counted by name here and by
    // phone there would report two different visit counts for one customer.
    if (column === "ds.customerName") {
      qb.andWhere("ds.phone IS NULL");
    }

    const rows = await qb
      .groupBy(column)
      .getRawMany<{ value: string; count: string }>();

    return rows.map((row) => ({ value: row.value, count: Number(row.count) }));
  }

  /** The detail page's `This customer's other walk-ins`, newest first. */
  async findCustomerSales(
    key: DirectSaleCustomerKey,
    options: { excludeId?: string; limit?: number } = {},
    em?: EntityManager,
  ): Promise<DirectSale[]> {
    const qb = await this.qb(em);
    qb.where("ds.deletedAt IS NULL");
    applyCustomerKey(qb, key);

    if (options.excludeId) {
      qb.andWhere("ds.id != :excludeId", { excludeId: options.excludeId });
    }

    return qb
      .orderBy("ds.soldAt", "DESC")
      .addOrderBy("ds.saleNo", "DESC")
      .take(options.limit ?? 8)
      .getMany();
  }

  /** `3 earlier visits · ₹300.00` — the footer of that same card. A SQL SUM. */
  async summariseCustomerSales(
    key: DirectSaleCustomerKey,
    excludeId?: string,
    em?: EntityManager,
  ): Promise<{ count: number; total: number }> {
    const qb = await this.qb(em);
    qb.select("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(ds.amount), 0)", "total")
      .where("ds.deletedAt IS NULL")
      .andWhere("ds.isVoided = false");
    applyCustomerKey(qb, key);

    if (excludeId) {
      qb.andWhere("ds.id != :excludeId", { excludeId });
    }

    const row = await qb.getRawOne<{ count: string; total: string }>();
    return { count: Number(row?.count ?? 0), total: Number(row?.total ?? 0) };
  }

  /**
   * One sale with its product joined.
   *
   * `findById` leaves the relation undefined, and `toDirectSaleDto` would then
   * report "no product recorded" for a sale that has one. The detail page and
   * every write that returns a row go through here instead.
   */
  async findByIdWithProduct(
    id: string,
    em?: EntityManager,
  ): Promise<DirectSale | null> {
    const qb = await this.qb(em);
    return qb
      .leftJoinAndSelect("ds.product", "product")
      .where("ds.id = :id", { id })
      .andWhere("ds.deletedAt IS NULL")
      .getOne();
  }

  /**
   * A returning walk-in customer gives their number, and the form pre-fills
   * from their last purchase. Ordered by the INSTANT rather than the business
   * date so two sales on the same day still come back in the right order.
   */
  async findRecentByPhone(
    phone: string,
    limit = 5,
    em?: EntityManager,
  ): Promise<DirectSale[]> {
    const qb = await this.qb(em);
    return qb
      .where("ds.phone = :phone", { phone })
      .andWhere("ds.deletedAt IS NULL")
      .andWhere("ds.isVoided = false")
      .orderBy("ds.soldAt", "DESC")
      .addOrderBy("ds.saleNo", "DESC")
      .take(limit)
      .getMany();
  }

  async findByCode(
    code: string,
    em?: EntityManager,
  ): Promise<DirectSale | null> {
    const qb = await this.qb(em);
    return qb
      .where("ds.code = :code", { code })
      .andWhere("ds.deletedAt IS NULL")
      .getOne();
  }
}

export const directSaleRepository = new DirectSaleRepository();
