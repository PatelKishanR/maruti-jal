import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  TABLE_PARAMS,
  type ListQuery,
  type SortDir,
  type TableConfig,
} from "./types";

type SearchParams = Record<string, string | string[] | undefined>;

function first(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Turn raw URL search params into a validated `ListQuery`.
 *
 * Everything hostile is neutralised here, before any value reaches a query
 * builder:
 *
 *  - **sort key** must be a KEY of `config.sortable`. Anything else falls back
 *    to the default. User input never becomes a SQL fragment.
 *  - **page / pageSize** are coerced to sane integers and clamped.
 *  - **filters** are dropped unless the module declared them, then validated
 *    by that filter's Zod schema.
 *  - **q** is trimmed and length-capped.
 *
 * This is the only place that reads raw params, so there is exactly one thing
 * to audit. See .claude/ARCHITECTURE.md §6.2
 */
export function parseListQuery(
  searchParams: SearchParams,
  config: TableConfig,
): ListQuery {
  const maxPageSize = config.maxPageSize ?? MAX_PAGE_SIZE;

  const rawPage = Number(first(searchParams, TABLE_PARAMS.page));
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1;

  const rawPageSize = Number(first(searchParams, TABLE_PARAMS.pageSize));
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(maxPageSize, Math.max(1, Math.trunc(rawPageSize)))
    : (config.defaultPageSize ?? DEFAULT_PAGE_SIZE);

  const q = (first(searchParams, TABLE_PARAMS.q) ?? "").trim().slice(0, 100);

  // ---- the injection defence -------------------------------------------
  const rawSort = first(searchParams, TABLE_PARAMS.sort);
  const key =
    rawSort && Object.hasOwn(config.sortable, rawSort)
      ? rawSort
      : config.defaultSort.key;

  const rawDir = first(searchParams, TABLE_PARAMS.dir);
  const dir: SortDir =
    rawDir === "asc" || rawDir === "desc" ? rawDir : config.defaultSort.dir;

  // ---- filters: unknown keys dropped, known keys validated --------------
  const filters: ListQuery["filters"] = {};
  for (const [filterKey, schema] of Object.entries(config.filters)) {
    const raw = searchParams[filterKey];
    if (raw === undefined || raw === "") continue;

    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      filters[filterKey] = parsed.data as string | string[];
    }
    // A malformed filter is silently ignored rather than 500-ing the page.
    // The user sees an unfiltered list, which is recoverable; an error page
    // from a stale bookmarked URL is not.
  }

  return { page, pageSize, q, sort: { key, dir }, filters };
}

/** Are any filters or a search term active? Drives the two empty states. */
export function hasActiveFilters(query: ListQuery): boolean {
  return query.q.length > 0 || Object.keys(query.filters).length > 0;
}
