import { createApiHandler } from "@/lib/api/handler";
import {
  coinIssueIdParamsSchema,
  recordCoinReturnSchema,
} from "@/lib/validation/coin-issue";
import { recordCoinReturn } from "@/lib/services/coin-issue.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/coin-issues/[id]/returns — unsold coins come back.
 *
 * APPEND-ONLY by construction: there is no PATCH and no DELETE here, because
 * `coin_issue_return_events` has neither. A mistyped return is corrected by
 * recording a reversing event, so both rows stay visible — the difference
 * between an accounting system and a spreadsheet. DATA-MODEL §9
 *
 * One transaction writes the events, one ledger row each, and lets the triggers
 * recompute the line, the header and the coin type's cached balance. If the
 * result flips the issue into refund due, the response says so and the modal's
 * blue banner is already correct.
 */
export const POST = createApiHandler({
  name: "POST /api/coin-issues/[id]/returns",
  roles: ["OWNER", "ADMIN"],
  params: coinIssueIdParamsSchema,
  body: recordCoinReturnSchema,
  status: 201,
  handler: ({ params, body, ctx }) =>
    recordCoinReturn(params.id, body, ctx.userId),
});
