"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Repeat } from "lucide-react";
import { DateInput, EntityCombobox, QuantityInput } from "@/components/form";
import { Alert } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Money } from "@/components/common/money";
import { apiRoutes } from "@/lib/api/routes";
import { formatDate, formatWeekday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { MAX_SCHEDULE_DAYS } from "@/lib/validation/party-order";
import { DayItemsEditor, type PartyProductRef } from "./day-items-editor";
import {
  blankDay,
  blankItem,
  buildPreview,
  copyItems,
  isItemComplete,
  MIN_CUSTOM_GAP,
  previewLineTotal,
  REPEAT_MODES,
  type DayDraft,
  type ItemDraft,
  type RepeatMode,
} from "./schedule-model";

/**
 * The repeat-pattern generator. Spec: design/MODULES/05-party-orders.md §5.4
 *
 * It generates ROWS, not a rule. A recurrence rule cannot express "day 1, day
 * 3, then days 8–12", cannot be partly cancelled, and has nowhere to hang the
 * staff member who is doing Tuesday. What comes out of this modal is an
 * ordinary list of days that the owner then edits one at a time.
 * See .claude/DATA-MODEL.md §5.16
 *
 * Every preview date is a tickable chip, and a date already in the schedule is
 * shown struck through rather than hidden — "will be skipped" is information,
 * and silently dropping it would leave the count unexplained. The primary
 * button COUNTS WHAT IT WILL DO, live.
 */
export function RepeatPatternModal({
  open,
  onOpenChange,
  defaultStart,
  existingDates,
  products,
  submitting = false,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day after the last scheduled one, or today on an empty schedule. */
  defaultStart: string;
  existingDates: string[];
  products: PartyProductRef[];
  submitting?: boolean;
  onGenerate: (days: DayDraft[]) => void;
}) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;

  const [from, setFrom] = useState(defaultStart);
  const [to, setTo] = useState(defaultStart);
  const [mode, setMode] = useState<RepeatMode>("daily");
  const [gap, setGap] = useState<number>(MIN_CUSTOM_GAP);
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFrom(defaultStart);
      setTo(defaultStart);
      setDeselected(new Set());
      setError(null);
    }
  }, [open, defaultStart]);

  const preview = useMemo(
    () =>
      buildPreview({ from, to, mode, gap }, existingDates, deselected),
    [from, to, mode, gap, existingDates, deselected],
  );

  const selected = preview.filter((date) => date.selected);
  const conflicts = preview.filter((date) => date.conflict);

  // Counts and a per-day money preview — the stored figures come from the
  // database after the days are saved. See schedule-model.ts
  const unitsPerDay = items.reduce(
    (sum, item) => sum + (item.quantity ?? 0),
    0,
  );
  const perDayTotal =
    items.reduce(
      (sum, item) => sum + Math.round(previewLineTotal(item) * 100),
      0,
    ) / 100;

  function toggle(date: string) {
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function generate() {
    if (from > to) {
      setError(t("generator.errors.endBeforeStart"));
      return;
    }
    if (!items.some(isItemComplete)) {
      setError(t("generator.errors.noItems"));
      return;
    }
    if (preview.length > MAX_SCHEDULE_DAYS) {
      setError(
        t("generator.errors.tooManyDays", {
          count: preview.length,
          max: MAX_SCHEDULE_DAYS,
        }),
      );
      return;
    }
    if (preview.length > 0 && selected.length === 0) {
      setError(
        conflicts.length === preview.length
          ? t("generator.errors.allConflict")
          : t("generator.errors.noneSelected"),
      );
      return;
    }
    if (selected.length === 0) {
      setError(t("generator.errors.noneSelected"));
      return;
    }

    onGenerate(
      selected.map((date) => ({
        ...blankDay(date.date, copyItems(items.filter(isItemComplete))),
        assignedStaffId: staffId,
        assignedStaffName: staffName,
        // Marked for the session so the owner can see what the generator did —
        // they are ordinary days in every other respect. §5.4
        generated: true,
      })),
    );
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-180">
        <DialogTitle>{t("generator.title")}</DialogTitle>
        <DialogDescription>{t("generator.subtitle")}</DialogDescription>

        <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {error && (
            <Alert variant="danger" icon={<AlertTriangle aria-hidden />}>
              {error}
            </Alert>
          )}

          <div className="flex flex-wrap items-start gap-4">
            <div>
              <Label htmlFor="repeat-from" required>
                {t("generator.startLabel")}
              </Label>
              <DateInput
                id="repeat-from"
                value={from}
                disabled={submitting}
                onValueChange={(value) => {
                  setFrom(value);
                  setError(null);
                  // An end before the start is a typo, not an intention.
                  if (value > to) setTo(value);
                }}
              />
            </div>

            <div>
              <Label htmlFor="repeat-to" required>
                {t("generator.endLabel")}
              </Label>
              <DateInput
                id="repeat-to"
                value={to}
                min={from}
                disabled={submitting}
                onValueChange={(value) => {
                  setTo(value);
                  setError(null);
                }}
              />
            </div>

            <div>
              <Label htmlFor="repeat-mode">{t("generator.repeatLabel")}</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={mode}
                  disabled={submitting}
                  onValueChange={(value) => setMode(value as RepeatMode)}
                >
                  <SelectTrigger id="repeat-mode" className="w-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_MODES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`generator.modes.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {mode === "custom" && (
                  <label className="flex items-center gap-2">
                    <QuantityInput
                      value={gap}
                      min={MIN_CUSTOM_GAP}
                      disabled={submitting}
                      className="w-20"
                      onValueChange={(value) => setGap(value ?? MIN_CUSTOM_GAP)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {t("generator.days")}
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="repeat-items">{t("generator.itemsLabel")}</Label>
            <div id="repeat-items">
              <DayItemsEditor
                items={items}
                products={products}
                disabled={submitting}
                // A day that has not happened has no actuals to record. §5.4
                showDelivered={false}
                onChange={(next) => {
                  setItems(next);
                  setError(null);
                }}
              />
            </div>
            <p className="mt-2 flex items-center justify-end gap-3 text-sm">
              <span className="font-semibold text-foreground">
                {t("generator.perDayTotal")}
              </span>
              <Money value={perDayTotal} emphasis className="text-base" />
            </p>
          </div>

          <div className="max-w-100">
            <Label htmlFor="repeat-staff">{t("generator.staffLabel")}</Label>
            <EntityCombobox
              id="repeat-staff"
              value={staffId}
              endpoint={apiRoutes.staff.options}
              placeholder={t("generator.staffPlaceholder")}
              searchPlaceholder={t("dayModal.staffSearch")}
              emptyMessage={t("dayModal.staffEmpty")}
              disabled={submitting}
              onValueChange={(id, option) => {
                setStaffId(id);
                setStaffName(option?.label ?? null);
              }}
            />
          </div>

          {/* ---- Preview ---------------------------------------------- */}
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
              <span className="text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                {t("generator.preview")}
              </span>
              <span className="text-caption text-muted-foreground">
                {t("generator.previewCount", { count: selected.length })}
              </span>
            </div>

            {preview.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("generator.previewEmpty")}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2 pt-3">
                {preview.map((date) => (
                  <li key={date.date}>
                    {date.conflict ? (
                      <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-muted px-3 text-caption text-muted-foreground opacity-60">
                        <span className="line-through">
                          {formatDate(date.date, locale)} ·{" "}
                          {formatWeekday(date.date, locale)}
                        </span>
                        <span className="text-[var(--badge-warning-fg)]">
                          {t("generator.conflict")}
                        </span>
                      </span>
                    ) : (
                      <label
                        className={cn(
                          "inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-caption",
                          date.selected
                            ? "bg-[var(--badge-primary-bg)] text-[var(--badge-primary-fg)]"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Checkbox
                          checked={date.selected}
                          disabled={submitting}
                          onCheckedChange={() => toggle(date.date)}
                        />
                        {formatDate(date.date, locale)} ·{" "}
                        {formatWeekday(date.date, locale)}
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm text-muted-foreground">
          <span>
            {t("generator.footerSummary", {
              days: selected.length,
              units: unitsPerDay * selected.length,
            })}
          </span>
          <Money
            value={(Math.round(perDayTotal * 100) * selected.length) / 100}
            emphasis
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("actions.cancel")}
          </Button>
          {/* The button counts what it will do, and updates as chips are
              ticked. A generic "Generate" hides the mistake. §5.4 */}
          <Button
            onClick={generate}
            loading={submitting}
            loadingText={t("generator.generating")}
          >
            <Repeat aria-hidden />
            {t("generator.generate", { count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
