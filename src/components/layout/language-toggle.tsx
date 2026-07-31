"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import {
  locales,
  localeShortNames,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/config";
import { api } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";

/**
 * Segmented `EN | ગુ` control. Spec: .claude/design/DESIGN-STANDARDS.md §14
 *
 * Present on the LOGIN page as well as the topbar — Gujarati that only starts
 * working after you're already in is backwards. Signed out there is no account
 * to persist to, so it writes the cookie directly; signed in it also persists
 * the preference through the API.
 */
export function LanguageToggle({
  authenticated = false,
  className,
}: {
  authenticated?: boolean;
  className?: string;
}) {
  const current = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(locale: Locale) {
    startTransition(async () => {
      // Cookie first, so the switch is instant either way.
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

      if (authenticated) {
        try {
          await api.patch(apiRoutes.account.preferences, {
            locale,
            theme: (localStorage.getItem("theme") ?? "system") as string,
          });
        } catch {
          // The cookie already switched the UI; persistence can fail quietly.
        }
      }

      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5",
        isPending && "opacity-60",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            aria-pressed={active}
            disabled={isPending || active}
            onClick={() => switchTo(locale)}
            className={cn(
              "h-7 min-w-9 rounded-sm px-2 text-xs font-medium transition-colors duration-100",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {localeShortNames[locale]}
          </button>
        );
      })}
    </div>
  );
}
