import { z } from "zod";
import {
  ORDER_STATUSES,
  PAYMENT_DIRECTIONS,
  PAYMENT_STATUSES,
  RETURN_STATUSES,
} from "@/lib/db/entities/enums";
import { DELIVERY_ORDER_FILTERS } from "@/lib/table/configs/delivery-order";

/**
 * Delivery order validation.
 *
 * Shared by the client forms and the API routes, so one rule cannot drift from
 * the other. Imports nothing server-side — `entities/enums` and the table
 * config are plain const arrays and zod schemas.
 *
 * Messages are CATALOGUE KEYS, never sentences: a Gujarati UI must not receive
 * English validation errors. See .claude/I18N.md §5.4
 *
 * There is deliberately NO `[A-Za-z]` anywhere below. A character class on a
 * note or a price-override reason silently blocks "શર્મા જી નો રેગ્યુલર ભાવ"
 * and presents to the owner as "the app won't let me save".
 * See .claude/I18N.md §3.1
 *
 * ── What this file deliberately does NOT validate ────────────────────────
 *
 * 1. **Line totals and the order total.** `order_items.line_total` is a STORED
 *    GENERATED column — `round((quantity - returned_filled_qty) * unit_price,
 *    2)` — and `delivery_orders.subtotal_amount` is trigger-maintained over it.
 *    A schema that accepted a client-computed total would be inviting the two
 *    to disagree. The forms compute figures to SHOW; the database computes the
 *    ones that count. See .claude/DATA-MODEL.md §8.2
 *
 * 2. **Over-returns.** `chk_order_items_returns_within_quantity` is the guard,
 *    and it holds for imports and hand-written SQL too. The per-line ceiling
 *    depends on rows this schema cannot see, so it is checked in the service
 *    against LOCKED rows and refused there with a message naming the line.
 */

/* ── Field primitives ─────────────────────────────────────────────────── */

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
 * Whole jars, greater than zero.
 *
 * `z.number`, deliberately not `z.coerce.number`: coercion turns an EMPTY field
 * into 0, and `chk_order_items_quantity_positive` rejects 0 anyway — so the
 * user would get a Postgres error instead of "quantity is required".
 */
const quantityField = z
  .number({ invalid_type_error: "orders.errors.quantityRequired" })
  .int({ message: "orders.errors.wholeJarsOnly" })
  .min(1, { message: "orders.errors.quantityPositive" })
  .max(1_000_000, { message: "orders.errors.quantityTooLarge" });

/** A return bucket. Zero is legal on its own line; all-zero is not. */
const returnQtyField = z
  .number({ invalid_type_error: "orders.errors.returnQtyRequired" })
  .int({ message: "orders.errors.wholeJarsOnly" })
  .min(0, { message: "orders.errors.returnQtyNegative" })
  .max(1_000_000, { message: "orders.errors.quantityTooLarge" });

/** numeric(12,2): never more precise than a paisa. */
const money = (requiredKey: string) =>
  z
    .number({ invalid_type_error: requiredKey })
    .min(0, { message: "orders.errors.amountNegative" })
    .max(9_999_999_999.99, { message: "orders.errors.amountTooLarge" })
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
      message: "orders.errors.amountPaise",
    });

const priceField = money("orders.errors.priceRequired");
const amountField = money("orders.errors.amountRequired");

const coinCountField = z
  .number({ invalid_type_error: "orders.errors.coinCountRequired" })
  .int({ message: "orders.errors.wholeCoinsOnly" })
  .min(1, { message: "orders.errors.coinCountPositive" })
  .max(100_000_000, { message: "orders.errors.coinCountTooLarge" });

/* ── Line items ───────────────────────────────────────────────────────── */

/**
 * One line of the builder.
 *
 * `unitPrice` is NULLABLE and means "charge the list price". The form pre-fills
 * it from the product and the owner overrides it when a rate was bargained; a
 * line he never touched must not be able to arrive as `0` because a controlled
 * input emptied itself. The service resolves null to `product.basePrice` from
 * the row it just read — the same read the snapshot columns come from, so the
 * price charged and the price recorded as "list" are the same number.
 *
 * THE SAME PRODUCT MAY APPEAR ON SEVERAL LINES. There is no `.refine()`
 * de-duplicating `productId`, and its absence is the feature: one route order
 * legitimately holds 20-litre jars at ₹35 for one customer and ₹30 for another.
 * Uniqueness in the database is `(order_id, line_no)` only.
 * See .claude/DATA-MODEL.md §5.6
 */
export const orderLineSchema = z.object({
  productId: uuidField("orders.errors.productRequired"),
  quantity: quantityField,
  unitPrice: priceField.nullable().optional().default(null),
  priceOverrideNote: optionalText(300, "orders.errors.noteTooLong"),
});

export type OrderLineInput = z.infer<typeof orderLineSchema>;

