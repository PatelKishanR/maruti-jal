import { createApiHandler } from "@/lib/api/handler";
import {
  partyOrderDayParamsSchema,
  updatePartyOrderDaySchema,
} from "@/lib/validation/party-order";
import {
  removePartyOrderDay,
  updatePartyOrderDay,
} from "@/lib/services/party-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/party-orders/[id]/days/[dayId] — one delivery day.
 *
 * `items` absent leaves the lines alone, so `Mark skipped`, `Assign staff` and
 * `Mark delivered` never have to resend a schedule they did not touch. Present
 * replaces them wholesale.
 */
export const PATCH = createApiHandler({
  name: "PATCH /api/party-orders/[id]/days/[dayId]",
  roles: ["OWNER", "ADMIN"],
  params: partyOrderDayParamsSchema,
  body: updatePartyOrderDaySchema,
  handler: ({ params, body, ctx }) =>
    updatePartyOrderDay(ctx.userId, params.id, params.dayId, body),
});

/**
 * DELETE /api/party-orders/[id]/days/[dayId] — take the date out entirely.
 *
 * A DELIVERED day is refused with a 409 and must be cancelled instead: deleting
 * it would rewrite what the party was billed for water it received.
 * See .claude/MODULES/05-party-orders.md §7
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/party-orders/[id]/days/[dayId]",
  roles: ["OWNER", "ADMIN"],
  params: partyOrderDayParamsSchema,
  handler: ({ params, ctx }) =>
    removePartyOrderDay(ctx.userId, params.id, params.dayId),
});
