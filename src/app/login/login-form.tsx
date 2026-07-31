"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { AlertCircle, Eye, EyeOff, Info, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";

/**
 * Login form. Spec: .claude/design/MODULES/00-auth.md §3
 *
 * Posts to the Auth.js API route (`/api/auth/callback/credentials`) via
 * `signIn` — an API call, consistent with the rest of the app. No Server
 * Action, no direct service access.
 *
 * Behaviours that matter and are easy to lose:
 *  - validation never runs while typing, only on blur and submit
 *  - after a failure the EMAIL is kept and focus moves to password; retyping
 *    an email you already got right is pure friction
 *  - the button holds its spinner through the redirect rather than flashing
 *    back to idle
 */
export function LoginForm({
  redirectTo,
  wasRedirected,
  sessionExpired = false,
}: {
  redirectTo: string;
  wasRedirected: boolean;
  /** Arrived here from force-signout after a stale session was cleared. */
  sessionExpired?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [values, setValues] = useState({ email: "", password: "" });
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Client-side checks run only once a field has been blurred.
  const emailError =
    touched.email && !values.email.trim()
      ? "auth.errors.emailRequired"
      : touched.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())
        ? "auth.errors.emailInvalid"
        : undefined;

  const passwordError =
    touched.password && !values.password ? "auth.errors.passwordRequired" : undefined;

  const isNetworkError = bannerKey === "auth.errors.network";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setBannerKey(null);

    if (!values.email.trim() || !values.password) return;

    startTransition(async () => {
      try {
        const result = await signIn("credentials", {
          email: values.email.trim().toLowerCase(),
          password: values.password,
          redirect: false,
        });

        if (result?.error) {
          // Identical message for a wrong password and an unknown email —
          // distinguishing them enumerates accounts. See MODULES/00-auth.md §5.1
          setBannerKey("auth.errors.invalidCredentials");
          setValues((v) => ({ ...v, password: "" }));
          passwordRef.current?.focus();
          return;
        }

        // Keep the spinner through navigation — never flash back to idle.
        router.replace(redirectTo);
        router.refresh();
      } catch {
        setBannerKey("auth.errors.network");
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      {sessionExpired && !bannerKey && (
        <Alert variant="info" icon={<Info aria-hidden />} className="mb-6">
          {t("auth.signIn.expiredNotice")}
        </Alert>
      )}

      {wasRedirected && !sessionExpired && !bannerKey && (
        <Alert variant="info" icon={<Info aria-hidden />} className="mb-6">
          {t("auth.signIn.redirectedNotice")}
        </Alert>
      )}

      {bannerKey && (
        <Alert
          variant="danger"
          icon={isNetworkError ? <WifiOff aria-hidden /> : <AlertCircle aria-hidden />}
          className="mb-6"
        >
          {t(bannerKey)}
        </Alert>
      )}

      <div className="mb-4">
        <Label htmlFor="email">{t("auth.signIn.emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          inputSize="lg"
          placeholder={t("auth.signIn.emailPlaceholder")}
          value={values.email}
          invalid={!!emailError || !!bannerKey}
          aria-describedby={emailError ? "email-error" : undefined}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          onBlur={() => setTouched((s) => ({ ...s, email: true }))}
          disabled={isPending}
        />
        <FieldError id="email-error" message={emailError ? t(emailError) : null} />
      </div>

      <div className="mb-5">
        <Label htmlFor="password">{t("auth.signIn.passwordLabel")}</Label>
        <Input
          id="password"
          name="password"
          ref={passwordRef}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          inputSize="lg"
          value={values.password}
          invalid={!!passwordError || !!bannerKey}
          aria-describedby={passwordError ? "password-error" : undefined}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          onBlur={() => setTouched((s) => ({ ...s, password: true }))}
          disabled={isPending}
          suffix={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              // Reveal is a deliberate click, never a hover.
              className="flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={t(
                showPassword ? "auth.signIn.hidePassword" : "auth.signIn.showPassword",
              )}
            >
              {showPassword ? (
                <EyeOff className="size-[18px]" aria-hidden />
              ) : (
                <Eye className="size-[18px]" aria-hidden />
              )}
            </button>
          }
        />
        <FieldError id="password-error" message={passwordError ? t(passwordError) : null} />
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Checkbox id="keepSignedIn" name="keepSignedIn" disabled={isPending} />
        <Label
          htmlFor="keepSignedIn"
          className="mb-0 cursor-pointer font-normal text-muted-foreground"
        >
          {t("auth.signIn.keepSignedIn")}
        </Label>
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={isPending}
        loadingText={t("auth.signIn.submitting")}
      >
        {t("auth.signIn.submit")}
      </Button>
    </form>
  );
}
