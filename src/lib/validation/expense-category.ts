import { z } from "zod";

/**
 * Expense category validation.
 *
 * Shared between the client and the API route. Imports nothing server-side, so
 * it is safe in both places.
 *
 * Messages are CATALOGUE KEYS, never sentences — the form layer resolves them
 * through the active language. See .claude/I18N.md §5.4
 */

/** Design spec: `Category name can't be longer than 40 characters`. */
export const CATEGORY_NAME_MAX_LENGTH = 40;

/** `sort_order` is a smallint. */
const SORT_ORDER_MAX = 32_767;

/**
 * Length only — NO character-class restriction.
 *
 * A `[A-Za-z]` pattern here would silently reject `પ્લાન્ટ મેઇન્ટેનન્સ` and
 * present to the owner as "the app won't let me save". See .claude/I18N.md §3.1
 */
export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, { message: "expenseCategories.errors.nameRequired" })
  .max(CATEGORY_NAME_MAX_LENGTH, {
    message: "expenseCategories.errors.nameTooLong",
  });

export const createExpenseCategorySchema = z.object({
  name: categoryNameSchema,
});

export type CreateExpenseCategoryInput = z.infer<
  typeof createExpenseCategorySchema
>;

/**
 * Rename and switch on/off share one route, so both fields are optional — but
 * a PATCH that changes nothing is a client bug, not a no-op to swallow.
 */
export const updateExpenseCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(SORT_ORDER_MAX).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined || v.isActive !== undefined || v.sortOrder !== undefined,
    { message: "common.invalidRequest", path: ["name"] },
  );

export type UpdateExpenseCategoryInput = z.infer<
  typeof updateExpenseCategorySchema
>;

/**
 * The whole new order in one request.
 *
 * Sending deltas would let two partial writes interleave into an order nobody
 * chose; sending the full list makes the service's job a single transactional
 * rewrite. See .claude/ARCHITECTURE.md §4.3
 */
export const reorderSchema = z.object({
  ids: z
    .array(z.string().uuid({ message: "common.invalidRequest" }))
    .min(1, { message: "common.invalidRequest" })
    // The table lives in the low tens of rows; a 500-element payload is an
    // attack or a bug either way.
    .max(200, { message: "common.invalidRequest" })
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "common.invalidRequest",
    }),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

/** `/api/expense-categories/[id]` — a segment is user input like any other. */
export const expenseCategoryParamsSchema = z.object({
  id: z.string().uuid({ message: "common.notFound" }),
});

/** `GET /api/expense-categories?status=` */
export const listExpenseCategoriesQuerySchema = z.object({
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export type ListExpenseCategoriesQuery = z.infer<
  typeof listExpenseCategoriesQuerySchema
>;

/**
 * `GET /api/expense-categories/options?q=`
 *
 * `q` is what `EntityCombobox` appends, so the name matches the component
 * rather than the module.
 */
export const expenseCategoryOptionsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
});

export type ExpenseCategoryOptionsQuery = z.infer<
  typeof expenseCategoryOptionsQuerySchema
>;
