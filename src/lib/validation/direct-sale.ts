import { z } from "zod";
import { isBusinessDate, todayIST } from "@/lib/dates";
import { parseRupees } from "@/lib/money";
import { normalisePhone } from "@/lib/validation/staff";

/**
 * Direct-sale (walk-in) validation — shared by the inline entry row, the edit
 * form and the API routes.
 *
 * Imports nothing server-side, so the same schema runs in the browser (instant
 * feedback in a row that must never change height) and in the route handler
 * (the actual guarantee). One schema, one set of rules, no drift.
 *
 * Messages are CATALOGUE KEYS, never sentences — the form resolves them in the
 * active language. See .claude/I18N.md §5.4
 *
 * **No character-class restriction on customer name, address or note.** A
 * `[A-Za-z]` pattern silently rejects "કલ્પેશ ભાઈ" and surfaces as "the app
 * won't let me save". Length is the only limit. Phone is the single exception,
 * because a phone number genuinely is ten Latin digits.
 */

/* ═══════════════════════════════════════════════════════════════════════
   Free text — length only, any script
   ═══════════════════════════════════════════════════════════════════════ */

function optionalText(max: number, tooLongKey: string) {
  return z
    .string()
    .nullish()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value.length <= max, { message: tooLongKey })
    // An empty optional field is NULL, never "". Otherwise "no address" and
    // "an address that is the empty string" become two states.
    .transform((value) => (value.length === 0 ? null : value));
}

/* ═══════════════════════════════════════════════════════════════════════
   Phone — optional here, unlike Staff

   `normalisePhone` is imported rather than re-implemented: it latinises
   Gujarati numerals and strips `+91` / leading zero, and two copies of that
   would drift. It is a pure function with no server imports.
   ═══════════════════════════════════════════════════════════════════════ */

const optionalPhoneSchema = z
  .string()
  .nullish()
  .transform((value) => (value == null ? "" : normalisePhone(value)))
  .superRefine((value, ctx) => {
    if (value.length === 0) return;
    if (value.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "directSales.errors.phoneLength",
      });
    }
  })
  .transform((value) => (value.length === 0 ? null : value));

/* ═══════════════════════════════════════════════════════════════════════
   Money and litres

   `z.coerce.number()` is wrong here: it turns "" into 0, which would save an
   untouched amount as a free sale. A preprocess that maps blank to `undefined`
   keeps "nothing typed" distinguishable from "zero typed", and the required
   message fires on the first rather than the second.
   ═══════════════════════════════════════════════════════════════════════ */

function toNumberOrUndefined(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseRupees(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}

const amountSchema = z.preprocess(
  toNumberOrUndefined,
  z
    .number({
      required_error: "directSales.errors.amountRequired",
      invalid_type_error: "directSales.errors.amountInvalid",
    })
    .finite({ message: "directSales.errors.amountInvalid" })
    .positive({ message: "directSales.errors.amountPositive" })
    // numeric(12,2): anything larger is a typo, not a walk-in.
    .max(9_999_999_999, { message: "directSales.errors.amountTooLarge" }),
);

const litresSchema = z.preprocess(
  toNumberOrUndefined,
  z
    .number({ invalid_type_error: "directSales.errors.litresInvalid" })
    .finite({ message: "directSales.errors.litresInvalid" })
    .min(0, { message: "directSales.errors.litresNegative" })
    // numeric(7,3).
    .max(9_999.999, { message: "directSales.errors.litresTooLarge" })
    .nullish()
    .transform((value) => (value === undefined ? null : value)),
);

/* ═══════════════════════════════════════════════════════════════════════
   Sale date — a business date STRING, never a Date
   ═══════════════════════════════════════════════════════════════════════ */

const saleDateSchema = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = (value ?? "").trim();
    // Blank means today. The entry row is used dozens of times a day and the
    // date is right nine times out of ten; `todayIST()` rather than
    // `new Date().toISOString().slice(0,10)`, which is a day out east of UTC
    // and would file an evening sale under tomorrow. See lib/dates.ts
    return trimmed.length === 0 ? todayIST() : trimmed;
  })
  .superRefine((value, ctx) => {
    if (!isBusinessDate(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "directSales.errors.saleDateInvalid",
      });
      return;
    }
    // String comparison is correct for 'YYYY-MM-DD' and needs no timezone.
    if (value > todayIST()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "directSales.errors.saleDateFuture",
      });
    }
  });

