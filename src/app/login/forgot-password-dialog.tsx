"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const RESET_COMMAND = "npm run auth:reset-password";

/**
 * Honest recovery guidance. Spec: .claude/design/MODULES/00-auth.md §4
 *
 * Version 1 has no email-based reset because the app has no email provider
 * configured, and adding one is a real infrastructure decision rather than a
 * small feature. For a single owner with server access this is sufficient.
 *
 * Deliberately informational — no alarm colours. This is guidance, not an error.
 */
export function ForgotPasswordDialog() {
  const t = useTranslations("auth.forgot");
  const tSignIn = useTranslations("auth.signIn");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(RESET_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the command stays visible and selectable.
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mx-auto block text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {tSignIn("forgotPassword")}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <KeyRound
              className="mt-0.5 size-6 shrink-0 text-primary"
              aria-hidden
            />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription className="mt-4">{t("body")}</DialogDescription>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-3">
          {/* Scrolls rather than wraps — a wrapped shell command invites mistyping. */}
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-foreground">
            {RESET_COMMAND}
          </code>
          <button
            type="button"
            onClick={copy}
            className="flex size-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={t("copyCommand")}
          >
            {copied ? (
              <Check className="size-4 text-success" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("afterCommand")}
        </p>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button variant="secondary">{tCommon("gotIt")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
