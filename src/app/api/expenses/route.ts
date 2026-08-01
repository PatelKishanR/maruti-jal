import { createApiHandler } from "@/lib/api/handler";
import {
  createExpenseSchema,
  expenseListQuerySchema,
} from "@/lib/validation/expense";
import { createExpense, listExpenses } from "@/lib/services/expense.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/expenses — the month's register, its foot total, the KPI strip and
 * the category chips, in one response.
 *
 * Readable by every role: a VIEWER reading a profit figure needs the outgoings
 * behind it, and the list is the only place they are legible.
 *
 * `month` is deliberately absent from the query defaults — the default is "the
 * current month in IST", a figure only the server can compute honestly, so the
 * service fills it in and returns the month it chose.
 */
export const GET = createApiHandler({
  name: "GET /api/expenses",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: expenseListQuerySchema,
  handler: ({ query }) => listExpenses(query),
});

/**
 * POST /api/expenses — record one payment out.
 *
 * OWNER/ADMIN only. A manager raises orders against the business; what the
 * business spends is not his to write.
 */
export const POST = createApiHandler({
  name: "POST /api/expenses",
  roles: ["OWNER", "ADMIN"],
  body: createExpenseSchema,
  status: 201,
  handler: ({ body, ctx }) => createExpense(ctx.userId, body),
});
