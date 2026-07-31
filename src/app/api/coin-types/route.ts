import { createApiHandler } from "@/lib/api/handler";
import {
  coinTypeListQuerySchema,
  createCoinTypeSchema,
} from "@/lib/validation/coin-type";
import {
  createCoinType,
  listCoinTypes,
} from "@/lib/services/coin-type.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/coin-types — the stock overview plus its KPI strip.
 *
 * Every role may read the masters; only OWNER and ADMIN may change them.
 */
export const GET = createApiHandler({
  name: "GET /api/coin-types",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: coinTypeListQuerySchema,
  handler: ({ query }) => listCoinTypes(query),
});

/** POST /api/coin-types — create, with an optional OPENING ledger entry. */
export const POST = createApiHandler({
  name: "POST /api/coin-types",
  roles: ["OWNER", "ADMIN"],
  body: createCoinTypeSchema,
  status: 201,
  handler: ({ body, ctx }) => createCoinType(body, ctx.userId),
});
