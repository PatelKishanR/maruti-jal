import { createApiHandler } from "@/lib/api/handler";
import { productLookupsQuerySchema } from "@/lib/validation/product";
import { getProductLookups } from "@/lib/services/product.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/products/lookups — tags and filter types for the form selects.
 *
 * Both in one response because the form always needs both, and two requests
 * would let the page render with one select populated and the other spinning.
 *
 * `?includeInactive=true` is for the EDIT form: a product whose tag was retired
 * last week must still show its own tag, or saving an unrelated field would
 * silently move it to whatever is first in the list.
 */
export const GET = createApiHandler({
  name: "GET /api/products/lookups",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: productLookupsQuerySchema,
  handler: ({ query }) => getProductLookups(query.includeInactive),
});
