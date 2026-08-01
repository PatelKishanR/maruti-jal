import { createApiHandler } from "@/lib/api/handler";
import { partyOrderOptionsQuerySchema } from "@/lib/validation/party-order";
import { listPartyOrderOptions } from "@/lib/services/party-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/party-orders/options — live bookings as `ComboboxOption[]`.
 *
 * Every module ships one: the calendar's empty-cell popover asks "add a
 * delivery day to which booking?", and later modules will pick from this too.
 * See .claude/MODULE-RECIPE.md §5
 */
export const GET = createApiHandler({
  name: "GET /api/party-orders/options",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: partyOrderOptionsQuerySchema,
  handler: ({ query }) => listPartyOrderOptions(query),
});
