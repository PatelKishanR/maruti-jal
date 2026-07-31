import { createApiHandler } from "@/lib/api/handler";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword } from "@/lib/services/auth.service";

export const runtime = "nodejs";

/**
 * PUT /api/account/password — rotate the password.
 *
 * Returns the new sessionVersion so the calling device can refresh its own
 * token and stay signed in while every other device is signed out.
 */
export const PUT = createApiHandler({
  name: "PUT /api/account/password",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  body: changePasswordSchema,
  handler: ({ body, ctx }) =>
    changePassword(ctx.userId, body.currentPassword, body.newPassword),
});
