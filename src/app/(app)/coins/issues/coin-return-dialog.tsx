"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, PackageCheck, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { DateInput, FormField, QuantityInput } from "@/components/form";
import { Money, Quantity } from "@/components/common/money";
import { api, ApiError } from "@/lib/api/client";
import { todayIST } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CoinIssueListItemDto } from "@/lib/dto/coin-issue.dto";
import { ColourDot } from "../types/coin-figures";

/**
 * Record coin return. Spec: design MODULES/04-coins §9
 *
 * Four numbers per line, side by side — issued, already returned, returning
 * now, remaining — because that is the arithmetic the owner is doing in his
 * head at the counter, and showing three of them is worse than showing none.
 *
 * The one thing this modal must do that a plain form would not: say, BEFORE
 * saving, whether the return turns the creditor into the debtor. A staff member
 * who paid up front and hands back unsold coins is owed money, and discovering
 * that after the fact is how it gets forgotten. §9.4
 *
 * Every figure below is a PREVIEW computed for display. The server recomputes
 * all of it from the stored `value_credited` on each event, so a rounding
 * difference of a few paise is expected and is exactly what §8.2 describes.
 */
export function CoinReturnDialog({
  issue,
  open,
  onOpenChange,
}: {
  issue: CoinIssueListItemDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("coins.issues.returnModal");
  const tRoot = useTranslations();
  const router = useRouter();

  const [returnDate, setReturnDate] = useState(todayIST());
  const [quantities, setQuantities] = useState<Record<string, number | null>>({});
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  /** Only lines with coins still out can be returned against. §9.5 */
  const lines = useMemo(
    () => issue.lines.filter((line) => line.coinsOutstanding > 0),
    [issue.lines],
  );

  const entered = lines.map((line) => {
    const coins = quantities[line.id] ?? 0;
    return {
      line,
      coins,
      remaining: line.coinsOutstanding - coins,
      // Rounded per line, exactly as the server rounds `value_credited`.
      value: Math.round(coins * line.perCoinPrice * 100) / 100,
      overReturn: coins > line.coinsOutstanding,
    };
  });

  const returningCoins = entered.reduce((total, row) => total + row.coins, 0);
  // A display total over already-rounded line values — the same shape the
  // trigger sums server-side. Nothing here is persisted.
  const returningValue =
    Math.round(entered.reduce((total, row) => total + row.value, 0) * 100) / 100;

  const newNetPayable = Math.round((issue.netPayable - returningValue) * 100) / 100;
  const newPending =
    Math.round((issue.outstandingAmount - returningValue) * 100) / 100;

  const anyOverReturn = entered.some((row) => row.overReturn);
  const nothingEntered = returningCoins === 0;
  const flipsToRefund = newPending < 0;

  function fillEverything() {
    const next: Record<string, number | null> = {};
    for (const line of lines) next[line.id] = line.coinsOutstanding;
    setQuantities(next);
  }

  function submit() {
    setFormError(null);

    if (nothingEntered) {
      setFormError(tRoot("coins.issues.errors.returnAllZero"));
      return;
    }

    startSubmit(async () => {
      try {
        await api.post(`/api/coin-issues/${issue.id}/returns`, {
          returnDate,
          lines: entered
            .filter((row) => row.coins > 0)
            .map((row) => ({
              coinIssueItemId: row.line.id,
              coins: row.coins,
            })),
          note: note.trim() || null,
        });

        toast.success(
          newPending < 0
            ? t("successRefund", {
                coins: formatQuantity(returningCoins),
                staff: issue.staffName,
                amount: formatINR(Math.abs(newPending)),
              })
            : t("success", {
                coins: formatQuantity(returningCoins),
                amount: formatINR(Math.max(newPending, 0)),
                staff: issue.staffName,
              }),
        );

        onOpenChange(false);
        setQuantities({});
        setNote("");
        // Refresh in place — the owner stays where he was and the figures
        // update under him. Design §8.6
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-180">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("subtitle", {
              code: issue.code,
              staff: issue.staffName,
              date: issue.issueDate,
            })}
          </DialogDescription>
        </DialogHeader>

        {lines.length === 0 ? (
          /* Nothing left to hand back. A table of zeroes would invite the
             owner to try anyway. §9.5 */
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <PackageCheck className="size-10 text-success" aria-hidden />
            <h3 className="text-h4 font-semibold">{t("empty.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("empty.body", {
                coins: formatQuantity(issue.totalCoinsIssued),
                code: issue.code,
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <FormField label={t("returnDate")} required>
              {({ id }) => (
                <DateInput
                  id={id}
                  value={returnDate}
                  onValueChange={setReturnDate}
                  min={issue.issueDate}
                  max={todayIST()}
                />
              )}
            </FormField>

            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-caption uppercase tracking-[0.04em] text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold">
                      {t("columns.coinType")}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {t("columns.issued")}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {t("columns.alreadyReturned")}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {t("columns.returningNow")}
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      {t("columns.remaining")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entered.map((row) => (
                    <tr
                      key={row.line.id}
                      className={cn(
                        "border-b border-border last:border-b-0",
                        row.overReturn && "border-l-2 border-l-destructive",
                      )}
                    >
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <ColourDot colour={row.line.colourHex} />
                          <span className="font-medium">
                            {row.line.coinTypeName}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Quantity value={row.line.coinsIssued} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Quantity value={row.line.coinsReturned} zeroAs="dash" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-end gap-0.5">
                          <QuantityInput
                            value={quantities[row.line.id] ?? null}
                            onValueChange={(value) =>
                              setQuantities((prev) => ({
                                ...prev,
                                [row.line.id]: value,
                              }))
                            }
                            min={0}
                            invalid={row.overReturn}
                            className="w-28"
                          />
                          {row.coins > 0 && (
                            <span className="font-mono text-caption text-success">
                              = {formatINR(row.value)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Quantity
                          value={row.remaining}
                          emphasis
                          zeroAs="value"
                          className={cn(
                            row.remaining === 0 && "text-success",
                            row.overReturn && "text-destructive",
                          )}
                        />
                        {row.overReturn && (
                          <p className="mt-0.5 flex items-center justify-end gap-1 text-caption text-destructive">
                            <AlertCircle className="size-3.5" aria-hidden />
                            {t("overReturn", {
                              remaining: formatQuantity(
                                row.line.coinsOutstanding,
                              ),
                              name: row.line.coinTypeName,
                            })}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={fillEverything}>
                {t("returnEverything")}
              </Button>
            </div>

            <FormField label={t("note")}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("notePlaceholder")}
                />
              )}
            </FormField>

            {/* The live settlement panel. `New pending` is the number the whole
                modal exists to show, so it is the largest thing in it. §9.3 */}
            <dl className="space-y-1 rounded-md bg-muted p-4 text-sm">
              <Row
                label={t("panel.returning", {
                  coins: formatQuantity(returningCoins),
                })}
                value={<Money value={returningValue} />}
              />
              <Row
                label={t("panel.netPayable")}
                value={
                  <span className="flex items-center gap-2">
                    <Money
                      value={issue.netPayable}
                      className="text-muted-foreground line-through"
                    />
                    <span aria-hidden>→</span>
                    <Money value={newNetPayable} />
                  </span>
                }
              />
              <Row
                label={t("panel.collected")}
                value={<Money value={issue.paidAmount} />}
              />
              <Row
                label={t("panel.newPending")}
                value={
                  <Money
                    value={newPending}
                    emphasis
                    // BLUE, not red. Money pointing the other way is not a loss.
                    variant={newPending < 0 ? "refund" : "default"}
                    className="text-base"
                  />
                }
              />
            </dl>

            {flipsToRefund && (
              <div className="flex gap-2 rounded-md border border-primary bg-(--badge-primary-bg) p-3 text-caption text-(--badge-primary-fg)">
                <RotateCcw className="size-4 shrink-0" aria-hidden />
                <p>
                  {t("refundFlip", {
                    staff: issue.staffName,
                    amount: formatINR(Math.abs(newPending)),
                  })}
                </p>
              </div>
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
          {lines.length > 0 && (
            <Button
              onClick={submit}
              loading={submitting}
              loadingText={t("submitting")}
              // The ONE place a disabled primary is correct: the database will
              // refuse an over-return anyway, so letting it through would waste
              // the entry. Design §9.5
              disabled={anyOverReturn}
              title={anyOverReturn ? t("fixQuantity") : undefined}
            >
              {t("submit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
