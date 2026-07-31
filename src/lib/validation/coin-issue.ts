import { z } from "zod";
import { PAYMENT_DIRECTIONS } from "@/lib/db/entities/enums";
import {
  COIN_ISSUE_FILTERS,
  COIN_ISSUE_STATUS_FILTERS,
} from "@/lib/table/configs/coin-issue";

/**
 * Coin issue validation.
 *
 * Shared by the client forms and the API routes, so one rule cannot drift from
 * the other. Imports nothing server-side — `entities/enums` and the table
 * config are plain const arrays and zod schemas.
 *
 * Messages are CATALOGUE KEYS, never sentences: a Gujarati UI must not receive
 * English validation errors. See .claude/I18N.md §5.4
 *
 * There is deliberately NO `[A-Za-z]` anywhere below. A character class on a
 * note silently blocks "વેચાયા વગરના પાછા આવ્યા" and presents to the owner as
 * "the app won't let me save". See .claude/I18N.md §3.1
 */

/**
 * The payment modes the owner may choose against a coin issue.
 *
 * `COIN` is excluded on purpose: paying for coins WITH coins is not a thing,
 * and `chk_payments_coin_fields` would demand a coin type and count anyway.
 * `WRITE_OFF` is excluded because it is not a payment the owner records — it is
 * what `settle difference` writes on his behalf.
 *
 * NOTE — the design offers a fourth option, `Cheque`. The `payment_mode`
 * PostgreSQL enum has no such value, so it is not offered. Reported as a
 * schema gap rather than silently mapped onto `BANK_TRANSFER`.
 */
export const COIN_PAYMENT_MODES = ["CASH", "UPI", "BANK_TRANSFER"] as const;

export type CoinPaymentMode = (typeof COIN_PAYMENT_MODES)[number];

const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "common.invalidRequest" });

const uuidField = (message: string) => z.string().uuid({ message });

/** Optional free text: `""` becomes null, so an untouched field is not "". */
const optionalText = (max: number, tooLongKey: string) =>
  z
    .string()
    .trim()
    .max(max, { message: tooLongKey })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

/**
 * Whole packets, greater than zero.
 *
 * `z.number`, deliberately not `z.coerce.number`: coercion turns an EMPTY field
 * into 0, and "0 packets" is a different statement from "I haven't filled this
 * in". The form sends real numbers or null, and null must fail loudly.
 */
const packetsField = z
  .number({ invalid_type_error: "coins.issues.errors.packetsRequired" })
  .int({ message: "coins.issues.errors.wholePacketsOnly" })
  .min(1, { message: "coins.issues.errors.packetsPositive" })
  .max(1_000_000, { message: "coins.issues.errors.packetsTooLarge" });

const coinsField = z
  .number({ invalid_type_error: "coins.issues.errors.coinsRequired" })
  .int({ message: "coins.issues.errors.wholeCoinsOnly" })
  .min(0, { message: "coins.issues.errors.coinsNegative" })
  .max(100_000_000, { message: "coins.issues.errors.coinsTooLarge" });

/** numeric(12,2): never more precise than a paisa. */
const amountField = z
  .number({ invalid_type_error: "coins.issues.errors.amountRequired" })
  .min(0, { message: "coins.issues.errors.amountNegative" })
  .max(9_999_999_999.99, { message: "coins.issues.errors.amountTooLarge" })
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: "coins.issues.errors.amountPaise",
  });

/* ── Create ───────────────────────────────────────────────────────────── */

export const coinIssueLineSchema = z.object({
  coinTypeId: uuidField("coins.issues.errors.coinTypeRequired"),
  packets: packetsField,
});

export type CoinIssueLineInput = z.infer<typeof coinIssueLineSchema>;

/**
 * The payment taken at the moment of handover. Optional in every sense — a
 * staff member may walk away owing the full face value, which is the normal
 * case on a morning round. MODULES/04-coins.md §5.1
 */
export const coinIssuePaymentAtIssueSchema = z.object({
  amount: amountField.refine((v) => v > 0, {
    message: "coins.issues.errors.amountPositive",
  }),
  mode: z.enum(COIN_PAYMENT_MODES, {
    errorMap: () => ({ message: "coins.issues.errors.modeRequired" }),
  }),
  referenceNo: optionalText(120, "coins.issues.errors.referenceTooLong"),
  note: optionalText(500, "coins.issues.errors.noteTooLong"),
});

const createCoinIssueFields = {
  staffId: uuidField("coins.issues.errors.staffRequired"),
  issueDate: businessDate,
  notes: optionalText(500, "coins.issues.errors.noteTooLong"),
  items: z
    .array(coinIssueLineSchema)
    .min(1, { message: "coins.issues.errors.atLeastOneLine" })
    .max(50, { message: "coins.issues.errors.tooManyLines" }),
  payment: coinIssuePaymentAtIssueSchema.nullable().optional().default(null),
  /**
   * Minted once per form open, so a retry after a timeout carries the same
   * value and the unique index rejects the duplicate rather than the staff
   * member being charged twice. See .claude/DATA-MODEL.md §10.11
   */
  clientRequestId: optionalText(64, "common.invalidRequest"),
};

/**
 * `uq_cii_issue_type` is a table constraint, so a repeated coin type is a
 * database error unless it is caught here first. Refining rather than
 * de-duplicating silently: two lines of "Blue Token" mean the owner lost track
 * of what he typed, and merging them for him hides that.
 */
export const createCoinIssueSchema = z
  .object(createCoinIssueFields)
  .refine(
    (v) => new Set(v.items.map((i) => i.coinTypeId)).size === v.items.length,
    {
      message: "coins.issues.errors.duplicateCoinType",
      path: ["items"],
    },
  );

