"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, PackageX, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { DateInput, FormField, QuantityInput } from "@/components/form";
import { api, ApiError } from "@/lib/api/client";
import { todayIST } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PaymentDirection } from "@/lib/db/entities/enums";
import type { CoinTypeListItemDto } from "@/lib/dto/coin-type.dto";
import {
  createCoinAdjustmentSchema,
  REASONS_BY_DIRECTION,
} from "@/lib/validation/coin-adjustment";
import { ColourDot } from "../types/coin-figures";

/**
 * New stock adjustment. Spec: design MODULES/04-coins §12
 *
 * ── The whole design problem ──────────────────────────────────────────────
 *
 * The note is MANDATORY, and the requirement has to be visible before the owner
 * starts typing — not discovered when he tries to save. Four deliberately
 * redundant layers, per §12.4:
 *
 *   1. the amber permanence banner, above every field;
 *   2. the label is a QUESTION — `What happened?` — not a noun;
 *   3. always-visible helper text stating the requirement AND its reason;
 *   4. on submit, a specific error carrying an example sentence.
 *
 * The primary button is **never disabled**. A disabled button that will not say
 * why is how people conclude the software is broken.
 *
 * Direction defaults to `Out` — the more common and more dangerous case, so it
 * is never silently `In`. Changing it rewrites the reason list and clears any
 * chosen reason: a `Damaged` increase must be impossible. §12.5, §12.6
 */
