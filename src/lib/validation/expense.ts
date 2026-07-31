import { z } from "zod";
import { EXPENSE_PAYMENT_MODES } from "@/lib/db/entities/enums";
import { isBusinessDate, todayIST } from "@/lib/dates";

/**
 * Expense validation — shared by the client form and the API routes.
 *
 * Imports nothing server-side (`enums.ts` has no imports at all and
 * `lib/dates.ts` only touches `Intl`), so the same schema runs in both places
 * and the two can never drift. See .claude/ARCHITECTURE.md §7
 *
 * **No character-class restriction on `paidTo` or `note`.** A `[A-Za-z]`
 * pattern here would silently reject `રમેશ પટેલ` and surface to the owner as
 * "the app won't let me save". Length is the only limit.
 * See .claude/I18N.md §3.1
 *
 * Messages are CATALOGUE KEYS, not sentences — a Gujarati UI must not receive
 * English validation errors. See .claude/I18N.md §5.4
 */

/** numeric(12,2). Anything above this is a typo, not an expense. */
const AMOUNT_MAX = 9_999_999_999.99;

/** `Vendor or person` — a shop name, not an essay. */
const PAID_TO_MAX = 120;

/** Design §4.4: `Note can't be longer than 500 characters`. */
const NOTE_MAX = 500;

/**
 * A stored object key or a signed URL, whichever the (still unchosen) storage
 * provider hands back. Deliberately NOT `.url()` — an S3 key is not a URL, and
 * refusing one would bake today's missing decision into the schema.
 */
const RECEIPT_URL_MAX = 2048;

