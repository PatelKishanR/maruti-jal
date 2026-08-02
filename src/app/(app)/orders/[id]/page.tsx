import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { DetailSummary } from "@/components/common/detail-summary";
import { EmptyState } from "@/components/common/empty-state";
import { Money, Quantity } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/i18n/config";
import type { DeliveryOrderDetailDto } from "@/lib/dto/delivery-order.dto";
import { OrderStatusBadges } from "../order-badges";
import { OrderDetailTabs } from "./order-detail-tabs";
import { OrderActions } from "./order-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("orders.detail");
  const locale = (await getLocale()) as Locale;

  let order: DeliveryOrderDetailDto;
  try {
    order = await api.get<DeliveryOrderDetailDto>(`/api/orders/${id}`);
  } catch (error) {
    // A missing order is a normal outcome of a stale bookmark; anything else
    // is a real fault and belongs to the error boundary.
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          variant="no-data"
          icon="order"
          title={t("notFound.title")}
          description={t("notFound.body")}
          action={
            <Button asChild>
              <Link href="/orders">{t("notFound.cta")}</Link>
            </Button>
          }
        />
      );
    }
    throw error;
  }

  return (
    <>
      <Link
        href="/orders"
        className="mb-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
      >
        ‹ {t("back")}
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{order.code}</span>
            <OrderStatusBadges order={order} />
          </span>
        }
        subtitle={t("meta", {
          staff: order.staffName,
          date: formatDate(order.orderDate, locale),
        })}
        actions={<OrderActions order={order} />}
      />

      {order.status === "CANCELLED" && (
        <Alert variant="info" className="mb-6">
          {t("cancelledBanner")}
        </Alert>
      )}

      <DetailSummary
        className="mb-8"
        items={[
          { label: t("summary.billed"), value: <Money value={order.totalAmount} /> },
          {
            label: t("summary.collected"),
            value: <Money value={order.paidTotalAmount} />,
          },
          {
            label:
              order.outstandingAmount < 0
                ? t("summary.refundDue")
                : t("summary.outstanding"),
            value: (
              <Money
                value={order.dueAmount}
                emphasis
                variant={order.outstandingAmount < 0 ? "refund" : undefined}
              />
            ),
            emphasis: true,
          },
          {
            label: t("summary.jars"),
            value: (
              <span>
                <Quantity value={order.qtyPending} />
                <span className="text-muted-foreground">
                  {" "}
                  {t("summary.ofIssued", { total: order.qtyIssued })}
                </span>
              </span>
            ),
          },
        ]}
      />

      <OrderDetailTabs order={order} />
    </>
  );
}
