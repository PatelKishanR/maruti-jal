import { createApiHandler } from "@/lib/api/handler";
import {
  coinLedgerQuerySchema,
  coinTypeIdParamsSchema,
} from "@/lib/validation/coin-type";
import { getLedger } from "@/lib/services/coin-type.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/coin-types/[id]/ledger — the register, paginated.
 *
 * There is no sort parameter by design. The register is ordered by
 * `entry_seq`, which is the order the running balances were computed in; sorted
 * any other way the balance column is meaningless. See design §5.6
 */
export const GET = createApiHandler({
  name: "GET /api/coin-types/[id]/ledger",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: coinTypeIdParamsSchema,
  query: coinLedgerQuerySchema,
  handler: ({ params, query }) => getLedger(params.id, query),
});
