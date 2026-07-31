import { z } from "zod";
import { isBusinessDate, todayIST } from "@/lib/dates";
import {
  PARTY_ORDER_SORT_KEYS,
  partyOrderFilterSchemas,
} from "@/lib/table/configs/party-order";

/**
 * Party-order validation — shared by the booking wizard, the modals and the
 * API routes.
 *
 * Imports nothing server-side, so the same schema runs in both places and the
 * two can never drift. See .claude/ARCHITECTURE.md §7
 *
 * **No character-class restriction on party name, address or notes.** A
 * `[A-Za-z]` pattern here silently rejects `શ્રીજી વાડી` and
 * `પટેલ સમાજ વાડી, કલોલ ચાર રસ્તા પાસે`, and surfaces to the owner as "the app
 * won't let me save". Length is the only limit. Phone is the single exception,
 * because a phone number genuinely is ten Latin digits.
 * See .claude/I18N.md §3.1
 *
 * **Business dates are `'YYYY-MM-DD'` strings end to end.** Never a `Date` —
 * a `Date` is an instant, and this module generates dozens of dates at a time.
 * See .claude/ARCHITECTURE.md §9.2
 *
 * Messages are CATALOGUE KEYS, not sentences — a Gujarati UI must not receive
 * English validation errors. See .claude/I18N.md §5.4
 */

const PARTY_NAME_MAX = 160;
const ADDRESS_MAX = 500;
const NOTES_MAX = 1000;
const REFERENCE_MAX = 120;

/** numeric(12,2). Anything above this is a typo, not an amount. */
const AMOUNT_MAX = 9_999_999_999.99;
/** integer column, and 100,000 jars is not an event. */
const QUANTITY_MAX = 999_999;

/**
 * A booking longer than this is almost always a mistyped year, and the repeat
 * generator would otherwise produce hundreds of rows from one fat finger.
 * Design §5.6: "That pattern makes 94 days. Shorten the range."
 */
export const MAX_SCHEDULE_DAYS = 60;

/** How many digits sit after the decimal point, without float arithmetic. */
function decimalPlaces(value: number): number {
  const text = String(value);
  if (text.includes("e") || text.includes("E")) return Number.MAX_SAFE_INTEGER;
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * A blank numeric field is ABSENT, not zero.
 *
 * `z.coerce.number()` turns `""` into `0`, which would save an untouched unit
 * price as free and read an untouched quantity as "must be more than 0" rather
 * than "enter a quantity".
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

/* ═══════════════════════════════════════════════════════════════════════
   Phone — the ONE field with a character class, because it genuinely is
   ten Latin digits. Gujarati numerals are latinised rather than rejected.
   ═══════════════════════════════════════════════════════════════════════ */

const GUJARATI_ZERO = 0x0ae6;

function latiniseDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out +=
      code >= GUJARATI_ZERO && code <= GUJARATI_ZERO + 9
        ? String(code - GUJARATI_ZERO)
        : ch;
  }
  return out;
}

/** Strips spaces, hyphens, brackets and a `+91` / `0` prefix, silently. */
export function normalisePhone(input: string): string {
  const digits = latiniseDigits(input).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value);
}

export const partyPhoneSchema = z
  .string({ message: "partyOrders.errors.phoneRequired" })
  .transform(normalisePhone)
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "partyOrders.errors.phoneRequired",
      });
      return;
    }
    if (!isValidPhone(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "partyOrders.errors.phoneInvalid",
      });
    }
  });

export const partyAltPhoneSchema = z
  .string()
  .nullish()
  .transform((value) => (value == null ? "" : normalisePhone(value)))
  .superRefine((value, ctx) => {
    if (value.length === 0) return;
    if (!isValidPhone(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "partyOrders.errors.altPhoneInvalid",
      });
    }
  })
  // An empty box is "no alternate number", not an empty string in the column.
  .transform((value) => (value === "" ? null : value));

/* ═══════════════════════════════════════════════════════════════════════
   Dates
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * A calendar date, never an instant.
 *
 * The regex is a SHAPE check on machine-formatted digits — it is not a
 * character class on human text, so the Gujarati rule does not apply.
 * `isBusinessDate` then rejects 31 February and friends.
 */
export const businessDateSchema = z
  .string({ message: "partyOrders.errors.dateRequired" })
  .trim()
  .refine((v) => isBusinessDate(v), {
    message: "partyOrders.errors.dateRequired",
  });

