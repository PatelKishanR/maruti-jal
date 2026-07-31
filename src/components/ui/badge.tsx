import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge. Spec: .claude/design/COMPONENT-INVENTORY.md §4
 *
 * 22px tall, 8px horizontal padding, full radius, 12px/500, optional 12px
 * leading icon at a 4px gap.
 *
 * Each variant reads the `--badge-*-bg` / `--badge-*-fg` pair from globals.css,
 * so dark mode is handled by the token flip and needs no `dark:` class here.
 *
 * `min-h` rather than `h`: Gujarati runs 20–40% taller and must grow the pill
 * rather than be clipped.
 *
 * Badges show numbers where a number exists — `₹450 due`, `8 jars out` — so the
 * owner can triage without opening the record. Meaning map: DESIGN-STANDARDS
 * §7.2.
 */
const badgeVariants = cva(
  [
    "inline-flex min-h-[22px] w-fit items-center gap-1 rounded-full px-2 py-0.5",
    "text-caption font-medium",
    "[&_svg]:size-3 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-[var(--badge-default-bg)] text-[var(--badge-default-fg)]",
        primary:
          "bg-[var(--badge-primary-bg)] text-[var(--badge-primary-fg)]",
        success:
          "bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]",
        warning:
          "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]",
        danger: "bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** 12px leading icon, 4px gap. Colour inherits from the badge text. */
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {icon}
      {children}
    </span>
  ),
);
Badge.displayName = "Badge";

export { badgeVariants };
