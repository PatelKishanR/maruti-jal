"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/empty-state";

/**
 * Spec: §3.5 error state.
 *
 * Plain language, a retry, and NO status codes or stack traces — the owner
 * cannot act on "500 TypeError", and showing it makes a recoverable blip look
 * like data loss. The detail is already in the server log, correlated by the
 * `x-request-id` the API stamped on the failed response.
 *
 * `reset()` re-renders the segment, which re-runs the fetch: a genuine retry
 * rather than a full page reload that would lose the filters in the URL.
 */
export default function StaffError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("staff");

  return (
    <ErrorState
      title={t("list.error.title")}
      description={t("list.error.body")}
      retryLabel={t("list.error.cta")}
      onRetry={reset}
    />
  );
}
