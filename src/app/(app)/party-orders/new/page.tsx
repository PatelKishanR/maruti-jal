import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { api } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import { partyOrderPaths } from "@/lib/api/routes.party-order";
import { todayIST } from "@/lib/dates";
import type { ProductListResponseDto } from "@/lib/dto/product.dto";
import type { PartyProductRef } from "../day-items-editor";
import { blankAdvance, blankDetails } from "../schedule-model";
import { BookingWizard } from "./booking-wizard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The booking wizard's shell. Spec: design/MODULES/05-party-orders.md §4
 *
 * Fetches through the API like every other screen — no service import, no
 * repository, no DataSource. See .claude/ARCHITECTURE.md §4
 *
 * The blank booking is built HERE, on the server, from `schedule-model.ts` —
 * which is a plain module for exactly this reason: a server component may not
 * call an export of a `"use client"` file. See .claude/MODULE-RECIPE.md §7
 *
 * The catalogue read exists to give the line-item table its BASE prices, which
 * the picker endpoint deliberately does not carry (it returns a display hint,
 * not a figure). If it fails the wizard still works — the base column shows an
 * em dash and nothing is flagged as an override. §8.5
 */
export default async function NewPartyOrderPage() {
  const t = await getTranslations("partyOrders");

  let products: PartyProductRef[] = [];
  try {
    const catalogue = await api.get<ProductListResponseDto>(
      `${apiRoutes.products.list}?pageSize=100`,
    );
    products = catalogue.result.rows.map((product) => ({
      id: product.id,
      title: product.title,
      basePrice: product.basePrice,
    }));
  } catch {
    // Degrade, never block: a booking can be entered with hand-typed rates.
    products = [];
  }

  const today = todayIST();

  return (
    <>
      <Link
        href={partyOrderPaths.list}
        className="inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>

      <PageHeader title={t("wizard.title")} subtitle={t("wizard.subtitle")} />

      <BookingWizard
        initialDetails={blankDetails()}
        // An empty schedule, deliberately: the owner adds the first day with
        // whichever of the three tools suits the booking. §5.7
        initialDays={[]}
        initialAdvance={blankAdvance(today)}
        products={products}
      />
    </>
  );
}