export function NewAdjustmentDialog({
  coinTypes,
  open,
  onOpenChange,
  lockedCoinTypeId,
}: {
  coinTypes: CoinTypeListItemDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set and read-only when opened from a coin type's detail page. §12.5 */
  lockedCoinTypeId?: string;
}) {
  const t = useTranslations("coins.adjustments.form");
  const tRoot = useTranslations();
  const router = useRouter();

  const [coinTypeId, setCoinTypeId] = useState(lockedCoinTypeId ?? "");
  const [adjustmentDate, setAdjustmentDate] = useState(todayIST());
  const [direction, setDirection] = useState<PaymentDirection>("OUT");
  const [coins, setCoins] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const coinType = coinTypes.find((type) => type.id === coinTypeId);
  const entered = coins ?? 0;

  const value = coinType
    ? Math.round(entered * coinType.perCoinPrice * 100) / 100
    : 0;
  const newBalance = coinType
    ? coinType.balanceCoins + (direction === "OUT" ? -entered : entered)
    : 0;
  const short = direction === "OUT" && !!coinType && entered > coinType.balanceCoins;

  function changeDirection(next: PaymentDirection) {
    setDirection(next);
    // A `Damaged` reason on an `In` adjustment must be impossible, so the
    // select goes back to its placeholder rather than keeping a stale value.
    setReason("");
  }

  function payload() {
    return {
      coinTypeId,
      adjustmentDate,
      direction,
      coins,
      reason,
      note: note.trim(),
    };
  }

  function submit() {
    const parsed = createCoinAdjustmentSchema.safeParse(payload());
    const mapped: Record<string, string> = {};

    if (!parsed.success) {
      for (const [field, messages] of Object.entries(
        parsed.error.flatten().fieldErrors,
      )) {
        if (messages?.[0]) {
          mapped[field] = tRoot.has(messages[0])
            ? tRoot(messages[0])
            : messages[0];
        }
      }
    }

    setErrors(mapped);
    setFormError(null);
    if (Object.keys(mapped).length > 0) return;

    startSubmit(async () => {
      try {
        await api.post("/api/coin-adjustments", payload());
        toast.success(
          t(direction === "OUT" ? "successOut" : "successIn", {
            coins: formatQuantity(entered),
            name: coinType?.name ?? "",
            balance: formatQuantity(newBalance),
          }),
        );
        onOpenChange(false);
        setCoins(null);
        setReason("");
        setNote("");
        router.refresh();
      } catch (error) {
        setFormError(
          error instanceof ApiError
            ? (tRoot.has(error.messageKey)
                ? tRoot(error.messageKey, {
                    ...(error.meta as Record<string, string | number>),
                  })
                : error.messageKey)
            : tRoot("common.somethingWentWrong"),
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-140">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Layer 1 of 4. Non-dismissible, and above the first field so the
              consequence is read before anything is typed. §12.3 */}
          <p className="flex gap-2 rounded-md border border-warning bg-(--badge-warning-bg) p-3 text-caption text-(--badge-warning-fg)">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {t("permanence")}
          </p>

          <div className="flex flex-wrap gap-4">
            <FormField
              label={t("coinType")}
              required
              error={errors.coinTypeId}
              className="min-w-60 flex-1"
              hint={
                coinType
                  ? t("stockContext", {
                      coins: formatQuantity(coinType.balanceCoins),
                      packets: formatQuantity(coinType.stockPackets),
                      loose: formatQuantity(coinType.stockLooseCoins),
                    })
                  : undefined
              }
            >
              {({ id }) => (
                <Select
                  value={coinTypeId}
                  onValueChange={setCoinTypeId}
                  disabled={!!lockedCoinTypeId}
                >
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue placeholder={t("coinTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {coinTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <span className="flex items-center gap-2">
                          <ColourDot colour={type.colourHex} />
                          {type.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField label={t("date")} required error={errors.adjustmentDate}>
              {({ id, invalid }) => (
                <DateInput
                  id={id}
                  value={adjustmentDate}
                  onValueChange={setAdjustmentDate}
                  max={todayIST()}
                  invalid={invalid}
                />
              )}
            </FormField>
          </div>

          <FormField label={t("direction")} required error={errors.direction}>
            <div className="flex gap-2">
              <DirectionCard
                selected={direction === "IN"}
                onSelect={() => changeDirection("IN")}
                icon={<Plus className="size-4" aria-hidden />}
                label={t("directionIn")}
              />
              <DirectionCard
                selected={direction === "OUT"}
                onSelect={() => changeDirection("OUT")}
                icon={<PackageX className="size-4" aria-hidden />}
                label={t("directionOut")}
              />
            </div>
          </FormField>

          <FormField
            label={t("coins")}
            required
            error={errors.coins}
            hint={
              coinType && entered > 0
                ? t("liveResult", {
                    value: formatINR(value),
                    balance: formatQuantity(Math.abs(newBalance)),
                  })
                : undefined
            }
          >
            {({ id }) => (
              <span className="flex items-center gap-3">
                <QuantityInput
                  id={id}
                  value={coins}
                  onValueChange={setCoins}
                  min={1}
                  invalid={short}
                />
                {short && coinType && (
                  <span className="text-caption text-destructive">
                    {t("insufficient", {
                      available: formatQuantity(coinType.balanceCoins),
                      name: coinType.name,
                      requested: formatQuantity(entered),
                    })}
                  </span>
                )}
              </span>
            )}
          </FormField>

          <FormField label={t("reason")} required error={errors.reason}>
            {({ id }) => (
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id={id} className="w-full">
                  <SelectValue placeholder={t("reasonPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {REASONS_BY_DIRECTION[direction].map((option) => (
                    <SelectItem key={option} value={option}>
                      {tRoot(`coins.adjustments.reasons.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          {/* Layers 2 and 3: the label is a question, and the helper is ALWAYS
              present rather than only on error — the error replaces it in the
              same reserved space, so nothing shifts. §12.3 */}
          <FormField
            label={t("noteLabel")}
            required
            error={errors.note}
            hint={t("noteHelper")}
          >
            {({ id, invalid }) => (
              <Textarea
                id={id}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
                invalid={invalid}
              />
            )}
          </FormField>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tRoot("common.cancel")}
          </Button>
          {/* Never disabled — layer 4 is a specific error on submit, with focus
              moved into the field that needs it. §12.4 */}
          <Button
            onClick={submit}
            loading={submitting}
            loadingText={t("submitting")}
          >
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A 40px radio card. Selected gets a 2px primary border and a primary tint. */
function DirectionCard({
  selected,
  onSelect,
  icon,
  label,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex h-10 flex-1 items-center justify-center gap-2 rounded-md border text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected
          ? "border-2 border-primary bg-(--badge-primary-bg) text-(--badge-primary-fg)"
          : "border-input text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
