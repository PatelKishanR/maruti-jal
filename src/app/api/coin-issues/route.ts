import { createApiHandler } from "@/lib/api/handler";
import {
  coinIssueListQuerySchema,
  createCoinIssueSchema,
} from "@/lib/validation/coin-issue";
import {
  createCoinIssue,
  listCoinIssues,
} from "@/lib/services/coin-issue.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/coin-issues — the register, its KPI strip and the §13 drift check,
 * in one payload.
 *
 * Every role may read; only OWNER and ADMIN may hand coins out.
 */
export const GET = createApiHandler({
  name: "GET /api/coin-issues",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: coinIssueListQuerySchema,
  handler: ({ query }) => listCoinIssues(query),
});

/**
 * POST /api/coin-issues — the handover.
 *
 * Header, lines, one ledger row per line and an optional payment, in ONE
 * transaction. Stock is re-checked under a row lock inside it, so a request
 * that raced another to the last packet comes back as a 409 rather than
 * overdrawing the float. See coin-issue.service.ts
 */
export const POST = createApiHandler({
  name: "POST /api/coin-issues",
  roles: ["OWNER", "ADMIN"],
  body: createCoinIssueSchema,
  status: 201,
  handler: ({ body, ctx }) => createCoinIssue(body, ctx.userId),
});
