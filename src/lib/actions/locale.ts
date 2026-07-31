"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/config";
import { updatePreferences } from "@/lib/services/auth.service";
import { getDataSource } from "@/lib/db/data-source";
import { User } from "@/lib/db/entities";

/**
 * Switch UI language.
 *
 * Works signed OUT too — the login page has a language toggle, because
 * Gujarati that only starts working after you're already in is backwards.
 * Signed in, the choice is also persisted to the user record so it survives
 * a new browser.
 */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false, // read by the client toggle for instant feedback
  });

  const session = await auth();
  if (session?.user?.id) {
    const ds = await getDataSource();
    const user = await ds.getRepository(User).findOne({
      where: { id: session.user.id },
      select: { id: true, theme: true },
    });

    await updatePreferences(session.user.id, {
      locale: locale as Locale,
      theme: (user?.theme ?? "system") as "light" | "dark" | "system",
    });
  }

  revalidatePath("/", "layout");
}
