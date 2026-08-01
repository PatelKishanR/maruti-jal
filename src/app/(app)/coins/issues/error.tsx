"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/empty-state";

/**
 * Spec: design MODULES/04-coins §6.4 error copy.
 *
 * Plain language, a retry, and NO status codes or stack traces — the owner
 * cannot act on "500 TypeError", and showing it makes a recoverable blip look
 * like data loss. The detail is already in the server log, correlated by the
 * `x-request-id` the API stamped on the failed response.
 *
 * "Nothing has been changed" is the sentence that matters on a money screen.
 *
 * `reset()` re-renders the segment, which re-runs the fetch: a genuine retry
 * rather than a full page reload that would lose the filters in the URL.
 */
export default function CoinIssuesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("coins.issues.error");

  return (
    <ErrorState
      title={t("title")}
      description={t("body")}
      retryLabel={t("cta")}
      onRetry={reset}
    />
  );
}
