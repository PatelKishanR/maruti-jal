import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatQuantity } from "@/lib/money";
import type { DeliveryOrderDto } from "@/lib/dto/delivery-order.dto";

/**
 * Payment and return status, side by side.
 *
 * They are INDEPENDENT: an order can be fully Paid and still have 12 jars out,
 * or every jar back and nothing collected. One combined badge would have to
 * pick a winner and would hide the other. DESIGN-STANDARDS §7.3
 *
 * Both carry NUMBERS where a number exists — `₹450 due`, `8 jars out` — so the
 * owner can triage a whole list without opening a single row. §7.2
 *
 * No `"use client"`: the server detail page and the client table share it.
 */
export function OrderStatusBadges({
  order,
  className,
}: {
  order: DeliveryOrderDto;
  className?: string;
}) {
  const t = useTranslations("orders.badges");

  if (order.status === "CANCELLED") {
    return <Badge variant="default">{t("cancelled")}</Badge>;
  }

  return (
    <span className={className ? `flex gap-1 ${className}` : "flex gap-1"}>
      <PaymentBadge order={order} />
      <ReturnBadge order={order} />
    </span>
  );
}

function PaymentBadge({ order }: { order: DeliveryOrderDto }) {
  const t = useTranslations("orders.badges");

  switch (order.paymentStatus) {
    case "PAID":
      return <Badge variant="success">{t("paid")}</Badge>;
    case "PARTIAL":
      // The figure, not the word: "₹450 due" is actionable, "Partial" is not.
      return <Badge variant="warning">{t("due", { amount: formatINR(order.dueAmount) })}</Badge>;
    case "OVERPAID":
      return (
        <Badge variant="warning">
          {t("overpaid", { amount: formatINR(order.overpaidAmount) })}
        </Badge>
      );
    case "REFUND_DUE":
      // Primary, not Danger. Money owed back is a direction, not a loss. §13
      return (
        <Badge variant="primary">
          {t("refundDue", { amount: formatINR(Math.abs(order.outstandingAmount)) })}
        </Badge>
      );
    default:
      return <Badge variant="danger">{t("unpaid")}</Badge>;
  }
}

function ReturnBadge({ order }: { order: DeliveryOrderDto }) {
  const t = useTranslations("orders.badges");

  switch (order.returnStatus) {
    case "NOT_APPLICABLE":
      // Every line was a sealed bottle — there is nothing to come back, which
      // is different from "nothing has come back yet".
      return null;
    case "COMPLETE":
      return <Badge variant="success">{t("settled")}</Badge>;
    case "PARTIAL":
      return (
        <Badge variant="warning">
          {t("jarsOut", { count: formatQuantity(order.qtyPending) })}
        </Badge>
      );
    default:
      return (
        <Badge variant="danger">
          {t("jarsOut", { count: formatQuantity(order.qtyPending) })}
        </Badge>
      );
  }
}
