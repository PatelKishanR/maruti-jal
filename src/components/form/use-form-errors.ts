"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/client";

/**
 * Routes SERVER field errors into the same display path as client-side ones.
 *
 * The API returns `fieldErrors` as message-catalogue KEYS, not sentences —
 * otherwise a Gujarati UI receives English validation errors. This hook
 * resolves them in the active language so one <FieldError> renders both
 * sources. Two error-display paths is how they drift.
 *
 * See .claude/ARCHITECTURE.md §5.2
 */
export function useFormErrors() {
  const t = useTranslations();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const resolve = useCallback(
    (key: string) => {
      // A key that isn't in the catalogue is shown verbatim rather than
      // swallowed — a visible odd string beats a silently blank field.
      try {
        return t.has(key) ? t(key) : key;
      } catch {
        return key;
      }
    },
    [t],
  );

  const clear = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
  }, []);

  const clearField = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** Returns true if it mapped field-level errors, false if it was general. */
  const handle = useCallback(
    (error: unknown): boolean => {
      if (error instanceof ApiError && error.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [field, keys] of Object.entries(error.fieldErrors)) {
          if (keys?.[0]) mapped[field] = resolve(keys[0]);
        }
        if (Object.keys(mapped).length > 0) {
          setFieldErrors(mapped);
          setFormError(null);
          return true;
        }
      }

      if (error instanceof ApiError) {
        setFormError(resolve(error.messageKey));
        return false;
      }

      setFormError(resolve("common.somethingWentWrong"));
      return false;
    },
    [resolve],
  );

  return { fieldErrors, formError, setFieldErrors, setFormError, handle, clear, clearField };
}
