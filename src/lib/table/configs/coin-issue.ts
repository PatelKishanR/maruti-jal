import type { TableConfig } from "@/lib/table/types";

/**
 * The coin-issue register table contract. Spec: .claude/ARCHITECTURE.md §6.1 ·
 * design/MODULES/04-coins.md
 *
 * Written ahead of the module (wave 3) so the allowlist exists in ONE place
 * from the first line of UI code. `CoinIssueRepository` already imports it.
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
  /**
   * TODO(wave-3): staff, status, coin type, the date range and the
   * "outstanding only" chip get their Zod schemas here when the list page
   * ships. The repository already filters on all five.
   */
  filters: {},
  defaultPageSize: 25,
  maxPageSize: 100,
} satisfies TableConfig;
