import { createApiHandler } from "@/lib/api/handler";
import { runReport } from "@/lib/services/report.service";
import {
  reportQuerySchema,
  reportSlugParamsSchema,
} from "@/lib/validation/report";

export const runtime = "nodejs";

/**
 * Run one report — design/MODULES/09-reports.md §4.
 *
 * The slug is validated against the enum, so an unknown report is a 422 rather
 * than a switch falling through to `undefined`. Every filter is validated too,
 * and each one carries `.catch(undefined)`, so a stale bookmarked URL degrades
 * to the report's defaults instead of throwing the screen away.
 *
 * No logic here: the route validates and calls the service. MODULE-RECIPE §5.
 */
export const GET = createApiHandler({
  name: "GET /api/reports/[slug]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: reportSlugParamsSchema,
  query: reportQuerySchema,
  handler: ({ params, query }) => runReport(params.slug, query),
});
