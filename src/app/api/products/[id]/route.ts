import { createApiHandler } from "@/lib/api/handler";
import {
  productIdParamsSchema,
  updateProductSchema,
} from "@/lib/validation/product";
import {
  deactivateProduct,
  getProduct,
  updateProduct,
} from "@/lib/services/product.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/products/[id] — specs, movement and price history. */
export const GET = createApiHandler({
  name: "GET /api/products/[id]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: productIdParamsSchema,
  handler: ({ params }) => getProduct(params.id),
});

/** PATCH /api/products/[id] — edit specs, price, or the active flag. */
export const PATCH = createApiHandler({
  name: "PATCH /api/products/[id]",
  roles: ["OWNER", "ADMIN"],
  params: productIdParamsSchema,
  body: updateProductSchema,
  handler: ({ params, body, ctx }) => updateProduct(ctx.userId, params.id, body),
});

/**
 * DELETE /api/products/[id] — DEACTIVATES. Nothing here is ever removed.
 *
 * Three layers make deletion impossible anyway: a RESTRICT constraint on every
 * reference, soft deletion, and the snapshot columns on order lines. DELETE is
 * the honest HTTP verb for "take this out of circulation"; the row stays.
 * See .claude/MODULES/02-products.md §6.3
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/products/[id]",
  roles: ["OWNER", "ADMIN"],
  params: productIdParamsSchema,
  handler: ({ params, ctx }) => deactivateProduct(ctx.userId, params.id),
});
