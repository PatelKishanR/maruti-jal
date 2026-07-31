import { cookies } from "next/headers";
import { createApiHandler } from "@/lib/api/handler";
import { updatePreferencesSchema } from "@/lib/validation/auth";
import { updatePreferences } from "@/lib/services/auth.service";
import { LOCALE_COOKIE } from "@/i18n/config";

export const runtime = "nodejs";

/** PATCH /api/account/preferences — language and theme. */
export const PATCH = createApiHandler({
  name: "PATCH /api/account/preferences",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  body: updatePreferencesSchema,
  handler: async ({ body, ctx }) => {
    const user = await updatePreferences(ctx.userId, body);

    // Mirror the locale into a cookie so the very next server paint is in the
    // right language — no flash of the previous one.
    const store = await cookies();
    store.set(LOCALE_COOKIE, body.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return user;
  },
});
