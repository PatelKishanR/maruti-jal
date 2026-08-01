"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Ban,
  Banknote,
  ExternalLink,
  MoreHorizontal,
  RotateCcw,
  Scale,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { api, ApiError } from "@/lib/api/client";
import { formatINR, formatQuantity } from "@/lib/money";
import type { CoinIssueListItemDto } from "@/lib/dto/coin-issue.dto";
import { CoinPaymentDialog } from "./coin-payment-dialog";
import { CoinReturnDialog } from "./coin-return-dialog";

/**
 * The `⋯` menu and every dialog behind it. Design §6.3, §8.3
 *
 * ONE component for the register row and the detail header, because they offer
 * the same six actions and a second copy would drift the moment one of them
 * gained a seventh.
 *
 * Which actions appear is driven entirely by the row's own numbers:
 *
 *   pending > 0   →  Record payment
 *   pending < 0   →  Record refund (never both — the direction is the point)
 *   coins out     →  Record return
 *   |pending| < ₹1 →  Settle difference, promoted to the top slot
 *   cancelled     →  Open issue, and nothing else
 */
export function CoinIssueActions({
  issue,
  align = "end",
  variant = "row",
}: {
  issue: CoinIssueListItemDto;
  align?: "start" | "end";
  /**
   * `detail` promotes the contextual action to a real button beside the `⋯`,
   * per §8.3 — the same dialogs, the same state, one implementation.
   */
  variant?: "row" | "detail";
}) {
  const t = useTranslations("coins.issues.actions");
  const tRoot = useTranslations();
  const router = useRouter();

  const [showReturn, setShowReturn] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<"IN" | "OUT" | null>(
    null,
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [pending, startTransition] = useTransition();

  const cancelled = issue.registerStatus === "cancelled";
  const canReturn = !cancelled && issue.lines.some((l) => l.coinsOutstanding > 0);
  const canCollect = !cancelled && issue.dueAmount > 0;
  const canRefund = !cancelled && issue.refundAmount > 0;
  const canSettle = !cancelled && issue.roundingStub;

  function report(error: unknown) {
    if (error instanceof ApiError) {
      toast.error(
        tRoot.has(error.messageKey) ? tRoot(error.messageKey) : error.messageKey,
      );
      return;
    }
    toast.error(tRoot("common.somethingWentWrong"));
  }

  async function settleDifference() {
    try {
      await api.patch(`/api/coin-issues/${issue.id}`, { note: null });
      toast.success(
        t("settle.success", {
          amount: formatINR(Math.abs(issue.outstandingAmount)),
          code: issue.code,
        }),
      );
      startTransition(() => router.refresh());
    } catch (error) {
      report(error);
    }
  }

  async function cancelIssue() {
    try {
      await api.del(`/api/coin-issues/${issue.id}`);
      toast.success(t("cancel.success", { code: issue.code }));
      startTransition(() => router.refresh());
    } catch (error) {
      report(error);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {/* Contextual primary FIRST — on a refund-due issue the one thing the
          owner came to do is hand money back, so that is the blue button.
          Design §8.3 */}
      {variant === "detail" && canReturn && (
        <Button variant="secondary" onClick={() => setShowReturn(true)}>
          <Undo2 aria-hidden />
          {t("recordReturn")}
        </Button>
      )}

      {variant === "detail" && canRefund && (
        <Button onClick={() => setPaymentDirection("OUT")}>
          <RotateCcw aria-hidden />
          {t("recordRefund", { amount: formatINR(issue.refundAmount) })}
        </Button>
      )}

      {variant === "detail" && !canRefund && canCollect && (
        <Button onClick={() => setPaymentDirection("IN")}>
          <Banknote aria-hidden />
          {t("recordPayment")}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={t("rowMenu", { code: issue.code })}
            // Without this the row navigates out from under the menu.
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align={align} onClick={(e) => e.stopPropagation()}>
          {/* A rounding stub is the one thing the owner cannot resolve any
              other way, so it takes the top slot. Design §6.5 */}
          {canSettle && (
            <DropdownMenuItem onSelect={() => setConfirmSettle(true)}>
              <Scale aria-hidden />
              {t("settleDifference", {
                amount: formatINR(Math.abs(issue.outstandingAmount)),
              })}
            </DropdownMenuItem>
          )}

          {canCollect && (
            <DropdownMenuItem onSelect={() => setPaymentDirection("IN")}>
              <Banknote aria-hidden />
              {t("recordPayment")}
            </DropdownMenuItem>
          )}

          {canRefund && (
            <DropdownMenuItem onSelect={() => setPaymentDirection("OUT")}>
              <RotateCcw aria-hidden />
              {t("recordRefund", { amount: formatINR(issue.refundAmount) })}
            </DropdownMenuItem>
          )}

          {canReturn && (
            <DropdownMenuItem onSelect={() => setShowReturn(true)}>
              <Undo2 aria-hidden />
              {t("recordReturn")}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem asChild>
            <Link href={`/coins/issues/${issue.id}`}>
              <ExternalLink aria-hidden />
              {t("openIssue")}
            </Link>
          </DropdownMenuItem>

          {!cancelled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmCancel(true)}>
                <Ban aria-hidden />
                {t("cancelIssue")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showReturn && (
        <CoinReturnDialog
          issue={issue}
          open
          onOpenChange={(open) => !open && setShowReturn(false)}
        />
      )}

      {paymentDirection && (
        <CoinPaymentDialog
          issue={issue}
          direction={paymentDirection}
          open
          onOpenChange={(open) => !open && setPaymentDirection(null)}
        />
      )}

      {confirmSettle && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirmSettle(false)}
          title={t("settle.title", {
            amount: formatINR(Math.abs(issue.outstandingAmount)),
            code: issue.code,
          })}
          description={t("settle.body", {
            amount: formatINR(Math.abs(issue.outstandingAmount)),
          })}
          confirmLabel={t("settle.confirm", {
            amount: formatINR(Math.abs(issue.outstandingAmount)),
          })}
          onConfirm={settleDifference}
        />
      )}

      {confirmCancel && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirmCancel(false)}
          variant="destructive"
          title={t("cancel.title", { code: issue.code })}
          // Names every consequence, including the one that does NOT happen:
          // the money already collected is not touched. Design §6.4
          description={t("cancel.body", {
            coins: formatQuantity(issue.coinsOutstanding),
            staff: issue.staffName,
            payable: formatINR(Math.max(issue.outstandingAmount, 0)),
            collected: formatINR(issue.paidAmount),
          })}
          confirmLabel={t("cancel.confirm")}
          onConfirm={cancelIssue}
        />
      )}
    </span>
  );
}
