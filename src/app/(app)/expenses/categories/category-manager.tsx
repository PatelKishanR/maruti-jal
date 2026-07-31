"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Receipt } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { LookupInputError, LookupManager } from "@/components/common/lookup-manager";
import { api, ApiError } from "@/lib/api/client";
import {
  expenseCategoryRoutes,
  type ExpenseCategoryDto,
} from "@/lib/dto/expense-category.dto";
import { CATEGORY_NAME_MAX_LENGTH } from "@/lib/validation/expense-category";

/**
 * Expense category management. Spec: design/MODULES/07-expenses.md §6
 *
 * All of the list behaviour lives in `LookupManager` — this file is the module's
 * half: the four API calls, the copy, and the mapping from server error keys to
 * sentences. Product tags and filter types will look almost identical.
 *
 * Talks to the API only. No service, no repository, no database import.
 * See .claude/ARCHITECTURE.md §4
 */
export function CategoryManager({
  initialItems,
  canEdit,
  initialError = false,
}: {
  initialItems: ExpenseCategoryDto[];
  /** OWNER and ADMIN edit; everyone else reads. DESIGN §6.5 read-only row. */
  canEdit: boolean;
  initialError?: boolean;
}) {
  const t = useTranslations("expenseCategories");
  const router = useRouter();

  const [items, setItems] = React.useState(initialItems);
  const [loading, setLoading] = React.useState(false);
  const [failedToLoad, setFailedToLoad] = React.useState(initialError);

  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  /**
   * Server messages are catalogue KEYS, resolved here in the active language —
   * so they render through the same inline strip as client-side ones. One
   * error path, not two. See .claude/I18N.md §5.4
   */
  function resolve(key: string | undefined, name: string): string | null {
    switch (key) {
      case "expenseCategories.errors.duplicate":
        return t("errors.duplicate", { name });
      case "expenseCategories.errors.nameRequired":
        return t("errors.nameRequired");
      case "expenseCategories.errors.nameTooLong":
        return t("errors.nameTooLong", { max: CATEGORY_NAME_MAX_LENGTH });
      default:
        return null;
    }
  }

  /**
   * A 409 or a 422 about the name belongs under the input; anything else is an
   * infrastructure failure and `LookupManager` rolls the row back and toasts.
   */
  function asInputError(e: unknown, name: string): unknown {
    if (!(e instanceof ApiError)) return e;
    const message =
      resolve(e.messageKey, name) ?? resolve(e.fieldErrors?.name?.[0], name);
    return message ? new LookupInputError(message) : e;
  }

  async function refetch() {
    setLoading(true);
    try {
      setItems(await api.get<ExpenseCategoryDto[]>(expenseCategoryRoutes.list()));
      setFailedToLoad(false);
    } catch {
      setFailedToLoad(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LookupManager<ExpenseCategoryDto>
      items={items}
      readOnly={!canEdit}
      loading={loading}
      error={failedToLoad}
      onRetry={() => void refetch()}
      maxNameLength={CATEGORY_NAME_MAX_LENGTH}
      emptyIcon={Receipt}
      labels={{
        addLabel: t("addLabel"),
        addPlaceholder: t("addPlaceholder"),
        emptyTitle: t("empty.title"),
        emptyDescription: t("empty.description"),
        errorTitle: t("error.title"),
        errorDescription: t("error.description"),
      }}
      renderSummary={({ total, active }) => t("summary", { total, active })}
      confirmDeactivate={(item) => ({
        title: t("deactivate.title", { name: item.name }),
        description: t("deactivate.description", { name: item.name }),
        confirmLabel: t("deactivate.confirm"),
      })}
      onCreate={async (name) => {
        try {
          const created = await api.post<ExpenseCategoryDto>(
            expenseCategoryRoutes.create,
            { name },
          );
          toast.success(t("toasts.added", { name: created.name }));
          router.refresh();
          return created;
        } catch (e) {
          throw asInputError(e, name);
        }
      }}
      onRename={async (id, name) => {
        try {
          const saved = await api.patch<ExpenseCategoryDto>(
            expenseCategoryRoutes.byId(id),
            { name },
          );
          toast.success(t("toasts.renamed", { name: saved.name }));
          router.refresh();
          return saved;
        } catch (e) {
          throw asInputError(e, name);
        }
      }}
      onToggleActive={async (id, isActive) => {
        // DELETE switches off, POST …/reactivate switches back on — the verbs
        // the API exposes, rather than a boolean flag on PATCH.
        const saved = isActive
          ? await api.post<ExpenseCategoryDto>(expenseCategoryRoutes.reactivate(id))
          : await api.del<ExpenseCategoryDto>(expenseCategoryRoutes.byId(id));

        toast.success(
          isActive
            ? t("toasts.switchedOn", { name: saved.name })
            : t("toasts.switchedOff", { name: saved.name }),
        );
        router.refresh();
        return saved;
      }}
      onReorder={async (ids) => {
        await api.post<ExpenseCategoryDto[]>(expenseCategoryRoutes.reorder, { ids });
        router.refresh();
      }}
    />
  );
}
