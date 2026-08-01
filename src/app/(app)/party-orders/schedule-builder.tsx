"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarPlus, Copy, Info, Repeat } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { formatDate, formatDateRange, todayIST } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import { ScheduleTimeline, ScheduleTotals } from "./day-card";
import type { PartyProductRef } from "./day-items-editor";
import { DuplicateDayDialog } from "./duplicate-day-dialog";
import { EditDayModal } from "./edit-day-modal";
import { RepeatPatternModal } from "./repeat-pattern-modal";
import {
  blankDay,
  nextScheduleDate,
  previewDayTotal,
  previewScheduleTotal,
  scheduleUnits,
  sortDays,
  takenDates,
  viewFromDraft,
  type DayDraft,
} from "./schedule-model";

/**
 * The schedule builder — the centrepiece of the module.
 * Spec: design/MODULES/05-party-orders.md §5
 *
 * A party order is a calendar, and this is where the calendar is built. Three
 * ways to add a day, ranked by how often each is used:
 *
 *   `+ Add a day`     one-offs and irregular days — the common case, so it is
 *                     the only blue-outlined button
 *   `Repeat pattern`  a run of days, previewed date by date
 *   `Duplicate a day` "the same again on the 19th"
 *
 * Everything they produce is an ORDINARY day afterwards. That is the whole
 * argument for one row per date over a recurrence rule: the owner cancels
 * Tuesday and doubles Wednesday, and neither is expressible as a rule.
 *
 * It holds DRAFTS, not saved rows, so the totals here are previews — the
 * wizard has nothing on disk yet. See schedule-model.ts
 */