/**
 * A line on the EDIT form.
 *
 * `id` present  → an existing line; quantity, price and the override note may
 *                 change. The snapshot columns cannot: they are `update: false`
 *                 and a trigger raises if they move by any other route, because
 *                 a six-month-old statement must reprint as it was issued.
 * `id` absent   → a new line, appended at `MAX(line_no) + 1`.
 * Line omitted  → REMOVED, and refused if anything has ever come back against
 *                 it: `order_item_return_events` cascades on delete, so
 *                 dropping such a line would silently destroy append-only
 *                 history. See .claude/DATA-MODEL.md §6, §9
 */
export const updateOrderLineSchema = orderLineSchema.extend({
  id: z.string().uuid({ message: "common.invalidRequest" }).optional(),
});

export type UpdateOrderLineInput = z.infer<typeof updateOrderLineSchema>;

/* ── Payments ─────────────────────────────────────────────────────────── */

/**
 * The modes the owner may choose for the NON-COIN half of a payment.
 *
 * `COIN` is excluded on purpose — coins arrive on their own repeatable rows
 * below, because each one needs a coin type, a count and a `rate6` snapshot,
 * and `chk_payments_coin_fields` demands all three.
 * `WRITE_OFF` is excluded because it is not a payment the owner records.
 *
 * NOTE — `Cheque` is offered by neither this list nor the `payment_mode`
 * PostgreSQL enum. Reported as a schema gap rather than silently mapped onto
 * `BANK_TRANSFER`.
 */
export const ORDER_PAYMENT_MODES = ["CASH", "UPI", "BANK_TRANSFER"] as const;

export type OrderPaymentMode = (typeof ORDER_PAYMENT_MODES)[number];

/**
 * One coin row: a type and a count. The VALUE is not sent.
 *
 * The per-coin price is read off `coin_types` under a row lock and snapshotted
 * onto the payment as `coin_unit_value`; `amount` is then
 * `round(coin_count × coin_unit_value, 2)`, which is exactly what
 * `chk_payments_coin_fields` re-checks. Accepting a client-computed value would
 * let a stale form price coins at last month's rate.
 * See .claude/DATA-MODEL.md §5.8, §10.5
 */
export const orderCoinLineSchema = z.object({
  coinTypeId: uuidField("orders.errors.coinTypeRequired"),
  coinCount: coinCountField,
});

export type OrderCoinLineInput = z.infer<typeof orderCoinLineSchema>;

const paymentFields = {
  /** The non-coin half. Zero when the whole payment arrived as coins. */
  amount: amountField.default(0),
  mode: z
    .enum(ORDER_PAYMENT_MODES, {
      errorMap: () => ({ message: "orders.errors.modeRequired" }),
    })
    .default("CASH"),
  coins: z
    .array(orderCoinLineSchema)
    .max(20, { message: "orders.errors.tooManyCoinLines" })
    .default([]),
  referenceNo: optionalText(120, "orders.errors.referenceTooLong"),
  note: optionalText(500, "orders.errors.noteTooLong"),
};

/**
 * Something has to have been handed over.
 *
 * OVERPAYMENT IS NOT CHECKED HERE, AND MUST NOT BE. §5.1 is explicit: a cash
 * business takes round-number payments constantly, and refusing ₹2,000 against
 * a ₹1,940 balance just teaches staff to record false amounts. The UI flags it
 * amber; the trigger flips `payment_status` to `OVERPAID`; nothing blocks.
 */
function carriesMoney(v: { amount: number; coins: unknown[] }): boolean {
  return v.amount > 0 || v.coins.length > 0;
}

/** Two rows for one coin type means he lost track of what he typed. */
function coinTypesDistinct(v: { coins: { coinTypeId: string }[] }): boolean {
  return new Set(v.coins.map((c) => c.coinTypeId)).size === v.coins.length;
}

/**
 * The payment taken at the moment the jars leave — story O4, "the common case
 * is one form, not two". Optional in every sense: most orders go out unpaid.
 * Its date is the order date, so it carries none of its own.
 */
export const orderPaymentAtCreateSchema = z
  .object(paymentFields)
  .refine(carriesMoney, {
    message: "orders.errors.paymentEmpty",
    path: ["amount"],
  })
  .refine(coinTypesDistinct, {
    message: "orders.errors.duplicateCoinType",
    path: ["coins"],
  });

export type OrderPaymentAtCreateInput = z.infer<
  typeof orderPaymentAtCreateSchema
>;

/**
 * Money moving against an existing order, in either direction.
 *
 * `direction` is fixed by which button opened the modal and is never a toggle
 * inside it: mixing an inbound instalment up with an outbound refund is the
 * most costly mistake available on this screen.
 *
 * COINS ARE INBOUND ONLY. A `COIN` payment writes an `ORDER_RECEIPT` row into
 * `coin_ledger_entries` — a POSITIVE movement, and `chk_ledger_sign` allows no
 * other sign for that type. There is no ledger movement type for "coins handed
 * back against an order refund", so the refund path takes cash, UPI or bank
 * transfer and nothing else.
 */
