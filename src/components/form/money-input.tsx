"use client";

import { forwardRef, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { parseRupees, formatRupeesPlain } from "@/lib/money";
import type { Locale } from "@/i18n/config";

/**
 * Currency field. Spec: COMPONENT-INVENTORY §2, DESIGN-STANDARDS §13
 *
 * 200px, not full width — a full-width box for an amount invites mis-keying,
 * and money reads best when the column is narrow enough to scan.
 *
 * Accepts `1250`, `1,250`, `1250.50`, `₹250`. Reformats to lakh grouping on
 * BLUR, never while typing: reformatting mid-keystroke moves the caret and is
 * genuinely infuriating to type into.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    value: number | null;
    onValueChange: (value: number | null) => void;
    invalid?: boolean;
    disabled?: boolean;
    id?: string;
    name?: string;
    placeholder?: string;
    className?: string;
    /** Allow negatives — off by default; the sign lives in `direction`. */
    allowNegative?: boolean;
    onBlur?: () => void;
  }
>(function MoneyInput(
  {
    value,
    onValueChange,
    invalid,
    disabled,
    id,
    name,
    placeholder = "0.00",
    className,
    allowNegative = false,
    onBlur,
  },
  ref,
) {
  const locale = useLocale() as Locale;
  const [text, setText] = useState(() =>
    value === null || value === undefined ? "" : formatRupeesPlain(value, locale),
  );
  const [focused, setFocused] = useState(false);

  // Reflect programmatic changes (e.g. a line-item recalculation) unless the
  // user is mid-edit, where overwriting their keystrokes would be hostile.
  useEffect(() => {
    if (focused) return;
    setText(value === null || value === undefined ? "" : formatRupeesPlain(value, locale));
  }, [value, locale, focused]);

  return (
    <div className={cn("relative w-50", className)}>
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        aria-hidden
      >
        ₹
      </span>
      <input
        ref={ref}
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          // Show the raw number while editing — grouping commas are for reading.
          setText(value === null || value === undefined ? "" : String(value));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (next.trim() === "") {
            onValueChange(null);
            return;
          }
          const parsed = parseRupees(next);
          if (parsed !== null && (allowNegative || parsed >= 0)) {
            onValueChange(parsed);
          }
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = text.trim() === "" ? null : parseRupees(text);
          const clean = parsed === null || (!allowNegative && parsed < 0) ? null : parsed;
          onValueChange(clean);
          setText(clean === null ? "" : formatRupeesPlain(clean, locale));
          onBlur?.();
        }}
        className={cn(
          "h-10 w-full rounded-sm border bg-transparent pl-7 pr-3",
          "text-right font-mono text-sm tabular-nums text-foreground",
          "transition-colors duration-100 placeholder:text-muted-foreground/60",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-muted",
          invalid ? "border-destructive" : "border-input hover:border-muted-foreground/50",
        )}
      />
    </div>
  );
});