export function ScheduleBuilder({
  days,
  onChange,
  products,
  subtitle,
  className,
}: {
  days: DayDraft[];
  onChange: (days: DayDraft[]) => void;
  products: PartyProductRef[];
  /** `Shreeji Wedding Hall` — the modals' subtitle. */
  subtitle: string;
  className?: string;
}) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;

  const [editing, setEditing] = useState<{
    mode: "add" | "edit";
    day: DayDraft;
  } | null>(null);
  const [duplicating, setDuplicating] = useState<DayDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [removing, setRemoving] = useState<DayDraft | null>(null);
  const [generatedBanner, setGeneratedBanner] = useState<{
    count: number;
    from: string;
    to: string;
  } | null>(null);

  const ordered = sortDays(days);
  const total = previewScheduleTotal(ordered);
  const units = scheduleUnits(ordered);
  const dates = takenDates(ordered);

  function openAdd(serviceDate?: string) {
    setEditing({
      mode: "add",
      day: blankDay(serviceDate ?? nextScheduleDate(ordered, todayIST())),
    });
  }

  function applyDay(draft: DayDraft) {
    const exists = days.some((day) => day.key === draft.key);
    onChange(
      sortDays(
        exists
          ? days.map((day) => (day.key === draft.key ? draft : day))
          : [...days, draft],
      ),
    );
    setEditing(null);
  }

  function removeDay(draft: DayDraft) {
    onChange(days.filter((day) => day.key !== draft.key));
    setRemoving(null);
  }

  return (
    <section className={className}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {ordered.length === 0
            ? t("schedule.summaryEmpty")
            : t("schedule.summary", {
                days: ordered.length,
                range: formatDateRange(
                  ordered[0].serviceDate,
                  ordered[ordered.length - 1].serviceDate,
                  locale,
                ),
                units: formatQuantity(units),
              })}
        </p>

        <p className="flex items-baseline gap-3">
          <span className="text-sm font-semibold text-foreground">
            {t("schedule.total")}
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatINR(total)}
          </span>
        </p>
      </header>

      {/* §5.3: only `+ Add a day` is blue. The other two are power tools. */}
      <div className="mt-4 flex flex-wrap gap-3 border-b border-border pb-4">
        <Button variant="secondary" onClick={() => openAdd()}>
          <CalendarPlus aria-hidden />
          {t("schedule.addDay")}
        </Button>

        <Button variant="outline" onClick={() => setGenerating(true)}>
          <Repeat aria-hidden />
          {t("schedule.repeat")}
        </Button>

        <Button
          variant="outline"
          disabled={ordered.length === 0}
          title={ordered.length === 0 ? t("schedule.duplicateDisabled") : undefined}
          onClick={() => setDuplicating(ordered[0] ?? null)}
        >
          <Copy aria-hidden />
          {t("schedule.duplicate")}
        </Button>
      </div>

      {generatedBanner && (
        <Alert variant="info" icon={<Info aria-hidden />} className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <p>
              {t("schedule.generatedBanner", {
                count: generatedBanner.count,
                from: formatDate(generatedBanner.from, locale),
                to: formatDate(generatedBanner.to, locale),
              })}
            </p>
            <button
              type="button"
              onClick={() => setGeneratedBanner(null)}
              className="shrink-0 text-caption underline-offset-4 hover:underline"
            >
              {t("actions.dismiss")}
            </button>
          </div>
        </Alert>
      )}

      {ordered.length === 0 ? (
        <EmptyState
          icon="party"
          title={t("schedule.empty.title")}
          description={t("schedule.empty.body")}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => openAdd()}>
                <CalendarPlus aria-hidden />
                {t("schedule.empty.add")}
              </Button>
              <Button variant="secondary" onClick={() => setGenerating(true)}>
                <Repeat aria-hidden />
                {t("schedule.repeat")}
              </Button>
            </div>
          }
        />
      ) : (
        <ScheduleTimeline
          className="mt-6"
          days={ordered.map(viewFromDraft)}
          onAddDay={(date) => openAdd(date)}
          actions={{
            onEdit: (view) => {
              const day = days.find((candidate) => candidate.key === view.key);
              if (day) setEditing({ mode: "edit", day });
            },
            onDuplicate: (view) => {
              const day = days.find((candidate) => candidate.key === view.key);
              if (day) setDuplicating(day);
            },
            onRemove: (view) => {
              const day = days.find((candidate) => candidate.key === view.key);
              if (day) setRemoving(day);
            },
          }}
        />
      )}

      <ScheduleTotals
        className="mt-6"
        days={ordered.length}
        units={units}
        total={total}
      />

      <EditDayModal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode={editing?.mode ?? "add"}
        subtitle={subtitle}
        day={editing?.day ?? blankDay(todayIST())}
        products={products}
        // The booking does not exist yet, so there is no stored total to move.
        bookingTotal={null}
        takenDates={dates.filter(
          (date) => date !== (editing?.day.serviceDate ?? ""),
        )}
        onSubmit={applyDay}
      />

      <RepeatPatternModal
        open={generating}
        onOpenChange={setGenerating}
        defaultStart={nextScheduleDate(ordered, todayIST())}
        existingDates={dates}
        products={products}
        onGenerate={(generated) => {
          const merged = sortDays([...days, ...generated]);
          onChange(merged);
          setGenerating(false);
          setGeneratedBanner({
            count: generated.length,
            from: generated[0].serviceDate,
            to: generated[generated.length - 1].serviceDate,
          });
        }}
      />

      <DuplicateDayDialog
        open={duplicating !== null}
        onOpenChange={(open) => !open && setDuplicating(null)}
        source={duplicating}
        takenDates={dates}
        onDuplicate={(day) => {
          onChange(sortDays([...days, day]));
          setDuplicating(null);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("schedule.remove.title", {
          date: removing ? formatDate(removing.serviceDate, locale) : "",
        })}
        // The consequence, with both figures — the total is what the owner is
        // really being asked about. §5.8
        description={t("schedule.remove.body", {
          items: removing?.items.length ?? 0,
          amount: formatINR(removing ? previewDayTotal(removing) : 0),
          from: formatINR(total),
          to: formatINR(total - (removing ? previewDayTotal(removing) : 0)),
        })}
        confirmLabel={t("schedule.remove.confirm")}
        onConfirm={() => {
          if (removing) removeDay(removing);
        }}
      />
    </section>
  );
}
