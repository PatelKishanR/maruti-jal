import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import type { CoinTypeDetailDto } from "@/lib/dto/coin-type.dto";
import { PageHeader } from "@/components/common/page-header";
import { CoinTypeForm } from "../../coin-type-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Spec: design MODULES/04-coins §4, edit mode. */
export default async function EditCoinTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("coins.types");

  let coinType: CoinTypeDetailDto;
  try {
    coinType = await api.get<CoinTypeDetailDto>(`/api/coin-types/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <Link
        href={`/coins/types/${coinType.id}`}
        className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {coinType.name}
      </Link>

      <PageHeader
        title={t("form.editTitle", { name: coinType.name })}
        subtitle={t("form.editSubtitle")}
      />

      <CoinTypeForm coinType={coinType} />
    </>
  );
}
