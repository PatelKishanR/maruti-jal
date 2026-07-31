import { z } from "zod";
import {
  ADJUSTMENT_REASONS,
  PAYMENT_DIRECTIONS,
  type AdjustmentReason,
  type PaymentDirection,
} from "@/lib/db/entities/enums";
import { COIN_ADJUSTMENT_FILTERS } from "@/lib/table/configs/coin-adjustment";

/**
 * Stock adjustment validation.
 *
 * Shared by the modal and the API route. Imports nothing server-side.
 * Messages are CATALOGUE KEYS, never sentences. See .claude/I18N.md §5.4
 */

/**
 * The reasons the owner may choose, per direction. Design §12.4
 *
 * `OPENING_STOCK` is absent from both lists deliberately: it belongs to the one
 * adjustment the coin-type form writes, and offering it here would let someone
 * record a second "opening" balance six months in.
 *
 * NOTE — the design also lists `Found` under In. The `adjustment_reason`
 * PostgreSQL enum has no such value, so it is not offered. Reported as a schema
 * gap rather than silently mapped onto `MINTED`.
 */
export const ADJUSTMENT_REASONS_IN = [
  "MINTED",
  "PURCHASED",
  "RECONCILIATION",
] as const satisfies readonly AdjustmentReason[];

export const ADJUSTMENT_REASONS_OUT = [
  "LOST",
  "DAMAGED",
  "STOLEN",
  "RECONCILIATION",
] as const satisfies readonly AdjustmentReason[];

/** Which reasons a direction permits. A `Damaged` increase must be impossible. */
export const REASONS_BY_DIRECTION: Record<
  PaymentDirection,
  readonly AdjustmentReason[]
> = {
  IN: ADJUSTMENT_REASONS_IN,
  OUT: ADJUSTMENT_REASONS_OUT,
};

const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "common.invalidRequest" });

/**
 * NOT NULL and non-empty, and the database says so too
 * (`chk_coin_adjustments_note_present`).
 *
 * This is a control, not a nicety: a stock adjustment with no explanation is
 * how theft hides. The form states the requirement four ways before submit —
 * amber banner, question-form label, always-visible helper, then this message
 * with an example. MODULES/04-coins.md §7.2 · design §12.4
 *
 * Length only, NO character class: `[A-Za-z]` here would block Gujarati.
 */
const noteField = z
  .string()
  .trim()
  .min(1, { message: "coins.adjustments.errors.noteRequired" })
  .max(1000, { message: "coins.adjustments.errors.noteTooLong" });

const createCoinAdjustmentFields = {
  coinTypeId: z
    .string()
    .uuid({ message: "coins.adjustments.errors.coinTypeRequired" }),
  adjustmentDate: businessDate,
  direction: z.enum(PAYMENT_DIRECTIONS, {
    errorMap: () => ({ message: "coins.adjustments.errors.directionRequired" }),
  }),
  coins: z
    .number({ invalid_type_error: "coins.adjustments.errors.coinsRequired" })
    .int({ message: "coins.adjustments.errors.wholeCoinsOnly" })
    .min(1, { message: "coins.adjustments.errors.coinsPositive" })
    .max(100_000_000, { message: "coins.adjustments.errors.coinsTooLarge" }),
  reason: z.enum(ADJUSTMENT_REASONS, {
    errorMap: () => ({ message: "coins.adjustments.errors.reasonRequired" }),
  }),
  note: noteField,
};

/**
 * The reason must belong to the direction, and the check lives here rather than
 * only in the select: a `DAMAGED` increase posted straight at the API would
 * otherwise be accepted and would read as nonsense in the ledger forever.
 */
export const createCoinAdjustmentSchema = z
  .object(createCoinAdjustmentFields)
  .refine((v) => REASONS_BY_DIRECTION[v.direction].includes(v.reason), {
    message: "coins.adjustments.errors.reasonDirectionMismatch",
    path: ["reason"],
  });

export type CreateCoinAdjustmentInput = z.infer<
  typeof createCoinAdjustmentSchema
>;

/* ── Query schemas ─────────────────────────────────────────────────────── */

const pageParam = z
  .string()
  .regex(/^\d{1,6}$/)
  .optional()
  .catch(undefined);

export const coinAdjustmentListQuerySchema = z.object({
  page: pageParam,
  pageSize: pageParam,
  q: z.string().max(100).optional().catch(undefined),
  sort: z.string().max(40).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  /** Every key below mirrors a filter declared on `coinAdjustmentTableConfig`. */
  [COIN_ADJUSTMENT_FILTERS.direction]: z
    .enum(PAYMENT_DIRECTIONS)
    .optional()
    .catch(undefined),
  [COIN_ADJUSTMENT_FILTERS.reason]: z
    .enum(ADJUSTMENT_REASONS)
    .optional()
    .catch(undefined),
  [COIN_ADJUSTMENT_FILTERS.coinTypeId]: z
    .string()
    .uuid()
    .optional()
    .catch(undefined),
  [COIN_ADJUSTMENT_FILTERS.from]: businessDate.optional().catch(undefined),
  [COIN_ADJUSTMENT_FILTERS.to]: businessDate.optional().catch(undefined),
});

export type CoinAdjustmentListQuery = z.infer<
  typeof coinAdjustmentListQuerySchema
>;
