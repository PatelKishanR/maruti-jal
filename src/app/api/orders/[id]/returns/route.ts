import { createApiHandler } from "@/lib/api/handler";
import {
  deliveryOrderIdParamsSchema,
  recordOrderReturnSchema,
} from "@/lib/validation/delivery-order";
import { recordOrderReturn } from "@/lib/services/delivery-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[id]/returns — jars come home.
 *
 * APPEND-ONLY by construction: there is no PATCH and no DELETE here, because
 * `order_item_return_events` has neither. A mis-keyed 40 that should have been
 * 4 is corrected by inserting a REVERSING event, and both rows stay visible —
 * the difference between an accounting system and a spreadsheet. DATA-MODEL §9
 *
 * **The response total will be LOWER than the request's order total whenever
 * `filledQty` was non-zero, and that is correct.** `line_total` is generated as
 * `round((quantity − returned_filled_qty) × unit_price, 2)`: the staff member
 * is billed for what he SOLD, so 2 unsold jars coming back take ₹70 off a
 * ₹1,400 order. Decision D5, MODULES/03 §9. The DTO carries `grossAmount` and
 * `filledReturnCredit` beside the new subtotal so the screen can say why.
 *
 * CROSS-ORDER. `lines[].orderItemId` may belong to another of the same staff
 * member's orders (§6.2) — that is what lets a jar from last week be attributed
 * to the line it actually went out on, so old orders close instead of sitting
 * open forever. `allocations` does the same without naming a line, spreading a
 * bare "8 jars came back" oldest-order-first. Lines belonging to a DIFFERENT
 * staff member are refused.
 *
 * Over-returning is refused by `chk_order_items_returns_within_quantity` in the
 * database, so it holds for imports and hand-written SQL too. The service
 * checks the same ceiling first against the locked row and returns a clean 409
 * — `orders.errors.overReturn` — naming the line and what remains.
 */
export const POST = createApiHandler({
  name: "POST /api/orders/[id]/returns",
  roles: ["OWNER", "ADMIN"],
  params: deliveryOrderIdParamsSchema,
  body: recordOrderReturnSchema,
  status: 201,
  handler: ({ params, body, ctx }) =>
    recordOrderReturn(params.id, body, ctx.userId),
});
