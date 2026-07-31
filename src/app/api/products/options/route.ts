import { createApiHandler } from "@/lib/api/handler";
import { productOptionsQuerySchema } from "@/lib/validation/product";
import { listProductOptions } from "@/lib/services/product.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/products/options?q= — `ComboboxOption[]` for every product picker.
 *
 * Delivery orders, party orders and direct sales all point `EntityCombobox`
 * here, so the label (title) and the hint (`20L · ₹35.00`) are decided once.
 * Active products only: an order can never be raised against a retired one.
 *
 * A static segment, so it is matched before `[id]` — `/options` is not a uuid
 * and would 422 there anyway, but the ordering is what makes it never try.
 */
export const GET = createApiHandler({
  name: "GET /api/products/options",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: productOptionsQuerySchema,
  handler: ({ query }) => listProductOptions(query.q),
});
