import { z } from "zod";
import type { TableConfig } from "@/lib/table/types";

/**
 * The party-order table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/05-party-orders.md §3
 *
 * The single source of truth for the sort allowlist AND the filter vocabulary.
 * `PartyOrderRepository` imports the sort map; `lib/validation/party-order.ts`
 * imports both — which is why the schemas live HERE rather than in validation.
 * Products goes the other way (config → validation); doing the same here would
 * make the repository's import of the sort map a cycle.
 *
 * Client-safe by construction — zod and types only, no `server-only`, no
 * entity or repository imports. See .claude/MODULE-RECIPE.md §1
 */

/**
 * Public sort key → hard-coded qualified SQL column.
 *
 * THE INJECTION DEFENCE IS THIS MAP: user input is only ever a lookup KEY into
 * it, never a value that reaches SQL, so `?sort=id;DROP TABLE party_orders`
 * misses it and falls back to the default. See .claude/ARCHITECTURE.md §6.2
 *
 * Every column here is a CACHED rollup on the header rather than an aggregate
 * over days and payments — sorting by something the database would have to
 * compute per row is how a list page stops being indexable.
 * See .claude/DATA-MODEL.md §8.1
 */
export const PARTY_ORDER_SORT_COLUMNS = {
  /** The first day of the service window, which is what "when" means here. */
  startDate: "po.firstServiceDate",
  partyName: "po.partyName",
  totalAmount: "po.totalAmount",
  outstandingAmount: "po.outstandingAmount",
  /** The identity number, not the text code — 'PTY-9' must precede 'PTY-10'. */
  code: "po.partyNo",
} as const;

export type PartyOrderSortKey = keyof typeof PARTY_ORDER_SORT_COLUMNS;

/**
 * The URL-facing keys, checked against the map at COMPILE time.
 *
 * `satisfies` means a key listed here with no SQL column behind it fails the
 * build rather than throwing when someone clicks that column header.
 */
export const PARTY_ORDER_SORT_KEYS = [
  "startDate",
  "partyName",
  "totalAmount",
  "outstandingAmount",
  "code",
] as const satisfies readonly PartyOrderSortKey[];

/* ═══════════════════════════════════════════════════════════════════════
   Filters — design §3.3
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Delivery status as the OWNER thinks of it, mapped in the service onto
 * `party_orders.status`. `upcoming` is not a database value: a booking that is
 * CONFIRMED but whose first day has not arrived is "upcoming", and one whose
 * days have started is "in progress".
 */
export const PARTY_ORDER_DELIVERY_FILTERS = [
  "all",
  "upcoming",
  "inProgress",
  "completed",
  "cancelled",
] as const;
export type PartyOrderDeliveryFilter =
  (typeof PARTY_ORDER_DELIVERY_FILTERS)[number];

export const PARTY_ORDER_PAYMENT_FILTERS = [
  "all",
  "unpaid",
  "partial",
  "paid",
  "overpaid",
  "refundDue",
] as const;
export type PartyOrderPaymentFilter =
  (typeof PARTY_ORDER_PAYMENT_FILTERS)[number];

/**
 * A business date, `'YYYY-MM-DD'`. A shape check on machine-generated digits,
 * never a character class on anything a human types — see the note in
 * `lib/validation/party-order.ts`.
 */
export const businessDateFilterSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/);

export const partyOrderFilterSchemas = {
  delivery: z.enum(PARTY_ORDER_DELIVERY_FILTERS),
  payment: z.enum(PARTY_ORDER_PAYMENT_FILTERS),
  /** The `Money pending` chip. Reads `outstanding_amount > 0`, an indexed column. */
  outstanding: z.enum(["true", "false"]),
  from: businessDateFilterSchema,
  to: businessDateFilterSchema,
};

const urlSortable = Object.fromEntries(
  PARTY_ORDER_SORT_KEYS.map((key) => [key, PARTY_ORDER_SORT_COLUMNS[key]]),
) as Record<PartyOrderSortKey, string>;

export const partyOrderTableConfig: TableConfig & {
  sortable: Record<PartyOrderSortKey, string>;
} = {
  sortable: urlSortable,
  /**
   * Start date ASCENDING, so the next event is at the top — design §3.6.
   * This list is read as a diary, not as a register: the question it answers
   * at 6 am is "what is coming", not "what was booked most recently".
   */
  defaultSort: { key: "startDate", dir: "asc" },
  /**
   * One generated column (party name ‖ phone ‖ alt phone ‖ address) under one
   * trigram index, plus `code` beside it: PostgreSQL forbids a generated column
   * referencing another generated column, so the code cannot be folded in.
   * See .claude/DATA-MODEL.md §5.2, §5.5
   */
  searchable: ["po.searchBlob", "po.code"],
  filters: {
    delivery: partyOrderFilterSchemas.delivery,
    payment: partyOrderFilterSchemas.payment,
    outstanding: partyOrderFilterSchemas.outstanding,
    from: partyOrderFilterSchemas.from,
    to: partyOrderFilterSchemas.to,
  },
  defaultPageSize: 25,
  maxPageSize: 100,
};
