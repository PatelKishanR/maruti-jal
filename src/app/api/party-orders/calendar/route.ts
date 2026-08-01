import { createApiHandler } from "@/lib/api/handler";
import { partyCalendarQuerySchema } from "@/lib/validation/party-order";
import { getPartyCalendar } from "@/lib/services/party-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/party-orders/calendar — every party delivery in one month's grid.
 *
 * The only read in the module that crosses bookings by date, and the one the
 * owner opens at 6 am while jars are being loaded. The window is padded to
 * whole Monday→Sunday weeks by the service, so the page can chunk the dates by
 * seven without doing any date arithmetic of its own.
 *
 * A static segment, so it never collides with `/api/party-orders/[id]`.
 */
export const GET = createApiHandler({
  name: "GET /api/party-orders/calendar",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: partyCalendarQuerySchema,
  handler: ({ query }) => getPartyCalendar(query),
});
