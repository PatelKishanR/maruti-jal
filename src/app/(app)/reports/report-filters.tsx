"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateInput, EntityCombobox } from "@/components/form";
import type { ComboboxOption } from "@/components/form";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { addDays, todayIST } from "@/lib/dates";
import { reportPaths } from "@/lib/api/routes.report";
import {
  REPORT_DEFINITIONS,
  type ReportPreset,
  type ReportSlug,
} from "@/lib/validation/report";
import type { ReportMetaDto } from "@/lib/dto/report.dto";

/**
 * The filter panel. Spec: design/MODULES/09-reports.md §4.3, §4.6
 *
 * ONE PANEL FOR ALL SEVEN REPORTS, driven by `REPORT_DEFINITIONS` — the same
 * descriptor the service resolves filters from. A field the panel renders is
 * therefore a field the query understands, by construction; the alternative is
 * a list here and a schema there, and the symptom of them drifting is a filter
 * the URL carries and the report silently ignores.
 *
 * EVERY FILTER IS A URL PARAMETER (§4.3), so the view is shareable and browser
 * back works. Applying pushes a history entry.
 *
 * CHANGING A FILTER DOES NOT AUTO-RUN. `Run report` becomes emphasised and a
 * caption says so — otherwise a heavy query fires on every keystroke of a date
 * field. The two exceptions are deliberate: a QUICK CHIP is a single
 * unambiguous intent, and the SUBJECT of a statement (the staff member, the
 * party order) is what the report is about rather than a refinement of it, so
 * both apply immediately. §4.6
 *
 * FIELD WIDTHS ARE FIXED, NEVER FULL WIDTH — a full-width box for a date
 * invites errors. Below `md` they stack at 44px, which is the one place the
 * rule is relaxed because a phone has no room for anything else. §4.3, §4.7
 */
