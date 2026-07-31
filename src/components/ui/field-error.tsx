import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single error renderer for form fields.
 *
 * Client-side and server-side errors both land here, so there is only one
 * error-display code path — which is where localisation and styling usually
 * diverge. Spec: .claude/design/DESIGN-STANDARDS.md §6.4
 *
 * The space is reserved when `reserve` is set, so nothing shifts when an error
 * appears.
 */
export function FieldError({
  message,
  reserve = false,
  className,
  id,
}: {
  message?: string | null;
  reserve?: boolean;
  className?: string;
  id?: string;
}) {
  if (!message) {
    return reserve ? <div className="mt-1 h-4" aria-hidden /> : null;
  }

  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "mt-1 flex items-start gap-1 text-xs leading-4 text-destructive",
        className,
      )}
    >
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

/** Helper text below a field. Same slot as the error, so they never stack. */
export function FieldHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-1 text-xs leading-4 text-muted-foreground", className)}>
      {children}
    </p>
  );
}