export const recordOrderPaymentSchema = z
  .object({
    ...paymentFields,
    direction: z
      .enum(PAYMENT_DIRECTIONS, {
        errorMap: () => ({ message: "common.invalidRequest" }),
      })
      .default("IN"),
    paidOn: businessDate,
    /**
     * Minted once per form open, so a double-tap on a poor connection carries
     * the same value and the second attempt returns the FIRST one's result
     * instead of taking the money twice. See .claude/DATA-MODEL.md §10.11
     */
    clientRequestId: optionalText(64, "common.invalidRequest"),
  })
  .refine(carriesMoney, {
    message: "orders.errors.paymentEmpty",
    path: ["amount"],
  })
  .refine(coinTypesDistinct, {
    message: "orders.errors.duplicateCoinType",
    path: ["coins"],
  })
  .refine((v) => v.direction === "IN" || v.coins.length === 0, {
    message: "orders.errors.refundInCoins",
    path: ["coins"],
  });

export type RecordOrderPaymentInput = z.infer<typeof recordOrderPaymentSchema>;

/* ── Create ───────────────────────────────────────────────────────────── */

const createFields = {
  staffId: uuidField("orders.errors.staffRequired"),
  orderDate: businessDate,
  notes: optionalText(1000, "orders.errors.noteTooLong"),
  /**
   * Header round-off, zero or more — the ONLY money field the admin types
   * directly. `chk_delivery_orders_discount_non_negative` says the same thing.
   */
  discountAmount: amountField.default(0),
  items: z
    .array(orderLineSchema)
    .min(1, { message: "orders.errors.atLeastOneLine" })
    .max(100, { message: "orders.errors.tooManyLines" }),
  payment: orderPaymentAtCreateSchema.nullable().optional().default(null),
  clientRequestId: optionalText(64, "common.invalidRequest"),
};

export const createDeliveryOrderSchema = z.object(createFields);

export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>;

/* ── Edit ─────────────────────────────────────────────────────────────── */

/**
 * PATCH is PARTIAL. `undefined` means "leave alone"; that is a different
 * instruction from `null`, which means "clear this field".
 *
 * `items` absent therefore leaves the lines untouched, so "fix the notes" never
 * resends a line list it did not change. `items` PRESENT replaces the set:
 * lines carrying an `id` are updated, lines without one are appended, and lines
 * that have vanished are removed.
 *
 * `version` is the optimistic lock. Sending it turns a lost update into a loud
 * 409 — "changed by someone else, reload" — instead of the second save silently
 * discarding the first one's work. See .claude/DATA-MODEL.md §9
 */
export const updateDeliveryOrderSchema = z.object({
  staffId: uuidField("orders.errors.staffRequired").optional(),
  orderDate: businessDate.optional(),
  notes: optionalText(1000, "orders.errors.noteTooLong").optional(),
  discountAmount: amountField.optional(),
  items: z
    .array(updateOrderLineSchema)
    .min(1, { message: "orders.errors.atLeastOneLine" })
    .max(100, { message: "orders.errors.tooManyLines" })
    .optional(),
  version: z.number().int().min(0).optional(),
  /** Typed into the edit dialog; stored on the `document_revisions` row. */
  changeReason: optionalText(500, "orders.errors.noteTooLong"),
});

export type UpdateDeliveryOrderInput = z.infer<typeof updateDeliveryOrderSchema>;

export const cancelDeliveryOrderSchema = z.object({
  reason: optionalText(500, "orders.errors.noteTooLong"),
});

export type CancelDeliveryOrderInput = z.infer<
  typeof cancelDeliveryOrderSchema
>;

/* ── Returns ──────────────────────────────────────────────────────────── */

/**
 * One row of the return modal: a line, and the three buckets typed against it.
 *
 * "Still pending" is NOT a field. It is `issued − (empty + filled + lost)`,
 * calculated by a generated column, which removes a whole class of data-entry
 * error and guarantees the buckets always reconcile to the issued quantity.
 * MODULES/03 §6.1
 *
 * `orderItemId` may belong to a DIFFERENT order from the one being posted to.
 * That is the point of §6.2: a customer routinely hands back last week's jar
 * when this week's staff member calls, and the jar must be attributed to the
 * line it actually went out on or old orders never close. The service checks
 * the line belongs to the same staff member.
 */
export const orderReturnLineSchema = z.object({
  orderItemId: uuidField("common.invalidRequest"),
  emptyQty: returnQtyField.default(0),
  filledQty: returnQtyField.default(0),
  lostQty: returnQtyField.default(0),
});

