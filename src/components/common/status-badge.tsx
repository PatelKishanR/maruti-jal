import { useTranslations } from "next-intl";
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  CircleDashed,
  FileEdit,
  Package,
  PackageCheck,
  PackageX,
  RotateCcw,
  SkipForward,
  type LucideIcon,
} from "lucide-react";
import type { PaymentStatus, ReturnStatus } from "@/lib/db/entities/enums";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatINR, formatQuantity } from "@/lib/money";

/**
 * Status badges. Spec: .claude/design/DESIGN-STANDARDS.md §7, §7.2 verbatim.
 *
 * ONE component, ONE meaning map, used identically in all nine modules. If a
 * module needs a status that isn't here, it goes into §7.2 first — otherwise
 * amber means "partial" on one screen and "attention" on another, and the
 * owner's ability to scan a list at arm's length is gone.
 *
 * **Badges show numbers where a number exists.** `₹450 due` beats `Partial` and
 * `8 jars out` beats `Partial`, because a number lets the owner triage the list
 * without opening anything. Bare-word badges are reserved for terminal states
 * where no number is left to show.
 *
 * Colour is never the only signal: every badge carries text (or, for the
 * not-applicable dash, a screen-reader label).
 */

/**
 * The canonical status vocabulary — §7.2, in order.
 *
 * These are UI meanings, not database values, which is why they are their own
 * union: `PARTIAL` means "₹450 still due" on a payment and "8 jars still out"
 * on a return, and one map cannot serve both under a shared key.
 */
export type StatusKind =
  | "unpaid"
  | "partiallyPaid"
  | "paid"
  | "overpaid"
  | "refundDue"
  | "notReturned"
  | "partiallyReturned"
  | "settled"
  | "notApplicable"
  | "active"
  | "inactive"
  | "draft"
  | "cancelled"
  | "scheduled"
  | "delivered"
  | "skipped";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

/** What is still out — jars on an order, coins on an issue. */
export type OutstandingUnit = "jars" | "coins" | "items";

export const STATUS_META: Record<
  StatusKind,
  { variant: BadgeVariant; icon: LucideIcon | null }
> = {
  unpaid: { variant: "danger", icon: Circle },
  partiallyPaid: { variant: "warning", icon: CircleDashed },
  paid: { variant: "success", icon: CheckCircle2 },
  overpaid: { variant: "warning", icon: AlertCircle },
  refundDue: { variant: "primary", icon: RotateCcw },
  notReturned: { variant: "danger", icon: PackageX },
  partiallyReturned: { variant: "warning", icon: Package },
  settled: { variant: "success", icon: PackageCheck },
  notApplicable: { variant: "default", icon: null },
  active: { variant: "success", icon: null },
  inactive: { variant: "default", icon: null },
  draft: { variant: "default", icon: FileEdit },
  // §7.2 also drops the whole row to 60% opacity — that belongs to the table.
  cancelled: { variant: "default", icon: Ban },
  scheduled: { variant: "primary", icon: Calendar },
  delivered: { variant: "success", icon: Check },
  skipped: { variant: "warning", icon: SkipForward },
};

const PAYMENT_STATUS_KIND: Record<PaymentStatus, StatusKind> = {
  UNPAID: "unpaid",
  PARTIAL: "partiallyPaid",
  PAID: "paid",
  OVERPAID: "overpaid",
  REFUND_DUE: "refundDue",
};

const RETURN_STATUS_KIND: Record<ReturnStatus, StatusKind> = {
  NOT_RETURNED: "notReturned",
  PARTIAL: "partiallyReturned",
  COMPLETE: "settled",
  NOT_APPLICABLE: "notApplicable",
};

const UNIT_KEY: Record<OutstandingUnit, string> = {
  jars: "jarsOut",
  coins: "coinsOut",
  items: "itemsOut",
};

