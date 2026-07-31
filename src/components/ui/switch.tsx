"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/**
 * Switch. 44×24px track with a 20px thumb — the track is already at the 44px
 * touch-target minimum (DESIGN-STANDARDS §18) along its long edge, so pair it
 * with a `<Label>` that is also clickable to reach 44px of tappable height.
 *
 * Use a Switch only where the change applies immediately (a product going
 * inactive). Anything that needs a Save belongs on a Checkbox.
 */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
      "border-2 border-transparent",
      "transition-colors duration-100",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      "disabled:cursor-not-allowed disabled:opacity-40",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        // The thumb stays light in BOTH themes. A `bg-card` thumb would be
        // #1E293B in dark, which is all but invisible on the #334155 unchecked
        // track.
        "pointer-events-none block size-5 rounded-full bg-card shadow-sm ring-0 dark:bg-foreground",
        "transition-transform duration-100",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;
