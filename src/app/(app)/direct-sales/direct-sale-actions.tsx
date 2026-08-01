"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Ban, Eye, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api/client";
import { directSalePaths, directSaleRoutes } from "@/lib/api/routes.direct-sale";
import { formatDate, formatDateTime, todayIST } from "@/lib/dates";
import { formatINR, formatLitres } from "@/lib/money";
import { voidDirectSaleSchema } from "@/lib/validation/direct-sale";
import type { Locale } from "@/i18n/config";
import type {
  DirectSaleDetailDto,
  DirectSaleListItemDto,
} from "@/lib/dto/direct-sale.dto";

/**
 * Row and header actions, plus the void dialog. Spec: §3.3, §5.3, §7
 *
 * One component for the list and the detail page, because the rules are the
 * same in both places and duplicating them is how they drift.
 *
 * Talks to the API only — no service, no repository. See ARCHITECTURE §4.1
 */
export function DirectSaleActions({
  sale,
  detail,
  variant = "row",
}: {
  sale: DirectSaleListItemDto;
  /** Already loaded on the detail page, so the dialog needs no round trip. */
  detail?: DirectSaleDetailDto;
  variant?: "row" | "detail";
}) {
  const t = useTranslations("directSales");
  const [voiding, setVoiding] = useState(false);

  return (
    // Stops a click on the menu from also opening the row's detail page.
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center gap-2"
    >
      {variant === "detail" && sale.canEdit && (
        <Button variant="primary" asChild>
          <Link href={directSalePaths.edit(sale.id)}>
            <Pencil aria-hidden />
            {t("actions.edit")}
          </Link>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Always visible at 44×44, never hover-only. §5.2 */}
          <button
            type="button"
            aria-label={t("actions.menuLabel", { code: sale.code })}
            className="flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-55">
          {variant === "row" && (
            <DropdownMenuItem asChild>
              <Link href={directSalePaths.detail(sale.id)}>
                <Eye aria-hidden />
                {t("actions.view")}
              </Link>
            </DropdownMenuItem>
          )}

          {/**
           * A disabled control with its REASON attached, never a bare grey
           * item — "Only today's entries can be edited" is the whole
           * explanation, and hiding it leaves the owner clicking a dead row.
           * §3.3
           */}
          {sale.canEdit ? (
            <DropdownMenuItem asChild>
              <Link href={directSalePaths.edit(sale.id)}>
                <Pencil aria-hidden />
                {t("actions.edit")}
              </Link>
            </DropdownMenuItem>
          ) : (
            <div className="px-2 py-1.5 opacity-40">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Pencil className="size-4" aria-hidden />
                {t("actions.edit")}
              </p>
              <p className="mt-0.5 pl-6 text-caption text-muted-foreground">
                {sale.isVoided
                  ? t("actions.editVoided")
                  : t("actions.editBlocked")}
              </p>
            </div>
          )}

          <DropdownMenuSeparator />

          {sale.isVoided ? (
            <div className="px-2 py-1.5 opacity-40">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Ban className="size-4" aria-hidden />
                {t("actions.unvoid")}
              </p>
              <p className="mt-0.5 pl-6 text-caption text-muted-foreground">
                {t("actions.unvoidBlocked")}
              </p>
            </div>
          ) : (
            <DropdownMenuItem destructive onSelect={() => setVoiding(true)}>
              <Ban aria-hidden />
              {t("actions.void")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <VoidDialog
        sale={sale}
        detail={detail}
        open={voiding}
        onOpenChange={setVoiding}
      />
    </div>
  );
}

/**
 * Void dialog. Spec: §7
 *
 * States the exact effect on the day's total before the button is pressed, and
 * offers **no Undo** afterwards: the entire point of voiding rather than
 * deleting is that the cancellation is on the record.
 */
function VoidDialog({
  sale,
  detail,
  open,
  onOpenChange,
}: {
  sale: DirectSaleListItemDto;
  detail?: DirectSaleDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("directSales");
  const tCommon = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * The impact figures are two SQL sums the row does not carry. The dialog
   * opens at final size immediately and fills them in — subtracting the amount
   * from the band total in the browser would put a float in front of the one
   * number this dialog exists to state. §7.5
   */
  const [impact, setImpact] = useState<DirectSaleDetailDto | null>(
    detail ?? null,
  );

  useEffect(() => {
    if (!open || impact) return;
    let cancelled = false;
    void api
      .get<DirectSaleDetailDto>(directSaleRoutes.detail(sale.id))
      .then((loaded) => {
        if (!cancelled) setImpact(loaded);
      })
      .catch(() => {
        /* The figures are context, not a blocker — the void still works. */
      });
    return () => {
      cancelled = true;
    };
  }, [open, impact, sale.id]);

  useEffect(() => {
    if (!open) {
      setReason("");
      setError(null);
      setFormError(null);
    }
  }, [open]);

  async function confirm() {
    const parsed = voidDirectSaleSchema.safeParse({ reason });
    if (!parsed.success) {
      const key = parsed.error.flatten().fieldErrors.reason?.[0];
      setError(key && tRoot.has(key) ? tRoot(key) : (key ?? null));
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      /**
       * DELETE with a body: `api.del` takes a `RequestInit`, and the reason is
       * a required sentence rather than a URL parameter.
       */
      await api.del(directSaleRoutes.detail(sale.id), {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      onOpenChange(false);
      // No `Undo` — see §7.4. The toast names the object and stops there.
      toast.success(t("toasts.voided", { code: sale.code }));
      startTransition(() => router.refresh());
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.messageKey === "directSales.errors.alreadyVoided"
      ) {
        const meta = e.meta as { voidedAt?: string } | undefined;
        setFormError(
          meta?.voidedAt
            ? t("void.alreadyVoidedAt", {
                time: formatDateTime(meta.voidedAt, locale),
              })
            : t("void.alreadyVoided"),
        );
      } else {
        setFormError(t("void.failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  const isToday = sale.saleDate === todayIST();

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-120">
        <div className="flex gap-3">
          <Ban className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <DialogTitle>{t("void.title", { code: sale.code })}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("void.consequence")}
            </DialogDescription>
          </div>
        </div>

        {/* The sale being voided, restated — someone who opened the wrong row
            can still catch it here. §7.3 */}
        <div className="mt-4 rounded-md border border-border bg-muted p-3">
          <p className="text-sm text-foreground">
            {sale.customerName}
            <span className="text-muted-foreground">
              {" · "}
              {formatDateTime(sale.soldAt, locale)}
            </span>
          </p>
          <p className="mt-1 flex items-center justify-between gap-3">
            <span className="text-caption text-muted-foreground">
              {[
                sale.litres === null ? null : formatLitres(sale.litres),
                sale.productTitle,
              ]
                .filter(Boolean)
                .join(" · ") || t("void.amountOnly")}
            </span>
            <span className="font-mono text-base font-semibold tabular-nums text-foreground">
              {formatINR(sale.amount)}
            </span>
          </p>
        </div>

        <div className="mt-4">
          <Label htmlFor="void-reason" required>
            {t("void.reasonLabel")}
          </Label>
          <Textarea
            id="void-reason"
            rows={2}
            autoFocus
            value={reason}
            invalid={!!error}
            placeholder={t("void.reasonPlaceholder")}
            onChange={(e) => {
              setReason(e.target.value);
              // Once a field is in error it re-validates on every keystroke,
              // so the error clears the instant it is fixed. §4.6
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              // Plain Enter inserts a newline — it is a textarea. §7.6
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void confirm();
              }
            }}
          />
          {/* Space reserved, so nothing shifts when the message appears. */}
          <p
            className={`mt-1 min-h-4 text-caption ${
              error ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {error ?? t("void.reasonHelper")}
          </p>
        </div>

        <p className="mt-4 text-sm text-foreground">
          {impact ? (
            isToday ? (
              t.rich("void.impactToday", {
                from: () => <Figure>{formatINR(impact.dayTotal)}</Figure>,
                to: () => <Figure>{formatINR(impact.dayTotalAfterVoid)}</Figure>,
              })
            ) : (
              t.rich("void.impactDay", {
                date: formatDate(sale.saleDate, locale),
                from: () => <Figure>{formatINR(impact.dayTotal)}</Figure>,
                to: () => <Figure>{formatINR(impact.dayTotalAfterVoid)}</Figure>,
              })
            )
          ) : (
            <Skeleton className="h-4 w-64" />
          )}
        </p>

        {formError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {formError}
          </p>
        )}

        <DialogFooter className="mt-6 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {tCommon("cancel")}
          </Button>
          {/* The confirm repeats the verb, and stays enabled — pressing it is
              how a missing reason gets surfaced. §7.5 */}
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            loading={busy}
            loadingText={t("void.submitting")}
          >
            {t("void.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Figure({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono font-semibold tabular-nums">{children}</span>
  );
}
