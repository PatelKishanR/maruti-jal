import { createApiHandler } from "@/lib/api/handler";
import { expenseIdParamsSchema } from "@/lib/validation/expense";
import { restoreExpense } from "@/lib/services/expense.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/expenses/[id]/restore — puts a deleted expense back.
 *
 * The counterpart to `DELETE …/[id]`, mirroring `POST …/reactivate` on the
 * master modules. Two designed affordances need it: the 8-second `Undo` on the
 * delete toast (§3.4) and the `Restore` button on a deleted expense's detail
 * page (§5.4). A delete with no undo is why owners stop trusting the ⋯ menu.
 *
 * Idempotent — restoring a live expense is a no-op, so a double-clicked Undo
 * returns the record rather than an error toast.
 */
export const POST = createApiHandler({
  name: "POST /api/expenses/[id]/restore",
  roles: ["OWNER", "ADMIN"],
  params: expenseIdParamsSchema,
  handler: ({ params, ctx }) => restoreExpense(ctx.userId, params.id),
});
