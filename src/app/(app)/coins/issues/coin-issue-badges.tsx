import { useTranslations } from "next-intl";
import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  StatusBadge,
  type StatusKind,
} from "@/components/common/status-badge";
import type { CoinIssueStatusFilter } from "@/lib/table/configs/coin-issue";
import type { CoinIssueListItemDto } from "@/lib/dto/coin-issue.dto";

/**
 * The register's badges, in ONE place.
 *
 * No `"use client"` on purpose: the server detail page and the client register
 * table both render these, and two implementations of "what does this row's
 * status look like" is how amber comes to mean two different things.
 * See .claude/MODULE-RECIPE.md §7
 */

/**
 * The register's vocabulary → the shared §7.2 status kinds.
 *
 * `refund_due` maps to `refundDue`, which `StatusBadge` renders in PRIMARY blue
 * with a `RotateCcw`. Money the company owes back is not a loss, and rendering
 * a routine coin return in Danger red makes a normal Tuesday look like a
 * problem. DESIGN-STANDARDS §13
 */
const STATUS_KIND: Record<CoinIssueStatusFilter, StatusKind> = {
  pending: "unpaid",
  partial: "partiallyPaid",
  settled: "settled",
  refund_due: "refundDue",
  cancelled: "cancelled",
};

/**
 * `₹500 due` · `Refund ₹500` · `Settled` · `Unpaid` · `Cancelled`.
 *
 * The amount is always passed: a badge that shows a number lets the owner
 * triage the register without opening anything, and `StatusBadge` already
 * ignores it for the states where no number is left to show.
 */
export function CoinIssueStatusBadge({
  issue,
  className,
}: {
  issue: Pick<CoinIssueListItemDto, "registerStatus" | "outstandingAmount">;
  className?: string;
}) {
  return (
    <StatusBadge
      status={STATUS_KIND[issue.registerStatus]}
      amount={issue.outstandingAmount}
      className={className}
    />
  );
}

/**
 * Pending is non-zero but under a rupee — rounding, not money. §8.2
 *
 * Shown BESIDE the status badge rather than replacing it, because the row is
 * still genuinely unsettled; it just cannot be settled by collecting anything.
 */
export function RoundingStubBadge() {
  const t = useTranslations("coins.issues");
  return (
    <Badge variant="default" icon={<Scale aria-hidden />}>
      {t("badges.rounding")}
    </Badge>
  );
}

/**
 * The 2px left border that lets the owner read the register's shape at arm's
 * length, before reading a single figure. Design §6.3
 *
 * Blue for a refund due, red for untouched, amber for part-paid. Settled and
 * cancelled rows carry none — a closed row should recede.
 */
export function rowAccentClass(
  issue: Pick<CoinIssueListItemDto, "registerStatus">,
): string | undefined {
  switch (issue.registerStatus) {
    case "refund_due":
      return "border-l-2 border-l-primary";
    case "pending":
      return "border-l-2 border-l-destructive";
    case "partial":
      return "border-l-2 border-l-warning";
    // A cancelled row dims instead; a settled one is a good outcome and keeps
    // full strength with no border at all. Design §6.5
    case "cancelled":
      return "opacity-60";
    default:
      return undefined;
  }
}
