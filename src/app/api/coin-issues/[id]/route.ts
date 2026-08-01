import { createApiHandler } from "@/lib/api/handler";
import {
  coinIssueIdParamsSchema,
  settleCoinIssueDifferenceSchema,
} from "@/lib/validation/coin-issue";
import {
  cancelCoinIssue,
  getCoinIssue,
  settleCoinIssueDifference,
} from "@/lib/services/coin-issue.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/coin-issues/[id] — lines, returns, payments and the net position. */
export const GET = createApiHandler({
  name: "GET /api/coin-issues/[id]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: coinIssueIdParamsSchema,
  handler: ({ params }) => getCoinIssue(params.id),
});

/**
 * PATCH /api/coin-issues/[id] — SETTLE THE DIFFERENCE.
 *
 * The only in-place mutation an issue accepts. Coin lines are deliberately NOT
 * editable: each one snapshots the rate it was issued at and has already moved
 * stock through the ledger, so "editing" one would mean reversing a movement —
 * which is a cancel-and-reissue, not an update.
 *
 * What remains is the five-paise stub §8.2 leaves behind when a packet does not
 * divide evenly. It takes no amount — the residual is whatever the ledger says
 * it is, and letting a human type it would make the write-off a way to move
 * real money.
 */
export const PATCH = createApiHandler({
  name: "PATCH /api/coin-issues/[id]",
  roles: ["OWNER", "ADMIN"],
  params: coinIssueIdParamsSchema,
  body: settleCoinIssueDifferenceSchema,
  handler: ({ params, body, ctx }) =>
    settleCoinIssueDifference(params.id, body, ctx.userId),
});

/**
 * DELETE /api/coin-issues/[id] — CANCEL, not delete.
 *
 * An issue with ledger movements is physically undeletable: the ledger's
 * foreign keys are ON DELETE RESTRICT. Cancelling puts the coins still out back
 * into stock through an `ISSUE_CANCELLED` entry and leaves every payment
 * exactly where it is — money that changed hands is never unwritten.
 *
 * NO BODY. The §6.4 confirm dialog asks one question and offers two buttons —
 * it never collects a reason — and a DELETE that demanded a JSON body would
 * fail the moment `api.del` (which sends none) called it. `cancelCoinIssueSchema`
 * stays in the validation module for the day a reason is asked for.
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/coin-issues/[id]",
  roles: ["OWNER", "ADMIN"],
  params: coinIssueIdParamsSchema,
  handler: ({ params, ctx }) =>
    cancelCoinIssue(params.id, { reason: null }, ctx.userId),
});
