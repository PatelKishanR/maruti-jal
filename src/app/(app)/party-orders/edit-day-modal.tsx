"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Plus } from "lucide-react";
import { DateInput, EntityCombobox } from "@/components/form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/common/money";
import { apiRoutes } from "@/lib/api/routes";
import { formatINR } from "@/lib/money";
import type { DayDeliveryStatus } from "@/lib/db/entities/enums";
import {
  createPartyOrderDaySchema,
  DAY_STATUS_VALUES,
} from "@/lib/validation/party-order";
import { DayItemsEditor, type PartyProductRef } from "./day-items-editor";
import {
  previewDayTotal,
  toDayPayload,
  type DayDraft,
} from "./schedule-model";

/**
 * Add / edit one delivery day. Spec: design/MODULES/05-party-orders.md §8
 *
 * FOUR entry points, one modal: `+ Add a day`, a no-delivery marker, `Edit day`
 * on a card, and the calendar. The mental model has to stay single — **a day is
 * a thing you open and change**.
 *
 * It owns no persistence. The wizard applies the result to local state and the
 * detail page PATCHes it, because only they know whether a database row exists
 * yet. What this component owns is the shape of a day and the arithmetic the
 * owner watches while typing.
 *
 * The `Day total` and `Booking total →` figures are PREVIEWS. Every figure the
 * app stores or shows after a save comes from a generated column or a rollup
 * trigger. See schedule-model.ts
 */
