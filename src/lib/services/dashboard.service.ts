import "server-only";
import { userRepository } from "@/lib/repositories/user.repository";
import type { DashboardSummaryQuery } from "@/lib/validation/dashboard";
import type { DashboardSummaryDto } from "@/lib/dto/dashboard.dto";

/**
 * Dashboard aggregates.
 *
 * Phase 8 replaces the body with real SQL aggregates over the cached rollup
 * columns. The shape and the FE → API → service → repository path are already
 * in place, so that phase only changes what this function returns.
 */
export async function getDashboardSummary(
  period: DashboardSummaryQuery["period"],
): Promise<DashboardSummaryDto> {
  const accountCount = await userRepository.count();

  return {
    period,
    accountCount,
    pendingModules: [
      "deliveryOrders",
      "coins",
      "partyOrders",
      "directSales",
      "expenses",
    ],
  };
}
