import "server-only";
import type {
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from "typeorm";
import { getDataSource } from "@/lib/db/data-source";

/**
 * Base repository.
 *
 * THE ONLY LAYER ALLOWED TO TOUCH THE DATABASE.
 *
 * Rules that make this layer worth having:
 *  1. One repository per entity. A repository never queries another entity's
 *     table — if a service needs two entities, it calls two repositories.
 *  2. Every method takes an optional `EntityManager`. Absent → use the default
 *     connection. Present → join the caller's transaction. This is what makes
 *     repositories composable inside a service transaction.
 *  3. A repository NEVER opens a transaction. That belongs to the service, so
 *     several repository calls can be committed or rolled back as one unit.
 *  4. Repositories return entities. Services map to DTOs before anything
 *     crosses the API boundary.
 *
 * See .claude/ARCHITECTURE.md §4
 */
/**
 * Every entity in this schema has a primary key named `id`.
 *
 * It is a uuid on every business table (DATA-MODEL D-1). The two exceptions
 * are the high-volume append-only logs — `audit_logs` and `document_revisions`
 * — which use a `bigint` identity so new rows append to the end of the index
 * instead of scattering random uuids through it. Hence `string | number`;
 * methods below take `T["id"]`, so each repository still gets exactly one
 * concrete key type. See .claude/DATA-MODEL.md §5.20, §5.21
 */
type HasId = ObjectLiteral & { id: string | number };

export abstract class BaseRepository<T extends HasId> {
  protected abstract readonly target: EntityTarget<T>;
  /** Alias used by query builders in subclasses. */
  protected abstract readonly alias: string;

  /**
   * Resolve the TypeORM repository, joining the caller's transaction when one
   * is supplied.
   */
  protected async repo(em?: EntityManager): Promise<Repository<T>> {
    if (em) return em.getRepository(this.target);
    const ds = await getDataSource();
    return ds.getRepository(this.target);
  }

  protected async qb(em?: EntityManager): Promise<SelectQueryBuilder<T>> {
    const repo = await this.repo(em);
    return repo.createQueryBuilder(this.alias);
  }

  async findById(id: T["id"], em?: EntityManager): Promise<T | null> {
    const repo = await this.repo(em);
    return repo.findOne({ where: { id } as unknown as FindOptionsWhere<T> });
  }

  async findOneBy(
    where: FindOptionsWhere<T>,
    em?: EntityManager,
  ): Promise<T | null> {
    const repo = await this.repo(em);
    return repo.findOne({ where });
  }

  async findManyBy(
    where: FindOptionsWhere<T>,
    em?: EntityManager,
  ): Promise<T[]> {
    const repo = await this.repo(em);
    return repo.find({ where });
  }

  async exists(
    where: FindOptionsWhere<T>,
    em?: EntityManager,
  ): Promise<boolean> {
    const repo = await this.repo(em);
    return repo.exists({ where });
  }

  async count(
    where?: FindOptionsWhere<T>,
    em?: EntityManager,
  ): Promise<number> {
    const repo = await this.repo(em);
    return where ? repo.count({ where }) : repo.count();
  }

  async create(data: DeepPartial<T>, em?: EntityManager): Promise<T> {
    const repo = await this.repo(em);
    return repo.save(repo.create(data));
  }

  async save(entity: T, em?: EntityManager): Promise<T> {
    const repo = await this.repo(em);
    return repo.save(entity);
  }

  /** Partial update by id. Does not run entity subscribers — use save() when they matter. */
  async updateById(
    id: T["id"],
    data: Parameters<Repository<T>["update"]>[1],
    em?: EntityManager,
  ): Promise<void> {
    const repo = await this.repo(em);
    await repo.update({ id } as unknown as FindOptionsWhere<T>, data);
  }

  /** Soft delete — nothing transactional is ever hard-deleted. */
  async softDeleteById(id: T["id"], em?: EntityManager): Promise<void> {
    const repo = await this.repo(em);
    await repo.softDelete({ id } as unknown as FindOptionsWhere<T>);
  }

  async restoreById(id: T["id"], em?: EntityManager): Promise<void> {
    const repo = await this.repo(em);
    await repo.restore({ id } as unknown as FindOptionsWhere<T>);
  }

  /**
   * Row lock for read-modify-write. MUST be called inside a transaction, so
   * the EntityManager is required rather than optional.
   *
   * Acquire locks in a consistent order across the codebase — child → parent →
   * grandparent — or you get intermittent deadlocks that are miserable to
   * reproduce. See .claude/ARCHITECTURE.md §4.2
   */
  async findByIdForUpdate(id: T["id"], em: EntityManager): Promise<T | null> {
    return em
      .getRepository(this.target)
      .createQueryBuilder(this.alias)
      .setLock("pessimistic_write")
      .where(`${this.alias}.id = :id`, { id })
      .getOne();
  }
}
