"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  Coins,
  Eye,
  MoreHorizontal,
  PackageX,
  Pencil,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api/client";
import { staffPaths, staffRoutes } from "@/lib/api/routes.staff";
import { formatINR, formatQuantity } from "@/lib/money";
import type { StaffBlockerDto, StaffListItemDto } from "@/lib/dto/staff.dto";

/**
 * Row and header actions, plus the two deactivation dialogs.
 *
 * One component for the list and the detail page, because the rules are the
 * same in both places and duplicating them is how they drift.
 *
 * Talks to the API only — no service, no repository. See ARCHITECTURE §4.1
 */
export function StaffActions({
  staff,
  variant = "row",
}: {
  staff: StaffListItemDto;
  /** `row` renders the `⋯` trigger; `detail` adds a visible Edit button. */
  variant?: "row" | "detail";
}) {
  const t = useTranslations("staff");
  const router = useRouter();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockers, setBlockers] = useState<StaffBlockerDto[] | null>(null);
  const [, startTransition] = useTransition();

  /**
   * The figures are already on the row, so the right dialog opens immediately
   * — no spinner, no round trip. The server re-checks on submit anyway
   * (fail closed), which is what makes this safe rather than optimistic.
   */
  function localBlockers(): StaffBlockerDto[] {
    const found: StaffBlockerDto[] = [];
    if (staff.cashOutstanding > 0) {
      found.push({ kind: "cash", amount: staff.cashOutstanding, count: 0 });
    }
    if (staff.jarsOut > 0) {
      found.push({ kind: "jars", amount: staff.jarsOut, count: 0 });
    }
    if (staff.coinDues > 0) {
      found.push({ kind: "coins", amount: staff.coinDues, count: 0 });
    }
    return found;
  }

  function askToDeactivate() {
    const found = localBlockers();
    if (found.length > 0) {
      setBlockers(found);
      return;
    }
    setConfirmOpen(true);
  }

  async function reactivate() {
    await api.post(staffRoutes.reactivate(staff.id));
    startTransition(() => router.refresh());
  }

  async function deactivate() {
    try {
      await api.del(staffRoutes.detail(staff.id));
      startTransition(() => router.refresh());

      // Names the object, and offers the way back for 8 seconds — the owner
      // who deactivated the wrong row should not need to hunt for them.
      toast.success(t("toasts.deactivated", { name: staff.name }), {
        duration: 8000,
        action: {
          label: t("actions.undo"),
          onClick: () => {
            void reactivate().then(() =>
              toast.success(t("toasts.reactivated", { name: staff.name })),
            );
          },
        },
      });
    } catch (error) {
      // The server refused. It knows more than the row did — a payment may
      // have landed since this page rendered — so show what it says.
      if (
        error instanceof ApiError &&
        error.messageKey === "staff.errors.deactivateBlocked"
      ) {
        const meta = error.meta as { blockers?: StaffBlockerDto[] } | undefined;
        setConfirmOpen(false);
        setBlockers(meta?.blockers ?? localBlockers());
        return;
      }
      toast.error(t("toasts.deactivateFailed", { name: staff.name }));
    }
  }

  async function confirmReactivate() {
    try {
      await reactivate();
      toast.success(t("toasts.reactivated", { name: staff.name }));
    } catch {
      toast.error(t("toasts.reactivateFailed", { name: staff.name }));
    }
  }

  return (
    // Stops a click on the menu from also opening the row's detail page.
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center gap-2"
    >
      {variant === "detail" && (
        <Button variant="secondary" asChild>
          <Link href={staffPaths.edit(staff.id)}>
            <Pencil aria-hidden />
            {t("actions.edit")}
          </Link>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Always visible at 44×44, never hover-only: hover-only actions are
              undiscoverable and impossible on touch. §5.2 */}
          <button
            type="button"
            aria-label={t("actions.menuLabel", { name: staff.name })}
            className="flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {variant === "row" && (
            <>
              <DropdownMenuItem asChild>
                <Link href={staffPaths.detail(staff.id)}>
                  <Eye aria-hidden />
                  {t("actions.view")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={staffPaths.edit(staff.id)}>
                  <Pencil aria-hidden />
                  {t("actions.edit")}
                </Link>
              </DropdownMenuItem>
            </>
          )}

          {variant === "row" && <DropdownMenuSeparator />}

          {staff.isActive ? (
            /* Deliberately NOT disabled when dues exist — clicking opens the
               blocked dialog, which explains. A disabled item with no
               explanation is worse than a clear refusal. §4.5 */
            <DropdownMenuItem destructive onSelect={askToDeactivate}>
              <Ban aria-hidden />
              {t("actions.deactivate")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
              <CheckCircle2 aria-hidden className="text-success" />
              {t("actions.reactivate")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant={staff.isActive ? "destructive" : "primary"}
        title={
          staff.isActive
            ? t("deactivate.title", { name: staff.name })
            : t("reactivate.title", { name: staff.name })
        }
        description={
          staff.isActive
            ? t("deactivate.body")
            : t("reactivate.body")
        }
        confirmLabel={
          staff.isActive ? t("actions.deactivate") : t("actions.reactivate")
        }
        confirmingLabel={
          staff.isActive
            ? t("deactivate.submitting")
            : t("reactivate.submitting")
        }
        onConfirm={staff.isActive ? deactivate : confirmReactivate}
      />

      <BlockedDialog
        name={staff.name}
        staffId={staff.id}
        blockers={blockers}
        onClose={() => setBlockers(null)}
      />
    </div>
  );
}

/**
 * The `Reactivate` affordance on the inactive banner (§4.4).
 *
 * A banner that states a problem without offering the fix makes the owner hunt
 * through a menu for it. No confirmation here: bringing someone back is not
 * destructive, and the banner itself is the context.
 */
export function StaffReactivateLink({
  staffId,
  name,
}: {
  staffId: string;
  name: string;
}) {
  const t = useTranslations("staff");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reactivate() {
    setBusy(true);
    try {
      await api.post(staffRoutes.reactivate(staffId));
      router.refresh();
      toast.success(t("toasts.reactivated", { name }));
    } catch {
      toast.error(t("toasts.reactivateFailed", { name }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={reactivate}
      disabled={busy}
      className="shrink-0 text-sm font-medium underline-offset-4 hover:underline disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {t("actions.reactivate")}
    </button>
  );
}

const BLOCKER_META: Record<
  StaffBlockerDto["kind"],
  { icon: LucideIcon; tone: string; tab: string }
> = {
  cash: { icon: Wallet, tone: "text-destructive", tab: "orders" },
  jars: { icon: PackageX, tone: "text-destructive", tab: "orders" },
  coins: { icon: Coins, tone: "text-warning", tab: "coins" },
};

/**
 * The refusal, itemised. Spec: design/MODULES/01-staff.md §7.3
 *
 * Every row is a link to the records behind the figure, so the dialog is a
 * starting point rather than a dead end.
 */
function BlockedDialog({
  name,
  staffId,
  blockers,
  onClose,
}: {
  name: string;
  staffId: string;
  blockers: StaffBlockerDto[] | null;
  onClose: () => void;
}) {
  const t = useTranslations("staff");
  const open = blockers !== null && blockers.length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-120">
        <div className="flex gap-3">
          <Ban className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <DialogTitle>{t("deactivate.blocked.title", { name })}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("deactivate.blocked.body", { count: blockers?.length ?? 0 })}
            </DialogDescription>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border bg-muted">
          {(blockers ?? []).map((blocker) => {
            const { icon: Icon, tone, tab } = BLOCKER_META[blocker.kind];
            return (
              <li key={blocker.kind}>
                <Link
                  href={`${staffPaths.detail(staffId)}?tab=${tab}`}
                  onClick={onClose}
                  className="flex min-h-12 items-center gap-3 px-4 py-2 transition-colors duration-100 hover:bg-border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {blocker.kind === "jars"
                        ? formatQuantity(blocker.amount)
                        : formatINR(blocker.amount)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {t(`deactivate.blocked.reason.${blocker.kind}`)}
                    </span>
                  </span>
                  {blocker.count > 0 && (
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {blocker.kind === "coins"
                        ? t("deactivate.blocked.issueCount", {
                            count: blocker.count,
                          })
                        : t("deactivate.blocked.orderCount", {
                            count: blocker.count,
                          })}
                    </span>
                  )}
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="mt-6 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("actions.close")}
          </Button>
          {/* The dialog offers the fix, not just the refusal. Recording a
              payment lives in the payments module (wave 4); until then the fix
              is the record itself, where the open items are listed. */}
          <Button asChild>
            <Link href={staffPaths.detail(staffId)} onClick={onClose}>
              {t("deactivate.blocked.openRecord")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
