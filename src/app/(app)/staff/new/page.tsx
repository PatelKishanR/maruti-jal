import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { staffPaths } from "@/lib/api/routes.staff";
import { StaffForm } from "../staff-form";

export const runtime = "nodejs";

/**
 * Add staff. Spec: design/MODULES/01-staff.md §5
 *
 * No skeleton and no fetch — there is nothing to load, so the form renders
 * instantly with the cursor already in the name field.
 */
export default async function NewStaffPage() {
  const t = await getTranslations("staff");

  return (
    <>
      <Link
        href={staffPaths.list}
        className="mb-2 inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>

      <PageHeader title={t("new.title")} subtitle={t("new.subtitle")} />

      <StaffForm />
    </>
  );
}