export type OrderReturnLineInput = z.infer<typeof orderReturnLineSchema>;

/**
 * "Eight 20-litre jars came back; I don't know which orders they went out on."
 *
 * Spread across that staff member's open lines OLDEST ORDER FIRST, which is
 * what makes old orders close instead of sitting open forever (story O9). An
 * explicit `lines` entry always wins — hence "unless specified".
 */
export const orderReturnAllocationSchema = z.object({
  productId: uuidField("orders.errors.productRequired"),
  emptyQty: returnQtyField.default(0),
  filledQty: returnQtyField.default(0),
  lostQty: returnQtyField.default(0),
});

export type OrderReturnAllocationInput = z.infer<
  typeof orderReturnAllocationSchema
>;

function totalOf(
  rows: { emptyQty: number; filledQty: number; lostQty: number }[],
): number {
  return rows.reduce(
    (sum, row) => sum + row.emptyQty + row.filledQty + row.lostQty,
    0,
  );
}

/**
 * Any single row may legitimately be all zeros — the clerk tabs past two of
 * five lines — but a return where EVERYTHING is zero is a no-op the
 * append-only log must not record.
 * `chk_oire_normal_or_reversal` refuses a zero-sum event outright.
 */
export const recordOrderReturnSchema = z
  .object({
    returnDate: businessDate,
    lines: z
      .array(orderReturnLineSchema)
      .max(200, { message: "orders.errors.tooManyLines" })
      .default([]),
    allocations: z
      .array(orderReturnAllocationSchema)
      .max(50, { message: "orders.errors.tooManyLines" })
      .default([]),
    note: optionalText(500, "orders.errors.noteTooLong"),
  })
  .refine((v) => totalOf(v.lines) + totalOf(v.allocations) > 0, {
    message: "orders.errors.returnAllZero",
    path: ["lines"],
  });

export type RecordOrderReturnInput = z.infer<typeof recordOrderReturnSchema>;

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

export const deliveryOrderListQuerySchema = z.object({
  page: pageParam,
  pageSize: pageParam,
  q: z.string().max(100).optional().catch(undefined),
  /**
   * Free text, deliberately unconstrained beyond a length cap. The sort key is
   * the only URL value that reaches SQL structurally, and `parseListQuery`
   * resolves it through `DELIVERY_ORDER_SORT_COLUMNS` — anything not a key of
   * that map falls back to the default.
   */
  sort: z.string().max(40).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  /** Every key below mirrors a filter declared on `deliveryOrderTableConfig`. */
  [DELIVERY_ORDER_FILTERS.staffId]: z
    .string()
    .uuid()
    .optional()
    .catch(undefined),
  [DELIVERY_ORDER_FILTERS.from]: businessDate.optional().catch(undefined),
  [DELIVERY_ORDER_FILTERS.to]: businessDate.optional().catch(undefined),
  [DELIVERY_ORDER_FILTERS.status]: z
    .enum(ORDER_STATUSES)
    .optional()
    .catch(undefined),
  [DELIVERY_ORDER_FILTERS.paymentStatus]: z
    .enum(PAYMENT_STATUSES)
    .optional()
    .catch(undefined),
  [DELIVERY_ORDER_FILTERS.returnStatus]: z
    .enum(RETURN_STATUSES)
    .optional()
    .catch(undefined),
  [DELIVERY_ORDER_FILTERS.moneyPending]: z
    .enum(["1"])
    .optional()
    .catch(undefined),
  [DELIVERY_ORDER_FILTERS.jarsOut]: z.enum(["1"]).optional().catch(undefined),
});

export type DeliveryOrderListQuery = z.infer<
  typeof deliveryOrderListQuerySchema
>;

export const deliveryOrderIdParamsSchema = z.object({
  id: z.string().uuid({ message: "common.notFound" }),
});

/**
 * The cross-order return picker. §6.2
 *
 * `staffId` is REQUIRED and not optional-with-catch: "every open line" with no
 * staff member is every open line in the business, which is not a question
 * anyone asks and is an accident waiting to page through 40,000 rows.
 */
export const openReturnLinesQuerySchema = z.object({
  staffId: z.string().uuid({ message: "orders.errors.staffRequired" }),
  /** The order the modal is already showing — its own lines are listed there. */
  excludeOrderId: z.string().uuid().optional().catch(undefined),
  productId: z.string().uuid().optional().catch(undefined),
  limit: z
    .string()
    .regex(/^\d{1,3}$/)
    .optional()
    .catch(undefined),
});

export type OpenReturnLinesQuery = z.infer<typeof openReturnLinesQuerySchema>;

/** The picker is a list, not a report: 200 open lines is already unusable. */
export const OPEN_LINES_DEFAULT_LIMIT = 100;
export const OPEN_LINES_MAX_LIMIT = 200;
