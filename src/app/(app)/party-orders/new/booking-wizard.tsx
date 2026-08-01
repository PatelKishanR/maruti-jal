"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { DateInput, FormField, MoneyInput } from "@/components/form";
import { useFormErrors } from "@/components/form/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Money } from "@/components/common/money";
import { api } from "@/lib/api/client";
import { partyOrderPaths, partyOrderRoutes } from "@/lib/api/routes.party-order";
import { formatDate, formatDateRange, formatWeekday } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { PartyOrderDetailDto } from "@/lib/dto/party-order.dto";
import {
  createPartyOrderSchema,
  PARTY_PAYMENT_MODES,
  partyDetailsFields,
  type PartyPaymentMode,
} from "@/lib/validation/party-order";
import type { PartyProductRef } from "../day-items-editor";
import { ScheduleBuilder } from "../schedule-builder";
import {
  previewDayTotal,
  previewScheduleTotal,
  scheduleUnits,
  sortDays,
  toDayPayload,
  type AdvanceDraft,
  type DayDraft,
  type PartyDetailsDraft,
} from "../schedule-model";

/**
 * The booking wizard. Spec: design/MODULES/05-party-orders.md §4, §5, §6
 *
 * Four decisions in order — who, when, deposit, confirm. A wizard rather than
 * one long form because **step 2 is a full working surface in its own right**
 * and would be lost inside a scrolling page.
 *
 * Every step is held CLIENT-SIDE and nothing is written until `Book party
 * order`: the header, all the days, all their lines and the advance land in one
 * transaction, so a failure leaves nothing half-booked and the owner's typing
 * is still on screen. See .claude/ARCHITECTURE.md §4.4
 */

const STEPS = ["details", "schedule", "advance", "review"] as const;
type Step = (typeof STEPS)[number];

