"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/empty-state";

/**
 * Spec: design/MODULES/09-reports.md §4.4, §4.5
 *
 * The copy says the data is safe, because that is the owner's first question
 * and here the answer is unusually strong: REPORTS ONLY READ. Nothing on any
 * report screen writes, so a failure genuinely cannot have changed a record —
 * and saying so is more useful than a status code the owner cannot act on.
 *
 * `reset()` re-renders the segment, which re-runs the query with the filters
 * still in the URL. A page reload would work too and would lose them.
 */
export default function ReportsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("reports.error");

  return (
    <ErrorState
      title={t("title")}
      description={t("body")}
      retryLabel={t("cta")}
      onRetry={reset}
    />
  );
}
