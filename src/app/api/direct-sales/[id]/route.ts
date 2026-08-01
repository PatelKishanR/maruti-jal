import { createApiHandler } from "@/lib/api/handler";
import {
  getDirectSale,
  updateDirectSale,
  voidDirectSale,
} from "@/lib/services/direct-sale.service";
import {
  directSaleIdParamsSchema,
  updateDirectSaleSchema,
  voidDirectSaleSchema,
} from "@/lib/validation/direct-sale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler({
  name: "GET /api/direct-sales/[id]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: directSaleIdParamsSchema,
  handler: ({ params }) => getDirectSale(params.id),
});

/**
 * PATCH corrects a same-day entry. The window is checked against the STORED
 * row, so it lives in the service — a schema cannot see what is on disk.
 */
export const PATCH = createApiHandler({
  name: "PATCH /api/direct-sales/[id]",
  roles: ["OWNER", "ADMIN"],
  params: directSaleIdParamsSchema,
  body: updateDirectSaleSchema,
  handler: ({ params, body, ctx }) =>
    updateDirectSale(ctx.userId, params.id, body),
});

/**
 * DELETE voids. Nothing here is ever removed.
 *
 * The row stays in the register, struck through and out of every total, so
 * receipt numbering has no gaps and a tallied day cannot be quietly altered.
 * The reason travels in the body rather than the query string because it is a
 * sentence a person wrote, and it ends up quoted on the detail page — a URL is
 * the wrong place for it, and it is required, not optional.
 * See MODULES/06-direct-sales.md §6
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/direct-sales/[id]",
  roles: ["OWNER", "ADMIN"],
  params: directSaleIdParamsSchema,
  body: voidDirectSaleSchema,
  handler: ({ params, body, ctx }) =>
    voidDirectSale(ctx.userId, params.id, body),
});
