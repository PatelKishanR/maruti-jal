"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sheet / drawer. Spec: .claude/design/DESIGN-STANDARDS.md §10
 *
 * 400px panel on the right; below `md` it becomes a bottom sheet, which is
 * where the mobile Filters control opens. Overlay rgba(15,23,42,0.5), 12px
 * radius, `shadow-xl`, 24px padding.
 *
 * Drawers use the 350ms "slow" motion token on enter and 150ms on exit
 * (§16). The mobile and desktop slide directions are kept on `max-md:` / `md:`
 * variants rather than layered, so their enter-translate custom properties
 * never fight each other.
 *
 * Radix traps focus inside and restores it to the trigger on close. A
 * `SheetTitle` is required for the accessible name — use `className="sr-only"`
 * where the design has no visible heading.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[rgba(15,23,42,0.5)]",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Clear for drawers that must not be escapable, e.g. a dirty filter form. */
    dismissible?: boolean;
  }
>(({ className, children, dismissible = true, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      onEscapeKeyDown={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onPointerDownOutside={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      className={cn(
        "fixed z-50 flex flex-col gap-4 overflow-y-auto bg-card p-6 shadow-xl",
        // Bottom sheet below md.
        "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-lg",
        // Right drawer at md and up.
        "md:inset-y-0 md:bottom-auto md:left-auto md:right-0 md:h-full md:max-h-none",
        "md:w-[400px] md:max-w-[calc(100vw-2rem)] md:rounded-none",
        "max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom",
        "md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right",
        "data-[state=open]:animate-in data-[state=open]:duration-[350ms]",
        "data-[state=closed]:animate-out data-[state=closed]:duration-150",
        className,
      )}
      {...props}
    >
      {children}
      {dismissible && (
        <DialogPrimitive.Close
          className={cn(
            "absolute right-4 top-4 flex size-8 items-center justify-center rounded-sm",
            "text-muted-foreground transition-colors duration-100 hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <X className="size-4" aria-hidden />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0 pr-8", className)} {...props} />;
}

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-h4 font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("mt-1 text-sm leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export function SheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
