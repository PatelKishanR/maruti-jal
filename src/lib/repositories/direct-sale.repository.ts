import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { DirectSale } from "@/lib/db/entities";

/**
 * Public sort key → hard-coded SQL. User input is only a lookup key into this
 * map. See .claude/ARCHITECTURE.md §6.2
 */
const SORT_COLUMNS = {
  saleDate: "ds.saleDate",
  soldAt: "ds.soldAt",
  /** The identity number, not the text code — 'DWS-9' must precede 'DWS-10'. */
  code: "ds.saleNo",
  amount: "ds.amount",
  customerName: "ds.customerName",
} as const;

export type DirectSaleSortKey = keyof typeof SORT_COLUMNS;

export interface DirectSaleSearchQuery {
  search?: string;
  productId?: string;
  /** Omitted → live sales only. Voided rows are kept but hidden by default. */
  includeVoided?: boolean;
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

    const term = query.search?.trim();
    if (term) {
      qb.andWhere("(ds.searchBlob ILIKE :term OR ds.code ILIKE :term)", {
        term: `%${escapeLike(term)}%`,
      });
    }

    const column =
      SORT_COLUMNS[query.sort as DirectSaleSortKey] ?? SORT_COLUMNS.saleDate;
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
