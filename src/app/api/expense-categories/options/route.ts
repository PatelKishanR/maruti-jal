import { createApiHandler } from "@/lib/api/handler";
import { expenseCategoryOptionsQuerySchema } from "@/lib/validation/expense-category";
import { listCategoryOptions } from "@/lib/services/expense-category.service";

export const runtime = "nodejs";

/**
 * GET /api/expense-categories/options — `ComboboxOption[]` for a picker.
 *
 * ACTIVE categories only. A switched-off category stays on the expenses that
 * already carry it but must never be selectable on a new one.
 * See MODULES/07-expenses.md §4.1
 *
 * `?q=` is what `EntityCombobox` appends, so this drops straight into the
 * expense form. The Expenses module (Wave 3) depends on this route.
 */
export const GET = createApiHandler({
  name: "GET /api/expense-categories/options",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: expenseCategoryOptionsQuerySchema,
  handler: ({ query }) => listCategoryOptions(query.q),
});