export interface StatusBadgeProps {
  status: StatusKind;
  /**
   * Money still in play. Turns `Partial` into `₹450 due`, `Overpaid` into
   * `Overpaid ₹60`, `Refund due` into `Refund ₹500`. Sign is ignored — an
   * outstanding of `-500` is still "Refund ₹500".
   */
  amount?: number | string | null;
  /** Units still out. Turns `Partial` into `8 jars out`. */
  count?: number | string | null;
  unit?: OutstandingUnit;
  className?: string;
}

/**
 * The generic badge. Prefer `PaymentStatusBadge` / `ReturnStatusBadge` where
 * the value comes straight from a database enum.
 */
export function StatusBadge({
  status,
  amount,
  count,
  unit = "jars",
  className,
}: StatusBadgeProps) {
  const t = useTranslations("common.status");
  const { variant, icon: Icon } = STATUS_META[status];

  const shell = cn("inline-flex items-center gap-1", className);

  /** §7.2 label composition — the number wins wherever there is one. */
  const label = (): string => {
    const money = toFigure(amount);
    const units = toFigure(count);

    switch (status) {
      case "partiallyPaid":
        return money === null
          ? t("partiallyPaid")
          : t("amountDue", { amount: formatINR(money) });
      case "overpaid":
        return money === null
          ? t("overpaid")
          : t("overpaidBy", { amount: formatINR(money) });
      case "refundDue":
        return money === null
          ? t("refundDue")
          : t("refundAmount", { amount: formatINR(money) });
      case "notReturned":
      case "partiallyReturned":
        return units === null
          ? t(status)
          : t(UNIT_KEY[unit], { count: formatQuantity(units) });
      default:
        return t(status);
    }
  };

  // §7.2: not-applicable is an em dash. Colour and dash carry it visually; the
  // screen reader gets the words.
  if (status === "notApplicable") {
    return (
      <Badge variant={variant} className={shell}>
        <span aria-hidden>—</span>
        <span className="sr-only">{t("notApplicable")}</span>
      </Badge>
    );
  }

  return (
    <Badge variant={variant} className={shell}>
      {Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
      {label()}
    </Badge>
  );
}

/** Always positive: the sign lives in the status, not the label. */
function toFigure(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

export interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  /** Outstanding (or overpaid / refundable) amount, so the badge shows it. */
  amount?: number | string | null;
  className?: string;
}

export function PaymentStatusBadge({
  status,
  amount,
  className,
}: PaymentStatusBadgeProps) {
  return (
    <StatusBadge
      status={PAYMENT_STATUS_KIND[status]}
      amount={amount}
      className={className}
    />
  );
}

export interface ReturnStatusBadgeProps {
  status: ReturnStatus;
  /** How many are still out, so the badge reads `8 jars out`. */
  count?: number | string | null;
  unit?: OutstandingUnit;
  className?: string;
}

export function ReturnStatusBadge({
  status,
  count,
  unit = "jars",
  className,
}: ReturnStatusBadgeProps) {
  return (
    <StatusBadge
      status={RETURN_STATUS_KIND[status]}
      count={count}
      unit={unit}
      className={className}
    />
  );
}

export interface DualStatusBadgeProps {
  paymentStatus: PaymentStatus;
  amountDue?: number | string | null;
  returnStatus: ReturnStatus;
  unitsOut?: number | string | null;
  unit?: OutstandingUnit;
  className?: string;
}

/**
 * Payment + return, 4px apart, payment first. §7.3
 *
 * The two are genuinely independent — an order can be `Paid` with `12 jars out`
 * — so they are two badges rather than one combined state. Wraps rather than
 * truncates, because Gujarati labels run 20–40% longer.
 */
export function DualStatusBadge({
  paymentStatus,
  amountDue,
  returnStatus,
  unitsOut,
  unit = "jars",
  className,
}: DualStatusBadgeProps) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <PaymentStatusBadge status={paymentStatus} amount={amountDue} />
      <ReturnStatusBadge status={returnStatus} count={unitsOut} unit={unit} />
    </span>
  );
}
