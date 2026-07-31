import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Inline banner. Spec: .claude/design/DESIGN-STANDARDS.md §11.2
 *
 * Semantic tint + 1px border + 20px icon. Dismissible only when
 * informational — a coin reconciliation mismatch is not dismissible.
 */
const alertVariants = cva(
  "flex w-full items-start gap-3 rounded-lg border p-4 text-sm",
  {
    variants: {
      variant: {
        info: "border-primary bg-[var(--badge-primary-bg)] text-[var(--badge-primary-fg)]",
        success:
          "border-success bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]",
        warning:
          "border-warning bg-[var(--badge-warning-bg)] text-[var(--badge-warning-fg)]",
        danger:
          "border-destructive bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

export function Alert({
  className,
  variant,
  icon,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon && <span className="mt-px shrink-0 [&_svg]:size-5">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-medium", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-0.5 leading-relaxed", className)} {...props} />;
}
