import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { api } from "@/lib/api/client";
import type { DeliveryOrderDetailDto } from "@/lib/dto/delivery-order.dto";
import { OrderForm } from "../../order-form";
import { toFormValues } from "../../order-form-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("orders.edit");
  const order = await api.get<DeliveryOrderDetailDto>(`/api/orders/${id}`);

  return (
    <>
      <PageHeader
        title={t("title", { code: order.code })}
        subtitle={
          order.hasReturns || order.hasPayments
            ? t("subtitleWithHistory")
            : t("subtitle")
        }
      />
      <OrderForm mode="edit" orderId={order.id} initial={toFormValues(order)} />
    </>
  );
}
