"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  addDays,
  formatDate,
  isBusinessDate,
  todayIST,
} from "@/lib/dates";
import type { Locale } from "@/i18n/config";

/**
 * Business-date field. Spec: COMPONENT-INVENTORY §2
 *
 * The VALUE is always a `'YYYY-MM-DD'` string; a `Date` never enters or
 * leaves. See lib/dates.ts for why that matters.
 *
 * Defaults to today and offers Today/Yesterday chips, because those two
 * account for nearly every entry — the owner records the day's orders in the
 * evening, or yesterday's first thing in the morning.
 */
export function DateInput({
  value,
  onValueChange,
  invalid,
  disabled,
  id,
  min,
  max,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  min?: string;
  max?: string;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);

  const display = isBusinessDate(value) ? formatDate(value, locale) : "";

  function pick(next: string) {
    onValueChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-10 w-45 items-center justify-between gap-2 rounded-sm border bg-transparent px-3",
            "text-left text-sm text-foreground transition-colors duration-100",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-muted",
            invalid ? "border-destructive" : "border-input hover:border-muted-foreground/50",
            className,
          )}
        >
          <span className={cn(!display && "text-muted-foreground/60")}>
            {display || "DD MMM YYYY"}
          </span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-3">
        <div className="mb-3 flex gap-2">
          <QuickChip onClick={() => pick(todayIST())}>{t("today")}</QuickChip>
          <QuickChip onClick={() => pick(addDays(todayIST(), -1))}>
            {t("yesterday")}
          </QuickChip>
        </div>

        {/* Native picker: keyboard-accessible, locale-aware, and zero bundle
            cost. The value it emits is already 'YYYY-MM-DD'. */}
        <input
          type="date"
          value={isBusinessDate(value) ? value : ""}
          min={min}
          max={max}
          onChange={(e) => e.target.value && pick(e.target.value)}
          className="h-10 w-full rounded-sm border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      </PopoverContent>
    </Popover>
  );
}

function QuickChip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 rounded-full bg-muted px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}