/** `YYYY-MM` — the month the list is framed by. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** How many digits sit after the decimal point, without float arithmetic. */
function decimalPlaces(value: number): number {
  const text = String(value);
  // 1e-7 and friends: exponent form always means more precision than we allow.
  if (text.includes("e") || text.includes("E")) return Number.MAX_SAFE_INTEGER;
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * A blank amount is ABSENT, not zero.
 *
 * `z.coerce.number()` would turn `""` into `0`, so an untouched Amount box
 * would report "must be more than ₹0.00" instead of "enter an amount" — and,
 * worse, a cleared field would sail past a `>= 0` check. Junk text is passed
 * through unchanged so `z.number()` reports it as the wrong TYPE rather than
 * as a missing value.
 */
function blankToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Field schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A business date, `'YYYY-MM-DD'`, never in the future.
 *
 * `todayIST()` is called INSIDE the refine rather than captured at module load:
 * a schema evaluated once at boot would freeze "today" at whatever day the
 * server started, and reject every entry made after midnight.
 */
export const expenseDateSchema = z
  .string({ message: "expenses.errors.dateRequired" })
  .trim()
  .refine((v) => isBusinessDate(v), { message: "expenses.errors.dateRequired" })
  .refine((v) => v <= todayIST(), { message: "expenses.errors.dateFuture" });

/**
 * Greater than zero, mirroring the `chk_expenses_amount_positive` CHECK in the
 * database. Both exist on purpose: this one produces a field error the form can
 * point at, the constraint stops anything that never came through this schema.
 */
export const expenseAmountSchema = z.preprocess(
  blankToUndefined,
  z
    .number({
      required_error: "expenses.errors.amountRequired",
      invalid_type_error: "expenses.errors.amountInvalid",
    })
    .refine((v) => Number.isFinite(v), {
      message: "expenses.errors.amountInvalid",
    })
    .refine((v) => v > 0, { message: "expenses.errors.amountPositive" })
    .refine((v) => v <= AMOUNT_MAX, {
      message: "expenses.errors.amountTooLarge",
    })
    .refine((v) => decimalPlaces(v) <= 2, {
      message: "expenses.errors.amountDecimals",
    }),
);

export const expenseCategoryIdSchema = z
  .string({ message: "expenses.errors.categoryRequired" })
  .trim()
  .uuid({ message: "expenses.errors.categoryRequired" });

export const expensePaymentModeSchema = z.enum(EXPENSE_PAYMENT_MODES, {
  message: "expenses.errors.paymentModeRequired",
});

/** Any script. Length is the only limit — see the file header. */
export const expensePaidToSchema = z
  .string()
  .trim()
  .max(PAID_TO_MAX, { message: "expenses.errors.paidToTooLong" })
  // An empty box is "no payee recorded", not an empty string in the column.
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const expenseNoteSchema = z
  .string()
  .trim()
  .max(NOTE_MAX, { message: "expenses.errors.noteTooLong" })
  .transform((v) => (v === "" ? null : v))
  .nullable();

/** Optional link for salary, advances and reimbursements. */
export const expenseStaffIdSchema = z
  .string()
  .trim()
  .uuid({ message: "expenses.errors.staffInvalid" })
  .nullable();

export const expenseReceiptUrlSchema = z
  .string()
  .trim()
  .max(RECEIPT_URL_MAX, { message: "expenses.errors.receiptUrlTooLong" })
  .transform((v) => (v === "" ? null : v))
  .nullable();

// ─────────────────────────────────────────────────────────────────────────────
// Write schemas
// ─────────────────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  expenseDate: expenseDateSchema,
  categoryId: expenseCategoryIdSchema,
  amount: expenseAmountSchema,
  paymentMode: expensePaymentModeSchema,
  paidTo: expensePaidToSchema.optional().default(null),
  staffId: expenseStaffIdSchema.optional().default(null),
  note: expenseNoteSchema.optional().default(null),
  /**
   * TODO: no file-storage provider is configured yet (S3 / R2 / UploadThing is
   * an unmade infrastructure decision), so this arrives as a string the caller
   * already holds. The dropzone is fully built and says so out loud rather than
   * swallowing the file. See design/MODULES/07-expenses.md §4.3
   */
  receiptUrl: expenseReceiptUrlSchema.optional().default(null),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * Every field optional: the edit form sends the whole record, but a targeted
 * PATCH (just `receiptUrl`, say) is equally valid and must not be forced to
 * resend an amount it never touched.
 */
export const updateExpenseSchema = z
  .object({
    expenseDate: expenseDateSchema.optional(),
    categoryId: expenseCategoryIdSchema.optional(),
    amount: expenseAmountSchema.optional(),
    paymentMode: expensePaymentModeSchema.optional(),
    paidTo: expensePaidToSchema.optional(),
    staffId: expenseStaffIdSchema.optional(),
    note: expenseNoteSchema.optional(),
    receiptUrl: expenseReceiptUrlSchema.optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: "expenses.errors.nothingToUpdate",
  });

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Read schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical URL-facing sort allowlist.
 *
 * `expenseTableConfig.sortable` is built by PICKING these keys out of
 * `EXPENSE_SORT_COLUMNS`, so a key listed here with no SQL column behind it is
 * a compile error rather than a header that claims one order while the rows
 * come back in another. See .claude/MODULE-RECIPE.md §1
 *
 * `category` is deliberately absent although the design lists it: sorting by
 * category name needs a join to `expense_categories`, and a repository queries
 * its own table only (ARCHITECTURE §4.1 rule 4). Sorting by `category_id` would
 * order by a random uuid, which is worse than not offering it.
 */
export const EXPENSE_SORT_KEYS = [
  "expenseDate",
  "code",
  "amount",
  "paidTo",
] as const;
export type ExpenseSortKey = (typeof EXPENSE_SORT_KEYS)[number];

/** `Has attachment`: Any · With receipt · Without receipt — design §3.4. */
export const EXPENSE_RECEIPT_FILTERS = ["any", "with", "without"] as const;
export type ExpenseReceiptFilter = (typeof EXPENSE_RECEIPT_FILTERS)[number];

/** URL parameter names for this module's filters, in one place. */
export const EXPENSE_FILTERS = {
  month: "month",
  from: "from",
  to: "to",
  category: "category",
  mode: "mode",
  staff: "staff",
  minAmount: "minAmount",
  maxAmount: "maxAmount",
  receipt: "receipt",
} as const;

const monthSchema = z
  .string()
  .trim()
  .regex(MONTH_PATTERN, { message: "common.invalidRequest" });

const businessDateSchema = z
  .string()
  .trim()
  .refine((v) => isBusinessDate(v), { message: "common.invalidRequest" });

/**
 * Amount bounds arrive as text from a URL. They are only ever compared, never
 * rendered, so a plain positive number is enough — but a blank or junk value
 * must degrade to "no bound" rather than 422 a bookmarked link.
 */
const amountBoundSchema = z.coerce
  .number()
  .min(0)
  .max(AMOUNT_MAX)
  .transform((v) => String(v));

/** Filter schemas, reused verbatim by `expenseTableConfig.filters`. */
export const expenseFilterSchemas = {
  month: monthSchema,
  from: businessDateSchema,
  to: businessDateSchema,
  category: z.string().trim().uuid(),
  mode: z.enum(EXPENSE_PAYMENT_MODES),
  staff: z.string().trim().uuid(),
  minAmount: amountBoundSchema,
  maxAmount: amountBoundSchema,
  receipt: z.enum(EXPENSE_RECEIPT_FILTERS),
};

/**
 * Search params arrive as strings, so everything coerces.
 *
 * `.catch()` throughout is deliberate: a stale bookmark with `?month=banana`
 * should render the current month, not a 422. An error page from a saved URL is
 * not recoverable by the owner; a slightly wrong list is.
 *
 * `month` has no default HERE because the default is "the current month in
 * IST", which only the server can compute honestly — the service fills it in.
 */
export const expenseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25).catch(25),
  q: z.string().trim().max(100).default("").catch(""),
  sort: z.enum(EXPENSE_SORT_KEYS).default("expenseDate").catch("expenseDate"),
  /** A spend register is read newest first. */
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
  month: expenseFilterSchemas.month.optional().catch(undefined),
  from: expenseFilterSchemas.from.optional().catch(undefined),
  to: expenseFilterSchemas.to.optional().catch(undefined),
  category: expenseFilterSchemas.category.optional().catch(undefined),
  mode: expenseFilterSchemas.mode.optional().catch(undefined),
  staff: expenseFilterSchemas.staff.optional().catch(undefined),
  minAmount: expenseFilterSchemas.minAmount.optional().catch(undefined),
  maxAmount: expenseFilterSchemas.maxAmount.optional().catch(undefined),
  receipt: expenseFilterSchemas.receipt.default("any").catch("any"),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

/** `/api/expenses/options?q=` — every module ships one. MODULE-RECIPE §5. */
export const expenseOptionsQuerySchema = z.object({
  q: z.string().trim().max(100).default("").catch(""),
});

export type ExpenseOptionsQuery = z.infer<typeof expenseOptionsQuerySchema>;

/** A route segment is user input like any other. */
export const expenseIdParamsSchema = z.object({
  id: z.string().uuid({ message: "common.notFound" }),
});
