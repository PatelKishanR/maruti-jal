import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { CoinTypeForm } from "../coin-type-form";

export const runtime = "nodejs";

/** Spec: design MODULES/04-coins §4 */
export default async function NewCoinTypePage() {
  const t = await getTranslations("coins.types");

  return (
    <>
      <Link
        href="/coins/types"
        className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("form.back")}
      </Link>

      <PageHeader title={t("form.newTitle")} subtitle={t("form.newSubtitle")} />

      <CoinTypeForm />
    </>
  );
}
