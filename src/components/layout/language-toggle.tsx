"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { locales, localeShortNames, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/lib/actions/locale";

/**
 * Segmented `EN | ગુ` control. Spec: .claude/design/DESIGN-STANDARDS.md §14
 *
 * A two-state segmented control, not a dropdown — one tap, and both options
 * are always visible. Present on the LOGIN page as well as the topbar.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const current = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

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
            onClick={() => startTransition(() => setLocaleAction(locale))}
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
