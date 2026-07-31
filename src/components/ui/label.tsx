"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

/**
 * Label. Required fields are marked with a blue asterisk — we mark REQUIRED,
 * not optional, because most fields in this app are required.
 * Spec: .claude/design/DESIGN-STANDARDS.md §6.1
 */
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
    required?: boolean;
  }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "mb-1.5 block text-sm font-medium text-foreground",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-40",
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="ml-0.5 text-primary" aria-hidden>
        *
      </span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;
