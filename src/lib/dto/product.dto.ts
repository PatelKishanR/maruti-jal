import type { Product } from "@/lib/db/entities";
import type { ListResult } from "@/lib/table/types";

/**
 * Plain shapes crossing the server → client boundary.
 *
 * TypeORM entities are CLASS INSTANCES, and React's server-component
 * serialiser rejects any object whose prototype isn't Object.prototype. Mapping
 * once here also keeps `searchBlob`, `deletedById` and every other internal
 * column out of the browser by construction.
 * See .claude/ARCHITECTURE.md §4.1
 *
 * Tag and filter-type LABELS travel alongside their codes. The code is what
 * filters and groups; the label is what the owner reads, and it is editable —
 * renaming `Cold` to `ઠંડું` must propagate everywhere with no code change.
 * See .claude/DATA-MODEL.md §3
 */

/** A lookup row — product tags and filter types share this exact shape. */
export interface LookupDto {
  code: string;
  /** The editable display name. Already in whatever script the owner chose. */
  label: string;
  sortOrder: number;
  isActive: boolean;
}

interface LookupRow {
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export function toLookupDto(row: LookupRow): LookupDto {
  return {
    code: row.code,
    label: row.label,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/** Both lookups in one payload — the product form needs them together. */
export interface ProductLookupsDto {
  tags: LookupDto[];
  filterTypes: LookupDto[];
}

/** Resolves `tag_code` / `filter_type_code` to the label the owner reads. */
export interface LookupLabels {
  tags: ReadonlyMap<string, string>;
  filterTypes: ReadonlyMap<string, string>;
}

/**
 * A catalogue row. Deliberately narrower than `ProductDto`: a table of 100
 * products has no use for `updatedAt`, and shipping it costs bytes on every
 * repage.
 */
export interface ProductListItemDto {
  id: string;
  /** `PRD-000001` — generated, never editable. */
  code: string;
  title: string;
  description: string | null;
  litres: number;
  tagCode: string;
  tagLabel: string;
  filterTypeCode: string;
  filterTypeLabel: string;
  basePrice: number;
  isReturnable: boolean;
  isActive: boolean;
}

export interface ProductDto extends ProductListItemDto {
  sortOrder: number;
  /** ISO strings — Date instances survive RSC, but strings keep DTOs flat. */
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
}

/** The three ways a product leaves the plant. */
export type ProductChannel = "delivery" | "party" | "walkIn";

export const PRODUCT_CHANNELS: readonly ProductChannel[] = [
  "delivery",
  "party",
  "walkIn",
];

/**
 * One row of the movement table.
 *
 * `null` means "no figure" and renders as an em dash. A channel with no
 * movement still gets a row — omitting it would hide the fact that walk-ins
 * never buy this product, which is itself the answer to a question.
 */
export interface ProductChannelMovementDto {
  channel: ProductChannel;
  units: number | null;
  revenue: number | null;
  avgPrice: number | null;
}

export interface ProductMovementDto {
  /** `YYYY-MM` — the month the figures cover. */
  month: string;
  channels: ProductChannelMovementDto[];
  totalUnits: number | null;
  totalRevenue: number | null;
  /** What the product actually sold for, against `basePrice`. */
  avgRealisedPrice: number | null;
  lifetimeUnits: number | null;
  /** Business date (`YYYY-MM-DD`) of the most recent sale, ever. */
  lastSoldOn: string | null;
  /**
   * False until orders exist. Lets the UI tell "nothing sold yet" apart from
   * "the aggregate query failed", which are different messages to the owner.
   */
  available: boolean;
}

export interface ProductPriceChangeDto {
  id: string;
  /** ISO instant. */
  changedAt: string;
  /** Null on the first entry — `Set at ₹32.00` rather than a `→` change. */
  previousPrice: number | null;
  newPrice: number;
  actorName: string | null;
}

export interface ProductDetailDto extends ProductDto {
  movement: ProductMovementDto;
  /** Newest first. The timeline component does not sort. */
  priceHistory: ProductPriceChangeDto[];
  /** How many order lines reference this product. Drives the edit meta line. */
  usageCount: number;
}

/**
 * The order-form picker option.
 *
 * Structurally identical to `ComboboxOption` in `components/form`, declared
 * here so a service never has to import a client component for a type.
 */
export interface ProductOptionDto {
  id: string;
  /** Primary line — the product title, in whatever script it was typed. */
  label: string;
  /** Secondary line — `20L · ₹35.00`. Disambiguates two similar jars. */
  hint?: string;
  disabled?: boolean;
}

/** A KPI card whose VALUE is a product name rather than a figure. */
export interface ProductLeaderDto {
  productId: string;
  title: string;
  /** Units for volume, rupees for revenue. */
  figure: number;
}

export interface ProductCatalogueKpisDto {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  /** Share of the catalogue that is active, 0–100. Null when nothing exists. */
  activeSharePercent: number | null;
  topByVolume: ProductLeaderDto | null;
  topByRevenue: ProductLeaderDto | null;
  /** `YYYY-MM` the two leader cards cover. */
  month: string;
  /** False until orders exist — the two leader cards render `—`, not `0`. */
  movementAvailable: boolean;
}

export interface ProductListResponseDto {
  result: ListResult<ProductListItemDto>;
  kpis: ProductCatalogueKpisDto;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A code with no matching lookup row falls back to the code itself rather than
 * to an empty cell. A visible `COLD` beats a blank badge that looks like a
 * rendering bug — and it names the row that needs fixing.
 */
function label(map: ReadonlyMap<string, string>, code: string): string {
  return map.get(code) ?? code;
}

export function toProductListItemDto(
  product: Product,
  labels: LookupLabels,
): ProductListItemDto {
  return {
    id: product.id,
    code: product.code,
    title: product.title,
    description: product.description,
    litres: product.litres,
    tagCode: product.tagCode,
    tagLabel: label(labels.tags, product.tagCode),
    filterTypeCode: product.filterTypeCode,
    filterTypeLabel: label(labels.filterTypes, product.filterTypeCode),
    basePrice: product.basePrice,
    isReturnable: product.isReturnable,
    isActive: product.isActive,
  };
}

export function toProductDto(
  product: Product,
  labels: LookupLabels,
): ProductDto {
  return {
    ...toProductListItemDto(product, labels),
    sortOrder: product.sortOrder,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    deactivatedAt: product.deactivatedAt?.toISOString() ?? null,
  };
}

/**
 * Movement with every figure absent.
 *
 * Orders do not exist yet, so there is nothing to aggregate. The shape is real
 * and the UI renders its "nothing sold yet" state from it — when wave 4 lands,
 * only the service body changes.
 */
export function emptyMovement(month: string): ProductMovementDto {
  return {
    month,
    channels: PRODUCT_CHANNELS.map((channel) => ({
      channel,
      units: null,
      revenue: null,
      avgPrice: null,
    })),
    totalUnits: null,
    totalRevenue: null,
    avgRealisedPrice: null,
    lifetimeUnits: null,
    lastSoldOn: null,
    available: false,
  };
}
