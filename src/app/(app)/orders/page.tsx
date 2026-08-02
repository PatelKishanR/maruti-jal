import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard, KpiRow } from "@/components/common/kpi-card";
import { api } from "@/lib/api/client";
import type { DeliveryOrderListResponseDto } from "@/lib/dto/delivery-order.dto";
import { OrdersTable } from "./orders-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The register the business runs on.
 *
 * One round trip: the list response carries its own `summary`, so the KPI strip
 * and the table are never two queries out of step with each other.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("orders");
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string" && v) params.set(k, v);
  }

  const data = await api.get<DeliveryOrderListResponseDto>(
    `/api/orders${params.toString() ? `?${params}` : ""}`,
  );
  const s = data.summary;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Every figure is a door — each card lands on the list it describes. §1.4 */}
      <KpiRow className="mb-8">
        <KpiCard
          label={t("kpi.orders")}
          icon="order"
          value={s.orderCount}
          format="count"
          href="/orders"
          breakdown={
            s.cancelledCount > 0
              ? t("kpi.ordersBreakdown", { cancelled: s.cancelledCount })
              : undefined
          }
          zeroHint={t("kpi.noOrdersYet")}
        />
        <KpiCard
          label={t("kpi.billed")}
          icon="rupee"
          value={s.totalAmount}
          href="/orders"
          breakdown={t("kpi.collected", { amount: s.collectedAmount })}
          zeroHint={t("kpi.nothingBilled")}
        />
        <KpiCard
          label={t("kpi.outstanding")}
          icon="cash"
          value={s.outstandingAmount}
          href="/orders?payment=pending"
          variant={s.outstandingAmount > 0 ? "alert" : "default"}
          invertTrend
          breakdown={t("kpi.acrossOrders", { count: s.ordersWithMoneyPending })}
          zeroHint={t("kpi.allCollected")}
        />
        <KpiCard
          label={t("kpi.jarsOut")}
          icon="jarsOut"
          value={s.jarsOut}
          format="count"
          href="/orders?returns=pending"
          variant={s.jarsOut > 0 ? "alert" : "default"}
          breakdown={t("kpi.withStaff", { count: s.staffWithJarsOut })}
          zeroHint={t("kpi.allBack")}
        />
      </KpiRow>

      <OrdersTable data={data} />
    </>
  );
}
