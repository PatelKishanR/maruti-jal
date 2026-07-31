"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FieldHint } from "@/components/ui/field-error";
import { updateProfileAction } from "./actions";

export function ProfileForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");

  const [values, setValues] = useState({
    name: initialName,
    email: initialEmail,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty =
    values.name !== initialName || values.email !== initialEmail;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setBanner(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateProfileAction(values);

      if (result.ok) {
        setSaved(true);
        return;
      }

      if (result.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [field, keys] of Object.entries(result.fieldErrors)) {
          // Server errors are catalogue KEYS, resolved in the active language —
          // so they render through the same FieldError as client-side ones.
          if (keys?.[0]) mapped[field] = tCommon.has(keys[0]) ? tCommon(keys[0]) : keys[0];
        }
        setErrors(mapped);
        return;
      }

      setBanner(tCommon("somethingWentWrong"));
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
