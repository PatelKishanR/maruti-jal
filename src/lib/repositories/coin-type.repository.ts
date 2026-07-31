import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { CoinType } from "@/lib/db/entities";

/**
 * Public sort key → hard-coded SQL column.
 *
 * User input is only ever a LOOKUP KEY into this map, never a value that
 * reaches SQL. `?sort=id;DROP TABLE coin_types` simply misses the map and falls
 * back to the default. There is no escaping to get wrong because nothing
 * user-supplied is interpolated. See .claude/ARCHITECTURE.md §6.2
 */
const SORTABLE = {
  name: "ct.name",
  coinsPerPacket: "ct.coinsPerPacket",
  packetAmount: "ct.packetAmount",
  perCoinPrice: "ct.perCoinPrice",
  balanceCoins: "ct.balanceCoins",
  createdAt: "ct.createdAt",
} as const;

export type CoinTypeSortKey = keyof typeof SORTABLE;

export interface CoinTypeSearchParams {
  /** Free text over the name. */
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: CoinTypeSortKey;
  sortDir?: "ASC" | "DESC";
}

/**
 * Every query that touches `coin_types` lives here and nowhere else.
 *
 * `findByIdForUpdate(id, em)` is inherited from BaseRepository and is THE lock
 * of this module: the stock check and the ledger insert must be atomic, or two
 * people issuing the last packets both succeed. Use `findByIdsForUpdate` when a
 * single transaction touches several coin types.
 * See .claude/DATA-MODEL.md §10.2
 */
class CoinTypeRepository extends BaseRepository<CoinType> {
  protected readonly target: EntityTarget<CoinType> = CoinType;
  protected readonly alias = "ct";

  /** The picker list on the issue form — active types only, alphabetical. */
  async findActive(em?: EntityManager): Promise<CoinType[]> {
    const qb = await this.qb(em);
    return qb
      .where("ct.isActive = true")
      .andWhere("ct.deletedAt IS NULL")
      .orderBy("ct.name", "ASC")
      .getMany();
  }

  /**
   * Row-lock several coin types at once, IN ASCENDING ID ORDER.
   *
   * A coin issue spanning three types must lock all three, and the order is not
   * a detail: two transactions taking the same locks in different orders
   * deadlock intermittently, which is miserable to reproduce. PostgreSQL locks
   * rows in the order the query yields them, so the ORDER BY is the fix.
   * Must be called inside a transaction, hence the required EntityManager.
   * See .claude/ARCHITECTURE.md §4.3 and §4.4
   */
  async findByIdsForUpdate(
    ids: string[],
    em: EntityManager,
  ): Promise<CoinType[]> {
    if (ids.length === 0) return [];
    return em
      .getRepository(CoinType)
      .createQueryBuilder("ct")
      .setLock("pessimistic_write")
      .where("ct.id IN (:...ids)", { ids })
      .orderBy("ct.id", "ASC")
      .getMany();
  }

  /**
   * Is this name already used by a different, non-deleted coin type?
   *
   * Case-insensitive, matching the functional unique index on `lower(name)` —
   * a check that compared case-sensitively would pass here and then fail at the
   * database, which reads to the user as a random error.
   */
  async isNameTaken(
    name: string,
    excludeId?: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const qb = await this.qb(em);
    qb.where("lower(ct.name) = lower(:name)", { name }).andWhere(
      "ct.deletedAt IS NULL",
    );
    if (excludeId) qb.andWhere("ct.id != :excludeId", { excludeId });
    return qb.getExists();
  }

  async searchPaginated(
    params: CoinTypeSearchParams = {},
    em?: EntityManager,
  ): Promise<{ rows: CoinType[]; total: number }> {
    const {
      search,
      isActive,
      page = 1,
      pageSize = 25,
      sortBy = "name",
      sortDir = "ASC",
    } = params;

    const qb = await this.qb(em);
    qb.where("ct.deletedAt IS NULL");

    if (search?.trim()) {
      qb.andWhere("ct.name ILIKE :search", { search: `%${search.trim()}%` });
    }
    if (isActive !== undefined) {
      qb.andWhere("ct.isActive = :isActive", { isActive });
    }

    const [rows, total] = await qb
      .orderBy(SORTABLE[sortBy] ?? SORTABLE.name, sortDir)
      // Without a stable tiebreaker, equal-valued rows shuffle between pages —
      // users see one record twice and miss another entirely.
      .addOrderBy("ct.id", "ASC")
      // skip/take, never offset/limit: skip/take paginates ENTITIES, which is
      // the only correct behaviour once a to-many join appears.
      // See .claude/ARCHITECTURE.md §6.3
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { rows, total };
  }
}

export const coinTypeRepository = new CoinTypeRepository();
