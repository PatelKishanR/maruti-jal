"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/empty-state";

/**
 * Spec: design MODULES/04-coins §11.4 error copy.
 *
 * Plain language, a retry, and no status codes — the detail is already in the
 * server log, correlated by the `x-request-id` the API stamped on the failed
 * response. "Nothing has been changed" is the sentence that matters: this
 * screen is a record of stock corrections, and a failure to READ one must never
 * read as one having been made.
 *
 * `reset()` re-renders the segment, which re-runs the fetch — a genuine retry
 * rather than a reload that would lose the filters in the URL.
 */
export default function CoinAdjustmentsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("coins.adjustments.error");

  return (
    <ErrorState
      title={t("title")}
      description={t("body")}
      retryLabel={t("cta")}
      onRetry={reset}
    />
  );
}
