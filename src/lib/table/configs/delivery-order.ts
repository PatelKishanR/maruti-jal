import { z } from "zod";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  RETURN_STATUSES,
} from "@/lib/db/entities/enums";
import type { TableConfig } from "@/lib/table/types";

/**
 * The delivery-order table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/03-delivery-orders.md
 *
 * Written ahead of the module (wave 3) so the allowlist exists in ONE place
 * from the first line of UI code. `DeliveryOrderRepository` already imports it;
 * the list page and its table will import it too.
 *
 * Client-safe by construction — zod, types and the PLAIN ENUM CONST ARRAYS from
 * `entities/enums` (no `server-only`, no decorators, no repository imports) —
 * because a client component reads it for column definitions. Re-typing those
 * three enums here would be the duplication §1 exists to forbid.
 * See .claude/MODULE-RECIPE.md §1
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

/** True when the parsed key is one the repository can actually order by. */
export function isDeliveryOrderSortKey(
  key: string,
): key is DeliveryOrderSortKey {
  return Object.hasOwn(DELIVERY_ORDER_SORT_COLUMNS, key);
}

/**
 * Filter param names, so the chips, the URL and the Zod query schema cannot
 * drift. `parseListQuery` DROPS any key not declared in `filters` below, so
 * this object and that one are two views of the same list.
 */
export const DELIVERY_ORDER_FILTERS = {
  staffId: "staffId",
  from: "from",
  to: "to",
  status: "status",
  paymentStatus: "paymentStatus",
  returnStatus: "returnStatus",
  /** Quick chip — anything still to collect, or to refund. */
  moneyPending: "moneyPending",
  /** Quick chip — jars still with customers. */
  jarsOut: "jarsOut",
} as const;

/** `'YYYY-MM-DD'`, matching the string-only business date rule of §9.2. */
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();
/** A chip is present or absent in the URL; `?jarsOut=1` is the only truth. */
const chip = z.enum(["1"]);

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
   * PAYMENT AND RETURN ARE TWO INDEPENDENT DIMENSIONS, and they are two
   * filters here rather than one blended "register status" enum, because
   * MODULES/03 §1 is explicit: "the order screen shows two independent things:
   * how much money is still to collect, and how many jars are still out". An
   * order can be fully paid with twelve jars out, or fully returned and unpaid.
   * Collapsing them would make half the real states unreachable from the URL.
   *
   * Every key maps 1:1 onto a `DeliveryOrderFilters` field the repository
   * already implements, and each predicate lands on an indexed column
   * (`outstanding_amount` and `qty_pending` are STORED generated columns with
   * their own partial indexes). See .claude/DATA-MODEL.md §8.1
   *
   * TODO(wave-4): `product` and `amount range` from §7.2 are NOT here.
   * `DeliveryOrderRepository.applyFilters` cannot serve either — a product
   * filter needs an EXISTS over `order_items`, and an amount range needs
   * min/max bounds on `total_amount`. Declaring a key `parseListQuery` would
   * accept but the repository would silently ignore is worse than not offering
   * it. Reported as a repository gap.
   */
  filters: {
    [DELIVERY_ORDER_FILTERS.staffId]: uuid,
    [DELIVERY_ORDER_FILTERS.from]: businessDate,
    [DELIVERY_ORDER_FILTERS.to]: businessDate,
    [DELIVERY_ORDER_FILTERS.status]: z.enum(ORDER_STATUSES),
    [DELIVERY_ORDER_FILTERS.paymentStatus]: z.enum(PAYMENT_STATUSES),
    [DELIVERY_ORDER_FILTERS.returnStatus]: z.enum(RETURN_STATUSES),
    [DELIVERY_ORDER_FILTERS.moneyPending]: chip,
    [DELIVERY_ORDER_FILTERS.jarsOut]: chip,
  },
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
