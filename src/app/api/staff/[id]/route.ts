import { createApiHandler } from "@/lib/api/handler";
import {
  deactivateStaff,
  getStaff,
  updateStaff,
} from "@/lib/services/staff.service";
import {
  staffIdParamsSchema,
  updateStaffSchema,
} from "@/lib/validation/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler({
  name: "GET /api/staff/[id]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: staffIdParamsSchema,
  handler: ({ params }) => getStaff(params.id),
});

export const PATCH = createApiHandler({
  name: "PATCH /api/staff/[id]",
  roles: ["OWNER", "ADMIN"],
  params: staffIdParamsSchema,
  body: updateStaffSchema,
  handler: ({ params, body, ctx }) => updateStaff(ctx.userId, params.id, body),
});

/**
 * DELETE deactivates. Nothing here is ever hard-deleted — history has to keep
 * rendering, and every reference to staff is a RESTRICT constraint, so the
 * database would refuse anyway. See MODULES/01-staff.md §6
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/staff/[id]",
  roles: ["OWNER", "ADMIN"],
  params: staffIdParamsSchema,
  handler: ({ params, ctx }) => deactivateStaff(ctx.userId, params.id),
});
