import "server-only";
import type { EntityManager, Repository } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";
import { ProductTag } from "@/lib/db/entities";

/**
 * Every query that touches the `product_tags` table lives here and nowhere
 * else.
 *
 * DELIBERATELY NOT extending BaseRepository. `BaseRepository<T>` is constrained
 * to `{ id: string }` and its whole surface — findById, softDeleteById,
 * restoreById, findByIdForUpdate — is keyed on a uuid primary key and a
 * `deleted_at` column. This table has neither: DATA-MODEL §5.3 gives it a TEXT
 * primary key (`code`) and no audit block, precisely so `products.tag_code`
 * stays readable and filterable without a join. Inheriting a base class whose
 * methods would all fail at runtime would be worse than repeating six lines.
 *
 * The same contract still holds: every method takes an optional EntityManager
 * so it composes inside a service transaction, and nothing here opens one.
 * See .claude/ARCHITECTURE.md §4
 */
class ProductTagRepository {
  private async repo(em?: EntityManager): Promise<Repository<ProductTag>> {
    if (em) return em.getRepository(ProductTag);
    const ds = await getDataSource();
    return ds.getRepository(ProductTag);
  }

  /**
   * The whole vocabulary, active or not. A handful of rows that every product
   * form needs — paginating it would cost more code than it saves queries.
   */
  async findAll(em?: EntityManager): Promise<ProductTag[]> {
    const repo = await this.repo(em);
    return repo.find({ order: { sortOrder: "ASC", label: "ASC" } });
  }

  /** The product-form dropdown. A retired tag must not be selectable. */
  async findActive(em?: EntityManager): Promise<ProductTag[]> {
    const repo = await this.repo(em);
    return repo.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", label: "ASC" },
    });
  }

  async findByCode(
    code: string,
    em?: EntityManager,
  ): Promise<ProductTag | null> {
    const repo = await this.repo(em);
    return repo.findOne({ where: { code } });
  }

  async existsByCode(code: string, em?: EntityManager): Promise<boolean> {
    const repo = await this.repo(em);
    return repo.exists({ where: { code } });
  }

  /**
   * Labels are what the owner reads, so two tags called "Cold" is a data-entry
   * bug even though their codes differ. Case-insensitive for the same reason.
   */
  async isLabelTaken(
    label: string,
    excludeCode?: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const repo = await this.repo(em);
    const qb = repo
      .createQueryBuilder("pt")
      .where("lower(pt.label) = lower(:label)", { label: label.trim() });
    if (excludeCode) qb.andWhere("pt.code != :excludeCode", { excludeCode });
    return qb.getExists();
  }

  async create(
    data: Pick<ProductTag, "code" | "label"> &
      Partial<Pick<ProductTag, "sortOrder" | "isActive">>,
    em?: EntityManager,
  ): Promise<ProductTag> {
    const repo = await this.repo(em);
    return repo.save(repo.create(data));
  }

  async save(tag: ProductTag, em?: EntityManager): Promise<ProductTag> {
    const repo = await this.repo(em);
    return repo.save(tag);
  }

  /**
   * Renaming a CODE is safe — every referencing FK is ON UPDATE CASCADE, so
   * `products.tag_code` follows. See .claude/DATA-MODEL.md §5.4
   */
  async updateByCode(
    code: string,
    data: Partial<Pick<ProductTag, "label" | "sortOrder" | "isActive">>,
    em?: EntityManager,
  ): Promise<void> {
    const repo = await this.repo(em);
    await repo.update({ code }, data);
  }

  /**
   * There is no delete. The FK from `products` is ON DELETE RESTRICT and there
   * is no `deleted_at` on this table — retiring a tag means `is_active = false`
   * so historic products keep resolving it. See .claude/DATA-MODEL.md §10.6
   */
  async setActive(
    code: string,
    isActive: boolean,
    em?: EntityManager,
  ): Promise<void> {
    const repo = await this.repo(em);
    await repo.update({ code }, { isActive });
  }
}

export const productTagRepository = new ProductTagRepository();
