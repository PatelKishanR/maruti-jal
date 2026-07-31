"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { FieldError, FieldHint } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

/**
 * Label + control + message, with the message slot RESERVED.
 *
 * Reserving the space is the point: without it, the first validation error
 * pushes every field below it down, and on a long form the user loses their
 * place mid-correction. See DESIGN-STANDARDS §6.1
 *
 * Mark REQUIRED, not optional — most fields in this app are required, so
 * asterisking the exceptions would be noisier than asterisking the rule.
 */
export function FormField({
  label,
  required,
  error,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  /** Already-resolved message, not a catalogue key. */
  error?: string | null;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode | ((props: { id: string; invalid: boolean }) => React.ReactNode);
}) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const invalid = !!error;

  return (
    <div className={cn("mb-4", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>

      {typeof children === "function" ? children({ id, invalid }) : children}

      {/* One slot, always present — error wins, hint fills otherwise. */}
      <div className="min-h-5">
        {error ? (
          <FieldError id={`${id}-error`} message={error} />
        ) : hint ? (
          <FieldHint>{hint}</FieldHint>
        ) : null}
      </div>
    </div>
  );
}
