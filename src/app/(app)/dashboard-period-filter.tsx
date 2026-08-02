"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DASHBOARD_PERIODS, type DashboardPeriod } from "@/lib/validation/dashboard";

/**
 * The global date filter and the refresh control. Spec: §3.3.1, §4
 *
 * It scopes ROWS 1 AND 3 ONLY, which is why the page prints
 * "Current position — not affected by the date filter" above row 2.
 *
 * Applying writes `?period=` (or `?from=&to=`) to the URL and pushes a history
 * entry, so a view is shareable and browser back returns to the previous
 * period. The presets apply on click — a preset that needs confirming is
 * slower than the register it replaced. Only Custom gets an Apply button,
 * because a half-typed range is not a question anyone asked.
 */
export function DashboardToolbar({
  period,
  from,
  to,
  rangeLabel,
}: {
  period: DashboardPeriod;
  from: string;
  to: string;
  /** Already formatted — `01 Aug – 14 Aug 2026`. Shown on the Custom segment. */
  rangeLabel: string;
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [customFrom, setCustomFrom] = React.useState(from);
  const [customTo, setCustomTo] = React.useState(to);

  const invalid = customFrom > customTo;

  const apply = (search: string) => {
    startTransition(() => router.push(`${pathname}${search}`));
  };

  const presets = DASHBOARD_PERIODS.filter((key) => key !== "custom");

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {/*
        Applying a period does NOT blank the page: the previous figures stay on
        screen inside the transition and this 2px indeterminate bar says the
        next ones are coming. Rows 2 and 4 are untouched either way — they are
        not period figures. §3.5
      */}
      {pending ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute -bottom-2 left-0 h-0.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] bg-primary" />
        </div>
      ) : null}

      <div
        role="group"
        aria-label={t("period.label")}
        className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-card"
      >
        {presets.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={period === key}
            onClick={() => apply(`?period=${key}`)}
            className={cn(
              "h-full border-r border-border px-3 text-body-sm transition-colors duration-100 last:border-r-0",
              period === key
                ? "bg-(--badge-primary-bg) font-medium text-(--badge-primary-fg)"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`period.${key === "last-month" ? "lastMonth" : key}`)}
          </button>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-pressed={period === "custom"}
              className={cn(
                "flex h-full items-center gap-1 px-3 text-body-sm transition-colors duration-100",
                period === "custom"
                  ? "bg-(--badge-primary-bg) font-medium text-(--badge-primary-fg)"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {period === "custom" ? rangeLabel : t("period.custom")}
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-80 space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-caption font-medium text-muted-foreground">
                {t("period.from")}
                <Input
                  type="date"
                  value={customFrom}
                  max={to}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="text-caption font-medium text-muted-foreground">
                {t("period.to")}
                <Input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="mt-1"
                />
              </label>
            </div>

            {invalid ? (
              <p className="text-caption text-destructive">
                {t("period.invalid")}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                {t("period.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={invalid}
                onClick={() => {
                  setOpen(false);
                  apply(
                    `?period=custom&from=${customFrom}&to=${customTo}`,
                  );
                }}
              >
                {t("period.apply")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Button
        variant="outline"
        size="icon"
        aria-label={t("refresh")}
        title={t("refresh")}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RotateCw
          className={cn("size-4", pending && "animate-spin")}
          aria-hidden
        />
      </Button>
    </div>
  );
}
