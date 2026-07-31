"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sticky form footer. Spec: DESIGN-STANDARDS §6.5
 *
 * Two rules worth keeping:
 *  - the primary button NAMES the action ("Save order", "Record payment"),
 *    never "Submit" — the label is the last thing read before committing
 *  - it is DISABLED until the form is dirty, so an accidental double-save is
 *    impossible and the button state tells you whether anything changed
 */
export function FormActions({
  onCancel,
  submitLabel,
  submittingLabel,
  dirty = true,
  submitting = false,
  disabled = false,
  extra,
  className,
}: {
  onCancel?: () => void;
  submitLabel: string;
  submittingLabel?: string;
  dirty?: boolean;
  submitting?: boolean;
  disabled?: boolean;
  /** e.g. "Save as draft" */
  extra?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");

  return (
    <div
      className={cn(
        "sticky bottom-0 -mx-6 -mb-6 mt-6 flex items-center justify-end gap-3",
        "border-t border-border bg-card px-6 py-4 rounded-b-lg",
        className,
      )}
    >
      {dirty && !submitting && (
        <span className="mr-auto text-xs text-muted-foreground">
          {t("unsavedChanges")}
        </span>
      )}

      {extra}

      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          {t("cancel")}
        </Button>
      )}

      <Button
        type="submit"
        disabled={disabled || !dirty}
        loading={submitting}
        loadingText={submittingLabel ?? t("saving")}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
