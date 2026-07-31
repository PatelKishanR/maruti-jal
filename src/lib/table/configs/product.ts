import type { TableConfig } from "@/lib/table/types";
import {
  PRODUCT_SORT_KEYS,
  productFilterSchemas,
  type ProductSortKey,
} from "@/lib/validation/product";

/**
 * Public sort key → hard-coded qualified SQL column. Spec:
 * .claude/ARCHITECTURE.md §6.2
 *
 * The injection defence is STRUCTURAL rather than escaping-based: a request's
 * `?sort=` value is only ever used as a lookup KEY into this map.
 * `?sort=title;DROP TABLE products` misses it and falls back to `defaultSort` —
 * there is no interpolation to get wrong.
 *
 * THE SINGLE SOURCE OF TRUTH: `ProductRepository` imports this map rather than
 * keeping a second copy, because the repository is what builds the ORDER BY.
 * See .claude/MODULE-RECIPE.md §1
 *
 * Two keys here are NOT URL-facing. `sortOrder` and `code` exist because the
 * SERVICE sorts by them — the order-form picker asks for `sortOrder` so the
 * owner's pinned products lead every dropdown — but neither is offered as a
 * column header, and `productListQuerySchema` does not accept them. The
 * URL-facing subset is `PRODUCT_SORT_KEYS`, applied to `sortable` below.
 */
export const PRODUCT_SORT_COLUMNS = {
  /** The picker's order: the owner pins his two best sellers to the top. */
  sortOrder: "p.sortOrder",
  /** ICU-collated (`gu-IN-x-icu`), so `૨૦ લિટર જાર` interleaves with Latin. */
  title: "p.title",
  /** The identity number, not the text code — 'PRD-9' must precede 'PRD-10'. */
  code: "p.productNo",
  /** Numeric, so `0.5L` sits below `5L` rather than beside it. */
  litres: "p.litres",
  basePrice: "p.basePrice",
  createdAt: "p.createdAt",
} as const;

/** Every key the repository can ORDER BY, URL-facing or not. */
export type ProductSortColumnKey = keyof typeof PRODUCT_SORT_COLUMNS;

/**
 * The URL-facing subset, PICKED from the map above rather than retyped.
 *
 * A key listed in `PRODUCT_SORT_KEYS` with no column behind it is a compile
 * error, and advertising a key the API's `z.enum(PRODUCT_SORT_KEYS)` would
 * reject is what makes the header say "sorted by code" while the rows come back
 * sorted by title.
 */
const urlSortable = Object.fromEntries(
  PRODUCT_SORT_KEYS.map((key) => [key, PRODUCT_SORT_COLUMNS[key]]),
) as Record<ProductSortKey, string>;

/**
 * The catalogue table contract. Spec: DESIGN-STANDARDS §5 ·
 * .claude/ARCHITECTURE.md §6.1
 */
export const productTableConfig: TableConfig & {
  sortable: Record<ProductSortKey, string>;
} = {
  sortable: urlSortable,
  /** The owner reads this list as a catalogue, so alphabetical is the default. */
  defaultSort: { key: "title", dir: "asc" },
  /**
   * One generated, trigram-indexed column rather than three OR-branches.
   * `products.search_blob` is `title || ' ' || coalesce(description, '')`, which
   * is exactly what the design says the box covers. `code` is searched
   * alongside it — one generated column may not reference another, so it cannot
   * be folded into the blob.
   *
   * Search is SCRIPT-LITERAL: a product stored as `૨૦ લિટર જાર` is not found by
   * typing `20L`, which is why the no-results copy quotes the query back.
   */
  searchable: ["p.searchBlob", "p.code"],
  filters: {
    tag: productFilterSchemas.tag,
    filterType: productFilterSchemas.filterType,
    status: productFilterSchemas.status,
    returnable: productFilterSchemas.returnable,
  },
  defaultPageSize: 25,
  maxPageSize: 100,
};

/** Re-exported so table code has one import for the keys and the config. */
export { PRODUCT_SORT_KEYS };
export type { ProductSortKey };