export function BookingWizard({
  initialDetails,
  initialDays,
  initialAdvance,
  products,
}: {
  initialDetails: PartyDetailsDraft;
  initialDays: DayDraft[];
  initialAdvance: AdvanceDraft;
  products: PartyProductRef[];
}) {
  const t = useTranslations("partyOrders");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [step, setStep] = useState<Step>("details");
  const [details, setDetails] = useState(initialDetails);
  const [days, setDays] = useState(initialDays);
  const [advance, setAdvance] = useState(initialAdvance);
  const [discarding, setDiscarding] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const { fieldErrors, formError, setFieldErrors, setFormError, handle } =
    useFormErrors();

  const ordered = useMemo(() => sortDays(days), [days]);
  const total = previewScheduleTotal(ordered);
  const units = scheduleUnits(ordered);
  const advanceAmount = advance.enabled ? (advance.amount ?? 0) : 0;
  const outstanding = (Math.round(total * 100) - Math.round(advanceAmount * 100)) / 100;

  const dirty =
    details.partyName !== "" ||
    details.phone !== "" ||
    details.deliveryAddress !== "" ||
    ordered.length > 0;

  const resolve = (key: string) => (tRoot.has(key) ? tRoot(key) : key);

  /** Step 1 validates with the SAME field schemas the server enforces. */
  function validateDetails(): boolean {
    const errors: Record<string, string> = {};

    for (const [name, schema] of Object.entries(partyDetailsFields)) {
      const value = details[name as keyof PartyDetailsDraft];
      const parsed = schema.safeParse(value === "" ? undefined : value);
      if (!parsed.success) {
        errors[name] = resolve(parsed.error.issues[0].message);
      }
    }

    // Two identical numbers is a paste, not two contacts. §4.4
    if (
      details.altPhone.trim() !== "" &&
      details.altPhone.replace(/\D/g, "") === details.phone.replace(/\D/g, "")
    ) {
      errors.altPhone = t("errors.altPhoneSame");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goNext() {
    setFormError(null);

    if (step === "details") {
      if (!validateDetails()) return;
      setStep("schedule");
      return;
    }

    if (step === "schedule") {
      if (ordered.length === 0) {
        setFormError(t("errors.noDays"));
        return;
      }
      const incomplete = ordered.find((day) => toDayPayload(day).items.length === 0);
      if (incomplete) {
        setFormError(
          t("errors.dayWithoutItems", {
            date: formatDate(incomplete.serviceDate, locale),
          }),
        );
        return;
      }
      setStep("advance");
      return;
    }

    if (step === "advance") {
      if (advance.enabled && (advance.amount ?? 0) <= 0) {
        setFormError(t("errors.advanceAmount"));
        return;
      }
      setStep("review");
    }
  }

  function goBack() {
    setFormError(null);
    const index = STEPS.indexOf(step);
    if (index > 0) setStep(STEPS[index - 1]);
  }

  function payload() {
    return {
      partyName: details.partyName,
      phone: details.phone,
      altPhone: details.altPhone,
      deliveryAddress: details.deliveryAddress,
      notes: details.notes,
      days: ordered.map(toDayPayload),
      advance: advance.enabled
        ? {
            paidOn: advance.paidOn,
            amount: advance.amount,
            mode: advance.mode,
            isAdvance: true as const,
            referenceNo: advance.referenceNo,
            note: advance.note,
          }
        : null,
    };
  }

  function book() {
    setFormError(null);

    const parsed = createPartyOrderSchema.safeParse(payload());
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [field, messages] of Object.entries(flat)) {
        if (messages?.[0]) mapped[field] = resolve(messages[0]);
      }
      setFieldErrors(mapped);
      // Jump to the step that owns the problem rather than reporting it here.
      if (mapped.partyName || mapped.phone || mapped.deliveryAddress) {
        setStep("details");
      } else if (mapped.days) {
        setStep("schedule");
      } else {
        setFormError(resolve(parsed.error.issues[0].message));
      }
      return;
    }

    startSubmit(async () => {
      try {
        const booked = await api.post<PartyOrderDetailDto>(
          partyOrderRoutes.create,
          payload(),
        );

        toast.success(
          advance.enabled
            ? t("wizard.toastWithAdvance", {
                code: booked.code,
                advance: formatINR(booked.advanceAmount),
                outstanding: formatINR(booked.outstandingAmount),
              })
            : t("wizard.toast", {
                code: booked.code,
                party: booked.partyName,
                days: booked.progress.totalDays,
                amount: formatINR(booked.totalAmount),
              }),
        );

        router.push(partyOrderPaths.detail(booked.id));
        router.refresh();
      } catch (error) {
        handle(error);
      }
    });
  }

  return (
    <>
      <StepIndicator
        current={step}
        onSelect={setStep}
        summaries={{
          details: details.partyName || undefined,
          schedule:
            ordered.length > 0
              ? t("wizard.scheduleSummary", {
                  days: ordered.length,
                  amount: formatINR(total),
                })
              : undefined,
          advance: advance.enabled
            ? t("wizard.advanceSummary", { amount: formatINR(advanceAmount) })
            : undefined,
          review: undefined,
        }}
      />

      <Card className="mt-8 p-6">
        {formError && (
          <Alert
            variant="danger"
            icon={<AlertTriangle aria-hidden />}
            className="mb-4"
          >
            {formError}
          </Alert>
        )}

        {step === "details" && (
          <DetailsStep
            values={details}
            errors={fieldErrors}
            disabled={submitting}
            onChange={setDetails}
          />
        )}

        {step === "schedule" && (
          <ScheduleBuilder
            days={days}
            onChange={setDays}
            products={products}
            subtitle={details.partyName}
          />
        )}

        {step === "advance" && (
          <AdvanceStep
            values={advance}
            total={total}
            outstanding={outstanding}
            disabled={submitting}
            onChange={setAdvance}
          />
        )}

        {step === "review" && (
          <ReviewStep
            details={details}
            days={ordered}
            advance={advance}
            total={total}
            units={units}
            outstanding={outstanding}
            onEdit={setStep}
          />
        )}

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex flex-wrap items-center justify-end gap-3 rounded-b-lg border-t border-border bg-card px-6 py-4">
          {step !== "details" && (
            <Button variant="ghost" onClick={goBack} disabled={submitting}>
              <ChevronLeft aria-hidden />
              {t("wizard.back")}
            </Button>
          )}

          {/* Discard confirm only when something would be lost. §4.6 */}
          {dirty ? (
            <Button
              variant="ghost"
              disabled={submitting}
              onClick={() => setDiscarding(true)}
            >
              {t("actions.cancel")}
            </Button>
          ) : (
            <Button variant="ghost" asChild>
              <Link href={partyOrderPaths.list}>{t("actions.cancel")}</Link>
            </Button>
          )}

          {step === "review" ? (
            /* NEVER disabled. Pressing it is how the owner finds out what is
               missing — a dead final button on a four-step wizard is the worst
               dead end in the app. §6.5 */
            <Button
              onClick={book}
              loading={submitting}
              loadingText={t("wizard.booking")}
              className="min-w-45"
            >
              {t("wizard.book")}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={submitting}>
              {step === "details"
                ? t("wizard.nextSchedule")
                : step === "schedule"
                  ? t("wizard.nextAdvance")
                  : t("wizard.nextReview")}
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t("wizard.discard.title")}
        description={t("wizard.discard.body", {
          party: details.partyName || t("wizard.discard.noName"),
          days: ordered.length,
        })}
        confirmLabel={t("wizard.discard.confirm")}
        onConfirm={() => router.push(partyOrderPaths.list)}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Step indicator — §4.3
   ═══════════════════════════════════════════════════════════════════════ */

function StepIndicator({
  current,
  summaries,
  onSelect,
}: {
  current: Step;
  /** The ACTUAL entered summary on a completed step, never the generic line. */
  summaries: Record<Step, string | undefined>;
  onSelect: (step: Step) => void;
}) {
  const t = useTranslations("partyOrders.wizard.steps");
  const currentIndex = STEPS.indexOf(current);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <ol className="flex flex-wrap gap-4 sm:flex-nowrap">
        {STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const active = step === current;

          return (
            <li key={step} className="flex min-w-40 flex-1 items-start gap-3">
              <button
                type="button"
                // A completed step returns to itself with everything preserved;
                // one ahead is not reachable until it has been reached. §4.3
                disabled={!complete}
                onClick={() => onSelect(step)}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  complete &&
                    "border-success bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]",
                  active && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !complete && !active && "border-input text-muted-foreground",
                )}
              >
                {complete ? <Check className="size-4" aria-hidden /> : index + 1}
              </button>

              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    active || complete ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`${step}.title`)}
                </span>
                <span className="block text-caption text-muted-foreground">
                  {summaries[step] ?? t(`${step}.hint`)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Step 1 — party details, §4
   ═══════════════════════════════════════════════════════════════════════ */

function DetailsStep({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: PartyDetailsDraft;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (values: PartyDetailsDraft) => void;
}) {
  const t = useTranslations("partyOrders.details");

  function set<K extends keyof PartyDetailsDraft>(
    key: K,
    value: PartyDetailsDraft[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="max-w-180">
      <h2 className="border-b border-border pb-3 text-h4 font-semibold text-foreground">
        {t("heading")}
      </h2>

      <div className="mt-4">
        <FormField
          label={t("nameLabel")}
          required
          htmlFor="party-name"
          error={errors.partyName}
          hint={t("nameHint")}
        >
          {/* Autofocused, full width and 48px: the first field on a
              fast-entry form, and any script — `શ્રીજી વાડી` is a party name. */}
          <Input
            id="party-name"
            autoFocus
            className="h-12"
            value={values.partyName}
            placeholder={t("namePlaceholder")}
            invalid={!!errors.partyName}
            disabled={disabled}
            onChange={(event) => set("partyName", event.target.value)}
          />
        </FormField>

        <div className="flex flex-wrap gap-6">
          <FormField
            label={t("phoneLabel")}
            required
            htmlFor="party-phone"
            error={errors.phone}
          >
            <Input
              id="party-phone"
              type="tel"
              inputMode="tel"
              className="w-50"
              value={values.phone}
              placeholder={t("phonePlaceholder")}
              invalid={!!errors.phone}
              disabled={disabled}
              onChange={(event) => set("phone", event.target.value)}
            />
          </FormField>

          <FormField
            label={t("altPhoneLabel")}
            htmlFor="party-alt-phone"
            error={errors.altPhone}
          >
            <Input
              id="party-alt-phone"
              type="tel"
              inputMode="tel"
              className="w-50"
              value={values.altPhone}
              placeholder={t("altPhonePlaceholder")}
              invalid={!!errors.altPhone}
              disabled={disabled}
              onChange={(event) => set("altPhone", event.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label={t("addressLabel")}
          required
          htmlFor="party-address"
          error={errors.deliveryAddress}
        >
          <Textarea
            id="party-address"
            rows={3}
            value={values.deliveryAddress}
            placeholder={t("addressPlaceholder")}
            invalid={!!errors.deliveryAddress}
            disabled={disabled}
            onChange={(event) => set("deliveryAddress", event.target.value)}
          />
        </FormField>

        <FormField
          label={t("notesLabel")}
          htmlFor="party-notes"
          error={errors.notes}
          hint={t("notesHint")}
        >
          <Textarea
            id="party-notes"
            rows={3}
            value={values.notes}
            placeholder={t("notesPlaceholder")}
            invalid={!!errors.notes}
            disabled={disabled}
            onChange={(event) => set("notes", event.target.value)}
          />
        </FormField>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Step 3 — the advance, §6
   ═══════════════════════════════════════════════════════════════════════ */

function AdvanceStep({
  values,
  total,
  outstanding,
  disabled,
  onChange,
}: {
  values: AdvanceDraft;
  total: number;
  outstanding: number;
  disabled: boolean;
  onChange: (values: AdvanceDraft) => void;
}) {
  const t = useTranslations("partyOrders.advance");

  function set<K extends keyof AdvanceDraft>(key: K, value: AdvanceDraft[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="max-w-180">
      <h2 className="border-b border-border pb-3 text-h4 font-semibold text-foreground">
        {t("heading")}
      </h2>
      <p className="mt-4 text-sm text-muted-foreground">{t("intro")}</p>

      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium">
        <Switch
          checked={values.enabled}
          disabled={disabled}
          onCheckedChange={(checked) => set("enabled", checked)}
        />
        {t("toggle")}
      </label>

      {values.enabled ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <Label htmlFor="advance-date">{t("dateLabel")}</Label>
              <DateInput
                id="advance-date"
                value={values.paidOn}
                disabled={disabled}
                onValueChange={(value) => set("paidOn", value)}
              />
            </div>

            <div>
              <Label htmlFor="advance-amount" required>
                {t("amountLabel")}
              </Label>
              <MoneyInput
                id="advance-amount"
                value={values.amount}
                disabled={disabled}
                onValueChange={(value) => set("amount", value)}
              />
            </div>

            <div>
              <Label htmlFor="advance-mode" required>
                {t("modeLabel")}
              </Label>
              <Select
                value={values.mode}
                disabled={disabled}
                onValueChange={(value) => set("mode", value as PartyPaymentMode)}
              >
                <SelectTrigger id="advance-mode" className="w-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_PAYMENT_MODES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`modes.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="advance-reference">
              {values.mode === "UPI"
                ? t("upiReference")
                : values.mode === "BANK_TRANSFER"
                  ? t("bankReference")
                  : t("reference")}
            </Label>
            <Input
              id="advance-reference"
              value={values.referenceNo}
              placeholder={t("referencePlaceholder")}
              disabled={disabled}
              onChange={(event) => set("referenceNo", event.target.value)}
            />
          </div>

          {/* An advance ABOVE the current total is allowed, not blocked — the
              schedule is often finished after the deposit is taken. §6.4 */}
          {(values.amount ?? 0) > total && (
            <Alert variant="info">
              {t("exceeds", {
                amount: formatINR(values.amount ?? 0),
                total: formatINR(total),
                refund: formatINR(Math.abs(outstanding)),
              })}
            </Alert>
          )}
        </div>
      ) : (
        <p className="mt-4 text-caption text-muted-foreground">{t("later")}</p>
      )}

      <dl className="ml-auto mt-6 w-80 max-w-full text-sm">
        <Line label={t("totalPayable")} value={total} />
        {values.enabled && (
          <Line
            label={t("advanceNow")}
            value={values.amount ?? 0}
            className="text-primary"
          />
        )}
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-2">
          <dt className="font-semibold text-foreground">{t("outstandingAfter")}</dt>
          <dd>
            <Money
              value={outstanding}
              emphasis
              zeroAs="value"
              variant={outstanding < 0 ? "refund" : "default"}
              className="text-lg"
            />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Step 4 — review, §6.2
   ═══════════════════════════════════════════════════════════════════════ */

function ReviewStep({
  details,
  days,
  advance,
  total,
  units,
  outstanding,
  onEdit,
}: {
  details: PartyDetailsDraft;
  days: DayDraft[];
  advance: AdvanceDraft;
  total: number;
  units: number;
  outstanding: number;
  onEdit: (step: Step) => void;
}) {
  const t = useTranslations("partyOrders.review");
  const tAdvance = useTranslations("partyOrders.advance");
  const locale = useLocale() as Locale;

  return (
    <div>
      <Section
        title={t("partyHeading")}
        actionLabel={t("edit")}
        onEdit={() => onEdit("details")}
      >
        <p className="text-sm text-foreground">
          {[details.partyName, details.phone, details.altPhone]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
          {details.deliveryAddress}
        </p>
        {details.notes && (
          <p className="mt-1 text-sm text-muted-foreground">
            &ldquo;{details.notes}&rdquo;
          </p>
        )}
      </Section>

      <Section
        title={t("scheduleHeading", {
          days: days.length,
          range:
            days.length > 0
              ? formatDateRange(
                  days[0].serviceDate,
                  days[days.length - 1].serviceDate,
                  locale,
                )
              : "",
        })}
        actionLabel={t("edit")}
        onEdit={() => onEdit("schedule")}
      >
        <ul className="divide-y divide-border">
          {days.map((day) => (
            <li
              key={day.key}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm"
            >
              <span className="w-32 shrink-0 font-medium text-foreground">
                {formatDate(day.serviceDate, locale)} ·{" "}
                {formatWeekday(day.serviceDate, locale)}
              </span>
              <span className="min-w-0 flex-1 text-muted-foreground">
                {day.items
                  .filter((item) => item.productId)
                  .map(
                    (item) =>
                      `${item.productTitle} × ${formatQuantity(item.quantity ?? 0)}`,
                  )
                  .join(" · ")}
              </span>
              <span className="w-24 text-muted-foreground">
                {day.assignedStaffName ?? "—"}
              </span>
              <Money value={previewDayTotal(day)} className="w-28" />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-caption text-muted-foreground">
          {t("scheduleUnits", { units: formatQuantity(units) })}
        </p>
      </Section>

      <Section
        title={t("advanceHeading")}
        actionLabel={advance.enabled ? t("edit") : t("addAdvance")}
        onEdit={() => onEdit("advance")}
      >
        {advance.enabled ? (
          <p className="text-sm text-foreground">
            {[
              formatINR(advance.amount ?? 0),
              tAdvance(`modes.${advance.mode}`),
              formatDate(advance.paidOn, locale),
              advance.referenceNo ? `"${advance.referenceNo}"` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("noAdvance", { amount: formatINR(total) })}
          </p>
        )}
      </Section>

      <dl className="ml-auto mt-6 w-80 max-w-full text-sm">
        <Line label={t("totalPayable")} value={total} />
        {advance.enabled && (
          <Line
            label={t("advanceLine")}
            value={-(advance.amount ?? 0)}
            className="text-success"
          />
        )}
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-2">
          <dt className="font-semibold text-foreground">{t("outstanding")}</dt>
          <dd>
            <Money
              value={outstanding}
              emphasis
              zeroAs="value"
              variant={outstanding < 0 ? "refund" : "default"}
              className="text-lg"
            />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Section({
  title,
  actionLabel,
  onEdit,
  children,
}: {
  title: string;
  actionLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border py-6 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {actionLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

function Line({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Money value={value} zeroAs="value" className={className} />
      </dd>
    </div>
  );
}
