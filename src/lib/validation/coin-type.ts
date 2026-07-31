import { z } from "zod";
import {
  LEDGER_MOVEMENT_TYPES,
  type LedgerMovementType,
} from "@/lib/db/entities/enums";

/**
 * Coin type validation.
 *
 * Shared by the client form and the API routes, so one rule cannot drift from
 * the other. Imports nothing server-side — `entities/enums` is a plain list of
 * const arrays with no database dependency.
 *
 * Messages are CATALOGUE KEYS, never sentences: a Gujarati UI must not receive
 * English validation errors. See .claude/I18N.md §5.4
 */

/** The eight badge colours the form offers. Design MODULES/04-coins §4.3 */
export const COIN_TYPE_COLOURS = [
  "#2563EB",
  "#F97316",
  "#22C55E",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
  "#F59E0B",
  "#64748B",
] as const;

export type CoinTypeColour = (typeof COIN_TYPE_COLOURS)[number];

/** A coin type is "low stock" below this many packets. Design §3.5 */
export const LOW_STOCK_PACKETS = 5;

/**
 * Length only — NO character class.
 *
 * A `[A-Za-z]` pattern here silently blocks "બ્લુ ટોકન" and presents to the
 * owner as "the app won't let me save". See .claude/I18N.md §3.1
 */
const nameField = z
  .string()
  .trim()
  .min(1, { message: "coins.types.errors.nameRequired" })
  .max(120, { message: "coins.types.errors.nameTooLong" });

/**
 * Greater than zero — the generated per-coin price divides by this.
 *
 * `z.number`, deliberately not `z.coerce.number`: coercion turns an EMPTY field
 * into 0, and "0" is a different statement from "I haven't filled this in".
 * The form sends real numbers or null, and null must fail loudly.
 */
const coinsPerPacketField = z
  .number({ invalid_type_error: "coins.types.errors.coinsPerPacketRequired" })
  .int({ message: "coins.types.errors.wholeCoinsOnly" })
  .min(1, { message: "coins.types.errors.coinsPerPacketPositive" })
  .max(1_000_000, { message: "coins.types.errors.coinsPerPacketTooLarge" });

/** numeric(12,2): zero or more, and never more precise than a paisa. */
const packetAmountField = z
  .number({ invalid_type_error: "coins.types.errors.packetAmountRequired" })
  .min(0, { message: "coins.types.errors.packetAmountNegative" })
  .max(9_999_999_999.99, { message: "coins.types.errors.packetAmountTooLarge" })
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: "coins.types.errors.packetAmountPaise",
  });

/**
 * Opening stock is a CREATE-ONLY field.
 *
 * It writes an `OPENING` row in the ledger rather than a column, so the ledger
 * stays the single source of truth for every coin that has ever existed. Once
 * the ledger has entries the only way to change stock is an adjustment.
 * See MODULES/04-coins.md §4.1
 */
const openingStockField = z
  .number({ invalid_type_error: "coins.types.errors.openingStockRequired" })
  .int({ message: "coins.types.errors.wholeCoinsOnly" })
  .min(0, { message: "coins.types.errors.openingStockNegative" })
  .max(100_000_000, { message: "coins.types.errors.openingStockTooLarge" });

const colourField = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { message: "coins.types.errors.colourInvalid" })
  .nullable();

export const createCoinTypeSchema = z.object({
  name: nameField,
  coinsPerPacket: coinsPerPacketField,
  packetAmount: packetAmountField,
  openingStock: openingStockField.default(0),
  colourHex: colourField.default(COIN_TYPE_COLOURS[0]),
});

export type CreateCoinTypeInput = z.infer<typeof createCoinTypeSchema>;

/**
 * No `openingStock`: it is written once, at creation, as a ledger entry.
 * Editing it later would mean rewriting history, which is exactly what an
 * append-only ledger exists to prevent.
 */
export const updateCoinTypeSchema = z.object({
  name: nameField,
  coinsPerPacket: coinsPerPacketField,
  packetAmount: packetAmountField,
  colourHex: colourField,
  isActive: z.boolean(),
});

export type UpdateCoinTypeInput = z.infer<typeof updateCoinTypeSchema>;

/* ── Query schemas ────────────────────────────────────────────────────────
 *
 * Search params arrive as raw strings. These schemas bound them; the real
 * injection defence is `parseListQuery`, which only ever uses the sort key as
 * a LOOKUP into the TableConfig allowlist. `.catch(undefined)` rather than a
 * hard failure on the display-only params: a stale bookmarked URL should show
 * an unfiltered list, not a 422. See .claude/ARCHITECTURE.md §6.2
 */

const pageParam = z
  .string()
  .regex(/^\d{1,6}$/)
  .optional()
  .catch(undefined);

const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "common.invalidRequest" });

export const coinTypeListQuerySchema = z.object({
  page: pageParam,
  pageSize: pageParam,
  q: z.string().max(100).optional().catch(undefined),
  sort: z.string().max(40).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  /** Mirrors the `status` filter declared on `coinTypeTableConfig`. */
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
});

export type CoinTypeListQuery = z.infer<typeof coinTypeListQuerySchema>;

export const coinTypeOptionsQuerySchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
});

export type CoinTypeOptionsQuery = z.infer<typeof coinTypeOptionsQuerySchema>;

export const coinTypeIdParamsSchema = z.object({
  id: z.string().uuid({ message: "common.notFound" }),
});

/**
 * Ledger query.
 *
 * There is deliberately no sort parameter: the register is ordered by
 * `entry_seq`, which is the order the running balances were computed in. A
 * running balance sorted any other way is meaningless.
 * See MODULES/04-coins.md §7.1 and design §5.6
 */
export const coinLedgerQuerySchema = z.object({
  page: pageParam,
  pageSize: pageParam,
  /** Comma-separated movement types; unknown values are dropped, not rejected. */
  movement: z
    .string()
    .max(200)
    .optional()
    .transform((raw) =>
      raw
        ? raw
            .split(",")
            .map((v) => v.trim())
            .filter((v): v is LedgerMovementType =>
              (LEDGER_MOVEMENT_TYPES as readonly string[]).includes(v),
            )
        : undefined,
    )
    .catch(undefined),
  from: businessDate.optional().catch(undefined),
  to: businessDate.optional().catch(undefined),
});

export type CoinLedgerQuery = z.infer<typeof coinLedgerQuerySchema>;
