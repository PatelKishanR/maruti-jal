import { createApiHandler } from "@/lib/api/handler";
import { expenseCategoryParamsSchema } from "@/lib/validation/expense-category";
import { reactivateCategory } from "@/lib/services/expense-category.service";

export const runtime = "nodejs";

/**
 * POST /api/expense-categories/[id]/reactivate — put it back in the dropdown.
 *
 * Its own route rather than a PATCH flag, so "switch this back on" is one
 * unambiguous call the audit log can name.
 */
export const POST = createApiHandler({
  name: "POST /api/expense-categories/[id]/reactivate",
  roles: ["OWNER", "ADMIN"],
  params: expenseCategoryParamsSchema,
  handler: ({ params, ctx }) => reactivateCategory(ctx.userId, params.id),
});
