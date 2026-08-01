import { createApiHandler } from "@/lib/api/handler";
import {
  coinIssueIdParamsSchema,
  recordCoinPaymentSchema,
} from "@/lib/validation/coin-issue";
import { recordCoinPayment } from "@/lib/services/coin-issue.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/coin-issues/[id]/payments — money in, or money back out.
 *
 * ONE endpoint for both directions, because they are one table and one act:
 * `direction` is `IN` for an instalment and `OUT` for a refund. It arrives in
 * the body, fixed by which button opened the modal, and is never a toggle the
 * user can flip mid-entry — mixing the two up is the most costly mistake
 * available on this screen. Design §10.1
 *
 * `payments` is APPEND-ONLY, so there is no PATCH: a wrong payment is corrected
 * by a reversing row that points back at it.
 */
export const POST = createApiHandler({
  name: "POST /api/coin-issues/[id]/payments",
  roles: ["OWNER", "ADMIN"],
  params: coinIssueIdParamsSchema,
  body: recordCoinPaymentSchema,
  status: 201,
  handler: ({ params, body, ctx }) =>
    recordCoinPayment(params.id, body, ctx.userId),
});
