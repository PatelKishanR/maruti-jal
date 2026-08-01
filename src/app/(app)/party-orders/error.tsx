"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/empty-state";

/**
 * Spec: design/MODULES/05-party-orders.md §3.5, §7.5
 *
 * Plain language, a retry, and NO status codes or stack traces — the owner
 * cannot act on "500 TypeError", and showing it makes a recoverable blip look
 * like data loss. The detail is already in the server log, correlated by the
 * `x-request-id` the API stamped on the failed response.
 *
 * `reset()` re-renders the segment, which re-runs the fetch: a genuine retry
 * rather than a reload that would lose the filters in the URL.
 */
export default function PartyOrdersError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("partyOrders.error");

  return (
    <ErrorState
      title={t("listTitle")}
      description={t("listBody")}
      retryLabel={t("retry")}
      onRetry={reset}
    />
  );
}
