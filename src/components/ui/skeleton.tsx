import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton. Spec: .claude/design/DESIGN-STANDARDS.md §11.3, §5.6
 *
 * Border-coloured bar, 4px radius, 1.5s pulse. Vary the widths (40–80%) across
 * a group so it reads as content rather than a grid.
 *
 * Decorative by design: it is `aria-hidden`, and the region that owns it should
 * carry the `aria-busy` / live-region announcement instead.
 *
 * `prefers-reduced-motion` is handled globally in globals.css — the animation
 * collapses to a static bar there.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        // `.skeleton` is a gradient sweep defined in globals.css — it reads as
        // "loading" more clearly than a pulse, which can look like a glitch.
        "skeleton rounded-sm",
        className,
      )}
      {...props}
    />
  );
}
