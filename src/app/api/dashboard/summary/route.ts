import { createApiHandler } from "@/lib/api/handler";
import { getDashboardSummary } from "@/lib/services/dashboard.service";
import { dashboardSummaryQuerySchema } from "@/lib/validation/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/summary?period=today
 *
 * Placeholder until Phase 8. It exists now so the dashboard page proves the
 * full FE → API → service → repository → Neon path.
 */
export const GET = createApiHandler({
  name: "GET /api/dashboard/summary",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: dashboardSummaryQuerySchema,
  handler: ({ query }) => getDashboardSummary(query.period),
});
