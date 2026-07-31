import { getTranslations } from "next-intl/server";
import { api } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import { expenseCategoryRoutes, type ExpenseCategoryDto } from "@/lib/dto/expense-category.dto";
import type { UserDto } from "@/lib/dto/user.dto";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { CategoryManager } from "./category-manager";

export const runtime = "nodejs";

/**
 * Expense categories. Spec: design/MODULES/07-expenses.md §6
 *
 * Ten-ish rows the owner owns. Renaming takes one click, and a category can
 * only ever be switched off — deleting one would silently rewrite a past
 * month's profit breakdown.
 *
 * Fetches through the API like every other screen, forwarding the request
 * cookies. See .claude/ARCHITECTURE.md §4, §5.3
 */
export default async function ExpenseCategoriesPage() {
  const t = await getTranslations("expenseCategories");

  const user = await api.get<UserDto>(apiRoutes.account.me);

  /**
   * A failed list must not blow up the whole page: the header still renders and
   * the manager shows its own error state with `Try again`, which re-fetches
   * client-side. §5.6
   */
  const categories = await api
    .get<ExpenseCategoryDto[]>(expenseCategoryRoutes.list())
    .catch(() => null);

  const canEdit = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="max-w-[720px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card className="overflow-hidden">
        <CategoryManager
          initialItems={categories ?? []}
          initialError={categories === null}
          canEdit={canEdit}
        />
      </Card>

      <p className="mt-3 text-caption text-muted-foreground">{t("footnote")}</p>
    </div>
  );
}
