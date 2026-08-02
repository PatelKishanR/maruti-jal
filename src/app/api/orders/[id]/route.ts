import { createApiHandler } from "@/lib/api/handler";
import {
  deliveryOrderIdParamsSchema,
  updateDeliveryOrderSchema,
} from "@/lib/validation/delivery-order";
import {
  cancelDeliveryOrder,
  getDeliveryOrder,
  updateDeliveryOrder,
} from "@/lib/services/delivery-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id] — lines, the returns timeline, the payments timeline and
 * both balances.
 *
 * The line array carries `grossLineTotal`, `filledReturnCredit` and the stored
 * `lineTotal` side by side, so the screen can EXPLAIN why a ₹1,400 order now
 * reads ₹1,330 rather than presenting it as a glitch. Decision D5, §9.
 */
export const GET = createApiHandler({
  name: "GET /api/orders/[id]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: deliveryOrderIdParamsSchema,
  handler: ({ params }) => getDeliveryOrder(params.id),
});

/**
 * PATCH /api/orders/[id] — edit the header, the lines, or both. Story O6.
 *
 * PARTIAL: an absent field is left alone, and absent `items` leaves the line
 * set untouched, so "fix the notes" never resends a schedule it did not change.
 *
 * Send `version` and a concurrent edit becomes a loud 409 —
 * `orders.errors.staleVersion`, carrying the current version and `updatedAt` —
 * instead of the second save silently discarding the first one's work. §8
 *
 * Three edits are REFUSED rather than warned about, each with a message key
 * naming the line: a quantity below what has already come back, removing a line
 * with return history (the events cascade), and moving an order to a different
 * staff member after jars or money have moved.
 */
export const PATCH = createApiHandler({
  name: "PATCH /api/orders/[id]",
  roles: ["OWNER", "ADMIN"],
  params: deliveryOrderIdParamsSchema,
  body: updateDeliveryOrderSchema,
  handler: ({ params, body, ctx }) =>
    updateDeliveryOrder(params.id, body, ctx.userId),
});

/**
 * DELETE /api/orders/[id] — CANCEL, not delete.
 *
 * A hard delete would cascade through `order_items`, `payments` AND
 * `order_item_return_events`, taking the entire history of the money and the
 * jars with it. Cancelled is a status.
 *
 * §8 is explicit that payments and returns must be reversed FIRST, so this
 * REFUSES an order that still has either — `orders.errors.cancelBlocked`, whose
 * meta names which of the two is in the way. The detail DTO carries the same
 * fact as `cancelBlockedBy`, so the button is disabled with an explanation
 * rather than failing on click.
 *
 * NO BODY. `api.del` sends none, and a DELETE demanding a JSON body would fail
 * the moment it was called. `cancelDeliveryOrderSchema` stays in the validation
 * module for the day the confirm dialog asks for a reason.
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/orders/[id]",
  roles: ["OWNER", "ADMIN"],
  params: deliveryOrderIdParamsSchema,
  handler: ({ params, ctx }) =>
    cancelDeliveryOrder(params.id, { reason: null }, ctx.userId),
});
