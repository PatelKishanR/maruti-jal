import "server-only";
import { Brackets, type ObjectLiteral, type SelectQueryBuilder } from "typeorm";
import type { ListQuery, ListResult, TableConfig } from "./types";

/** Escape LIKE wildcards so a literal % or _ in a search term stays literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Apply search, sort and pagination to a QueryBuilder, and run it.
 *
 * Module code never paginates or sorts by hand — two things here are easy to
 * get wrong and expensive to discover later:
 *
 * 1. **skip/take, not offset/limit.** With a to-many join (order → items),
 *    `LIMIT 10` limits JOINED ROWS, so page 1 might show 3 orders. skip/take
 *    makes TypeORM run a two-phase distinct-id subquery and paginate ENTITIES
 *    correctly.
 *
 * 2. **A stable tiebreaker.** Sorting on a non-unique column without one lets
 *    equal-valued rows reshuffle between pages, so the user sees one record
 *    twice and never sees another. Every sort appends an id ordering.
 *
 * See .claude/ARCHITECTURE.md §6.3
 */
export async function applyListQuery<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: ListQuery,
  config: TableConfig,
): Promise<ListResult<T>> {
  if (query.q && config.searchable.length > 0) {
    const needle = `%${escapeLike(query.q)}%`;
    qb.andWhere(
      new Brackets((w) => {
        config.searchable.forEach((column, i) => {
          // `column` comes from config (written by us, never user input);
          // the VALUE is always parameterised.
          w.orWhere(`${column} ILIKE :mjq${i} ESCAPE '\\'`, {
            [`mjq${i}`]: needle,
          });
        });
      }),
    );
  }

  const sortColumn = config.sortable[query.sort.key];
  if (!sortColumn) {
    // parseListQuery guarantees the key exists; if it doesn't, the config and
    // the default disagree, which is a programming error worth surfacing.
    throw new Error(
      `Sort key "${query.sort.key}" is not in the sortable allowlist. ` +
        `Check the module's TableConfig.`,
    );
  }

  qb.orderBy(sortColumn, query.sort.dir === "asc" ? "ASC" : "DESC")
    .addOrderBy(`${qb.alias}.id`, "DESC")
    .skip((query.page - 1) * query.pageSize)
    .take(query.pageSize);

  const [rows, total] = await qb.getManyAndCount();

  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Map a `ListResult<Entity>` to a `ListResult<Dto>` without losing the meta. */
export function mapListResult<T, R>(
  result: ListResult<T>,
  map: (row: T) => R,
): ListResult<R> {
  return { ...result, rows: result.rows.map(map) };
}