export type CreateCoinIssueInput = z.infer<typeof createCoinIssueSchema>;

/* ── Returns ──────────────────────────────────────────────────────────── */

export const coinReturnLineSchema = z.object({
  coinIssueItemId: uuidField("common.invalidRequest"),
  coins: coinsField,
});

/**
 * Every line may legitimately be zero on its own — the owner returns two of
 * three coin types — but a return where EVERY line is zero is a no-op the
 * ledger must not record. Design §9.4
 */
export const recordCoinReturnSchema = z
  .object({
    returnDate: businessDate,
    lines: z
      .array(coinReturnLineSchema)
      .min(1, { message: "coins.issues.errors.returnNothing" }),
    note: optionalText(500, "coins.issues.errors.noteTooLong"),
  })
  .refine((v) => v.lines.some((l) => l.coins > 0), {
    message: "coins.issues.errors.returnAllZero",
    path: ["lines"],
  });

export type RecordCoinReturnInput = z.infer<typeof recordCoinReturnSchema>;

/* ── Payments and refunds ─────────────────────────────────────────────── */

/**
 * One schema, one modal, and the DIRECTION is fixed by how it was opened —
 * never a toggle inside the form. Mixing an inbound instalment up with an
 * outbound refund is the single most costly mistake available on this screen.
 * Design §10.1
 */
export const recordCoinPaymentSchema = z.object({
  direction: z.enum(PAYMENT_DIRECTIONS, {
    errorMap: () => ({ message: "common.invalidRequest" }),
  }),
  amount: amountField.refine((v) => v > 0, {
    message: "coins.issues.errors.amountPositive",
  }),
  mode: z.enum(COIN_PAYMENT_MODES, {
    errorMap: () => ({ message: "coins.issues.errors.modeRequired" }),
  }),
  paidOn: businessDate,
  referenceNo: optionalText(120, "coins.issues.errors.referenceTooLong"),
  note: optionalText(500, "coins.issues.errors.noteTooLong"),
  clientRequestId: optionalText(64, "common.invalidRequest"),
});

export type RecordCoinPaymentInput = z.infer<typeof recordCoinPaymentSchema>;

/* ── Cancel and settle ────────────────────────────────────────────────── */

export const cancelCoinIssueSchema = z.object({
  reason: optionalText(500, "coins.issues.errors.noteTooLong"),
});

export type CancelCoinIssueInput = z.infer<typeof cancelCoinIssueSchema>;

/**
 * The rounding write-off. Takes no amount: the residual is whatever the ledger
 * says it is, and letting a human type it would make the write-off a way to
 * move real money. MODULES/04-coins.md §8.2
 */
export const settleCoinIssueDifferenceSchema = z.object({
  note: optionalText(500, "coins.issues.errors.noteTooLong"),
});

export type SettleCoinIssueDifferenceInput = z.infer<
  typeof settleCoinIssueDifferenceSchema
>;

/* ── Query schemas ────────────────────────────────────────────────────────
 *
 * Search params arrive as raw strings. These schemas bound them; the real
 * injection defence is `parseListQuery`, which only ever uses the sort key as
 * a LOOKUP into the TableConfig allowlist. `.catch(undefined)` rather than a
 * hard failure: a stale bookmarked URL should degrade to an unfiltered list,
 * not a 422. See .claude/ARCHITECTURE.md §6.2
 */

const pageParam = z
  .string()
  .regex(/^\d{1,6}$/)
  .optional()
  .catch(undefined);

export const coinIssueListQuerySchema = z.object({
  page: pageParam,
  pageSize: pageParam,
  q: z.string().max(100).optional().catch(undefined),
  sort: z.string().max(40).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  /** Every key below mirrors a filter declared on `coinIssueTableConfig`. */
  [COIN_ISSUE_FILTERS.status]: z
    .enum(COIN_ISSUE_STATUS_FILTERS)
    .optional()
    .catch(undefined),
  [COIN_ISSUE_FILTERS.staffId]: z.string().uuid().optional().catch(undefined),
  [COIN_ISSUE_FILTERS.coinTypeId]: z.string().uuid().optional().catch(undefined),
  [COIN_ISSUE_FILTERS.from]: businessDate.optional().catch(undefined),
  [COIN_ISSUE_FILTERS.to]: businessDate.optional().catch(undefined),
});

export type CoinIssueListQuery = z.infer<typeof coinIssueListQuerySchema>;

export const coinIssueIdParamsSchema = z.object({
  id: z.string().uuid({ message: "common.notFound" }),
});

export const coinIssueOptionsQuerySchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  staffId: z.string().uuid().optional().catch(undefined),
});

export type CoinIssueOptionsQuery = z.infer<typeof coinIssueOptionsQuerySchema>;

/** The context line under the staff picker on the create form. Design §7.3 */
export const coinIssueStaffSummaryQuerySchema = z.object({
  staffId: z.string().uuid({ message: "common.invalidRequest" }),
});

export type CoinIssueStaffSummaryQuery = z.infer<
  typeof coinIssueStaffSummaryQuerySchema
>;

/**
 * Below this, an outstanding balance is rounding rather than money.
 *
 * ₹500 across 45 coins is ₹11.111111 a coin; returning them one at a time
 * credits ₹499.95. A five-paise gap must not keep an issue open forever, so
 * anything under a rupee gets the `Rounding` badge and the write-off action.
 * MODULES/04-coins.md §8.2
 */
export const ROUNDING_STUB_LIMIT = 1;
