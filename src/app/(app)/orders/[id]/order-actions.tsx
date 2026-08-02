"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/common/money";
import { MoneyInput } from "@/components/form/money-input";
import { QuantityInput } from "@/components/form/quantity-input";
import { DateInput } from "@/components/form/date-input";
import { useFormErrors } from "@/components/form/use-form-errors";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type {
  DeliveryOrderDetailDto,
  OrderLineDto,
} from "@/lib/dto/delivery-order.dto";

export function OrderActions({ order }: { order: DeliveryOrderDetailDto }) {
  const t = useTranslations("orders.actions");
  const [returnOpen, setReturnOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {order.canRecordReturn && (
          <Button variant="outline" onClick={() => setReturnOpen(true)}>
            {t("recordReturn")}
          </Button>
        )}
        {order.canRecordPayment && (
          <Button onClick={() => setPaymentOpen(true)}>{t("recordPayment")}</Button>
        )}
      </div>

      {returnOpen && (
        <ReturnDialog order={order} onClose={() => setReturnOpen(false)} />
      )}
      {paymentOpen && (
        <PaymentDialog order={order} onClose={() => setPaymentOpen(false)} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Record return
   ═══════════════════════════════════════════════════════════════════════ */

interface ReturnRow {
  emptyQty: number | null;
  filledQty: number | null;
  lostQty: number | null;
}

function ReturnDialog({
  order,
  onClose,
}: {
  order: DeliveryOrderDetailDto;
  onClose: () => void;
}) {
  const t = useTranslations("orders.returnModal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { formError, handle, clear } = useFormErrors();
  const [isPending, startTransition] = useTransition();
  const [returnDate, setReturnDate] = useState(todayIST());

  const openLines = order.lines.filter((l) => l.canReturn && l.pendingQty > 0);
  const [rows, setRows] = useState<Record<string, ReturnRow>>(() =>
    Object.fromEntries(
      openLines.map((l) => [l.id, { emptyQty: null, filledQty: null, lostQty: null }]),
    ),
  );

  function set(lineId: string, patch: Partial<ReturnRow>) {
    setRows((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  }

  const totalOf = (r: ReturnRow) =>
    (r.emptyQty ?? 0) + (r.filledQty ?? 0) + (r.lostQty ?? 0);

  /**
   * What this return will do to the bill, BEFORE it is submitted.
   *
   * Filled jars coming back are unsold stock, so they come off the invoice
   * (decision D5). Showing the new total live is what stops a correct drop
   * reading as a mistake once the modal closes.
   */
  const filledCredit = openLines.reduce((sum, line) => {
    const filled = rows[line.id]?.filledQty ?? 0;
    return sum + filled * line.unitPrice;
  }, 0);
  const totalAfter = order.totalAmount - filledCredit;

  const anything = openLines.some((l) => totalOf(rows[l.id] ?? {} as ReturnRow) > 0);
  const overReturn = openLines.find(
    (l) => totalOf(rows[l.id] ?? ({} as ReturnRow)) > l.pendingQty,
  );

  function submit() {
    clear();
    startTransition(async () => {
      try {
        await api.post(`/api/orders/${order.id}/returns`, {
          returnDate,
          lines: openLines
            .filter((l) => totalOf(rows[l.id]) > 0)
            .map((l) => ({
              orderItemId: l.id,
              emptyQty: rows[l.id].emptyQty ?? 0,
              filledQty: rows[l.id].filledQty ?? 0,
              lostQty: rows[l.id].lostQty ?? 0,
            })),
          allocations: [],
          note: null,
        });
        toast.success(t("success"));
        onClose();
        router.refresh();
      } catch (error) {
        handle(error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>
          {t("subtitle", { code: order.code, staff: order.staffName })}
        </DialogDescription>

        {formError && (
          <Alert variant="danger" className="mt-4">
            {formError}
          </Alert>
        )}

        <div className="mt-4">
          <Label htmlFor="returnDate">{t("dateLabel")}</Label>
          <DateInput id="returnDate" value={returnDate} onValueChange={setReturnDate} />
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-muted">
                <Th>{t("cols.product")}</Th>
                <Th align="right">{t("cols.out")}</Th>
                <Th align="right">{t("cols.empty")}</Th>
                <Th align="right">{t("cols.filled")}</Th>
                <Th align="right">{t("cols.lost")}</Th>
                <Th align="right">{t("cols.stillOut")}</Th>
              </tr>
            </thead>
            <tbody>
              {openLines.map((line) => {
                const row = rows[line.id];
                const entered = totalOf(row);
                const remaining = line.pendingQty - entered;
                return (
                  <tr key={line.id} className="border-b border-border last:border-b-0">
                    <Td>{line.productTitle}</Td>
                    <Td align="right">{line.pendingQty}</Td>
                    <Td align="right">
                      <QuantityInput
                        value={row.emptyQty}
                        onValueChange={(v) => set(line.id, { emptyQty: v })}
                        min={0}
                        className="ml-auto w-24"
                      />
                    </Td>
                    <Td align="right">
                      <QuantityInput
                        value={row.filledQty}
                        onValueChange={(v) => set(line.id, { filledQty: v })}
                        min={0}
                        className="ml-auto w-24"
                      />
                    </Td>
                    <Td align="right">
                      <QuantityInput
                        value={row.lostQty}
                        onValueChange={(v) => set(line.id, { lostQty: v })}
                        min={0}
                        className="ml-auto w-24"
                      />
                    </Td>
                    {/* Computed, never typed — the invariant the CHECK enforces. */}
                    <Td align="right">
                      <span
                        className={
                          remaining < 0
                            ? "font-mono font-semibold text-destructive"
                            : "font-mono text-muted-foreground"
                        }
                      >
                        {remaining}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {overReturn && (
          <Alert variant="danger" className="mt-3">
            {t("overReturn", {
              product: overReturn.productTitle,
              remaining: overReturn.pendingQty,
            })}
          </Alert>
        )}

        {filledCredit > 0 && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-[var(--badge-warning-bg)] p-3 text-sm text-[var(--badge-warning-fg)]">
            {t("creditNotice", {
              credit: formatINR(filledCredit),
              from: formatINR(order.totalAmount),
              to: formatINR(totalAfter),
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!anything || !!overReturn}
            loading={isPending}
            loadingText={t("submitting")}
          >
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Record payment
   ═══════════════════════════════════════════════════════════════════════ */

function PaymentDialog({
  order,
  onClose,
}: {
  order: DeliveryOrderDetailDto;
  onClose: () => void;
}) {
  const t = useTranslations("orders.paymentModal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { formError, handle, clear } = useFormErrors();
  const [isPending, startTransition] = useTransition();

  const [paidOn, setPaidOn] = useState(todayIST());
  const [amount, setAmount] = useState<number | null>(order.dueAmount || null);

  const balanceAfter = order.dueAmount - (amount ?? 0);

  function submit() {
    clear();
    startTransition(async () => {
      try {
        await api.post(`/api/orders/${order.id}/payments`, {
          direction: "IN",
          paidOn,
          amount,
          mode: "CASH",
          coins: [],
          referenceNo: null,
          note: null,
        });
        toast.success(t("success", { amount: formatINR(amount ?? 0) }));
        onClose();
        router.refresh();
      } catch (error) {
        handle(error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>
          {t("subtitle", {
            code: order.code,
            staff: order.staffName,
            amount: formatINR(order.dueAmount),
          })}
        </DialogDescription>

        {formError && (
          <Alert variant="danger" className="mt-4">
            {formError}
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <Label htmlFor="paidOn">{t("dateLabel")}</Label>
            <DateInput id="paidOn" value={paidOn} onValueChange={setPaidOn} />
          </div>
          <div>
            <Label htmlFor="amount" required>
              {t("amountLabel")}
            </Label>
            <MoneyInput id="amount" value={amount} onValueChange={setAmount} />
          </div>
        </div>

        <dl className="mt-4 space-y-1 rounded-lg bg-muted p-3 text-sm">
          <Row label={t("orderTotal")} value={order.totalAmount} />
          <Row label={t("alreadyCollected")} value={order.paidTotalAmount} />
          <Row label={t("thisPayment")} value={amount ?? 0} />
          <div className="flex justify-between border-t border-border pt-1 font-medium">
            <dt>{t("balanceAfter")}</dt>
            <dd>
              <Money value={balanceAfter} emphasis variant={balanceAfter < 0 ? "refund" : undefined} />
            </dd>
          </div>
        </dl>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!amount || amount <= 0}
            loading={isPending}
            loadingText={t("submitting")}
          >
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd>
        <Money value={value} />
      </dd>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`border-b border-border px-3 py-2 text-caption font-semibold uppercase tracking-wide text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}
