"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/**
 * Tooltip. Caption text on an inverted surface — dark in light mode, light in
 * dark mode — which is the only way to keep it readable and distinct from the
 * popover in both themes. `bg-foreground / text-background` gives that for free
 * from the semantic tokens.
 *
 * Used for truncated table cells (DESIGN-STANDARDS §5.3) and for the `ⓘ`
 * explanations on value changes.
 *
 * Tooltips are supplementary only: they never carry the sole copy of anything
 * an operator needs, because they do not exist on touch.
 *
 * Wrap the app (or a subtree) in `TooltipProvider` once; `Tooltip` also falls
 * back to its own provider when used standalone.
 */
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-[280px] rounded-sm bg-foreground px-2 py-1",
        "text-caption text-background shadow-md",
        "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=delayed-open]:duration-200",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
