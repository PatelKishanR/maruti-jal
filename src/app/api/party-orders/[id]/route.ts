import { createApiHandler } from "@/lib/api/handler";
import {
  cancelPartyOrderSchema,
  partyOrderIdParamsSchema,
  updatePartyOrderSchema,
} from "@/lib/validation/party-order";
import {
  cancelPartyOrder,
  getPartyOrder,
  updatePartyOrder,
} from "@/lib/services/party-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/party-orders/[id] — the booking, its whole schedule and its money. */
export const GET = createApiHandler({
  name: "GET /api/party-orders/[id]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: partyOrderIdParamsSchema,
  handler: ({ params }) => getPartyOrder(params.id),
});

/**
 * PATCH /api/party-orders/[id] — party details only.
 *
 * The schedule has its own endpoints, because a day is a thing you open and
 * change rather than a field on a form. `version` is the optimistic lock: send
 * it back and a booking someone else edited meanwhile fails loudly instead of
 * silently discarding their work.
 */
export const PATCH = createApiHandler({
  name: "PATCH /api/party-orders/[id]",
  roles: ["OWNER", "ADMIN"],
  params: partyOrderIdParamsSchema,
  body: updatePartyOrderSchema,
  handler: ({ params, body, ctx }) =>
    updatePartyOrder(ctx.userId, params.id, body),
});

/**
 * DELETE /api/party-orders/[id] — CANCELS. Nothing here is ever removed.
 *
 * The booking stays, its undelivered days become CANCELLED, and the total drops
 * to what actually went out — which is what flips a booking with a deposit to
 * `REFUND_DUE`. Delivered days are untouched, so billing history survives.
 *
 * The reason travels as a QUERY parameter rather than a body: `DELETE` with a
 * request body is poorly supported by intermediaries, and `api.del` in
 * `lib/api/client` deliberately sends none.
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/party-orders/[id]",
  roles: ["OWNER", "ADMIN"],
  params: partyOrderIdParamsSchema,
  query: cancelPartyOrderSchema,
  handler: ({ params, query, ctx }) =>
    cancelPartyOrder(ctx.userId, params.id, query),
});
