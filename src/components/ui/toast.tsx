"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Toaster as SonnerToaster,
  toast as sonnerToast,
  type ExternalToast,
  type ToasterProps,
} from "sonner";
import { cn } from "@/lib/utils";

/**
 * Toast. Spec: .claude/design/DESIGN-STANDARDS.md §11.1
 *
 * Bottom-right, 380px, 12px radius, `shadow-lg`, 4px semantic left border,
 * max 3 stacked. Sonner writes `data-type` on every toast, so one class string
 * drives all five left-border colours — no per-type wiring.
 *
 * Two overrides worth knowing about:
 *   · `--width` is set on the toaster because sonner sizes the *container* from
 *     that variable; styling only the toast would leave it 356px wide.
 *   · `font-sans` is re-asserted because sonner hardcodes its own font stack,
 *     which has no Gujarati in it. All of sonner's own rules sit inside
 *     `:where()` at zero specificity, so a single Tailwind class wins.
 *
 * Durations carry meaning, and are baked into the helper below:
 * success 4s · info 5s · error until dismissed, because an error the operator
 * missed is an error that silently didn't happen.
 *
 * Copy names the object — `Payment of ₹450 recorded`, never `Saved`. Every
 * destructive success should offer `Undo` for 8s where that is possible; pass
 * it through `action`.
 *
 * Mount `<Toaster />` once, inside the theme provider.
 */
export function Toaster({ className, style, ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "light"}
      position="bottom-right"
      visibleToasts={3}
      offset={24}
      className={cn("toaster font-sans", className)}
      style={
        {
          "--width": "380px",
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: cn(
            "flex w-full max-w-[calc(100vw-2rem)] items-start gap-3",
            "rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg",
            // 4px semantic left border.
            "border-l-4",
            "data-[type=success]:border-l-success",
            "data-[type=error]:border-l-destructive",
            "data-[type=warning]:border-l-warning",
            "data-[type=info]:border-l-primary",
          ),
          title: "text-sm font-medium leading-snug text-foreground",
          description: "mt-0.5 text-sm leading-relaxed text-muted-foreground",
          icon: "mt-0.5 shrink-0",
          content: "min-w-0 flex-1",
          actionButton: cn(
            "shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground",
            "transition-colors duration-100 hover:bg-primary/90",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          ),
          cancelButton: cn(
            "shrink-0 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground",
            "transition-colors duration-100 hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          ),
          closeButton: "border-border bg-card text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export type ToastOptions = ExternalToast;

type ToastId = string | number;

/**
 * The app's toast entry point. Import this rather than sonner's `toast`, so the
 * semantic durations live in one place.
 */
export const toast = {
  /** 4s. `toast.success("Payment of ₹450 recorded")` */
  success: (message: string, options?: ToastOptions): ToastId =>
    sonnerToast.success(message, { duration: 4000, ...options }),

  /** Stays until dismissed. Give the reason, and a `Retry` action where there is one. */
  error: (message: string, options?: ToastOptions): ToastId =>
    sonnerToast.error(message, {
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      ...options,
    }),

  /** 5s. */
  info: (message: string, options?: ToastOptions): ToastId =>
    sonnerToast.info(message, { duration: 5000, ...options }),

  /** Dismisses one toast, or every toast when called with no id. */
  dismiss: (id?: ToastId): void => {
    sonnerToast.dismiss(id);
  },
};
