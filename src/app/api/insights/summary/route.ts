import { createApiHandler } from "@/lib/api/handler";
import { getExecSummary } from "@/lib/services/insights.service";
import { insightsSummaryQuerySchema } from "@/lib/validation/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/insights/summary
 *
 * The dashboard headline: today's and this month's revenue and collection,
 * every receivable split by where it is owed from, jars out, the coin stock and
 * the coin float — one row from `v_exec_summary`.
 *
 * `force-dynamic` because the whole value of this figure is that it is current.
 * A cached cash position is a wrong cash position.
 *
 * VIEWER is included: the summary is read-only by construction, and a manager
 * or owner who cannot see the day's takings on the dashboard will go and find
 * them somewhere less trustworthy. Nothing here is per-user, so there is no
 * row-level access question to answer.
 *
 * The route contains no logic: authenticate, authorise, validate, call the
 * service. See ARCHITECTURE §5.1
 */
export const GET = createApiHandler({
  name: "GET /api/insights/summary",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: insightsSummaryQuerySchema,
  handler: () => getExecSummary(),
});
