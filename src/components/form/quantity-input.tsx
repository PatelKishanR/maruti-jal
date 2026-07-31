"use client";

import { forwardRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Whole-number quantity. Spec: COMPONENT-INVENTORY §2
 *
 * 120px. A full-width box for a 3-digit jar count invites errors and wastes a
 * line-item row's width, which is always the scarcest space on the form.
 *
 * Steppers appear on hover rather than always — permanently visible arrows on
 * every line of a 10-row order form is visual noise.
 */
export const QuantityInput = forwardRef<
  HTMLInputElement,
  {
    value: number | null;
    onValueChange: (value: number | null) => void;
    min?: number;
    max?: number;
    invalid?: boolean;
    disabled?: boolean;
    id?: string;
    name?: string;
    placeholder?: string;
    className?: string;
    onBlur?: () => void;
  }
>(function QuantityInput(
  {
    value,
    onValueChange,
    min = 0,
    max,
    invalid,
    disabled,
    id,
    name,
    placeholder = "0",
    className,
    onBlur,
  },
  ref,
) {
  function step(by: number) {
    const next = (value ?? 0) + by;
    if (next < min) return;
    if (max !== undefined && next > max) return;
    onValueChange(next);
  }

  return (
    <div className={cn("group relative w-30", className)}>
      <input
        ref={ref}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d-]/g, "");
          if (raw === "" || raw === "-") {
            onValueChange(null);
            return;
          }
          const parsed = Number.parseInt(raw, 10);
          if (!Number.isNaN(parsed)) onValueChange(parsed);
        }}
        onBlur={() => {
          if (value !== null && value !== undefined) {
            let clamped = value;
            if (clamped < min) clamped = min;
            if (max !== undefined && clamped > max) clamped = max;
            if (clamped !== value) onValueChange(clamped);
          }
          onBlur?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); step(1); }
          if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
        }}
        className={cn(
          "h-10 w-full rounded-sm border bg-transparent px-3 pr-7",
          "text-right font-mono text-sm tabular-nums text-foreground",
          "transition-colors duration-100 placeholder:text-muted-foreground/60",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-muted",
          invalid ? "border-destructive" : "border-input hover:border-muted-foreground/50",
        )}
      />

      {!disabled && (
        <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 flex-col group-hover:flex group-focus-within:flex">
          <Stepper onClick={() => step(1)} label="Increase">
            <ChevronUp className="size-3" aria-hidden />
          </Stepper>
          <Stepper onClick={() => step(-1)} label="Decrease">
            <ChevronDown className="size-3" aria-hidden />
          </Stepper>
        </div>
      )}
    </div>
  );
});

function Stepper({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className="flex h-4 w-4 items-center justify-center rounded-[2px] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
