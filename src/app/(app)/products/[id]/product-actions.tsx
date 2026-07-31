"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle2, Copy, MoreHorizontal } from "lucide-react";
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
import { api } from "@/lib/api/client";

/**
 * Detail-page header menu. Spec: design/MODULES/02-products.md §4.3
 *
 * A client island inside a Server Component page: deactivation needs state, a
 * confirm dialog and a toast with an 8-second `Undo`, none of which survive the
 * server boundary. Everything else on that page stays server-rendered.
 */
export function ProductActions({
  productId,
  title,
  isActive,
}: {
  productId: string;
  title: string;
  isActive: boolean;
}) {
  const t = useTranslations("products");
  const [confirming, setConfirming] = useState(false);
  const { deactivate, reactivate } = useActiveToggle(productId, title);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("rowActions.more")}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/products/new?duplicate=${productId}`}>
              <Copy aria-hidden />
              {t("rowActions.duplicate")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {isActive ? (
            <DropdownMenuItem destructive onSelect={() => setConfirming(true)}>
              <Ban aria-hidden />
              {t("rowActions.deactivate")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void reactivate()}>
              <CheckCircle2 aria-hidden />
              {t("rowActions.reactivate")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("deactivate.title", { title })}
        description={t("deactivate.body")}
        confirmLabel={t("deactivate.confirm")}
        onConfirm={deactivate}
      />
    </>
  );
}

/** The `Reactivate` link that sits at the right of the inactive banner. */
export function ReactivateLink({
  productId,
  title,
}: {
  productId: string;
  title: string;
}) {
  const t = useTranslations("products");
  const { reactivate, busy } = useActiveToggle(productId, title);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void reactivate()}
      className="shrink-0 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40"
    >
      {t("rowActions.reactivate")}
    </button>
  );
}

/**
 * Deactivation is never blocked for a product — a deactivated one breaks
 * nothing, because every past order renders from its own snapshot. So there is
 * no "in use" branch here to fail on, only success and network failure.
 */
function useActiveToggle(productId: string, title: string) {
  const t = useTranslations("products");
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  async function reactivate() {
    try {
      await api.post(`/api/products/${productId}/reactivate`);
      startTransition(() => router.refresh());
      toast.success(t("toast.reactivated", { title }));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  }

  async function deactivate() {
    try {
      await api.del(`/api/products/${productId}`);
      startTransition(() => router.refresh());
      toast.success(t("toast.deactivated", { title }), {
        duration: 8000,
        action: { label: t("toast.undo"), onClick: () => void reactivate() },
      });
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  }

  return { deactivate, reactivate, busy };
}