export function EditDayModal({
  open,
  onOpenChange,
  mode,
  subtitle,
  day,
  status = "SCHEDULED",
  allowStatus = false,
  takenDates,
  products,
  bookingTotal,
  submitting = false,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  /** `PTY-000045 · Shreeji Wedding Hall`, or the party name in the wizard. */
  subtitle: string;
  day: DayDraft;
  status?: DayDeliveryStatus;
  /** Only a SAVED day may change status — a new one always starts Scheduled. */
  allowStatus?: boolean;
  /** Every OTHER date in this schedule. The same date twice is impossible. */
  takenDates: string[];
  /** Base prices for the override strip. An empty list is a legal, degraded state. */
  products: PartyProductRef[];
  /** The booking's stored total, so the footer can show where it lands. */
  bookingTotal: number | null;
  submitting?: boolean;
  /** A server message, already resolved. */
  error?: string | null;
  onSubmit: (draft: DayDraft, status: DayDeliveryStatus) => void;
}) {
  const t = useTranslations("partyOrders");
  const tRoot = useTranslations();

  const [draft, setDraft] = useState<DayDraft>(day);
  const [dayStatus, setDayStatus] = useState<DayDeliveryStatus>(status);
  const [localError, setLocalError] = useState<string | null>(null);

  // Re-seed whenever a different day is opened — one modal, four entry points.
  useEffect(() => {
    if (open) {
      setDraft(day);
      setDayStatus(status);
      setLocalError(null);
    }
  }, [open, day, status]);

  const total = previewDayTotal(draft);
  const duplicate =
    draft.serviceDate !== "" && takenDates.includes(draft.serviceDate);

  function set<K extends keyof DayDraft>(key: K, value: DayDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setLocalError(null);
  }

  function submit() {
    if (duplicate) {
      // A DIFFERENT key from the schema's `duplicateDate`: this one names the
      // date, and a catalogue string with an unfilled placeholder is how a
      // validation message becomes a runtime error. See MODULE-RECIPE §8
      setLocalError(t("errors.duplicateDateOn", { date: draft.serviceDate }));
      return;
    }

    /**
     * Validated with the SERVER's schema, so the modal and the API cannot
     * disagree about what a valid day is. Messages are catalogue keys on both
     * sides and resolve through one path. See .claude/ARCHITECTURE.md §5.2
     */
    const parsed = createPartyOrderDaySchema.safeParse(toDayPayload(draft));
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message ?? "common.fixHighlighted";
      setLocalError(tRoot.has(key) ? tRoot(key) : key);
      return;
    }

    onSubmit(draft, dayStatus);
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-180">
        <DialogTitle>
          {mode === "add" ? t("dayModal.addTitle") : t("dayModal.editTitle")}
        </DialogTitle>
        <DialogDescription>{subtitle}</DialogDescription>

        <div
          className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1"
          onKeyDown={(event) => {
            // §8.6: ⌘/Ctrl + Enter saves from anywhere in the modal.
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        >
          {/* Not dismissible while it holds: re-billing a delivered day moves
              the booking total, and the owner should know before saving. §8.4 */}
          {dayStatus === "DELIVERED" && allowStatus && (
            <Alert variant="warning" icon={<AlertTriangle aria-hidden />}>
              {t("dayModal.deliveredWarning")}
            </Alert>
          )}

          {(error ?? localError) && (
            <Alert variant="danger" icon={<AlertTriangle aria-hidden />}>
              {error ?? localError}
            </Alert>
          )}

          <div className="flex flex-wrap items-start gap-4">
            <div>
              <Label htmlFor="day-date" required>
                {t("dayModal.dateLabel")}
              </Label>
              <DateInput
                id="day-date"
                value={draft.serviceDate}
                invalid={duplicate}
                disabled={submitting}
                onValueChange={(value) => set("serviceDate", value)}
              />
              <p className="min-h-5 text-caption text-destructive">
                {duplicate ? t("errors.duplicateDateShort") : ""}
              </p>
            </div>

            <div>
              <Label htmlFor="day-status">{t("dayModal.statusLabel")}</Label>
              <Select
                value={dayStatus}
                disabled={!allowStatus || submitting}
                onValueChange={(value) => setDayStatus(value as DayDeliveryStatus)}
              >
                <SelectTrigger id="day-status" className="w-45">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_STATUS_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`day.status.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="min-h-5 text-caption text-muted-foreground">
                {allowStatus ? "" : t("dayModal.statusLocked")}
              </p>
            </div>

            <div className="min-w-55 flex-1">
              <Label htmlFor="day-staff">{t("dayModal.staffLabel")}</Label>
              <EntityCombobox
                id="day-staff"
                value={draft.assignedStaffId}
                endpoint={apiRoutes.staff.options}
                placeholder={t("dayModal.staffPlaceholder")}
                searchPlaceholder={t("dayModal.staffSearch")}
                emptyMessage={t("dayModal.staffEmpty")}
                disabled={submitting}
                onValueChange={(id, option) => {
                  setDraft((current) => ({
                    ...current,
                    assignedStaffId: id,
                    assignedStaffName: option?.label ?? null,
                  }));
                }}
              />
              <p className="min-h-5" />
            </div>
          </div>

          <div>
            <Label htmlFor="day-items">{t("dayModal.itemsLabel")}</Label>
            <div id="day-items">
              <DayItemsEditor
                items={draft.items}
                products={products}
                disabled={submitting}
                onChange={(items) => set("items", items)}
              />
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {t("dayModal.deliveredHelp")}
            </p>
          </div>

          <div>
            <Label htmlFor="day-notes">{t("dayModal.notesLabel")}</Label>
            <Textarea
              id="day-notes"
              rows={2}
              value={draft.notes}
              placeholder={t("dayModal.notesPlaceholder")}
              disabled={submitting}
              onChange={(event) => set("notes", event.target.value)}
            />
          </div>
        </div>

        {/* ---- Footer: the two figures the modal exists for ------------- */}
        <div className="mt-4 space-y-1 rounded-md border-t border-border bg-muted px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-foreground">
              {t("dayModal.dayTotal")}
            </span>
            <Money value={total} emphasis className="text-lg" />
          </div>

          {bookingTotal !== null && (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                {t("dayModal.bookingTotal")}
              </span>
              <span className="font-mono tabular-nums">
                <span className="text-muted-foreground/60 line-through">
                  {formatINR(bookingTotal)}
                </span>{" "}
                <span aria-hidden>→</span>{" "}
                <span className="font-semibold text-foreground">
                  {formatINR(bookingTotal + total)}
                </span>
              </span>
            </div>
          )}
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
            onClick={submit}
            loading={submitting}
            loadingText={t("dayModal.saving")}
          >
            {mode === "add" ? (
              <>
                <Plus aria-hidden />
                {t("dayModal.add")}
              </>
            ) : (
              t("dayModal.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
