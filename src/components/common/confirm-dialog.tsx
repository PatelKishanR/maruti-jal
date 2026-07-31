"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Destructive confirmation. Spec: DESIGN-STANDARDS §10
 *
 * Two rules that make the difference between a safe dialog and a rubber stamp:
 *
 *  - the TITLE names the specific object — "Cancel order ORD-000123?" — so a
 *    user who opened the wrong row can still catch it here
 *  - the confirm button REPEATS THE VERB ("Cancel order"), never "Yes". On a
 *    dialog about cancelling an order, a button labelled "Cancel" is genuinely
 *    ambiguous: cancel the order, or cancel the dialog?
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmingLabel,
  onConfirm,
  variant = "destructive",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name the object: `Cancel order ORD-000123?` */
  title: string;
  /** State the consequence in one sentence. */
  description: string;
  /** Repeat the verb: `Cancel order`. */
  confirmLabel: string;
  confirmingLabel?: string;
  onConfirm: () => Promise<void> | void;
  variant?: "destructive" | "primary";
}) {
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-105">
        <div className="flex gap-3">
          {variant === "destructive" && (
            <AlertTriangle
              className="mt-0.5 size-6 shrink-0 text-destructive"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="mt-1">{description}</DialogDescription>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "primary"}
            onClick={confirm}
            loading={busy}
            loadingText={confirmingLabel ?? confirmLabel}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Wires the open/close state so a caller only supplies the content. */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, confirmProps: { open, onOpenChange: setOpen } };
}
