import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { CoinType } from "@/lib/db/entities";
import {
  COIN_TYPE_SORT_COLUMNS,
  type CoinTypeSortKey,
} from "@/lib/table/configs/coin-type";

/**
 * The sort allowlist is imported, never re-declared.
 *
 * `coinTypeTableConfig.sortable` is the one map, and it is what actually
 * reaches ORDER BY here. The config is client-safe (zod and types only), so
 * this import couples nothing.
 * See .claude/MODULE-RECIPE.md §1 and .claude/ARCHITECTURE.md §6.2
 */
export type { CoinTypeSortKey };

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

  /**
   * The stock KPI strip — counts and totals across every non-deleted type.
   *
   * Summed in SQL, deliberately. A `reduce((a, b) => a + b)` over the current
   * page would be both wrong (it only sees 25 rows) and a code-review failure
   * (money never adds up in TypeScript). `SUM` over a numeric returns a
   * numeric, which the driver hands back as a string, so every figure is
   * converted exactly once, here.
   * See .claude/ARCHITECTURE.md §9.1 and MODULES/04-coins.md §4.2
   */
  async summary(em?: EntityManager): Promise<{
    total: number;
    active: number;
    coinsInStock: number;
    valueInStock: number;
    packetsInStock: number;
    looseCoinsInStock: number;
  }> {
    const qb = await this.qb(em);
    const raw = await qb
      .select("COUNT(*)", "total")
      .addSelect("COUNT(*) FILTER (WHERE ct.is_active)", "active")
      .addSelect("COALESCE(SUM(ct.balance_coins), 0)", "coins")
      // Both columns are integers, so `/` is integer division and `%` is the
      // remainder — the owner's "47 packets + 40 coins", computed per type and
      // then summed, because packet sizes differ between types.
      .addSelect(
        "COALESCE(SUM(ct.balance_coins / ct.coins_per_packet), 0)",
        "packets",
      )
      .addSelect(
        "COALESCE(SUM(ct.balance_coins % ct.coins_per_packet), 0)",
        "loose",
      )
      // Rounded per row before summing, matching the two-decimal rule every
      // row-level amount in this module obeys. MODULES/04-coins.md §8.2
      .addSelect(
        "COALESCE(SUM(round(ct.balance_coins * ct.per_coin_price, 2)), 0)",
        "value",
      )
      .where("ct.deletedAt IS NULL")
      .getRawOne<{
        total: string | number;
        active: string | number;
        coins: string | number;
        value: string | number;
        packets: string | number;
        loose: string | number;
      }>();

    return {
      total: Number(raw?.total ?? 0),
      active: Number(raw?.active ?? 0),
      coinsInStock: Number(raw?.coins ?? 0),
      valueInStock: Number(raw?.value ?? 0),
      packetsInStock: Number(raw?.packets ?? 0),
      looseCoinsInStock: Number(raw?.loose ?? 0),
    };
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
      .orderBy(
        COIN_TYPE_SORT_COLUMNS[sortBy] ?? COIN_TYPE_SORT_COLUMNS.name,
        sortDir,
      )
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