const notFutureDateSchema = businessDateSchema.refine((v) => v <= todayIST(), {
  message: "partyOrders.errors.dateInFuture",
});

/* ═══════════════════════════════════════════════════════════════════════
   Party details — design §4.3
   ═══════════════════════════════════════════════════════════════════════ */

/** One field, any script. `Shreeji Wedding Hall` and `શ્રીજી વાડી` alike. */
export const partyNameSchema = z
  .string({ message: "partyOrders.errors.nameRequired" })
  .trim()
  .min(1, { message: "partyOrders.errors.nameRequired" })
  .max(PARTY_NAME_MAX, { message: "partyOrders.errors.nameTooLong" });

export const deliveryAddressSchema = z
  .string({ message: "partyOrders.errors.addressRequired" })
  .trim()
  .min(1, { message: "partyOrders.errors.addressRequired" })
  .max(ADDRESS_MAX, { message: "partyOrders.errors.addressTooLong" });

export const partyNotesSchema = z
  .string()
  .trim()
  .max(NOTES_MAX, { message: "partyOrders.errors.notesTooLong" })
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const partyDetailsFields = {
  partyName: partyNameSchema,
  phone: partyPhoneSchema,
  altPhone: partyAltPhoneSchema.optional().default(null),
  deliveryAddress: deliveryAddressSchema,
  notes: partyNotesSchema.optional().default(null),
};

/* ═══════════════════════════════════════════════════════════════════════
   Line items — design §8.3
   ═══════════════════════════════════════════════════════════════════════ */

export const quantitySchema = z.preprocess(
  blankToUndefined,
  z
    .number({
      required_error: "partyOrders.errors.quantityRequired",
      invalid_type_error: "partyOrders.errors.quantityRequired",
    })
    .int({ message: "partyOrders.errors.quantityWhole" })
    .refine((v) => v > 0, { message: "partyOrders.errors.quantityPositive" })
    .refine((v) => v <= QUANTITY_MAX, {
      message: "partyOrders.errors.quantityTooLarge",
    }),
);

/** Actuals are optional, and zero is legal — "we turned up and delivered none". */
export const deliveredQuantitySchema = z.preprocess(
  blankToUndefined,
  z
    .number({ invalid_type_error: "partyOrders.errors.deliveredInvalid" })
    .int({ message: "partyOrders.errors.quantityWhole" })
    .min(0, { message: "partyOrders.errors.deliveredNegative" })
    .max(QUANTITY_MAX, { message: "partyOrders.errors.quantityTooLarge" })
    .nullable()
    .optional(),
);

/** Zero is a LEGAL rate — a complimentary jar on a wedding order is real. */
export const unitPriceSchema = z.preprocess(
  blankToUndefined,
  z
    .number({
      required_error: "partyOrders.errors.priceRequired",
      invalid_type_error: "partyOrders.errors.priceInvalid",
    })
    .refine((v) => Number.isFinite(v), {
      message: "partyOrders.errors.priceInvalid",
    })
    .refine((v) => v >= 0, { message: "partyOrders.errors.priceNegative" })
    .refine((v) => v <= AMOUNT_MAX, {
      message: "partyOrders.errors.priceTooLarge",
    })
    .refine((v) => decimalPlaces(v) <= 2, {
      message: "partyOrders.errors.priceDecimals",
    }),
);

export const partyOrderItemSchema = z.object({
  productId: z
    .string({ message: "partyOrders.errors.productRequired" })
    .uuid({ message: "partyOrders.errors.productRequired" }),
  quantity: quantitySchema,
  deliveredQuantity: deliveredQuantitySchema.default(null),
  unitPrice: unitPriceSchema,
});

export type PartyOrderItemInput = z.infer<typeof partyOrderItemSchema>;

/* ═══════════════════════════════════════════════════════════════════════
   Delivery day — design §8
   ═══════════════════════════════════════════════════════════════════════ */

export const DAY_STATUS_VALUES = [
  "SCHEDULED",
  "DELIVERED",
  "SKIPPED",
  "CANCELLED",
] as const;
export type DayStatusInput = (typeof DAY_STATUS_VALUES)[number];

