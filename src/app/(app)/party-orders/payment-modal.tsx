"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Banknote, CheckCircle2 } from "lucide-react";
import { DateInput, MoneyInput } from "@/components/form";
import { useFormErrors } from "@/components/form/use-form-errors";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/common/money";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { partyOrderRoutes } from "@/lib/api/routes.party-order";
import { todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  PARTY_PAYMENT_MODES,
  type PartyPaymentMode,
} from "@/lib/validation/party-order";
import type { PartyOrderDetailDto } from "@/lib/dto/party-order.dto";

/**
 * Record a party payment. Spec: design/MODULES/05-party-orders.md §9
 *
 * Simpler than the delivery-order payment modal — parties pay in cash, UPI or
 * bank transfer, never coins — but it carries the one thing that one doesn't:
 * the **advance** flag, which changes how the payment reads in the history
 * forever and lets the amount legitimately exceed the current total.
 *
 * An advance is a SUBSET of what has been paid, not a second bucket. The
 * footer's arithmetic is a preview of what the rollup trigger will write; every
 * figure on screen afterwards comes back from the database.
 */
export function PaymentModal({
  open,
  onOpenChange,
  order,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    code: string;
    partyName: string;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
  };
  onRecorded: (detail: PartyOrderDetailDto) => void;
}) {
  const t = useTranslations("partyOrders");
  const [paidOn, setPaidOn] = useState(todayIST());
  const [amount, setAmount] = useState<number | null>(null);
  const [mode, setMode] = useState<PartyPaymentMode>("CASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [isAdvance, setIsAdvance] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, startSubmit] = useTransition();
  const { fieldErrors, formError, setFormError, setFieldErrors, handle, clear } =
    useFormErrors();

  /**
   * Minted ONCE per modal open. An impatient second tap on a flaky connection
   * carries the same value, so the server returns the first payment instead of
   * charging the party twice. See .claude/DATA-MODEL.md §10.11
   */
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (open) {
      setPaidOn(todayIST());
      setAmount(null);
      setMode("CASH");
      setReferenceNo("");
      setIsAdvance(false);
      setNote("");
      setRequestId(crypto.randomUUID());
      clear();
    }
  }, [open, clear]);

  const outstandingAfter = useMemo(
    () =>
      (Math.round(order.outstandingAmount * 100) -
        Math.round((amount ?? 0) * 100)) /
      100,
    [order.outstandingAmount, amount],
  );

  const overpaying = amount !== null && amount > order.outstandingAmount;

  function submit() {
    setFormError(null);

    startSubmit(async () => {
      try {
        const detail = await api.post<PartyOrderDetailDto>(
          partyOrderRoutes.payments(order.id),
          {
            paidOn,
            amount,
            mode,
            isAdvance,
            referenceNo,
            note,
            clientRequestId: requestId,
          },
        );

        toast.success(
          isAdvance
            ? t("payment.toastAdvance", {
                amount: formatINR(amount ?? 0),
                outstanding: formatINR(Math.max(0, detail.outstandingAmount)),
              })
            : detail.outstandingAmount === 0
              ? t("payment.toastSettles", {
                  amount: formatINR(amount ?? 0),
                  code: detail.code,
                })
              : t("payment.toastPartial", {
                  amount: formatINR(amount ?? 0),
                  outstanding: formatINR(Math.abs(detail.outstandingAmount)),
                }),
        );

        onRecorded(detail);
        onOpenChange(false);
      } catch (error) {
        handle(error);
      }
    });
  }

  const referenceLabel =
    mode === "UPI"
      ? t("payment.upiReference")
      : mode === "BANK_TRANSFER"
        ? t("payment.bankReference")
        : t("payment.reference");

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-140">
        <DialogTitle>{t("payment.title")}</DialogTitle>
        <DialogDescription>
          {order.outstandingAmount > 0
            ? t("payment.subtitle", {
                code: order.code,
                party: order.partyName,
                amount: formatINR(order.outstandingAmount),
              })
            : t("payment.subtitleSettled", {
                code: order.code,
                party: order.partyName,
              })}
        </DialogDescription>

        <div
          className="mt-4 space-y-4"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        >
          {formError && (
            <Alert variant="danger" icon={<AlertTriangle aria-hidden />}>
              {formError}
            </Alert>
          )}

          {/* Allowed, never blocked: an advance before the schedule is finished
              is normal, and a plain overpayment is offered the flag as the fix. */}
          {overpaying && (
            <Alert
              variant={isAdvance ? "info" : "warning"}
              icon={<AlertTriangle aria-hidden />}
            >
              {isAdvance
                ? t("payment.advanceExceeds", {
                    amount: formatINR(amount ?? 0),
                    outstanding: formatINR(order.outstandingAmount),
                    refund: formatINR(Math.abs(outstandingAfter)),
                  })
                : t("payment.overpayWarning", {
                    amount: formatINR(amount ?? 0),
                    outstanding: formatINR(order.outstandingAmount),
                    refund: formatINR(Math.abs(outstandingAfter)),
                  })}
            </Alert>
          )}

          <div className="flex flex-wrap items-start gap-4">
            <div>
              <Label htmlFor="payment-date">{t("payment.dateLabel")}</Label>
              <DateInput
                id="payment-date"
                value={paidOn}
                // Money cannot arrive tomorrow. The schema refuses it too.
                max={todayIST()}
                invalid={!!fieldErrors.paidOn}
                disabled={submitting}
                onValueChange={setPaidOn}
              />
              <p className="min-h-5 text-caption text-destructive">
                {fieldErrors.paidOn ?? ""}
              </p>
            </div>

            <div>
              <Label htmlFor="payment-amount" required>
                {t("payment.amountLabel")}
              </Label>
              <MoneyInput
                id="payment-amount"
                value={amount}
                invalid={!!fieldErrors.amount}
                disabled={submitting}
                onValueChange={(value) => {
                  setAmount(value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.amount;
                    return next;
                  });
                }}
              />
              <p className="min-h-5 text-caption text-destructive">
                {fieldErrors.amount ?? ""}
              </p>

              {order.outstandingAmount > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => setAmount(order.outstandingAmount)}
                >
                  {t("payment.payFull", {
                    amount: formatINR(order.outstandingAmount),
                  })}
                </Button>
              )}
            </div>
          </div>

          {/* A segmented control, not a select: three options is few enough
              that one tap beats a dropdown. §9.3 */}
          <div>
            <Label htmlFor="payment-mode" required>
              {t("payment.modeLabel")}
            </Label>
            <div
              id="payment-mode"
              role="group"
              aria-label={t("payment.modeLabel")}
              className="inline-flex h-10 items-center rounded-md border border-input p-0.5"
            >
              {PARTY_PAYMENT_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  disabled={submitting}
                  onClick={() => setMode(value)}
                  className={cn(
                    "h-full rounded-[5px] px-4 text-sm transition-colors duration-100",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    mode === value
                      ? "bg-[var(--badge-primary-bg)] font-medium text-[var(--badge-primary-fg)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`payment.modes.${value}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Cash has nothing to reference. A transfer without one cannot be
              reconciled later, which is why the schema requires it. §9.3 */}
          {mode !== "CASH" && (
            <div>
              <Label htmlFor="payment-reference" required>
                {referenceLabel}
              </Label>
              <Input
                id="payment-reference"
                value={referenceNo}
                placeholder={
                  mode === "UPI"
                    ? t("payment.upiPlaceholder")
                    : t("payment.bankPlaceholder")
                }
                invalid={!!fieldErrors.referenceNo}
                disabled={submitting}
                onChange={(event) => setReferenceNo(event.target.value)}
              />
              <p className="min-h-5 text-caption text-destructive">
                {fieldErrors.referenceNo ?? ""}
              </p>
            </div>
          )}

          <div>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={isAdvance}
                disabled={submitting}
                onCheckedChange={(checked) => setIsAdvance(checked === true)}
              />
              {t("payment.advanceLabel")}
              {isAdvance && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--badge-primary-bg)] px-2 py-0.5 text-caption text-[var(--badge-primary-fg)]">
                  <Banknote className="size-3" aria-hidden />
                  {t("payment.advanceBadge")}
                </span>
              )}
            </label>
            <p className="text-caption text-muted-foreground">
              {t("payment.advanceHelp")}
            </p>
          </div>

          <div>
            <Label htmlFor="payment-note">{t("payment.noteLabel")}</Label>
            <Input
              id="payment-note"
              value={note}
              placeholder={t("payment.notePlaceholder")}
              disabled={submitting}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        {/* The four lines the modal exists for. §9.3 */}
        <dl className="mt-4 space-y-1 rounded-md bg-muted px-4 py-3 text-sm">
          <Row label={t("payment.totalPayable")} value={order.totalAmount} />
          <Row label={t("payment.alreadyReceived")} value={order.paidAmount} />
          <Row
            label={t("payment.thisPayment")}
            value={amount}
            className="text-primary"
          />
          <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
            <dt className="font-semibold text-foreground">
              {t("payment.outstandingAfter")}
            </dt>
            <dd className="flex items-center gap-2">
              {outstandingAfter === 0 && amount !== null && (
                <CheckCircle2 className="size-4 text-success" aria-hidden />
              )}
              <Money
                value={outstandingAfter}
                emphasis
                zeroAs="value"
                variant={outstandingAfter < 0 ? "refund" : "default"}
                className="text-lg"
              />
            </dd>
          </div>
          {outstandingAfter === 0 && amount !== null && (
            <p className="text-right text-caption text-success">
              {t("payment.settles")}
            </p>
          )}
        </dl>

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
            disabled={amount === null || amount <= 0}
            loading={submitting}
            loadingText={t("payment.recording")}
          >
            {t("payment.record")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: number | null;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Money value={value} className={className} />
      </dd>
    </div>
  );
}
