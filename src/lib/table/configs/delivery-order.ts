import type { TableConfig } from "@/lib/table/types";

/**
 * The delivery-order table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/03-delivery-orders.md
 *
 * Written ahead of the module (wave 3) so the allowlist exists in ONE place
 * from the first line of UI code. `DeliveryOrderRepository` already imports it;
 * the list page and its table will import it too.
 *
 * Client-safe by construction — zod and types only, no `server-only`, no
 * entity or repository imports — because a client component reads it for
 * column definitions. See .claude/MODULE-RECIPE.md §1
 */

/**
 * Public sort key → hard-coded qualified SQL column.
 *
 * THE INJECTION DEFENCE IS THIS MAP, and it is structural rather than
 * escaping-based: user input is only ever a lookup KEY into it, and the values
 * are string literals written by us. `?sort=id;DROP TABLE staff` misses the map
 * and falls back to the default. See .claude/ARCHITECTURE.md §6.2
 *
 * `staff` sorts on the JOINED alias, so it is only valid for queries that join
 * `o.staff` as `s` — `searchPaginated` does.
 */
export const DELIVERY_ORDER_SORT_COLUMNS = {
  date: "o.orderDate",
  /** The identity number, not the text code — 'ORD-9' must precede 'ORD-10'. */
  code: "o.orderNo",
  total: "o.totalAmount",
  balance: "o.outstandingAmount",
  jarsPending: "o.qtyPending",
  staff: "s.name",
} as const;

export type DeliveryOrderSortKey = keyof typeof DELIVERY_ORDER_SORT_COLUMNS;

export const deliveryOrderTableConfig = {
  sortable: DELIVERY_ORDER_SORT_COLUMNS,
  /** A register is read newest first: today's deliveries, then yesterday's. */
  defaultSort: { key: "date", dir: "desc" },
  /**
   * The order's own code, plus the STAFF blob (name ‖ phone ‖ alt phone ‖
   * address) through the join — one trigram-indexed predicate per side instead
   * of three OR-branches across staff columns. `delivery_orders` has no
   * `search_blob` of its own; everything free-text about an order belongs to
   * the person it went to. See .claude/DATA-MODEL.md §5.2
   */
  searchable: ["o.code", "s.searchBlob"],
  /**
   * TODO(wave-3): status, paymentStatus, returnStatus, the date range and the
   * two quick chips (payment pending, jars out) get their Zod schemas here when
   * the list page ships. The repository already filters on all of them; an
   * unlisted filter key is DROPPED by `parseListQuery`, so declaring one before
   * its UI exists would silently widen the URL surface.
   */
  filters: {},
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
