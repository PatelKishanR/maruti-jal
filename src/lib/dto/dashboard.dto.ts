/**
 * DTOs live here, not in services, so the frontend can import the TYPE without
 * pulling a server module into its import graph.
 */
export interface DashboardSummaryDto {
  period: "today" | "week" | "month" | "last-month";
  /** Placeholder until Phase 8 — proves the full data path end to end. */
  accountCount: number;
  /** Modules whose figures aren't built yet, so the UI can say so honestly. */
  pendingModules: string[];
}

export interface SessionStateDto {
  valid: boolean;
}
