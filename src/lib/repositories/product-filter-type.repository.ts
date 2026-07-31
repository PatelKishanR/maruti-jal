import "server-only";
import type { EntityManager, Repository } from "typeorm";
import { getDataSource } from "@/lib/db/data-source";
import { ProductFilterType } from "@/lib/db/entities";

/**
 * Every query that touches the `product_filter_types` table lives here and
 * nowhere else.
 *
 * DELIBERATELY NOT extending BaseRepository, for the same reason as
 * ProductTagRepository: `BaseRepository<T>` is constrained to `{ id: string }`
 * and every method it supplies is keyed on a uuid primary key and a
 * `deleted_at` column. DATA-MODEL §5.3 gives this table a TEXT primary key
 * (`code`) and no audit block, so half the inherited surface would fail at
 * runtime.
 *
 * The contract that matters is kept: every method takes an optional
 * EntityManager so it composes inside a service transaction, and nothing here
 * opens one. See .claude/ARCHITECTURE.md §4
 */
class ProductFilterTypeRepository {
  private async repo(
    em?: EntityManager,
  ): Promise<Repository<ProductFilterType>> {
    if (em) return em.getRepository(ProductFilterType);
    const ds = await getDataSource();
    return ds.getRepository(ProductFilterType);
  }

  async findAll(em?: EntityManager): Promise<ProductFilterType[]> {
    const repo = await this.repo(em);
    return repo.find({ order: { sortOrder: "ASC", label: "ASC" } });
  }

  /** The product-form dropdown. A retired filter type must not be selectable. */
  async findActive(em?: EntityManager): Promise<ProductFilterType[]> {
    const repo = await this.repo(em);
    return repo.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", label: "ASC" },
    });
  }

  async findByCode(
    code: string,
    em?: EntityManager,
  ): Promise<ProductFilterType | null> {
    const repo = await this.repo(em);
    return repo.findOne({ where: { code } });
  }

  async existsByCode(code: string, em?: EntityManager): Promise<boolean> {
    const repo = await this.repo(em);
    return repo.exists({ where: { code } });
  }

  /** Two filter types labelled "Filtered" is a data-entry bug, not a variant. */
  async isLabelTaken(
    label: string,
    excludeCode?: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const repo = await this.repo(em);
    const qb = repo
      .createQueryBuilder("pft")
      .where("lower(pft.label) = lower(:label)", { label: label.trim() });
    if (excludeCode) qb.andWhere("pft.code != :excludeCode", { excludeCode });
    return qb.getExists();
  }

  async create(
    data: Pick<ProductFilterType, "code" | "label"> &
      Partial<Pick<ProductFilterType, "sortOrder" | "isActive">>,
    em?: EntityManager,
  ): Promise<ProductFilterType> {
    const repo = await this.repo(em);
    return repo.save(repo.create(data));
  }

  async save(
    filterType: ProductFilterType,
    em?: EntityManager,
  ): Promise<ProductFilterType> {
    const repo = await this.repo(em);
    return repo.save(filterType);
  }

  /** Renaming a code is safe — referencing FKs are ON UPDATE CASCADE (§5.4). */
  async updateByCode(
    code: string,
    data: Partial<Pick<ProductFilterType, "label" | "sortOrder" | "isActive">>,
    em?: EntityManager,
  ): Promise<void> {
    const repo = await this.repo(em);
    await repo.update({ code }, data);
  }

  /**
   * No delete: the FK from `products` is ON DELETE RESTRICT and there is no
   * `deleted_at` here. Retiring means `is_active = false`, so historic products
   * keep resolving their filter type. See .claude/DATA-MODEL.md §10.6
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

export const productFilterTypeRepository = new ProductFilterTypeRepository();
