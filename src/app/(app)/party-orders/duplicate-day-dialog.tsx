"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { DateInput } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { addDays, formatDate } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import {
  blankDay,
  copyItems,
  dayUnits,
  previewDayTotal,
  type DayDraft,
} from "./schedule-model";

/**
 * Duplicate a day. Spec: design/MODULES/05-party-orders.md §5.5
 *
 * The third of the three ways to add a day, and the one that exists because a
 * five-day event is usually four days of the same thing. It names the SOURCE
 * date, what is being copied and what it is worth, so a mis-clicked card is
 * still caught here.
 *
 * A date already in the schedule is refused with a link to edit that day
 * instead — quietly merging into it would silently double a delivery.
 */
export function DuplicateDayDialog({
  open,
  onOpenChange,
  source,
  takenDates,
  submitting = false,
  onDuplicate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day being copied. Null while no card has been chosen. */
  source: DayDraft | null;
  takenDates: string[];
  submitting?: boolean;
  onDuplicate: (day: DayDraft) => void;
}) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;

  const [target, setTarget] = useState("");
  const [copyStaff, setCopyStaff] = useState(true);
  const [copyNotes, setCopyNotes] = useState(false);

  useEffect(() => {
    if (open && source) {
      // The day after the source is the answer nine times out of ten.
      setTarget(addDays(source.serviceDate, 1));
      setCopyStaff(source.assignedStaffId !== null);
      setCopyNotes(false);
    }
  }, [open, source]);

  if (!source) return null;

  const clash = target !== "" && takenDates.includes(target);

  function duplicate() {
    if (!source || clash || target === "") return;

    onDuplicate({
      ...blankDay(target, copyItems(source.items)),
      assignedStaffId: copyStaff ? source.assignedStaffId : null,
      assignedStaffName: copyStaff ? source.assignedStaffName : null,
      notes: copyNotes ? source.notes : "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-105">
        <div className="flex gap-3">
          <Copy className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <DialogTitle>
              {t("duplicate.title", {
                date: formatDate(source.serviceDate, locale),
              })}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {t("duplicate.body", {
                items: source.items.length,
                units: formatQuantity(dayUnits(source)),
                amount: formatINR(previewDayTotal(source)),
              })}
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="duplicate-target" required>
            {t("duplicate.dateLabel")}
          </Label>
          <DateInput
            id="duplicate-target"
            value={target}
            invalid={clash}
            disabled={submitting}
            onValueChange={setTarget}
          />
          <p className="min-h-5 text-caption text-destructive">
            {clash
              ? t("duplicate.clash", { date: formatDate(target, locale) })
              : ""}
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox
              checked={copyStaff}
              disabled={submitting || source.assignedStaffId === null}
              onCheckedChange={(checked) => setCopyStaff(checked === true)}
            />
            {t("duplicate.copyStaff", {
              name: source.assignedStaffName ?? t("day.notAssigned"),
            })}
          </label>

          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox
              checked={copyNotes}
              disabled={submitting || source.notes.trim() === ""}
              onCheckedChange={(checked) => setCopyNotes(checked === true)}
            />
            {t("duplicate.copyNotes")}
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            onClick={duplicate}
            disabled={clash || target === ""}
            loading={submitting}
            loadingText={t("duplicate.duplicating")}
          >
            {t("duplicate.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
