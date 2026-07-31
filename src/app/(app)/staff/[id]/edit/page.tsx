import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api/client";
import { staffPaths, staffRoutes } from "@/lib/api/routes.staff";
import { formatDateTime } from "@/lib/dates";
import type { Locale } from "@/i18n/config";
import type { StaffDetailDto } from "@/lib/dto/staff.dto";
import { StaffForm } from "../../staff-form";
import { isNotFound, StaffNotFound } from "../staff-not-found";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Edit staff. Spec: design/MODULES/01-staff.md §6
 *
 * Same form component as `/staff/new`; only the back link, the meta line and
 * the Status section differ. The back link goes to the RECORD, not the list —
 * the owner came from there and expects to land back on it.
 */
export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("staff");
  const locale = (await getLocale()) as Locale;

  let staff: StaffDetailDto;
  try {
    staff = await api.get<StaffDetailDto>(staffRoutes.detail(id));
  } catch (error) {
    if (isNotFound(error)) return <StaffNotFound />;
    throw error;
  }

  return (
    <>
      <Link
        href={staffPaths.detail(staff.id)}
        className="mb-2 inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {staff.name}
      </Link>

      <div className="mb-6">
        <h1 className="text-h2 font-semibold text-foreground">
          {t("edit.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono text-[13px]">{staff.code}</span>
          {" · "}
          {/* Formatted in IST from the timestamp — slicing the ISO string
              would report the UTC day and drift for anything after 6:30pm. */}
          {t("edit.created", {
            date: formatDateTime(staff.createdAt, locale),
          })}
        </p>
      </div>

      <StaffForm staff={staff} />
    </>
  );
}
