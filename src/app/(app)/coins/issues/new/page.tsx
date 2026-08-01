import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api/client";
import type { CoinTypeListResponseDto } from "@/lib/dto/coin-type.dto";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { CoinIssueForm } from "../coin-issue-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issue coins. Spec: design MODULES/04-coins §7
 *
 * The ACTIVE coin types are fetched here, on the server, and handed to the form
 * whole — not through `/api/coin-types/options`, which returns only `{ id,
 * label, hint }`. The form has to show coins, per-coin value, line amount and
 * remaining stock per row and recompute them on every keystroke; a picker that
 * returns three strings would force a fetch per selection to display arithmetic
 * the owner expects to be instant. There are a handful of coin types, so the
 * whole list is smaller than one round trip. §7.3
 */
export default async function NewCoinIssuePage() {
  const t = await getTranslations("coins.issues");

  const { rows: coinTypes } = await api.get<CoinTypeListResponseDto>(
    "/api/coin-types?status=active&pageSize=100",
  );

  return (
    <>
      <Link
        href="/coins/issues"
        className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("form.back")}
      </Link>

      <PageHeader title={t("form.title")} subtitle={t("form.subtitle")} />

      {coinTypes.length === 0 ? (
        // You cannot hand over a coin type that does not exist yet. Sending the
        // owner to the screen that creates one beats an empty picker he has to
        // work out for himself.
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <EmptyState
            icon="coin"
            title={t("form.noCoinTypes.title")}
            description={t("form.noCoinTypes.body")}
            action={
              <Button asChild>
                <Link href="/coins/types/new">
                  {t("form.noCoinTypes.cta")}
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <CoinIssueForm coinTypes={coinTypes} />
      )}
    </>
  );
}
