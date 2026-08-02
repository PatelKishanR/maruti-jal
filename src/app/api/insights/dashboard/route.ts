import { createApiHandler } from "@/lib/api/handler";
import { getExecutiveDashboard } from "@/lib/services/dashboard.service";
import { dashboardQuerySchema } from "@/lib/validation/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/insights/dashboard?period=today
 *
 * Everything the executive dashboard renders, in ONE response: the period row,
 * the current money-at-risk position, four charts and three tables. Four rows
 * that must agree with each other cannot be four round trips — the moment they
 * are, the owner can read two different seconds at once.
 *
 * `force-dynamic` because the whole value of this screen is that it is current.
 * A cached cash position is a wrong cash position.
 *
 * VIEWER is included for the same reason as `/api/insights/summary`: the
 * figures are read-only by construction, and an owner or manager who cannot see
 * the day's takings here will go and find them somewhere less trustworthy.
 *
 * No logic in the route — authenticate, authorise, validate, call the service.
 * See .claude/ARCHITECTURE.md §5.1 · MODULE-RECIPE §5
 */
export const GET = createApiHandler({
  name: "GET /api/insights/dashboard",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: dashboardQuerySchema,
  handler: ({ query }) => getExecutiveDashboard(query),
});
