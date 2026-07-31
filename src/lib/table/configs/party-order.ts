import type { TableConfig } from "@/lib/table/types";

/**
 * The party-order table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/05-party-orders.md
 *
 * Written ahead of the module (wave 4) so the allowlist exists in ONE place
 * from the first line of UI code. `PartyOrderRepository` already imports it.
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

export const partyOrderTableConfig = {
  sortable: PARTY_ORDER_SORT_COLUMNS,
  /** Upcoming and recent bookings first — the register is read newest first. */
  defaultSort: { key: "startDate", dir: "desc" },
  /**
   * One generated column (party name ‖ phone ‖ alt phone ‖ address) under one
   * trigram index, plus `code` beside it: PostgreSQL forbids a generated column
   * referencing another generated column, so the code cannot be folded in.
   * See .claude/DATA-MODEL.md §5.2, §5.5
   */
  searchable: ["po.searchBlob", "po.code"],
  /**
   * TODO(wave-4): status, paymentStatus, the overlapping date range and the
   * "outstanding only" chip get their Zod schemas here when the list page
   * ships. The repository already filters on all of them.
   */
  filters: {},
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
