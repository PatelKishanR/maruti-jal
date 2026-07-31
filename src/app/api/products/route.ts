import { createApiHandler } from "@/lib/api/handler";
import {
  createProductSchema,
  productListQuerySchema,
} from "@/lib/validation/product";
import { createProduct, listProducts } from "@/lib/services/product.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/products — the catalogue list plus its KPI strip.
 *
 * Everyone may read the catalogue: an order form is useless without it.
 */
export const GET = createApiHandler({
  name: "GET /api/products",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: productListQuerySchema,
  handler: ({ query }) => listProducts(query),
});

/**
 * POST /api/products — define a new container to sell.
 *
 * Writing the catalogue is a masters-level action; a manager raises orders
 * against it rather than changing what the plant sells.
 */
export const POST = createApiHandler({
  name: "POST /api/products",
  roles: ["OWNER", "ADMIN"],
  body: createProductSchema,
  status: 201,
  handler: ({ body, ctx }) => createProduct(ctx.userId, body),
});
