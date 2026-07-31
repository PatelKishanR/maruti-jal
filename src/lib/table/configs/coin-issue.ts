import { z } from "zod";
import type { TableConfig } from "@/lib/table/types";

/**
 * The coin-issue register table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/04-coins.md §6
 *
 * The single source of truth for the sort allowlist AND the filter vocabulary:
 * `CoinIssueRepository` imports the sort map, the client table imports the
 * filter keys, and `coinIssueListQuerySchema` derives its enums from here.
 *
 * Client-safe by construction — zod and types only, no `server-only`, no
 * entity or repository imports. See .claude/MODULE-RECIPE.md §1
 */

/**
 * Public sort key → hard-coded qualified SQL column.
 *
 * THE INJECTION DEFENCE IS THIS MAP: user input is only ever a lookup KEY into
 * it, so `?sort=id;DROP TABLE coin_issues` misses it and falls back to the
 * default. See .claude/ARCHITECTURE.md §6.2
 *
 * `staff` sorts on the JOINED alias, so it is only valid for queries that join
 * `ci.staff` as `s` — `searchPaginated` does.
 */
export const COIN_ISSUE_SORT_COLUMNS = {
  issueDate: "ci.issueDate",
  /** The identity number, not the text code — 'CIS-9' must precede 'CIS-10'. */
  code: "ci.issueNo",
  staff: "s.name",
  netPayable: "ci.netPayable",
  outstandingAmount: "ci.outstandingAmount",
  totalCoinsIssued: "ci.totalCoinsIssued",
  createdAt: "ci.createdAt",
} as const;

export type CoinIssueSortKey = keyof typeof COIN_ISSUE_SORT_COLUMNS;

/** True when the parsed key is one the repository can actually order by. */
export function isCoinIssueSortKey(key: string): key is CoinIssueSortKey {
  return Object.hasOwn(COIN_ISSUE_SORT_COLUMNS, key);
}

/**
 * The register's status vocabulary.
 *
 * Deliberately NOT the raw `payment_status` enum. The owner reads this column
 * as "what do I do about this row?", and the answer comes from ONE signed
 * number — `outstanding_amount` — which is positive when he is owed, negative
 * when he owes, and zero when the relationship is closed. Design §6.4
 */
export const COIN_ISSUE_STATUS_FILTERS = [
  "pending",
  "partial",
  "settled",
  "refund_due",
  "cancelled",
] as const;

export type CoinIssueStatusFilter = (typeof COIN_ISSUE_STATUS_FILTERS)[number];

/** Filter param names, so the chips, the URL and the schema cannot drift. */
export const COIN_ISSUE_FILTERS = {
  status: "status",
  staffId: "staffId",
  coinTypeId: "coinTypeId",
  from: "from",
  to: "to",
} as const;

/** `'YYYY-MM-DD'`, matching the string-only business date rule of §9.2. */
const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

export const coinIssueTableConfig = {
  sortable: COIN_ISSUE_SORT_COLUMNS,
  /** The register is read newest first — today's issues at the top. */
  defaultSort: { key: "issueDate", dir: "desc" },
  /**
   * The issue's own code plus the staff member it went to. `coin_issues` has no
   * `search_blob`: the free-text question here is "which of Ramesh's issues?",
   * and that name and phone live on `staff`. See .claude/DATA-MODEL.md §5.2
   */
  searchable: ["ci.code", "s.name", "s.phone"],
  filters: {
    [COIN_ISSUE_FILTERS.status]: z.enum(COIN_ISSUE_STATUS_FILTERS),
    [COIN_ISSUE_FILTERS.staffId]: uuid,
    [COIN_ISSUE_FILTERS.coinTypeId]: uuid,
    [COIN_ISSUE_FILTERS.from]: businessDate,
    [COIN_ISSUE_FILTERS.to]: businessDate,
  },
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
