import { createApiHandler } from "@/lib/api/handler";
import { expenseOptionsQuerySchema } from "@/lib/validation/expense";
import { listExpenseOptions } from "@/lib/services/expense.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/expenses/options?q= — `ComboboxOption[]` for any expense picker.
 *
 * Every module ships one (MODULE-RECIPE §5); `expenseOptionsQuerySchema` was
 * written for this route. Payments and reports will point `EntityCombobox`
 * here, so the label (`EXP-000148`) and the hint (`₹4,850.00 · Shakti
 * Petroleum`) are decided once rather than per caller.
 *
 * A static segment, so it is matched before `[id]` — `/options` is not a uuid
 * and would 422 there anyway, but the ordering is what makes it never try.
 */
export const GET = createApiHandler({
  name: "GET /api/expenses/options",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: expenseOptionsQuerySchema,
  handler: ({ query }) => listExpenseOptions(query.q),
});
