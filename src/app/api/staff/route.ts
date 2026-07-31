import { createApiHandler } from "@/lib/api/handler";
import { createStaff, listStaff } from "@/lib/services/staff.service";
import {
  createStaffSchema,
  staffListQuerySchema,
} from "@/lib/validation/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The route contains no logic: authenticate, authorise, validate, call the
 * service. Rules live in exactly one place. See ARCHITECTURE §5.1
 */
export const GET = createApiHandler({
  name: "GET /api/staff",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: staffListQuerySchema,
  handler: ({ query }) => listStaff(query),
});

/** Master data is owner/admin territory; everyone else reads. */
export const POST = createApiHandler({
  name: "POST /api/staff",
  roles: ["OWNER", "ADMIN"],
  body: createStaffSchema,
  status: 201,
  handler: ({ body, ctx }) => createStaff(ctx.userId, body),
});
