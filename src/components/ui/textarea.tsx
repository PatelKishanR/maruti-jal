"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea. Spec: .claude/design/COMPONENT-INVENTORY.md §2
 *
 * 3 rows by default, vertical resize only — horizontal resize breaks the form
 * grid. Border, hover, focus and error treatment match Input exactly, so a
 * notes field sits in the same column as a text field without looking different.
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        "block w-full resize-y rounded-sm border bg-transparent px-3 py-2",
        "text-sm leading-relaxed text-foreground",
        "placeholder:text-muted-foreground/70",
        "transition-colors duration-100",
        "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-40",
        "read-only:border-transparent read-only:bg-muted read-only:text-muted-foreground",
        invalid
          ? "border-destructive"
          : "border-input hover:border-muted-foreground/50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