export function ReportFilters({
  slug,
  meta,
  staffId,
  partyOrderId,
  coinTypeId,
  productIds,
}: {
  slug: ReportSlug;
  meta: ReportMetaDto;
  staffId: string | null;
  partyOrderId: string | null;
  coinTypeId: string | null;
  productIds: string[];
}) {
  const t = useTranslations("reports.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const definition = REPORT_DEFINITIONS[slug];

  const [draft, setDraft] = useState({
    date: meta.date,
    from: meta.from,
    to: meta.to,
    staffId,
    partyOrderId,
    coinTypeId,
    productIds,
  });

  // A back/forward navigation changes `meta`, so the panel follows the URL
  // rather than holding a stale draft the owner never typed.
  useEffect(() => {
    setDraft({
      date: meta.date,
      from: meta.from,
      to: meta.to,
      staffId,
      partyOrderId,
      coinTypeId,
      productIds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.date, meta.from, meta.to, staffId, partyOrderId, coinTypeId, productIds.join(",")]);

  const dirty =
    draft.date !== meta.date ||
    draft.from !== meta.from ||
    draft.to !== meta.to ||
    draft.staffId !== staffId ||
    draft.partyOrderId !== partyOrderId ||
    draft.coinTypeId !== coinTypeId ||
    draft.productIds.join(",") !== productIds.join(",");

  function go(next: Partial<typeof draft> & { preset?: ReportPreset }) {
    const merged = { ...draft, ...next };
    /**
     * A NAMED PRESET WINS OVER THE DATE FIELDS, so choosing one must not also
     * forward the dates it replaces. Sending `preset=today&date=2026-07-28`
     * would resolve back to the 28th and the chip would light up over the wrong
     * day — the classic version of this bug, and invisible until someone checks
     * the sheet against the drawer.
     */
    const explicitDates = !next.preset || next.preset === "custom";

    /**
     * `Run report` with untouched dates KEEPS the active chip. Re-running "This
     * month" must not silently turn the same window into a custom range and
     * blank the chip that named it.
     */
    const preset =
      next.preset ?? (dirty || meta.preset === "custom" ? undefined : meta.preset);

    startTransition(() => {
      router.push(
        reportPaths.report(slug, {
          preset,
          date:
            definition.fields.includes("date") && explicitDates
              ? merged.date
              : undefined,
          from:
            definition.fields.includes("range") && explicitDates
              ? merged.from
              : undefined,
          to:
            definition.fields.includes("range") && explicitDates
              ? merged.to
              : undefined,
          staffId: merged.staffId ?? undefined,
          partyOrderId: merged.partyOrderId ?? undefined,
          coinTypeId: merged.coinTypeId ?? undefined,
          productIds:
            merged.productIds.length > 0
              ? merged.productIds.join(",")
              : undefined,
        }),
      );
    });
  }

  const missingSubject =
    (definition.requires === "staff" && !draft.staffId) ||
    (definition.requires === "partyOrder" && !draft.partyOrderId);

  return (
    <Card className="mb-6 p-4 print:hidden sm:p-6">
      <div className="flex flex-wrap items-end gap-4">
        {definition.fields.includes("staff") ? (
          <Field
            label={t("staff")}
            required={definition.requires === "staff"}
            className="w-full sm:w-70"
          >
            <EntityCombobox
              value={draft.staffId}
              onValueChange={(id) => {
                setDraft((d) => ({ ...d, staffId: id }));
                // The subject re-runs immediately. §6.6
                go({ staffId: id });
              }}
              endpoint="/api/staff/options"
              placeholder={t("allStaff")}
              searchPlaceholder={t("searchStaff")}
              emptyMessage={t("noStaff")}
            />
          </Field>
        ) : null}

        {definition.fields.includes("partyOrder") ? (
          <Field label={t("partyOrder")} required className="w-full sm:w-90">
            <EntityCombobox
              value={draft.partyOrderId}
              onValueChange={(id) => {
                setDraft((d) => ({ ...d, partyOrderId: id }));
                go({ partyOrderId: id });
              }}
              endpoint="/api/party-orders/options"
              placeholder={t("chooseParty")}
              searchPlaceholder={t("searchParty")}
              emptyMessage={t("noParty")}
            />
          </Field>
        ) : null}

        {definition.fields.includes("coinType") ? (
          <Field label={t("coinType")} className="w-full sm:w-60">
            <EntityCombobox
              value={draft.coinTypeId}
              onValueChange={(id) => {
                setDraft((d) => ({ ...d, coinTypeId: id }));
                go({ coinTypeId: id });
              }}
              endpoint="/api/coin-types/options"
              placeholder={t("allCoinTypes")}
              searchPlaceholder={t("searchCoinType")}
              emptyMessage={t("noCoinType")}
            />
          </Field>
        ) : null}

        {definition.fields.includes("date") ? (
          <Field label={t("date")} className="w-full sm:w-auto">
            {/* ‹ › day-stepping is the single most common action here. §5.6 */}
            <div className="flex items-center gap-1">
              <StepButton
                label={t("previousDay")}
                onClick={() => go({ date: addDays(draft.date, -1), preset: "custom" })}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </StepButton>
              <div className="w-full sm:w-45">
                <DateInput
                  value={draft.date}
                  onValueChange={(value) =>
                    setDraft((d) => ({ ...d, date: value }))
                  }
                  max={todayIST()}
                />
              </div>
              <StepButton
                label={t("nextDay")}
                disabled={draft.date >= todayIST()}
                onClick={() => go({ date: addDays(draft.date, 1), preset: "custom" })}
              >
                <ChevronRight className="size-4" aria-hidden />
              </StepButton>
            </div>
          </Field>
        ) : null}

        {definition.fields.includes("range") ? (
          <>
            <Field label={t("from")} className="w-1/2 sm:w-45">
              <DateInput
                value={draft.from}
                onValueChange={(value) =>
                  setDraft((d) => ({ ...d, from: value }))
                }
                max={draft.to}
              />
            </Field>
            <Field label={t("to")} className="w-1/2 sm:w-45">
              <DateInput
                value={draft.to}
                onValueChange={(value) => setDraft((d) => ({ ...d, to: value }))}
                min={draft.from}
                max={todayIST()}
              />
            </Field>
          </>
        ) : null}

        {definition.fields.includes("products") ? (
          <Field label={t("products")} className="w-full sm:w-60">
            <ProductPicker
              value={draft.productIds}
              onChange={(ids) => setDraft((d) => ({ ...d, productIds: ids }))}
              allLabel={t("allProducts")}
              countLabel={(n) => t("productsSelected", { count: String(n) })}
            />
          </Field>
        ) : null}
      </div>

      {(definition.presets.length > 0 || definition.fields.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Chips scroll horizontally rather than wrapping on a phone. §4.7 */}
          <div className="-mx-1 flex max-w-full flex-nowrap gap-2 overflow-x-auto px-1 py-0.5">
            {definition.presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => go({ preset })}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-caption font-medium transition-colors duration-100",
                  meta.preset === preset
                    ? "border border-primary bg-(--badge-primary-bg) text-(--badge-primary-fg)"
                    : "bg-(--badge-default-bg) text-(--badge-default-fg) hover:bg-border",
                )}
              >
                {t(`preset.${preset}`)}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto">
            {dirty ? (
              <p className="hidden text-caption text-muted-foreground sm:block">
                {t("changed")}
              </p>
            ) : null}
            <Button
              type="button"
              variant="primary"
              onClick={() => go({})}
              disabled={missingSubject}
              loading={pending}
              className="w-full sm:w-auto"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              {pending ? t("updating") : t("run")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-body-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-primary">*</span> : null}
      </p>
      {children}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-input text-foreground transition-colors duration-100 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * The product multi-select.
 *
 * A popover of checkboxes rather than a chip field: the plant sells six
 * products, all of them fit without scrolling, and a chip field would spend
 * more of the row on the chips than on the choice.
 */
function ProductPicker({
  value,
  onChange,
  allLabel,
  countLabel,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  allLabel: string;
  countLabel: (count: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ComboboxOption[]>([]);

  useEffect(() => {
    if (!open || options.length > 0) return;
    api
      .get<ComboboxOption[]>("/api/products/options")
      .then(setOptions)
      .catch(() => setOptions([]));
  }, [open, options.length]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between gap-2 rounded-sm border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <span className="truncate">
            {value.length === 0 ? allLabel : countLabel(value.length)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <ul className="max-h-72 overflow-y-auto">
          {options.map((option) => {
            const checked = value.includes(option.id);
            return (
              <li key={option.id}>
                <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-muted">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      onChange(
                        checked
                          ? value.filter((id) => id !== option.id)
                          : [...value, option.id],
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-body-sm">
                    {option.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
