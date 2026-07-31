"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FieldHint } from "@/components/ui/field-error";
import { api, ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import type { UserDto } from "@/lib/dto/user.dto";

/**
 * Talks to the API only — no service, no repository, no database import.
 * See .claude/ARCHITECTURE.md §4
 */
export function ProfileForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [values, setValues] = useState({ name: initialName, email: initialEmail });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = values.name !== initialName || values.email !== initialEmail;

  /**
   * Server field errors are catalogue KEYS, resolved here in the active
   * language — so they render through the same FieldError as client-side
   * ones. One error-display path, not two.
   */
  function resolveKey(key: string): string {
    return tCommon.has(key) ? tCommon(key) : key;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBanner(null);
    setSaved(false);

    startTransition(async () => {
      try {
        await api.patch<UserDto>(apiRoutes.account.profile, values);
        setSaved(true);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.fieldErrors) {
            const mapped: Record<string, string> = {};
            for (const [field, keys] of Object.entries(err.fieldErrors)) {
              if (keys?.[0]) mapped[field] = resolveKey(keys[0]);
            }
            setErrors(mapped);
            return;
          }
          if (err.messageKey.endsWith("emailTaken")) {
            setErrors({ email: t("errors.emailTaken") });
            return;
          }
        }
        setBanner(tCommon("somethingWentWrong"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      {banner && (
        <Alert variant="danger" icon={<AlertCircle aria-hidden />} className="mb-4">
          {banner}
        </Alert>
      )}

      <div className="mb-4">
        <Label htmlFor="name" required>
          {t("nameLabel")}
        </Label>
        {/* 320px, not full width — a name is not a paragraph. */}
        <Input
          id="name"
          value={values.name}
          className="max-w-80"
          invalid={!!errors.name}
          disabled={isPending}
          onChange={(e) => {
            setValues((v) => ({ ...v, name: e.target.value }));
            setSaved(false);
          }}
        />
        <FieldError message={errors.name} />
      </div>

      <div className="mb-4">
        <Label htmlFor="email" required>
          {t("emailLabel")}
        </Label>
        <Input
          id="email"
          type="email"
          value={values.email}
          className="max-w-80"
          invalid={!!errors.email}
          disabled={isPending}
          onChange={(e) => {
            setValues((v) => ({ ...v, email: e.target.value }));
            setSaved(false);
          }}
        />
        {errors.email ? (
          <FieldError message={errors.email} />
        ) : (
          <FieldHint>{t("emailHelper")}</FieldHint>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        {dirty && !isPending && (
          <span className="text-xs text-muted-foreground">
            {tCommon("unsavedChanges")}
          </span>
        )}
        {saved && !dirty && (
          <span className="text-xs text-success">{t("updated")}</span>
        )}
        <Button
          type="submit"
          disabled={!dirty}
          loading={isPending}
          loadingText={tCommon("saving")}
        >
          {tCommon("saveChanges")}
        </Button>
      </div>
    </form>
  );
}
