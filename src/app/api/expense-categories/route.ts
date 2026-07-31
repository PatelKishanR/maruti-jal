import { createApiHandler } from "@/lib/api/handler";
import {
  createExpenseCategorySchema,
  listExpenseCategoriesQuerySchema,
} from "@/lib/validation/expense-category";
import {
  createCategory,
  listCategories,
} from "@/lib/services/expense-category.service";

export const runtime = "nodejs";

/**
 * GET /api/expense-categories — the whole list, switched-off rows included.
 *
 * Readable by every role: a VIEWER reading an expense report needs the same
 * vocabulary as the owner who wrote it.
 */
export const GET = createApiHandler({
  name: "GET /api/expense-categories",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: listExpenseCategoriesQuerySchema,
  handler: ({ query }) => listCategories(query),
});

/** POST /api/expense-categories — add one. Master data, so OWNER/ADMIN only. */
export const POST = createApiHandler({
  name: "POST /api/expense-categories",
  roles: ["OWNER", "ADMIN"],
  body: createExpenseCategorySchema,
  status: 201,
  handler: ({ body, ctx }) => createCategory(ctx.userId, body),
});
