"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { AlertCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FieldHint } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import { changePasswordAction } from "./actions";

type Strength = "weak" | "fair" | "strong";

function strengthOf(password: string): Strength {
  if (password.length < 8) return "weak";
  if (password.length < 12) return "fair";
  return "strong";
}

/**
 * Spec: .claude/design/MODULES/00-auth.md §7
 *
 * The strength meter is the ONE place in the app where feedback runs while
 * typing. It is guidance rather than judgement, and it is the only way to know
 * before submitting.
 */
export function ChangePasswordDialog() {
  const t = useTranslations("account.changePasswordModal");
  const tCommon = useTranslations("common");
  const tAccount = useTranslations("account");
  const { update } = useSession();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const strength = strengthOf(values.next);
  const strengthPct = strength === "weak" ? 30 : strength === "fair" ? 65 : 100;
  const canSubmit = values.current && values.next && values.confirm;

  function reset() {
    setValues({ current: "", next: "", confirm: "" });
    setErrors({});
    setBanner(null);
  }

  function submit() {
    setErrors({});
    setBanner(null);

    if (values.next.length < 8) {
      setErrors({ next: t("errors.tooShort") });
      return;
    }
    if (values.next !== values.confirm) {
      setErrors({ confirm: t("errors.mismatch") });
      return;
    }

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: values.current,
        newPassword: values.next,
        confirmPassword: values.confirm,
      });

      if (result.ok) {
        // Refresh this device's token so it survives the sessionVersion bump.
        await update({ sessionVersion: result.data.sessionVersion });
        setOpen(false);
        reset();
        return;
      }

      if (result.messageKey.endsWith("currentWrong")) {
        setBanner(t("errors.currentWrong"));
        setValues((v) => ({ ...v, current: "" }));
        return;
      }
      if (result.messageKey.endsWith("sameAsCurrent")) {
        setErrors({ next: t("errors.sameAsCurrent") });
        return;
      }
      setBanner(tCommon("somethingWentWrong"));
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary">{tAccount("changePassword")}</Button>
      </DialogTrigger>

      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {banner && (
          <Alert
            variant="danger"
            icon={<AlertCircle aria-hidden />}
            className="mt-4"
          >
            {banner}
          </Alert>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="current-password" required>
              {t("currentLabel")}
            </Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={values.current}
              invalid={!!banner}
              disabled={isPending}
              onChange={(e) =>
                setValues((v) => ({ ...v, current: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="new-password" required>
              {t("newLabel")}
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={values.next}
              invalid={!!errors.next}
              disabled={isPending}
              onChange={(e) =>
                setValues((v) => ({ ...v, next: e.target.value }))
              }
            />

            {values.next && !errors.next && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-200",
                      strength === "weak" && "bg-destructive",
                      strength === "fair" && "bg-warning",
                      strength === "strong" && "bg-success",
                    )}
                    style={{ width: `${strengthPct}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs",
                    strength === "weak" && "text-destructive",
                    strength === "fair" && "text-warning",
                    strength === "strong" && "text-success",
                  )}
                >
                  {t(
                    strength === "weak"
                      ? "strengthWeak"
                      : strength === "fair"
                        ? "strengthFair"
                        : "strengthStrong",
                  )}
                </span>
              </div>
            )}

            {errors.next ? (
              <FieldError message={errors.next} />
            ) : (
              <FieldHint>{t("helper")}</FieldHint>
            )}
          </div>

          <div>
            <Label htmlFor="confirm-password" required>
              {t("confirmLabel")}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={values.confirm}
              invalid={!!errors.confirm}
              disabled={isPending}
              onChange={(e) =>
                setValues((v) => ({ ...v, confirm: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) submit();
              }}
            />
            <FieldError message={errors.confirm} />
          </div>

          <Alert variant="info" icon={<Info aria-hidden />}>
            <span className="text-xs">{t("notice")}</span>
          </Alert>
        </div>

        <DialogFooter className="mt-6 border-t border-border pt-4">
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button
            onClick={submit}
            loading={isPending}
            loadingText={t("submitting")}
            disabled={!canSubmit}
          >
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
