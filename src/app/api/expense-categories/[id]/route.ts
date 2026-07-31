import { createApiHandler } from "@/lib/api/handler";
import {
  expenseCategoryParamsSchema,
  updateExpenseCategorySchema,
} from "@/lib/validation/expense-category";
import {
  deactivateCategory,
  updateCategory,
} from "@/lib/services/expense-category.service";

export const runtime = "nodejs";

/** PATCH /api/expense-categories/[id] — rename, switch on/off, reposition. */
export const PATCH = createApiHandler({
  name: "PATCH /api/expense-categories/[id]",
  roles: ["OWNER", "ADMIN"],
  params: expenseCategoryParamsSchema,
  body: updateExpenseCategorySchema,
  handler: ({ params, body, ctx }) =>
    updateCategory(ctx.userId, params.id, body),
});

/**
 * DELETE /api/expense-categories/[id] — switches the category OFF.
 *
 * Deliberately not a delete. A category in use cannot be removed: it would
 * silently rewrite a past month's profit breakdown. The verb is DELETE because
 * that is what the row's menu means to the owner; the effect is deactivation,
 * and `POST …/reactivate` undoes it. See MODULES/07-expenses.md §6
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/expense-categories/[id]",
  roles: ["OWNER", "ADMIN"],
  params: expenseCategoryParamsSchema,
  handler: ({ params, ctx }) => deactivateCategory(ctx.userId, params.id),
});
