import { createApiHandler } from "@/lib/api/handler";
import {
  createPartyOrderSchema,
  partyOrderListQuerySchema,
} from "@/lib/validation/party-order";
import {
  createPartyOrder,
  listPartyOrders,
} from "@/lib/services/party-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/party-orders — the bookings list plus its KPI strip.
 *
 * Everyone may read it: "what is going out today, and who owes what" is the
 * question the whole plant runs on.
 */
export const GET = createApiHandler({
  name: "GET /api/party-orders",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: partyOrderListQuerySchema,
  handler: ({ query }) => listPartyOrders(query),
});

/**
 * POST /api/party-orders — book a party.
 *
 * Header, every delivery day, every line and an optional deposit, in ONE
 * transaction inside the service. The route validates and delegates; it holds
 * no business rules of its own. See .claude/ARCHITECTURE.md §4
 */
export const POST = createApiHandler({
  name: "POST /api/party-orders",
  roles: ["OWNER", "ADMIN"],
  body: createPartyOrderSchema,
  status: 201,
  handler: ({ body, ctx }) => createPartyOrder(ctx.userId, body),
});
