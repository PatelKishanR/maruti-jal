import { createApiHandler } from "@/lib/api/handler";
import {
  partyOrderIdParamsSchema,
  recordPartyPaymentSchema,
} from "@/lib/validation/party-order";
import { recordPartyPayment } from "@/lib/services/party-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/party-orders/[id]/payments — money in against the booking.
 *
 * Against the BOOKING, not a day: a party pays a deposit, some cash mid-event
 * and the balance at the end, and none of those belong to one delivery.
 *
 * `clientRequestId` makes it idempotent — the modal mints one per open, so an
 * impatient second tap returns the booking as it already stands instead of
 * charging the party twice. See .claude/DATA-MODEL.md §10.11
 */
export const POST = createApiHandler({
  name: "POST /api/party-orders/[id]/payments",
  roles: ["OWNER", "ADMIN"],
  params: partyOrderIdParamsSchema,
  body: recordPartyPaymentSchema,
  status: 201,
  handler: ({ params, body, ctx }) =>
    recordPartyPayment(ctx.userId, params.id, body),
});
