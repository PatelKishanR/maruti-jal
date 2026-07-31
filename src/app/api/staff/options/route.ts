import { createApiHandler } from "@/lib/api/handler";
import { listStaffOptions } from "@/lib/services/staff.service";
import { staffOptionsQuerySchema } from "@/lib/validation/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `ComboboxOption[]` for the shared EntityCombobox — the endpoint every module
 * that assigns work to a person will point at.
 *
 * Active staff only: an inactive member must not appear in a new order or coin
 * issue form. Their history stays intact, they simply stop being choosable.
 */
export const GET = createApiHandler({
  name: "GET /api/staff/options",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: staffOptionsQuerySchema,
  handler: ({ query }) => listStaffOptions(query.q),
});
