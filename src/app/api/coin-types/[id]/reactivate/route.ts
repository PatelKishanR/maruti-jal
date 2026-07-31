import { createApiHandler } from "@/lib/api/handler";
import { coinTypeIdParamsSchema } from "@/lib/validation/coin-type";
import { reactivateCoinType } from "@/lib/services/coin-type.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/coin-types/[id]/reactivate
 *
 * Its own route rather than a PATCH field: reactivating is a decision, and a
 * route that carries the verb is one that can be authorised and logged as one.
 */
export const POST = createApiHandler({
  name: "POST /api/coin-types/[id]/reactivate",
  roles: ["OWNER", "ADMIN"],
  params: coinTypeIdParamsSchema,
  handler: ({ params, ctx }) => reactivateCoinType(params.id, ctx.userId),
});
