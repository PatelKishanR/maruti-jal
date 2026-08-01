import { createApiHandler } from "@/lib/api/handler";
import {
  expenseIdParamsSchema,
  updateExpenseSchema,
} from "@/lib/validation/expense";
import {
  deleteExpense,
  getExpense,
  updateExpense,
} from "@/lib/services/expense.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/expenses/[id] — one expense, its receipt and its activity rail.
 *
 * Returns SOFT-DELETED rows too. The detail page has to render a deleted
 * expense behind a grey banner with a `Restore` button; 404-ing it would make
 * the undo path unreachable from a link someone already had.
 */
export const GET = createApiHandler({
  name: "GET /api/expenses/[id]",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: expenseIdParamsSchema,
  handler: ({ params }) => getExpense(params.id),
});

/**
 * PATCH /api/expenses/[id] — edit any field, or attach a receipt on its own.
 *
 * Every field is optional: the edit form sends the whole record, but a targeted
 * PATCH of just `receiptUrl` is equally valid and must not be forced to resend
 * an amount it never touched.
 */
export const PATCH = createApiHandler({
  name: "PATCH /api/expenses/[id]",
  roles: ["OWNER", "ADMIN"],
  params: expenseIdParamsSchema,
  body: updateExpenseSchema,
  handler: ({ params, body, ctx }) => updateExpense(ctx.userId, params.id, body),
});

/**
 * DELETE /api/expenses/[id] — SOFT deletes.
 *
 * The row stays and stays restorable; it simply stops counting towards the
 * month's profit. Nothing transactional in this app is ever hard-deleted, and
 * an expense the owner removed by mistake is a figure he would otherwise have
 * to re-key from a paper bill. `POST …/restore` is the undo.
 * See .claude/DATA-MODEL.md §4
 */
export const DELETE = createApiHandler({
  name: "DELETE /api/expenses/[id]",
  roles: ["OWNER", "ADMIN"],
  params: expenseIdParamsSchema,
  handler: ({ params, ctx }) => deleteExpense(ctx.userId, params.id),
});
