"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Banknote, CheckCircle2, RotateCcw } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { DateInput, FormField, MoneyInput } from "@/components/form";
import { Money } from "@/components/common/money";
import { StatusBadge } from "@/components/common/status-badge";
import { api, ApiError } from "@/lib/api/client";
import { todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PaymentDirection } from "@/lib/db/entities/enums";
import type { CoinIssueListItemDto } from "@/lib/dto/coin-issue.dto";
import {
  COIN_PAYMENT_MODES,
  type CoinPaymentMode,
} from "@/lib/validation/coin-issue";

/**
 * Record coin payment / refund. Spec: design MODULES/04-coins §10
 *
 * ONE modal, and the DIRECTION IS FIXED by how it was opened — never a toggle
 * inside the form. Mixing an inbound instalment up with an outbound refund is
 * the single most costly mistake available on this screen, so switching
 * direction means closing this and choosing the other action. That friction is
 * deliberate. §10.1, §10.6
 *
 * The always-present direction strip is the second half of that control: the
 * owner reads "Money going OUT to Suresh Chauhan" before he reads the amount.
 */
export function CoinPaymentDialog({
  issue,
  direction,
  open,
  onOpenChange,
}: {
  issue: CoinIssueListItemDto;
  /** `IN` = instalment, `OUT` = refund. Set by the caller, never by the form. */
  direction: PaymentDirection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("coins.issues.paymentModal");
  const tRoot = useTranslations();
  const router = useRouter();

  const outbound = direction === "OUT";
  /** What the modal opens pre-filled with, and the ceiling on a refund. */
  const suggested = outbound ? issue.refundAmount : issue.dueAmount;

  const [amount, setAmount] = useState<number | null>(suggested || null);
  const [mode, setMode] = useState<CoinPaymentMode>("CASH");
  const [paidOn, setPaidOn] = useState(todayIST());
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  /**
   * One id per form OPEN, so a retry after a timeout carries the same value and
   * the unique index rejects the duplicate rather than the staff member being
   * charged twice. See .claude/DATA-MODEL.md §10.11
   */
  const [clientRequestId] = useState(() => crypto.randomUUID());

  const applied = amount ?? 0;
  const newPending =
    Math.round(
      (issue.outstandingAmount + (outbound ? applied : -applied)) * 100,
    ) / 100;

  const overpaying = !outbound && applied > issue.dueAmount && issue.dueAmount >= 0;
  const overRefunding = outbound && applied > issue.refundAmount;

  function submit() {
    setFormError(null);

    if (!applied) {
      setFormError(tRoot("coins.issues.errors.amountPositive"));
      return;
    }

    startSubmit(async () => {
      try {
        await api.post(`/api/coin-issues/${issue.id}/payments`, {
          direction,
          amount: applied,
          mode,
          paidOn,
          referenceNo: referenceNo.trim() || null,
          note: note.trim() || null,
          clientRequestId,
        });

        toast.success(
          t(outbound ? "successRefund" : "success", {
            amount: formatINR(applied),
            code: issue.code,
          }),
        );

        onOpenChange(false);
        router.refresh();
      } catch (error) {
        setFormError(
          error instanceof ApiError
            ? (tRoot.has(error.messageKey)
                ? tRoot(error.messageKey)
                : error.messageKey)
            : tRoot("common.somethingWentWrong"),
        );
      }
    });
  }

  const nothingOutstanding = issue.outstandingAmount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-140">
        <DialogHeader>
          <DialogTitle>{t(outbound ? "titleRefund" : "title")}</DialogTitle>
          <DialogDescription>
            {t(outbound ? "subtitleRefund" : "subtitle", {
              code: issue.code,
              staff: issue.staffName,
              amount: formatINR(suggested),
            })}
          </DialogDescription>
        </DialogHeader>

        {nothingOutstanding ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <CheckCircle2 className="size-10 text-success" aria-hidden />
            <h3 className="text-h4 font-semibold">{t("empty.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("empty.body", { code: issue.code })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Always present, never a toggle. §10.3 */}
            <p
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                outbound
                  ? "bg-(--badge-primary-bg) text-(--badge-primary-fg)"
                  : "bg-(--badge-success-bg) text-(--badge-success-fg)",
              )}
            >
              {outbound ? (
                <RotateCcw className="size-4" aria-hidden />
              ) : (
                <Banknote className="size-4" aria-hidden />
              )}
              {t(outbound ? "directionOut" : "directionIn", {
                staff: issue.staffName,
              })}
            </p>

            <div className="flex flex-wrap gap-4">
              <FormField
                label={t("amount")}
                required
                hint={t(outbound ? "amountHelperRefund" : "amountHelper", {
                  amount: formatINR(suggested),
                })}
                error={
                  overRefunding
                    ? t("errors.refundExceeds", {
                        amount: formatINR(issue.refundAmount),
                      })
                    : null
                }
              >
                {({ id, invalid }) => (
                  <MoneyInput
                    id={id}
                    value={amount}
                    onValueChange={setAmount}
                    invalid={invalid}
                  />
                )}
              </FormField>

              <FormField label={t("mode")} required>
                {({ id }) => (
                  <Select
                    value={mode}
                    onValueChange={(value) => setMode(value as CoinPaymentMode)}
                  >
                    <SelectTrigger id={id} className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COIN_PAYMENT_MODES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {tRoot(`coins.issues.modes.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>

            <div className="flex flex-wrap gap-4">
              <FormField label={t("date")} required>
                {({ id }) => (
                  <DateInput
                    id={id}
                    value={paidOn}
                    onValueChange={setPaidOn}
                    max={todayIST()}
                  />
                )}
              </FormField>

              <FormField label={t("reference")} className="min-w-60 flex-1">
                {({ id }) => (
                  <Input
                    id={id}
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder={t("referencePlaceholder")}
                  />
                )}
              </FormField>
            </div>

            <FormField label={t("note")}>
              {({ id }) => (
                <Input
                  id={id}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("notePlaceholder")}
                />
              )}
            </FormField>

            {/* The result line: old pending, an arrow, the new one, and the
                badge the row will carry after saving. §10.3 */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                {t("resultLabel")}
                <Money
                  value={issue.outstandingAmount}
                  className="text-muted-foreground line-through"
                />
                <span aria-hidden>→</span>
                <Money
                  value={newPending}
                  emphasis
                  variant={newPending < 0 ? "refund" : "default"}
                />
              </span>
              <StatusBadge
                status={
                  newPending === 0
                    ? "settled"
                    : newPending < 0
                      ? "refundDue"
                      : "partiallyPaid"
                }
                amount={newPending}
              />
            </div>

            {/* Overpaying is ALLOWED — it simply creates a refund due, which is
                a truthful state. The banner says so; the button stays live. */}
            {overpaying && (
              <Alert variant="warning">
                <AlertDescription>
                  {t("overpayWarning", {
                    paid: formatINR(applied),
                    due: formatINR(issue.dueAmount),
                    extra: formatINR(applied - issue.dueAmount),
                    staff: issue.staffName,
                  })}
                </AlertDescription>
              </Alert>
            )}

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tRoot("common.cancel")}
          </Button>
          {!nothingOutstanding && (
            <Button
              onClick={submit}
              loading={submitting}
              loadingText={t("submitting")}
              disabled={overRefunding}
            >
              {t(outbound ? "submitRefund" : "submit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
