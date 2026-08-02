import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { todayIST } from "@/lib/dates";
import { OrderForm } from "../order-form";
import { blankOrder } from "../order-form-model";

export const runtime = "nodejs";

export default async function NewOrderPage() {
  const t = await getTranslations("orders.create");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {/* blankOrder lives in a plain .ts module — a server component may not
          call an export of a "use client" file. */}
      <OrderForm mode="create" initial={blankOrder(todayIST())} />
    </>
  );
}
