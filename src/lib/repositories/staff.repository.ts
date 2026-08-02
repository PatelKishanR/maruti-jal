import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { Staff } from "@/lib/db/entities";
import {
  STAFF_SORT_COLUMNS,
  type StaffSortKey,
} from "@/lib/table/configs/staff";

/**
 * The sort allowlist is imported, never re-declared.
 *
 * `staffTableConfig.sortable` and this ORDER BY must be the same map or a
 * column header the config advertises sorts by something else here. The config
 * is client-safe (zod and types only), so importing it costs this layer
 * nothing. See .claude/MODULE-RECIPE.md §1 and .claude/ARCHITECTURE.md §6.2
 */
export type { StaffSortKey };

export interface StaffSearchQuery {
  search?: string;
  isActive?: boolean;
  /**
   * Restrict to a known set of staff ids.
   *
   * This is how the `?hasBalance=1` and `?hasJars=1` filters work. Those
   * predicates live on `v_staff_outstanding` and `v_staff_jar_balance`, which
   * this repository must not query — one repository per entity
   * (ARCHITECTURE §4.1 rule 4). The service asks the view repositories WHO
   * qualifies and passes the answer down here, so search, sort and pagination
   * still happen in one round trip against `staff`.
   *
   * An EMPTY ARRAY MEANS "nobody" and must return zero rows. It is not the same
   * as `undefined`, which means "no id restriction" — collapsing the two would
   * turn "nobody owes anything" into "here is the entire roster".
   */
  ids?: string[];
  sort?: string;
  dir?: "ASC" | "DESC";
  skip?: number;
  take?: number;
}

/**
 * ILIKE treats % and _ as wildcards, so a search for "50%" would otherwise
 * match everything. Not a security issue — the term is a bound parameter — but
 * a correctness one.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Every query that touches the `staff` table lives here and nowhere else.
 *
 * Jar balances and outstanding amounts are NOT here: they aggregate
 * delivery_orders and coin_issues, which belong to other repositories. A
 * service that needs a staff member and their balances calls both.
 * See .claude/ARCHITECTURE.md §4.1 rule 4
 */
class StaffRepository extends BaseRepository<Staff> {
  protected readonly target: EntityTarget<Staff> = Staff;
  protected readonly alias = "s";

  /**
   * The list page: search + filter + sort + page, in one round trip.
   *
   * `skip`/`take` rather than `offset`/`limit` — once this query grows a
   * to-many join, LIMIT would limit JOINED ROWS and page 1 would show three
   * staff. See .claude/ARCHITECTURE.md §6.3
   */
  async searchPaginated(
    query: StaffSearchQuery,
    em?: EntityManager,
  ): Promise<[Staff[], number]> {
    const qb = await this.qb(em);
    qb.where("s.deletedAt IS NULL");

    if (query.isActive !== undefined) {
      qb.andWhere("s.isActive = :isActive", { isActive: query.isActive });
    }

    if (query.ids !== undefined) {
      // `IN ()` is a syntax error in PostgreSQL and TypeORM would emit exactly
      // that for an empty array, so the empty case is answered without a query
      // to the database rather than left to blow up at runtime.
      if (query.ids.length === 0) {
        qb.andWhere("1 = 0");
      } else {
        qb.andWhere("s.id IN (:...ids)", { ids: query.ids });
      }
    }

    const term = query.search?.trim();
    if (term) {
      // One generated column, one trigram index, one predicate — instead of an
      // OR across name, phone and address. See .claude/DATA-MODEL.md §5.2
      qb.andWhere("(s.searchBlob ILIKE :term OR s.code ILIKE :term)", {
        term: `%${escapeLike(term)}%`,
      });
    }

    const column =
      STAFF_SORT_COLUMNS[query.sort as StaffSortKey] ?? STAFF_SORT_COLUMNS.name;
    qb.orderBy(column, query.dir === "DESC" ? "DESC" : "ASC");
    // Without a unique tiebreaker, rows with equal names shuffle between pages
    // and the user sees one record twice while missing another.
    qb.addOrderBy("s.id", "ASC");

    qb.skip(query.skip ?? 0).take(query.take ?? 20);

    return qb.getManyAndCount();
  }

  /** For pickers and dropdowns — the whole active roster, never paginated. */
  async findActive(em?: EntityManager): Promise<Staff[]> {
    const qb = await this.qb(em);
    return qb
      .where("s.deletedAt IS NULL")
      .andWhere("s.isActive = true")
      .orderBy("s.name", "ASC")
      .addOrderBy("s.id", "ASC")
      .getMany();
  }

  /**
   * A batch by id — the names beside the receipts on a collection sheet, and
   * the staff group headings on the jar reconciliation, in one query.
   *
   * Soft-deleted rows are INCLUDED deliberately: a report over last quarter
   * must still name the person who drove, and dropping them would leave a
   * blank cell where a name belongs.
   */
  async findManyByIds(
    ids: readonly string[],
    em?: EntityManager,
  ): Promise<Staff[]> {
    if (ids.length === 0) return [];
    const qb = await this.qb(em);
    return qb
      .withDeleted()
      .where("s.id IN (:...ids)", { ids: [...ids] })
      .orderBy("s.name", "ASC")
      .getMany();
  }

  /**
   * Phone is unique among NON-DELETED rows only — when someone leaves their
   * number frees up for the next person (§10.15) — so this check must exclude
   * soft-deleted rows or the number would stay locked forever.
   */
  async isPhoneTaken(
    phone: string,
    excludeStaffId?: string,
    em?: EntityManager,
  ): Promise<boolean> {
    const qb = await this.qb(em);
    qb.where("s.phone = :phone", { phone }).andWhere("s.deletedAt IS NULL");
    if (excludeStaffId) {
      qb.andWhere("s.id != :excludeStaffId", { excludeStaffId });
    }
    return qb.getExists();
  }

  async findByPhone(phone: string, em?: EntityManager): Promise<Staff | null> {
    const qb = await this.qb(em);
    return qb
      .where("s.phone = :phone", { phone })
      .andWhere("s.deletedAt IS NULL")
      .getOne();
  }

  /** `code` is what the owner reads off a register slip, e.g. STF-000012. */
  async findByCode(code: string, em?: EntityManager): Promise<Staff | null> {
    const qb = await this.qb(em);
    return qb
      .where("s.code = :code", { code })
      .andWhere("s.deletedAt IS NULL")
      .getOne();
  }

  async countActive(em?: EntityManager): Promise<number> {
    const repo = await this.repo(em);
    return repo.count({ where: { isActive: true } });
  }
}

export const staffRepository = new StaffRepository();
