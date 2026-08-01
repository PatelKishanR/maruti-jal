import { createApiHandler } from "@/lib/api/handler";
import {
  addPartyOrderDaysSchema,
  partyOrderIdParamsSchema,
} from "@/lib/validation/party-order";
import { addPartyOrderDays } from "@/lib/services/party-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/party-orders/[id]/days — add one day, or the whole run the repeat
 * generator just previewed.
 *
 * BULK by design. The generator produces five dates at once and half a
 * generated schedule is worse than none — the owner cannot tell which of them
 * landed without reading all five. See .claude/ARCHITECTURE.md §4.4
 */
export const POST = createApiHandler({
  name: "POST /api/party-orders/[id]/days",
  roles: ["OWNER", "ADMIN"],
  params: partyOrderIdParamsSchema,
  body: addPartyOrderDaysSchema,
  status: 201,
  handler: ({ params, body, ctx }) =>
    addPartyOrderDays(ctx.userId, params.id, body),
});