const dayFields = {
  serviceDate: businessDateSchema,
  assignedStaffId: z
    .string()
    .uuid({ message: "common.invalidRequest" })
    .nullable()
    .optional()
    .default(null),
  notes: partyNotesSchema.optional().default(null),
  items: z
    .array(partyOrderItemSchema)
    .min(1, { message: "partyOrders.errors.noItems" })
    // 40 product lines on one day is already implausible; 400 is a bad paste.
    .max(40, { message: "partyOrders.errors.tooManyItems" }),
};

/** A new day always starts as Scheduled — design §8.4, so status is absent. */
export const createPartyOrderDaySchema = z.object(dayFields);
export type CreatePartyOrderDayInput = z.infer<typeof createPartyOrderDaySchema>;

/**
 * Adding days is a BULK operation, because the repeat-pattern generator adds a
 * run of them and half a generated schedule is worse than none.
 * See .claude/ARCHITECTURE.md §4.4
 */
export const addPartyOrderDaysSchema = z.object({
  days: z
    .array(createPartyOrderDaySchema)
    .min(1, { message: "partyOrders.errors.noDays" })
    .max(MAX_SCHEDULE_DAYS, { message: "partyOrders.errors.tooManyDays" }),
});
export type AddPartyOrderDaysInput = z.infer<typeof addPartyOrderDaysSchema>;

export const updatePartyOrderDaySchema = z.object({
  serviceDate: businessDateSchema.optional(),
  deliveryStatus: z.enum(DAY_STATUS_VALUES).optional(),
  assignedStaffId: z
    .string()
    .uuid({ message: "common.invalidRequest" })
    .nullable()
    .optional(),
  notes: partyNotesSchema.optional(),
  /**
   * Present → the day's lines are REPLACED wholesale. Absent → untouched, so
   * `Mark skipped` and `Assign staff` never have to resend an item list.
   */
  items: dayFields.items.optional(),
});
export type UpdatePartyOrderDayInput = z.infer<typeof updatePartyOrderDaySchema>;

/* ═══════════════════════════════════════════════════════════════════════
   Payments — design §9
   ═══════════════════════════════════════════════════════════════════════ */

export const PARTY_PAYMENT_MODES = ["CASH", "UPI", "BANK_TRANSFER"] as const;
export type PartyPaymentMode = (typeof PARTY_PAYMENT_MODES)[number];

export const paymentAmountSchema = z.preprocess(
  blankToUndefined,
  z
    .number({
      required_error: "partyOrders.errors.amountRequired",
      invalid_type_error: "partyOrders.errors.amountInvalid",
    })
    .refine((v) => Number.isFinite(v), {
      message: "partyOrders.errors.amountInvalid",
    })
    .refine((v) => v > 0, { message: "partyOrders.errors.amountPositive" })
    .refine((v) => v <= AMOUNT_MAX, {
      message: "partyOrders.errors.amountTooLarge",
    })
    .refine((v) => decimalPlaces(v) <= 2, {
      message: "partyOrders.errors.amountDecimals",
    }),
);

const paymentFields = {
  paidOn: notFutureDateSchema,
  amount: paymentAmountSchema,
  mode: z.enum(PARTY_PAYMENT_MODES, {
    message: "partyOrders.errors.modeRequired",
  }),
  /**
   * A deposit. Reported separately in the history and ALLOWED to exceed the
   * current total — a party pays before the schedule is finished.
   * See .claude/MODULES/05-party-orders.md §9
   */
  isAdvance: z.boolean().default(false),
  referenceNo: z
    .string()
    .trim()
    .max(REFERENCE_MAX, { message: "partyOrders.errors.referenceTooLong" })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .default(null),
  note: partyNotesSchema.optional().default(null),
  /**
   * Minted once per modal open, so an impatient second tap on a flaky
   * connection returns the first payment instead of charging twice.
   * See .claude/DATA-MODEL.md §10.11
   */
  clientRequestId: z.string().trim().min(1).max(80).optional(),
};

export const recordPartyPaymentSchema = z
  .object(paymentFields)
  .superRefine((value, ctx) => {
    // A UPI or bank transfer with no reference cannot be reconciled later.
    if (value.mode !== "CASH" && !value.referenceNo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceNo"],
        message: "partyOrders.errors.referenceRequired",
      });
    }
  });
export type RecordPartyPaymentInput = z.infer<typeof recordPartyPaymentSchema>;

/** The wizard's step 3. Identical fields; the flag is forced on. */
export const advancePaymentSchema = z.object({
  ...paymentFields,
  isAdvance: z.literal(true).default(true),
});
export type AdvancePaymentInput = z.infer<typeof advancePaymentSchema>;

