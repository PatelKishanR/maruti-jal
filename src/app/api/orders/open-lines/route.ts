import { createApiHandler } from "@/lib/api/handler";
import { openReturnLinesQuerySchema } from "@/lib/validation/delivery-order";
import { listOpenReturnLines } from "@/lib/services/delivery-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/open-lines?staffId=… — every still-open line for one staff
 * member, across ALL his orders. §6.2
 *
 * THIS IS WHAT MAKES OLD ORDERS CLOSE. A customer routinely hands back last
 * week's jar when this week's staff member calls, and unless that return can be
 * attributed to the line the jar actually went out on, the old order sits open
 * forever and the jars-out figure inflates permanently. The return modal lists
 * these beside the current order's own lines, newest first, and posts the ones
 * the clerk ticks to `POST /api/orders/[id]/returns`.
 *
 * Non-returnable products never appear: disposable bottles are not counted, and
 * `is_returnable` is a SNAPSHOT, so reclassifying a product today cannot
 * retroactively change what an old line owes.
 *
 * `staffId` is REQUIRED, not optional. "Every open line" with no staff member
 * is every open line in the business — a question nobody asks and an accident
 * waiting to page through forty thousand rows.
 *
 * Sits at `/api/orders/open-lines` rather than under `[id]` because it is a
 * question about a PERSON, not about an order. Next resolves the static segment
 * ahead of the dynamic one, so it never collides with `/api/orders/[id]`.
 */
export const GET = createApiHandler({
  name: "GET /api/orders/open-lines",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: openReturnLinesQuerySchema,
  handler: ({ query }) => listOpenReturnLines(query),
});
