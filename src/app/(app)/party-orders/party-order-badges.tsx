import { useTranslations } from "next-intl";
import { Ban, Calendar, Check, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";
import type { PartyOrderStatus } from "@/lib/db/entities/enums";
import type { PartyOrderListItemDto } from "@/lib/dto/party-order.dto";

/**
 * Delivery-status badges. Spec: design/MODULES/05-party-orders.md §3.3
 *
 * Deliberately NOT `"use client"`: the server detail page and the client table
 * render the same badge, and two implementations would drift the first time a
 * status was added. `useTranslations` works in both trees.
 *
 * **Precedence matters more than the vocabulary.** A cancelled booking is
 * cancelled whatever its days say; after that a SKIPPED day is the thing the
 * owner needs to see, because it is the reason the total is lower than the
 * schedule suggests. Only then does "completed" or "in progress" apply.
 */
export function PartyDeliveryBadge({
  status,
  skippedDays = 0,
  className,
}: {
  status: PartyOrderStatus;
  skippedDays?: number;
  className?: string;
}) {
  const t = useTranslations("partyOrders.delivery");

  if (status === "CANCELLED") {
    return (
      <Badge className={className} icon={<Ban aria-hidden />}>
        {t("cancelled")}
      </Badge>
    );
  }

  if (skippedDays > 0) {
    return (
      <Badge
        variant="warning"
        className={className}
        icon={<SkipForward aria-hidden />}
      >
        {t("skipped", { count: skippedDays })}
      </Badge>
    );
  }

  if (status === "COMPLETED") {
    return (
      <Badge variant="success" className={className} icon={<Check aria-hidden />}>
        {t("completed")}
      </Badge>
    );
  }

  return (
    <Badge
      variant="primary"
      className={className}
      icon={<Calendar aria-hidden />}
    >
      {status === "IN_PROGRESS" ? t("inProgress") : t("upcoming")}
    </Badge>
  );
}

/**
 * Payment first, delivery second, 4px apart — §3.3.
 *
 * The payment badge carries the FIGURE (`₹8,400 due`, `Refund ₹1,000`), because
 * a number lets the owner triage a list without opening anything. The
 * outstanding amount is signed, and `StatusBadge` takes its magnitude.
 */
export function PartyStatusBadges({
  order,
  className,
}: {
  order: Pick<
    PartyOrderListItemDto,
    "status" | "paymentStatus" | "outstandingAmount" | "progress"
  >;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <PaymentStatusBadge
        status={order.paymentStatus}
        amount={order.outstandingAmount}
      />
      <PartyDeliveryBadge
        status={order.status}
        skippedDays={order.progress.skippedDays}
      />
    </span>
  );
}

/**
 * The `3/5 days` fraction — the column unique to this module. §3.3
 *
 * A 4px track with the fraction beneath it: amber when a day was skipped,
 * because that is why the money does not match the schedule; grey at zero,
 * because an unstarted booking is not a failed one.
 */
export function PartyProgress({
  progress,
  cancelled = false,
}: {
  progress: PartyOrderListItemDto["progress"];
  cancelled?: boolean;
}) {
  const t = useTranslations("partyOrders");
  const { totalDays, deliveredDays, skippedDays, scheduledDays } = progress;
  const done = totalDays === 0 ? 0 : Math.round((deliveredDays / totalDays) * 100);

  return (
    <span
      className="block"
      title={t("progressTooltip", {
        delivered: deliveredDays,
        total: totalDays,
        skipped: skippedDays,
        scheduled: scheduledDays,
      })}
    >
      <span className="block h-1 w-12 overflow-hidden rounded-full bg-border">
        <span
          className={cn(
            "block h-full rounded-full",
            cancelled || done === 0
              ? "bg-muted-foreground/30"
              : skippedDays > 0
                ? "bg-warning"
                : "bg-success",
          )}
          style={{ width: `${cancelled ? 100 : done}%` }}
        />
      </span>
      <span className="mt-1 block font-mono text-caption tabular-nums text-muted-foreground">
        {deliveredDays}/{totalDays}
      </span>
    </span>
  );
}