/* ═══════════════════════════════════════════════════════════════════════
   Booking
   ═══════════════════════════════════════════════════════════════════════ */

export const createPartyOrderSchema = z.object({
  ...partyDetailsFields,
  days: z
    .array(createPartyOrderDaySchema)
    .min(1, { message: "partyOrders.errors.noDays" })
    .max(MAX_SCHEDULE_DAYS, { message: "partyOrders.errors.tooManyDays" })
    .superRefine((days, ctx) => {
      // One row per date, and the database's unique index says so too — but a
      // 23505 is a 500 to the owner, and this is a field error.
      const seen = new Set<string>();
      for (const day of days) {
        if (seen.has(day.serviceDate)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "partyOrders.errors.duplicateDate",
          });
          return;
        }
        seen.add(day.serviceDate);
      }
    }),
  advance: advancePaymentSchema.nullable().optional().default(null),
});
export type CreatePartyOrderInput = z.infer<typeof createPartyOrderSchema>;

export const updatePartyOrderSchema = z
  .object({
    partyName: partyNameSchema.optional(),
    phone: partyPhoneSchema.optional(),
    altPhone: partyAltPhoneSchema.optional(),
    deliveryAddress: deliveryAddressSchema.optional(),
    notes: partyNotesSchema.optional(),
    /**
     * Optimistic lock. Two admins on one booking → the second save fails
     * loudly instead of silently discarding the first one's work.
     * See .claude/DATA-MODEL.md §9
     */
    version: z.number().int().min(0).optional(),
  })
  .refine(
    (v) =>
      Object.entries(v).some(
        ([key, field]) => key !== "version" && field !== undefined,
      ),
    { message: "partyOrders.errors.nothingToUpdate" },
  );
export type UpdatePartyOrderInput = z.infer<typeof updatePartyOrderSchema>;

export const cancelPartyOrderSchema = z.object({
  reason: partyNotesSchema.optional().default(null),
});
export type CancelPartyOrderInput = z.infer<typeof cancelPartyOrderSchema>;

/* ═══════════════════════════════════════════════════════════════════════
   Read schemas
   ═══════════════════════════════════════════════════════════════════════ */

export type PartyOrderSortKey = (typeof PARTY_ORDER_SORT_KEYS)[number];

/**
 * Search params arrive as strings, so everything coerces.
 *
 * `.catch()` throughout is deliberate: a stale bookmark with `?pageSize=cat`
 * should render a list, not a 422. An error page from a saved URL is not
 * recoverable by the owner; a slightly wrong list is.
 */
export const partyOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25).catch(25),
  q: z.string().trim().max(100).default("").catch(""),
  sort: z.enum(PARTY_ORDER_SORT_KEYS).default("startDate").catch("startDate"),
  dir: z.enum(["asc", "desc"]).default("asc").catch("asc"),
  delivery: partyOrderFilterSchemas.delivery.default("all").catch("all"),
  payment: partyOrderFilterSchemas.payment.default("all").catch("all"),
  outstanding: partyOrderFilterSchemas.outstanding
    .default("false")
    .catch("false")
    .transform((v) => v === "true"),
  from: partyOrderFilterSchemas.from.optional().catch(undefined),
  to: partyOrderFilterSchemas.to.optional().catch(undefined),
});
export type PartyOrderListQuery = z.infer<typeof partyOrderListQuerySchema>;

export const partyOrderOptionsQuerySchema = z.object({
  q: z.string().trim().max(100).default("").catch(""),
});
export type PartyOrderOptionsQuery = z.infer<
  typeof partyOrderOptionsQuerySchema
>;

/** `YYYY-MM`. A shape check on digits, not a character class on human text. */
export const partyCalendarQuerySchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
});
export type PartyCalendarQuery = z.infer<typeof partyCalendarQuerySchema>;

export const partyOrderIdParamsSchema = z.object({
  id: z.string().uuid({ message: "common.invalidRequest" }),
});

export const partyOrderDayParamsSchema = z.object({
  id: z.string().uuid({ message: "common.invalidRequest" }),
  dayId: z.string().uuid({ message: "common.invalidRequest" }),
});

export const partyOrderPaymentParamsSchema = z.object({
  id: z.string().uuid({ message: "common.invalidRequest" }),
  paymentId: z.string().uuid({ message: "common.invalidRequest" }),
});
