import { createApiHandler } from "@/lib/api/handler";
import { coinIssueStaffSummaryQuerySchema } from "@/lib/validation/coin-issue";
import { getCoinIssueStaffSummary } from "@/lib/services/coin-issue.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/coin-issues/staff-summary?staffId= — the create form's context line.
 *
 * "Ramesh currently owes ₹4,500.00 on 1 open issue", or — when the figure is
 * negative — "You owe Ramesh Patel ₹500.00", in blue. Design §7.3
 *
 * A separate endpoint rather than a field on the staff options list: the
 * options endpoint is a picker feeding several modules, and hanging one
 * module's arithmetic off it would make every other picker pay for it.
 */
export const GET = createApiHandler({
  name: "GET /api/coin-issues/staff-summary",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: coinIssueStaffSummaryQuerySchema,
  handler: ({ query }) => getCoinIssueStaffSummary(query.staffId),
});
