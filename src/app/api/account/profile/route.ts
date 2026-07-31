import { createApiHandler } from "@/lib/api/handler";
import { updateProfileSchema } from "@/lib/validation/auth";
import { updateProfile } from "@/lib/services/auth.service";

export const runtime = "nodejs";

/** PATCH /api/account/profile — update name and email. */
export const PATCH = createApiHandler({
  name: "PATCH /api/account/profile",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  body: updateProfileSchema,
  handler: ({ body, ctx }) => updateProfile(ctx.userId, body),
});
