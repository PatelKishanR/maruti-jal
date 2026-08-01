import { createApiHandler } from "@/lib/api/handler";
import {
  createDirectSale,
  listDirectSales,
} from "@/lib/services/direct-sale.service";
import {
  createDirectSaleSchema,
  directSaleListQuerySchema,
} from "@/lib/validation/direct-sale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The route contains no logic: authenticate, authorise, validate, call the
 * service. Rules live in exactly one place. See ARCHITECTURE §5.1
 */
export const GET = createApiHandler({
  name: "GET /api/direct-sales",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: directSaleListQuerySchema,
  handler: ({ query }) => listDirectSales(query),
});

/**
 * Record a walk-in.
 *
 * The browser has already run this exact schema before it painted the
 * optimistic row — same file, same rules — so a 422 here means something the
 * client could not know (a hostile caller, a stale tab). It is still the only
 * guarantee: the client's copy is feedback, this one is the contract.
 */
export const POST = createApiHandler({
  name: "POST /api/direct-sales",
  roles: ["OWNER", "ADMIN"],
  body: createDirectSaleSchema,
  status: 201,
  handler: ({ body, ctx }) => createDirectSale(ctx.userId, body),
});
