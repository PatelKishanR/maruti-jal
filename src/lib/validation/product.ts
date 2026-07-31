import { z } from "zod";

/**
 * Product validation — shared by the client forms and the API routes.
 *
 * Imports nothing server-side, so the same schema runs in both places and the
 * two can never drift. See .claude/ARCHITECTURE.md §7
 *
 * **No character-class restriction on title, description or any free text.**
 * A `[A-Za-z]` pattern here would silently reject `૨૦ લિટર જાર` and surface to
 * the owner as "the app won't let me save". Length is the only limit.
 * See .claude/I18N.md §3.1
 *
 * Messages are CATALOGUE KEYS, not sentences — a Gujarati UI must not receive
 * English validation errors. See .claude/I18N.md §5.4
 */

/** numeric(7,3) — a 20,000 L tanker is not a product, 0.5 L pouches are. */
const LITRES_MAX = 9_999.999;
/** numeric(12,2). Anything above this is a typo, not a price. */
const BASE_PRICE_MAX = 9_999_999_999.99;
/** smallint. */
const SORT_ORDER_MAX = 32_767;

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 500;

/**
 * Lookup CODES are ASCII by construction — they are database keys, uppercase
 * and CHECK-constrained in the migration, and the owner never types them. The
 * editable, translatable part of a tag is its LABEL, which lives in the lookup
 * table and carries no pattern at all. This regex is therefore safe where one
 * on `title` would not be.
 */
const LOOKUP_CODE = /^[A-Z][A-Z0-9_]{0,39}$/;

/** How many digits sit after the decimal point, without float arithmetic. */
function decimalPlaces(value: number): number {
  const text = String(value);
  // 1e-7 and friends: exponent form always means more precision than we allow.
  if (text.includes("e") || text.includes("E")) return Number.MAX_SAFE_INTEGER;
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * A blank numeric field is ABSENT, not zero.
 *
 * `z.coerce.number()` would turn `""` and `null` into `0`, so an untouched
 * Litres box would report "must be more than 0" instead of "enter how many
 * litres this holds", and an untouched Base price would save silently as free.
 * Junk text is passed through unchanged so `z.number()` reports it as the wrong
 * TYPE rather than as a missing value — two different messages for two
 * genuinely different mistakes.
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

/** One field, any script. `20L Jar` and `૨૦ લિટર જાર` are equally valid. */
export const productTitleSchema = z
  .string({ message: "products.errors.titleRequired" })
  .trim()
  .min(1, { message: "products.errors.titleRequired" })
  .max(TITLE_MAX, { message: "products.errors.titleTooLong" });

export const productDescriptionSchema = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX, { message: "products.errors.descriptionTooLong" })
  // An empty textarea is "no description", not an empty string in the column.
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const productLitresSchema = z.preprocess(
  blankToUndefined,
  z
    .number({
      required_error: "products.errors.litresRequired",
      invalid_type_error: "products.errors.litresRequired",
    })
    .refine((v) => Number.isFinite(v), {
      message: "products.errors.litresRequired",
    })
    .refine((v) => v > 0, { message: "products.errors.litresPositive" })
    .refine((v) => v <= LITRES_MAX, {
      message: "products.errors.litresTooLarge",
    })
    .refine((v) => decimalPlaces(v) <= 3, {
      message: "products.errors.litresDecimals",
    }),
);

/**
 * Zero is a LEGAL price — a free sample jar is a real thing — so the floor is
 * 0 rather than a positive minimum, and the UI renders `₹0.00` as `Free`
 * rather than as the missing-value em dash.
 */
export const productBasePriceSchema = z.preprocess(
  blankToUndefined,
  z
    .number({
      required_error: "products.errors.basePriceRequired",
      invalid_type_error: "products.errors.basePriceInvalid",
    })
    .refine((v) => Number.isFinite(v), {
      message: "products.errors.basePriceInvalid",
    })
    .refine((v) => v >= 0, { message: "products.errors.basePriceNegative" })
    .refine((v) => v <= BASE_PRICE_MAX, {
      message: "products.errors.basePriceTooLarge",
    })
    .refine((v) => decimalPlaces(v) <= 2, {
      message: "products.errors.basePriceDecimals",
    }),
);

export const productTagCodeSchema = z
  .string({ message: "products.errors.tagRequired" })
  .trim()
  .min(1, { message: "products.errors.tagRequired" })
  .regex(LOOKUP_CODE, { message: "products.errors.tagRequired" });

