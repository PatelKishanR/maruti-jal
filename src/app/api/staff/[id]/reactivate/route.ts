import { createApiHandler } from "@/lib/api/handler";
import { reactivateStaff } from "@/lib/services/staff.service";
import { staffIdParamsSchema } from "@/lib/validation/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Its own route rather than a PATCH flag: bringing someone back is a distinct
 * intent with its own permission and its own log line, and it must not be
 * reachable by a stray `isActive: true` in an unrelated edit payload.
 */
export const POST = createApiHandler({
  name: "POST /api/staff/[id]/reactivate",
  roles: ["OWNER", "ADMIN"],
  params: staffIdParamsSchema,
  handler: ({ params, ctx }) => reactivateStaff(ctx.userId, params.id),
});
