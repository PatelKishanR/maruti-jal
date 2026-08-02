import { createApiHandler } from "@/lib/api/handler";
import {
  createDeliveryOrderSchema,
  deliveryOrderListQuerySchema,
} from "@/lib/validation/delivery-order";
import {
  createDeliveryOrder,
  listDeliveryOrders,
} from "@/lib/services/delivery-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders — the register and its §7.3 KPI strip in ONE payload.
 *
 * Two round trips would land a beat apart and read as the page still loading;
 * worse, the strip would briefly disagree with the table under it. The summary
 * is aggregated over the SAME filters as the rows, so every card is a door into
 * the list behind it.
 *
 * Every role may read; only OWNER and ADMIN may raise an order.
 */
export const GET = createApiHandler({
  name: "GET /api/orders",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: deliveryOrderListQuerySchema,
  handler: ({ query }) => listDeliveryOrders(query),
});

/**
 * POST /api/orders — a morning's load-out.
 *
 * Header, one line per product and — optionally — the payment taken on the spot
 * with its coin ledger rows, in ONE transaction. Story O4: "paid on the spot is
 * the common case, and it is one form, not two."
 *
 * Nothing in the request carries a total. `order_items.line_total` is generated
 * and `delivery_orders.subtotal_amount` is trigger-maintained, so the response
 * is read back inside the transaction and carries the figures the database
 * actually holds. See delivery-order.service.ts
 */
export const POST = createApiHandler({
  name: "POST /api/orders",
  roles: ["OWNER", "ADMIN"],
  body: createDeliveryOrderSchema,
  status: 201,
  handler: ({ body, ctx }) => createDeliveryOrder(body, ctx.userId),
});
