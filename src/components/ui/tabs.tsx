"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Tabs. Spec: .claude/design/COMPONENT-INVENTORY.md §12
 *
 * 44px tall, 2px Primary bottom indicator on the active tab, active label
 * `text-foreground` semibold, inactive `text-muted-foreground`.
 *
 * **Counts belong in the label** — `Returns 3` — so nothing hides behind a tab.
 * Pass `count` and it renders as a tinted pill after the label; it is omitted
 * entirely when `undefined`, and a zero still renders because "0 returns" is
 * information.
 *
 * `min-h-11` rather than a fixed height: a Gujarati label wraps rather than
 * being clipped.
 */
export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex min-h-11 w-full items-stretch gap-6 overflow-x-auto border-b border-border",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    /** Rendered as a pill after the label — `Returns 3`. */
    count?: number;
  }
>(({ className, count, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group relative -mb-px inline-flex min-h-11 shrink-0 items-center gap-2",
      "border-b-2 border-transparent px-1 py-2",
      "text-sm font-medium text-muted-foreground",
      "transition-colors duration-100",
      "hover:text-foreground",
      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      "disabled:pointer-events-none disabled:opacity-40",
      "data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
    {count !== undefined && (
      <span
        className={cn(
          "inline-flex min-h-[18px] items-center rounded-full px-1.5",
          "text-caption font-medium tabular-nums",
          "bg-[var(--badge-default-bg)] text-[var(--badge-default-fg)]",
          "group-data-[state=active]:bg-[var(--badge-primary-bg)] group-data-[state=active]:text-[var(--badge-primary-fg)]",
        )}
      >
        {count}
      </span>
    )}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