export const productFilterTypeCodeSchema = z
  .string({ message: "products.errors.filterTypeRequired" })
  .trim()
  .min(1, { message: "products.errors.filterTypeRequired" })
  .regex(LOOKUP_CODE, { message: "products.errors.filterTypeRequired" });

export const productSortOrderSchema = z.preprocess(
  blankToUndefined,
  z
    .number({
      required_error: "products.errors.sortOrderInteger",
      invalid_type_error: "products.errors.sortOrderInteger",
    })
    .int({ message: "products.errors.sortOrderInteger" })
    .min(0, { message: "products.errors.sortOrderRange" })
    .max(SORT_ORDER_MAX, { message: "products.errors.sortOrderRange" }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Write schemas
// ─────────────────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  title: productTitleSchema,
  litres: productLitresSchema,
  tagCode: productTagCodeSchema,
  filterTypeCode: productFilterTypeCodeSchema,
  description: productDescriptionSchema.optional().default(null),
  basePrice: productBasePriceSchema,
  /** Defaults ON — most of this catalogue is jars, and jars come back. */
  isReturnable: z.boolean().default(true),
  sortOrder: productSortOrderSchema.default(100),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Every field optional: the edit form sends the whole record, but a targeted
 * PATCH (just `isActive`, say) is equally valid and must not be forced to
 * resend a title it never touched.
 */
export const updateProductSchema = z
  .object({
    title: productTitleSchema.optional(),
    litres: productLitresSchema.optional(),
    tagCode: productTagCodeSchema.optional(),
    filterTypeCode: productFilterTypeCodeSchema.optional(),
    description: productDescriptionSchema.optional(),
    basePrice: productBasePriceSchema.optional(),
    isReturnable: z.boolean().optional(),
    sortOrder: productSortOrderSchema.optional(),
    /** Edit form only. Deactivation is never blocked for a product. */
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: "products.errors.nothingToUpdate",
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Read schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical sort allowlist.
 *
 * `productTableConfig.sortable` is keyed by exactly these, and the service only
 * ever uses the value as a LOOKUP KEY. `?sort=id;DROP TABLE products` misses
 * the enum here, misses the map there, and falls back to the default — there is
 * nothing to escape wrongly. See .claude/ARCHITECTURE.md §6.2
 */
export const PRODUCT_SORT_KEYS = [
  "title",
  "litres",
  "basePrice",
  "createdAt",
] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const PRODUCT_STATUS_FILTERS = ["active", "inactive", "all"] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

export const PRODUCT_RETURNABLE_FILTERS = ["any", "yes", "no"] as const;
export type ProductReturnableFilter =
  (typeof PRODUCT_RETURNABLE_FILTERS)[number];

/** Filter schemas, reused by `productTableConfig.filters`. */
export const productFilterSchemas = {
  tag: z.string().trim().regex(LOOKUP_CODE),
  filterType: z.string().trim().regex(LOOKUP_CODE),
  status: z.enum(PRODUCT_STATUS_FILTERS),
  returnable: z.enum(PRODUCT_RETURNABLE_FILTERS),
};

/**
 * Search params arrive as strings, so everything coerces.
 *
 * `.catch()` throughout is deliberate: a stale bookmark with `?pageSize=cat`
 * should render an unfiltered list, not a 422. An error page from a saved URL
 * is not recoverable by the owner; a slightly wrong list is.
 */
export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25).catch(25),
  q: z.string().trim().max(100).default("").catch(""),
  sort: z.enum(PRODUCT_SORT_KEYS).default("title").catch("title"),
  dir: z.enum(["asc", "desc"]).default("asc").catch("asc"),
  tag: productFilterSchemas.tag.optional().catch(undefined),
  filterType: productFilterSchemas.filterType.optional().catch(undefined),
  status: productFilterSchemas.status.default("active").catch("active"),
  returnable: productFilterSchemas.returnable.default("any").catch("any"),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** The order-form picker. Small catalogue, so one page of options is plenty. */
export const productOptionsQuerySchema = z.object({
  q: z.string().trim().max(100).default("").catch(""),
});

export type ProductOptionsQuery = z.infer<typeof productOptionsQuerySchema>;

export const productLookupsQuerySchema = z.object({
  /** `true` includes retired rows — the edit form needs them to render its own. */
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .catch("false")
    .transform((v) => v === "true"),
});

export type ProductLookupsQuery = z.infer<typeof productLookupsQuerySchema>;

export const productIdParamsSchema = z.object({
  id: z.string().uuid({ message: "common.invalidRequest" }),
});
