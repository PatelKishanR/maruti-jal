import { createApiHandler } from "@/lib/api/handler";
import { coinIssueOptionsQuerySchema } from "@/lib/validation/coin-issue";
import { listCoinIssueOptions } from "@/lib/services/coin-issue.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/coin-issues/options — `ComboboxOption[]` for `<EntityCombobox>`.
 *
 * Open handovers with something still outstanding, optionally narrowed to one
 * staff member. Delivery orders will pick from here when a customer pays in
 * coins. See .claude/MODULE-RECIPE.md §5
 *
 * Placed before `[id]` in the segment order it would otherwise collide with —
 * `options` is a literal segment, so Next matches it ahead of the dynamic one.
 */
export const GET = createApiHandler({
  name: "GET /api/coin-issues/options",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: coinIssueOptionsQuerySchema,
  handler: ({ query }) => listCoinIssueOptions(query),
});
