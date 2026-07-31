import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { In } from "typeorm";
import { BaseRepository } from "./base.repository";
import { Product } from "@/lib/db/entities";
import { NotFoundError } from "@/lib/errors";
import {
  PRODUCT_SORT_COLUMNS,
  type ProductSortColumnKey,
} from "@/lib/table/configs/product";

/**
 * The sort allowlist is imported, never re-declared.
 *
 * `PRODUCT_SORT_COLUMNS` carries every key this ORDER BY can serve, including
 * the two the URL does not expose (`sortOrder`, `code`) — the service sorts the
 * picker by `sortOrder`. The config is client-safe (zod and types only), so
 * this import couples nothing.
 * See .claude/MODULE-RECIPE.md §1 and .claude/ARCHITECTURE.md §6.2
 */
export type ProductSortKey = ProductSortColumnKey;

export interface ProductSearchQuery {
  search?: string;
  tagCode?: string;
  filterTypeCode?: string;
  isActive?: boolean;
  isReturnable?: boolean;
  sort?: string;
  dir?: "ASC" | "DESC";
  skip?: number;
  take?: number;
}

/** ILIKE treats % and _ as wildcards; "20%" would otherwise match everything. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Every query that touches the `products` table lives here and nowhere else.
 *
 * Tag and filter-type LABELS are not joined in: those are separate tables with
 * their own repositories. The list page filters on `tag_code` directly, which
 * is exactly why the lookup tables are keyed by code rather than uuid.
 * See .claude/DATA-MODEL.md §3
 */
class ProductRepository extends BaseRepository<Product> {
  protected readonly target: EntityTarget<Product> = Product;
  protected readonly alias = "p";

  /**
   * The catalogue list: search + the two headline filters + sort + page.
   * `skip`/`take`, never `offset`/`limit` — see .claude/ARCHITECTURE.md §6.3
   */
  async searchPaginated(
    query: ProductSearchQuery,
    em?: EntityManager,
  ): Promise<[Product[], number]> {
    const qb = await this.qb(em);
    qb.where("p.deletedAt IS NULL");

    if (query.tagCode) {
      qb.andWhere("p.tagCode = :tagCode", { tagCode: query.tagCode });
    }
    if (query.filterTypeCode) {
      qb.andWhere("p.filterTypeCode = :filterTypeCode", {
        filterTypeCode: query.filterTypeCode,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere("p.isActive = :isActive", { isActive: query.isActive });
    }
    if (query.isReturnable !== undefined) {
      qb.andWhere("p.isReturnable = :isReturnable", {
        isReturnable: query.isReturnable,
      });
    }

    const term = query.search?.trim();
    if (term) {
      qb.andWhere("(p.searchBlob ILIKE :term OR p.code ILIKE :term)", {
        term: `%${escapeLike(term)}%`,
      });
    }

    const column =
      PRODUCT_SORT_COLUMNS[query.sort as ProductSortKey] ??
      PRODUCT_SORT_COLUMNS.sortOrder;
    qb.orderBy(column, query.dir === "DESC" ? "DESC" : "ASC");
    if (column !== PRODUCT_SORT_COLUMNS.title) qb.addOrderBy("p.title", "ASC");
    // Stable tiebreaker: equal-valued rows must not shuffle between pages.
    qb.addOrderBy("p.id", "ASC");

    qb.skip(query.skip ?? 0).take(query.take ?? 20);

    return qb.getManyAndCount();
  }

  /**
   * The order-form picker. `sort_order` first so the owner can pin the two
   * products that make up ninety per cent of sales to the top.
   */
  async findActive(em?: EntityManager): Promise<Product[]> {
    const qb = await this.qb(em);
    return qb
      .where("p.deletedAt IS NULL")
      .andWhere("p.isActive = true")
      .orderBy("p.sortOrder", "ASC")
      .addOrderBy("p.title", "ASC")
      .addOrderBy("p.id", "ASC")
      .getMany();
  }

  /**
   * Saves every caller repeating the same null check before snapshotting a
   * product onto an order line — the one place a missing product must abort
   * the whole transaction rather than silently write a null title.
   */
  async findByIdOrFail(id: string, em?: EntityManager): Promise<Product> {
    const product = await this.findById(id, em);
    if (!product) throw new NotFoundError("Product", { id });
    return product;
  }

  /**
   * Titles are unique among non-deleted rows only, so a product deleted by
   * mistake and re-created does not collide with its own tombstone.
   */
  async isTitleTaken(
    title: string,
    excludeProductId?: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const qb = await this.qb(em);
    qb.where("lower(p.title) = lower(:title)", { title: title.trim() }).andWhere(
      "p.deletedAt IS NULL",
    );
    if (excludeProductId) {
      qb.andWhere("p.id != :excludeProductId", { excludeProductId });
    }
    return qb.getExists();
  }

  async findByCode(code: string, em?: EntityManager): Promise<Product | null> {
    const qb = await this.qb(em);
    return qb
      .where("p.code = :code", { code })
      .andWhere("p.deletedAt IS NULL")
      .getOne();
  }

  /**
   * One round trip for a whole order's worth of lines. Building an order this
   * way avoids N queries while the service snapshots each product's commercial
   * attributes onto its line. See .claude/DATA-MODEL.md §6
   */
  async findManyByIds(ids: string[], em?: EntityManager): Promise<Product[]> {
    if (ids.length === 0) return [];
    const repo = await this.repo(em);
    return repo.find({ where: { id: In(ids) } });
  }

  /** Are any products still pointing at this tag? Blocks retiring it. */
  async countByTagCode(tagCode: string, em?: EntityManager): Promise<number> {
    const qb = await this.qb(em);
    return qb
      .where("p.tagCode = :tagCode", { tagCode })
      .andWhere("p.deletedAt IS NULL")
      .getCount();
  }

  async countByFilterTypeCode(
    filterTypeCode: string,
    em?: EntityManager,
  ): Promise<number> {
    const qb = await this.qb(em);
    return qb
      .where("p.filterTypeCode = :filterTypeCode", { filterTypeCode })
      .andWhere("p.deletedAt IS NULL")
      .getCount();
  }
}

export const productRepository = new ProductRepository();
