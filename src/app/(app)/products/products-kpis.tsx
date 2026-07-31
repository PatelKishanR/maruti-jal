"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Package,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { KpiCard, KpiRow } from "@/components/common/kpi-card";
import { Money } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { formatQuantity } from "@/lib/money";
import type {
  ProductCatalogueKpisDto,
  ProductLeaderDto,
} from "@/lib/dto/product.dto";

/**
 * The catalogue KPI strip. Spec: design/MODULES/02-products.md §3.3
 *
 * A client component so it can own its Lucide icons: a `LucideIcon` is a plain
 * function, and functions do not cross the server → client boundary.
 *
 * Cards 3 and 4 deliberately break the 28px-mono KPI rule. Their VALUE is a
 * product title — potentially long, potentially `૨૦ લિટર જાર` — so it renders at
 * 18px Inter 600 and wraps at line-height 1.4 rather than being clipped or
 * squeezed into a monospace face that has no Gujarati in it. The mono treatment
 * moves down to the breakdown figure, which is the number that matters.
 * Documented as an exception in the module design spec, not an oversight.
 */
export function ProductKpis({ kpis }: { kpis: ProductCatalogueKpisDto }) {
  const t = useTranslations("products.kpi");

  return (
    <KpiRow className="mb-6">
      <KpiCard
        icon="product"
        label={t("totalProducts")}
        value={kpis.totalProducts}
        format="count"
        href="/products?status=all"
        breakdown={
          kpis.inactiveProducts > 0
            ? t("deactivatedCount", { count: kpis.inactiveProducts })
            : undefined
        }
        zeroHint={t("noProductsYet")}
      />

      <KpiCard
        icon="active"
        label={t("active")}
        value={kpis.activeProducts}
        format="count"
        href="/products?status=active"
        breakdown={
          kpis.activeSharePercent === null
            ? undefined
            : t("percentOfCatalogue", { percent: kpis.activeSharePercent })
        }
        zeroHint={t("noneActive")}
      />

      <LeaderCard
        icon={TrendingUp}
        label={t("topByVolume")}
        leader={kpis.topByVolume}
        available={kpis.movementAvailable}
        pendingHint={t("movementPending")}
        breakdown={(leader) =>
          t("unitsInMonth", { units: formatQuantity(leader.figure) })
        }
      />

      <LeaderCard
        icon={Wallet}
        label={t("topByRevenue")}
        leader={kpis.topByRevenue}
        available={kpis.movementAvailable}
        pendingHint={t("movementPending")}
        breakdown={(leader) => (
          <>
            <Money value={leader.figure} compact zeroAs="value" />
            <span className="ml-1">{t("thisMonth")}</span>
          </>
        )}
      />
    </KpiRow>
  );
}

/**
 * A KPI card whose value is a NAME.
 *
 * Not a `KpiCard` variant because the shared component hard-codes 28px mono for
 * its value — correct for every other card in the app, wrong for exactly these
 * two. The shell (padding, radius, border, hover) is copied verbatim so the
 * four cards still read as one strip.
 */
function LeaderCard({
  icon: Icon,
  label,
  leader,
  available,
  pendingHint,
  breakdown,
}: {
  icon: LucideIcon;
  label: string;
  leader: ProductLeaderDto | null;
  available: boolean;
  pendingHint: string;
  breakdown: (leader: ProductLeaderDto) => React.ReactNode;
}) {
  const shell = cn(
    "block rounded-lg border border-border bg-card p-5 text-left shadow-sm",
    "transition-colors duration-100",
  );

  const body = (
    <>
      <p className="flex items-center gap-1 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </p>

      {/* 18px Inter 600, wrapping to two lines — never truncated, because a
          clipped Gujarati title loses its matras and becomes unreadable. */}
      <p
        className={cn(
          "mt-2 text-h4 font-semibold leading-[1.4]",
          leader ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {leader ? leader.title : "—"}
      </p>

      <p className="mt-1 flex flex-wrap items-baseline text-caption text-muted-foreground">
        {leader ? breakdown(leader) : available ? null : pendingHint}
      </p>
    </>
  );

  // Nothing to open until orders exist; a card that navigates nowhere would
  // tell the owner something is wrong without telling them where.
  if (!leader) return <div className={shell}>{body}</div>;

  return (
    <Link
      href={`/products/${leader.productId}`}
      className={cn(shell, "cursor-pointer hover:border-primary/40")}
    >
      {body}
    </Link>
  );
}
