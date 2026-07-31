"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAction } from "@/lib/actions/create-action";
import {
  changePasswordSchema,
  updateProfileSchema,
  updatePreferencesSchema,
} from "@/lib/validation/auth";
import {
  changePassword,
  updateProfile,
  updatePreferences,
} from "@/lib/services/auth.service";
import { LOCALE_COOKIE } from "@/i18n/config";

/**
 * Every action goes through createAction, which re-checks the session and the
 * role. Server Actions are public POST endpoints — middleware is not the
 * boundary. See .claude/ARCHITECTURE.md §5.2
 */

export const updateProfileAction = createAction({
  name: "account.updateProfile",
  schema: updateProfileSchema,
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  handler: async (input, ctx) => {
    await updateProfile(ctx.userId, input);
    revalidatePath("/settings/account");
    return { ok: true };
  },
});

export const updatePreferencesAction = createAction({
  name: "account.updatePreferences",
  schema: updatePreferencesSchema,
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  handler: async (input, ctx) => {
    await updatePreferences(ctx.userId, input);

    // Mirror the locale into the cookie so the very next server paint is in
    // the right language — no flash of the previous one.
    const store = await cookies();
    store.set(LOCALE_COOKIE, input.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    revalidatePath("/", "layout");
    return { ok: true };
  },
});

export const changePasswordAction = createAction({
  name: "account.changePassword",
  schema: changePasswordSchema,
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  handler: async (input, ctx) => {
    const { sessionVersion } = await changePassword(
      ctx.userId,
      input.currentPassword,
      input.newPassword,
    );
    revalidatePath("/settings/account");
    // Returned so the client can refresh its own token and stay signed in
    // while every other device is signed out.
    return { sessionVersion };
  },
});
