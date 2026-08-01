import { createApiHandler } from "@/lib/api/handler";
import {
  coinAdjustmentListQuerySchema,
  createCoinAdjustmentSchema,
} from "@/lib/validation/coin-adjustment";
import {
  createCoinAdjustment,
  listCoinAdjustments,
} from "@/lib/services/coin-adjustment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/coin-adjustments — every manual correction to stock, with its reason.
 *
 * This list exists so that a stock change without an explanation is impossible
 * to hide, which is why the mandatory note is a column and not a detail page.
 */
export const GET = createApiHandler({
  name: "GET /api/coin-adjustments",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: coinAdjustmentListQuerySchema,
  handler: ({ query }) => listCoinAdjustments(query),
});

/**
 * POST /api/coin-adjustments — change stock by hand.
 *
 * There is deliberately no PATCH and no DELETE on this resource, here or
 * anywhere: `coin_adjustments` has no `deleted_at` column, and a wrong
 * adjustment is corrected by recording an opposing one. Both stay in the
 * ledger. DATA-MODEL §5.13
 */
export const POST = createApiHandler({
  name: "POST /api/coin-adjustments",
  roles: ["OWNER", "ADMIN"],
  body: createCoinAdjustmentSchema,
  status: 201,
  handler: ({ body, ctx }) => createCoinAdjustment(body, ctx.userId),
});
