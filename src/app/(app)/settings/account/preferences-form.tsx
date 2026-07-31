"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { api } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import type { UserDto } from "@/lib/dto/user.dto";

type Theme = "light" | "dark" | "system";
const THEMES: Theme[] = ["light", "dark", "system"];

/**
 * Language and theme apply INSTANTLY and persist on their own.
 *
 * They are preferences, not form data — making someone press Save to see a
 * theme change is needlessly indirect. Name and email, which are form data,
 * do require Save. See .claude/design/MODULES/00-auth.md §6.6
 */
export function PreferencesForm() {
  const t = useTranslations("account");
  const currentLocale = useLocale() as Locale;
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentTheme = (theme ?? "system") as Theme;

  function persist(nextLocale: Locale, nextTheme: Theme) {
    startTransition(async () => {
      await api.patch<UserDto>(apiRoutes.account.preferences, {
        locale: nextLocale,
        theme: nextTheme,
      });
      // The locale cookie is set by the API; refresh so the server re-renders
      // in the new language without a full reload.
      router.refresh();
    });
  }

  return (
    <div className="divide-y divide-border">
      <Row label={t("languageLabel")}>
        <Segmented
          disabled={isPending}
          options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
          value={currentLocale}
          onChange={(next) => persist(next as Locale, currentTheme)}
        />
      </Row>

      <Row label={t("themeLabel")}>
        <Segmented
          disabled={isPending}
          options={THEMES.map((th) => ({ value: th, label: t(`theme.${th}`) }))}
          value={currentTheme}
          onChange={(next) => {
            setTheme(next); // instant, before the round-trip
            persist(currentLocale, next as Theme);
          }}
        />
      </Row>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex h-9 items-center gap-0.5 rounded-sm bg-muted p-0.5",
        disabled && "opacity-60",
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => !active && onChange(option.value)}
            className={cn(
              "h-8 rounded-sm px-3 text-sm transition-colors duration-100",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
