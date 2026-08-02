import { createApiHandler } from "@/lib/api/handler";
import { getReportIndex } from "@/lib/services/report.service";

export const runtime = "nodejs";

/**
 * The report launcher's live figures — design/MODULES/09-reports.md §3.3.
 *
 * A read, so every role may call it. Reports never write, so this file has no
 * POST and never will.
 */
export const GET = createApiHandler({
  name: "GET /api/reports",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  handler: () => getReportIndex(),
});
