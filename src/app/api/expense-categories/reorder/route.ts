import { createApiHandler } from "@/lib/api/handler";
import { reorderSchema } from "@/lib/validation/expense-category";
import { reorderCategories } from "@/lib/services/expense-category.service";

export const runtime = "nodejs";

/**
 * POST /api/expense-categories/reorder — the whole new order in one call.
 *
 * The service runs it inside a single transaction: a partial reorder would
 * leave the list in an order nobody chose, neither the old one nor the new.
 * See .claude/ARCHITECTURE.md §4.3
 *
 * A static segment, so it never collides with `[id]` — Next.js resolves
 * literal paths before dynamic ones.
 */
export const POST = createApiHandler({
  name: "POST /api/expense-categories/reorder",
  roles: ["OWNER", "ADMIN"],
  body: reorderSchema,
  handler: ({ body, ctx }) => reorderCategories(ctx.userId, body.ids),
});
