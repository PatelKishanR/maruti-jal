import type { z } from "zod";

export type SortDir = "asc" | "desc";

/** Parsed, validated list state. Produced only by `parseListQuery`. */
export interface ListQuery {
  page: number;
  pageSize: number;
  q: string;
  sort: { key: string; dir: SortDir };
  filters: Record<string, string | string[] | undefined>;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Per-module table contract.
 *
 * `sortable` is the SQL-injection defence, and it is structural rather than
 * escaping-based: user input is only ever used as a LOOKUP KEY into this map.
 * `?sort=id;DROP TABLE staff` misses the map and falls back to the default —
 * there is nothing to escape wrongly. The values are string literals written
 * by us, and they are the only thing that ever reaches ORDER BY.
 *
 * See .claude/ARCHITECTURE.md §6.2
 */
export interface TableConfig {
  /** public sort key -> hard-coded qualified SQL column, e.g. `o.order_date` */
  sortable: Record<string, string>;
  defaultSort: { key: string; dir: SortDir };
  /**
   * Columns included in the free-text box. Prefer a single generated
   * `search_blob` column with one trigram index over three OR-branches.
   */
  searchable: string[];
  /** filter key -> Zod schema. Unknown keys are dropped, never passed through. */
  filters: Record<string, z.ZodTypeAny>;
  defaultPageSize?: number;
  maxPageSize?: number;
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** URL parameter names, in one place so client and server cannot drift. */
export const TABLE_PARAMS = {
  page: "page",
  pageSize: "pageSize",
  q: "q",
  sort: "sort",
  dir: "dir",
} as const;
