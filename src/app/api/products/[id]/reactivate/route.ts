import { createApiHandler } from "@/lib/api/handler";
import { productIdParamsSchema } from "@/lib/validation/product";
import { reactivateProduct } from "@/lib/services/product.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/products/[id]/reactivate — put a product back on order forms.
 *
 * Its own route rather than a flag on PATCH, because this is what the toast's
 * `Undo` calls: one intent, one URL, safe to retry.
 */
export const POST = createApiHandler({
  name: "POST /api/products/[id]/reactivate",
  roles: ["OWNER", "ADMIN"],
  params: productIdParamsSchema,
  handler: ({ params, ctx }) => reactivateProduct(ctx.userId, params.id),
});
