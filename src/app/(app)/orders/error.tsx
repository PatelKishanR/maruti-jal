"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/empty-state";

export default function OrdersError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("orders.error");
  return (
    <ErrorState title={t("listTitle")} description={t("listBody")} onRetry={reset} />
  );
}
