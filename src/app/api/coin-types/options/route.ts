import { createApiHandler } from "@/lib/api/handler";
import { coinTypeOptionsQuerySchema } from "@/lib/validation/coin-type";
import { listCoinTypeOptions } from "@/lib/services/coin-type.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/coin-types/options — `ComboboxOption[]` for `<EntityCombobox>`.
 *
 * Active types only. Coin issues and coin payments both pick from here, so the
 * shape is deliberately the picker's shape rather than a coin type DTO: the
 * label is the name and the hint is `₹10.00 × 100`, which is wordless and so
 * reads identically in English and Gujarati.
 *
 * Placed before `[id]` in the segment order it would otherwise collide with —
 * `options` is a literal segment, so Next matches it ahead of the dynamic one.
 */
export const GET = createApiHandler({
  name: "GET /api/coin-types/options",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: coinTypeOptionsQuerySchema,
  handler: ({ query }) => listCoinTypeOptions(query.q),
});