/* ═══════════════════════════════════════════════════════════════════════
   The forms
   ═══════════════════════════════════════════════════════════════════════ */

const directSaleFields = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, { message: "directSales.errors.nameRequired" })
    .max(120, { message: "directSales.errors.nameTooLong" }),
  amount: amountSchema,
  saleDate: saleDateSchema,
  phone: optionalPhoneSchema,
  address: optionalText(500, "directSales.errors.addressTooLong"),
  productId: z
    .string()
    .uuid({ message: "directSales.errors.productInvalid" })
    .nullish()
    .transform((value) => value ?? null),
  litres: litresSchema,
  note: optionalText(500, "directSales.errors.noteTooLong"),
});

export const createDirectSaleSchema = directSaleFields;

/**
 * PATCH means PARTIAL, so every field is optional and the service applies only
 * what was sent.
 *
 * The same-day rule is NOT expressed here: "you can only edit today's entries"
 * is about the STORED row, which this schema cannot see. It lives in the
 * service, which is the only place that can compare against what is on disk.
 */
export const updateDirectSaleSchema = directSaleFields.partial();

/**
 * Voiding needs a reason, and a short one is not a reason.
 *
 * `Add a few more words — this is the only record of why` is the message the
 * dialog shows, and it is the honest description of what this field is for.
 */
export const voidDirectSaleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, { message: "directSales.errors.voidReasonRequired" })
    .min(3, { message: "directSales.errors.voidReasonShort" })
    .max(500, { message: "directSales.errors.voidReasonTooLong" }),
});

export type CreateDirectSaleInput = z.infer<typeof createDirectSaleSchema>;
export type UpdateDirectSaleInput = z.infer<typeof updateDirectSaleSchema>;
export type VoidDirectSaleInput = z.infer<typeof voidDirectSaleSchema>;

/* ═══════════════════════════════════════════════════════════════════════
   List query
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Deliberately permissive strings.
 *
 * The real defence is `parseListQuery` + `directSaleTableConfig`: the sort key
 * must be a KEY of the sortable allowlist, page numbers are clamped, and
 * unknown or malformed filters are dropped. That is the audited path
 * (ARCHITECTURE §6.2), and it degrades to the default view rather than
 * erroring.
 *
 * Note the `.catch(undefined)` on every field — a stale bookmarked URL must
 * never 422. An error page teaches the owner nothing; an unfiltered list is
 * recoverable in one click.
 */
const listParam = (max: number) =>
  z.string().max(max).optional().catch(undefined);

export const directSaleListQuerySchema = z.object({
  page: listParam(10),
  pageSize: listParam(10),
  q: listParam(100),
  sort: listParam(40),
  dir: listParam(4),
  range: listParam(10),
  from: listParam(10),
  to: listParam(10),
  minAmount: listParam(16),
  maxAmount: listParam(16),
  voided: listParam(1),
  productId: listParam(40),
});

export type DirectSaleListQuery = z.infer<typeof directSaleListQuerySchema>;

/**
 * `GET /api/direct-sales/customers?q=` — the entry row's autocomplete.
 *
 * There is no customer master (decision D3); this matches against the names
 * and phone numbers already on past walk-ins. See MODULES/06-direct-sales.md §7
 */
export const directSaleCustomerQuerySchema = z.object({
  q: listParam(100),
  /** `9825014477` — the phone-first path, matched exactly rather than by prefix. */
  phone: listParam(20),
});

/** `GET /api/direct-sales/options?q=` — the shared EntityCombobox contract. */
export const directSaleOptionsQuerySchema = z.object({
  q: listParam(100),
});

/** Every dynamic segment is validated, same as body and query. */
export const directSaleIdParamsSchema = z.object({
  id: z.string().uuid({ message: "common.notFound" }),
});
