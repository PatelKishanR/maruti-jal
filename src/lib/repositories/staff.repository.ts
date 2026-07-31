import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { Staff } from "@/lib/db/entities";

/**
 * Public sort key → hard-coded SQL. User input is only ever a LOOKUP KEY into
 * this map, never a value that reaches SQL, so `?sort=id;DROP TABLE staff`
 * simply misses the map and falls back to the default. There is no escaping to
 * get wrong. See .claude/ARCHITECTURE.md §6.2
 */
const SORT_COLUMNS = {
  name: "s.name",
  /** Sort by the identity number, not the text code — 'STF-9' before 'STF-10'. */
  code: "s.staffNo",
  phone: "s.phone",
  joinedOn: "s.joinedOn",
  createdAt: "s.createdAt",
} as const;

export type StaffSortKey = keyof typeof SORT_COLUMNS;

export interface StaffSearchQuery {
  search?: string;
  isActive?: boolean;
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

    const term = query.search?.trim();
    if (term) {
      // One generated column, one trigram index, one predicate — instead of an
      // OR across name, phone and address. See .claude/DATA-MODEL.md §5.2
      qb.andWhere("(s.searchBlob ILIKE :term OR s.code ILIKE :term)", {
        term: `%${escapeLike(term)}%`,
      });
    }

    const column = SORT_COLUMNS[query.sort as StaffSortKey] ?? SORT_COLUMNS.name;
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
