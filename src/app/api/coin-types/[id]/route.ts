import { createApiHandler } from "@/lib/api/handler";
import {
  coinTypeIdParamsSchema,
  updateCoinTypeSchema,
} from "@/lib/validation/coin-type";
import {
  deactivateCoinType,
  getCoinType,
  updateCoinType,
} from "@/lib/services/coin-type.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/coin-types/[id] — detail, with the ledger reconciliation figures. */
export const GET = createApiHandler({
  name: "GET /api/coin-types/[id]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: coinTypeIdParamsSchema,
  handler: ({ params }) => getCoinType(params.id),
});

export const PATCH = createApiHandler({
  name: "PATCH /api/coin-types/[id]",
  roles: ["OWNER", "ADMIN"],
  params: coinTypeIdParamsSchema,
  body: updateCoinTypeSchema,
  handler: ({ params, body, ctx }) =>
    updateCoinType(params.id, body, ctx.userId),
});

/**
 * DELETE /api/coin-types/[id] — DEACTIVATE, not delete.
 *
 * A coin type with any ledger movement is physically undeletable: the ledger's
 * foreign keys are ON DELETE RESTRICT. Retiring it is the only operation that
 * exists, and the service refuses even that while stock remains.
 * See MODULES/04-coins.md §8
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/coin-types/[id]",
  roles: ["OWNER", "ADMIN"],
  params: coinTypeIdParamsSchema,
  handler: ({ params, ctx }) => deactivateCoinType(params.id, ctx.userId),
});
