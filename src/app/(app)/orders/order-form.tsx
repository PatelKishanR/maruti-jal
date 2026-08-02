"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form/form-field";
import { FormActions } from "@/components/form/form-actions";
import { MoneyInput } from "@/components/form/money-input";
import { QuantityInput } from "@/components/form/quantity-input";
import { DateInput } from "@/components/form/date-input";
import { EntityCombobox, type ComboboxOption } from "@/components/form/entity-combobox";
import { useFormErrors } from "@/components/form/use-form-errors";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DeliveryOrderDetailDto } from "@/lib/dto/delivery-order.dto";
import {
  blankLine,
  previewLineTotal,
  previewSubtotal,
  priceDelta,
  type OrderFormLine,
  type OrderFormValues,
} from "./order-form-model";

export function OrderForm({
  mode,
  initial,
  orderId,
}: {
  mode: "create" | "edit";
  initial: OrderFormValues;
  orderId?: string;
}) {
  const t = useTranslations("orders.form");
  const router = useRouter();
  const { fieldErrors, formError, handle, clear } = useFormErrors();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const lastQtyRef = useRef<HTMLInputElement>(null);

  function patch(next: Partial<OrderFormValues>) {
    setValues((v) => ({ ...v, ...next }));
    setDirty(true);
  }

  function patchLine(index: number, next: Partial<OrderFormLine>) {
    setValues((v) => ({
      ...v,
      lines: v.lines.map((l, i) => (i === index ? { ...l, ...next } : l)),
    }));
    setDirty(true);
  }

  function addLine() {
    setValues((v) => ({ ...v, lines: [...v.lines, blankLine()] }));
    setDirty(true);
  }

  function removeLine(index: number) {
    setValues((v) => ({ ...v, lines: v.lines.filter((_, i) => i !== index) }));
    setDirty(true);
  }

  const subtotal = previewSubtotal(values.lines);
  const total = Math.round((subtotal - (values.discountAmount ?? 0)) * 100) / 100;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    clear();

    const payload = {
      staffId: values.staffId,
      orderDate: values.orderDate,
      discountAmount: values.discountAmount ?? 0,
      notes: values.notes.trim() || null,
      items: values.lines
        .filter((l) => l.productId && l.quantity)
        .map((l) => ({
          ...(l.id ? { id: l.id } : {}),
          productId: l.productId,
          quantity: l.quantity,
          // null = charge the catalogue price. Sending the base price back
          // would mark every line as a deliberate override.
          unitPrice: l.unitPrice,
          priceOverrideNote: null,
        })),
      payment: null,
      clientRequestId: null,
    };

    startTransition(async () => {
      try {
        const saved =
          mode === "create"
            ? await api.post<DeliveryOrderDetailDto>("/api/orders", payload)
            : await api.patch<DeliveryOrderDetailDto>(`/api/orders/${orderId}`, payload);

        toast.success(t(mode === "create" ? "createdToast" : "updatedToast", {
          code: saved.code,
        }));
        // Land on the record, never leave the user on a form wondering.
        router.push(`/orders/${saved.id}`);
        router.refresh();
      } catch (error) {
        handle(error);
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card className="mb-6">
        {formError && (
          <Alert variant="danger" icon={<AlertCircle aria-hidden />} className="mb-4">
            {formError}
          </Alert>
        )}

        <div className="flex flex-wrap gap-4">
          <FormField
            label={t("staffLabel")}
            required
            error={fieldErrors.staffId}
            className="min-w-72 flex-1"
          >
            {({ id, invalid }) => (
              <EntityCombobox
                id={id}
                value={values.staffId || null}
                invalid={invalid}
                endpoint="/api/staff/options"
                placeholder={t("staffPlaceholder")}
                searchPlaceholder={t("staffSearch")}
                emptyMessage={t("staffEmpty")}
                onValueChange={(sid, option) =>
                  patch({ staffId: sid ?? "", staffLabel: option?.label ?? "" })
                }
              />
            )}
          </FormField>

          <FormField label={t("dateLabel")} required error={fieldErrors.orderDate}>
            {({ id, invalid }) => (
              <DateInput
                id={id}
                value={values.orderDate}
                invalid={invalid}
                onValueChange={(d) => patch({ orderDate: d })}
              />
            )}
          </FormField>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-h4 font-semibold text-foreground">{t("itemsHeading")}</h2>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <Th>{t("cols.product")}</Th>
                <Th align="right">{t("cols.qty")}</Th>
                <Th align="right">{t("cols.base")}</Th>
                <Th align="right">{t("cols.charged")}</Th>
                <Th align="right">{t("cols.total")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {values.lines.map((line, index) => {
                const delta = priceDelta(line);
                return (
                  <tr
                    key={line.id ?? index}
                    className={cn(
                      "align-top",
                      // A bargained rate gets an amber edge — the owner needs
                      // to see which lines went out below list at a glance.
                      delta !== 0 && "border-l-2 border-l-warning",
                    )}
                  >
                    <Td className="min-w-56">
                      <EntityCombobox
                        value={line.productId || null}
                        endpoint="/api/products/options"
                        placeholder={t("productPlaceholder")}
                        searchPlaceholder={t("productSearch")}
                        emptyMessage={t("productEmpty")}
                        onValueChange={(pid, option) =>
                          patchLine(index, {
                            productId: pid ?? "",
                            productTitle: option?.label ?? "",
                            basePrice: parseHintPrice(option),
                          })
                        }
                      />
                      {delta !== 0 && (
                        <Badge variant="warning" className="mt-1">
                          {t(delta < 0 ? "bargainedDown" : "bargainedUp", {
                            amount: formatINR(Math.abs(delta)),
                          })}
                        </Badge>
                      )}
                    </Td>
                    <Td align="right">
                      <QuantityInput
                        ref={index === values.lines.length - 1 ? lastQtyRef : undefined}
                        value={line.quantity}
                        min={1}
                        onValueChange={(q) => patchLine(index, { quantity: q })}
                        className="ml-auto"
                      />
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-muted-foreground">
                        {line.productId ? formatINR(line.basePrice) : "—"}
                      </span>
                    </Td>
                    <Td align="right">
                      <MoneyInput
                        value={line.unitPrice ?? (line.productId ? line.basePrice : null)}
                        onValueChange={(p) =>
                          // Back at the catalogue price is not an override.
                          patchLine(index, { unitPrice: p === line.basePrice ? null : p })
                        }
                        className="ml-auto w-32"
                      />
                    </Td>
                    <Td align="right">
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatINR(previewLineTotal(line))}
                      </span>
                    </Td>
                    <Td align="right">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        // Never removable down to zero — an order with no lines
                        // cannot be saved, so the control would only mislead.
                        disabled={values.lines.length === 1}
                        aria-label={t("removeLine")}
                        className="flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addLine}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="size-4" aria-hidden />
          {t("addLine")}
        </button>

        <div className="mt-6 flex flex-col items-end gap-2">
          <SummaryRow label={t("subtotal")} value={subtotal} />
          <div className="flex w-full max-w-xs items-center justify-between gap-3">
            <Label htmlFor="discount" className="mb-0 text-muted-foreground">
              {t("discount")}
            </Label>
            <MoneyInput
              id="discount"
              value={values.discountAmount}
              onValueChange={(d) => patch({ discountAmount: d })}
              className="w-36"
            />
          </div>
          <div className="flex w-full max-w-xs items-baseline justify-between border-t border-border pt-2">
            <span className="font-medium text-foreground">{t("total")}</span>
            <span className="font-mono text-h4 font-semibold tabular-nums text-foreground">
              {formatINR(total)}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <FormField label={t("notesLabel")} error={fieldErrors.notes}>
          {({ id }) => (
            <Textarea
              id={id}
              value={values.notes}
              placeholder={t("notesPlaceholder")}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          )}
        </FormField>

        <FormActions
          onCancel={() => router.back()}
          submitLabel={t(mode === "create" ? "submitCreate" : "submitEdit")}
          submitting={isPending}
          dirty={dirty}
          // Pressing the primary is how the owner discovers what is missing.
          alwaysEnabled={mode === "create"}
        />
      </Card>
    </form>
  );
}

/** `20L · ₹35.00` → 35. The picker's hint carries the catalogue price. */
function parseHintPrice(option: ComboboxOption | null): number {
  if (!option?.hint) return 0;
  const match = option.hint.match(/₹\s*([\d,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex w-full max-w-xs items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-muted-foreground">
        {formatINR(value)}
      </span>
    </div>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={cn(
        "border-b border-border pb-2 text-caption font-semibold uppercase tracking-wide text-muted-foreground",
        align === "right" ? "pr-2 text-right" : "pr-2 text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <td className={cn("py-2 pr-2", align === "right" && "text-right", className)}>
      {children}
    </td>
  );
}
