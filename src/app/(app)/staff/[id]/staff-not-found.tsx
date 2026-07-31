import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { staffPaths } from "@/lib/api/routes.staff";

/**
 * A 404 that helps. Spec: §4.5
 *
 * Not `notFound()` from next/navigation: the global 404 says nothing about
 * staff and offers no way back into the list. A bad id is usually a stale
 * bookmark or a deleted record, and the useful next step is the list.
 */
export async function StaffNotFound() {
  const t = await getTranslations("staff");

  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <SearchX className="size-12 text-muted-foreground/60" aria-hidden />

      <h1 className="mt-4 text-h4 font-semibold text-foreground">
        {t("detail.notFound.title")}
      </h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        {t("detail.notFound.body")}
      </p>

      <Button asChild className="mt-4">
        <Link href={staffPaths.list}>{t("detail.notFound.cta")}</Link>
      </Button>
    </div>
  );
}

/**
 * Only a 404 renders the block above. Everything else rethrows to `error.tsx`,
 * because "we couldn't reach the server" and "this person doesn't exist" are
 * different problems with different fixes.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
