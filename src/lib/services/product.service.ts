import "server-only";
import type { EntityManager } from "typeorm";
import { withTx } from "@/lib/db/data-source";
import { productRepository } from "@/lib/repositories/product.repository";
import { productTagRepository } from "@/lib/repositories/product-tag.repository";
import { productFilterTypeRepository } from "@/lib/repositories/product-filter-type.repository";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { todayIST } from "@/lib/dates";
import { formatINR, formatLitres } from "@/lib/money";
import { productTableConfig } from "@/lib/table/configs/product";
import type {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from "@/lib/validation/product";
import {
  emptyMovement,
  toLookupDto,
  toProductDto,
  toProductListItemDto,
  type LookupDto,
  type LookupLabels,
  type ProductCatalogueKpisDto,
  type ProductDetailDto,
  type ProductDto,
  type ProductListResponseDto,
  type ProductLookupsDto,
  type ProductOptionDto,
} from "@/lib/dto/product.dto";

/**
 * Business rules for the catalogue.
 *
 * This layer NEVER touches the database directly — every read and write goes
 * through `productRepository`, `productTagRepository` or
 * `productFilterTypeRepository`. It owns transaction boundaries, and it maps
 * entities to DTOs before anything leaves. See .claude/ARCHITECTURE.md §4
 *
 * The rule that shapes this whole module: **a price change never rewrites
 * history.** Order lines snapshot title, litres, tag, filter type, base price
 * and the returnable flag at the moment they are created, so nothing here has
 * to protect the past — which is precisely why deactivation is never blocked.
 * See .claude/MODULES/02-products.md §6.2
 */

// ─────────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tags, newest vocabulary included.
 *
 * `includeInactive` exists for the EDIT form: a product whose tag was retired
 * last week must still render its own tag in the select, or saving an unrelated
 * field would silently move it to whatever happened to be first in the list.
 */
export async function listTags(includeInactive = false): Promise<LookupDto[]> {
  const rows = includeInactive
    ? await productTagRepository.findAll()
    : await productTagRepository.findActive();
  return rows.map(toLookupDto);
}

export async function listFilterTypes(
  includeInactive = false,
): Promise<LookupDto[]> {
  const rows = includeInactive
    ? await productFilterTypeRepository.findAll()
    : await productFilterTypeRepository.findActive();
  return rows.map(toLookupDto);
}

/** Both lookups in one round trip — the product form always needs both. */
export async function getProductLookups(
  includeInactive = false,
): Promise<ProductLookupsDto> {
  const [tags, filterTypes] = await Promise.all([
    listTags(includeInactive),
    listFilterTypes(includeInactive),
  ]);
  return { tags, filterTypes };
}

/**
 * Every label, active or retired, keyed by code.
 *
 * Two tiny tables read once per list request rather than joined per row: the
 * lookups exist precisely so `products.tag_code` stays filterable without a
 * join, and a two-row `IN` scan is cheaper than the join it replaces.
 */
async function loadLookupLabels(): Promise<LookupLabels> {
  const [tags, filterTypes] = await Promise.all([
    productTagRepository.findAll(),
    productFilterTypeRepository.findAll(),
  ]);

  return {
    tags: new Map(tags.map((t) => [t.code, t.label])),
    filterTypes: new Map(filterTypes.map((f) => [f.code, f.label])),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/** `YYYY-MM` in IST — the month the KPI leader cards cover. */
function currentMonth(): string {
  return todayIST().slice(0, 7);
}

/**
 * The catalogue list, plus the KPI strip above it.
 *
 * Both come from one call because the KPI figures are counts of the same table
 * and the page renders them together — two round trips would only make the
 * strip and the table disagree while one of them was in flight.
 */
export async function listProducts(
  query: ProductListQuery,
): Promise<ProductListResponseDto> {
  /**
   * The injection defence, restated at the point of use: `query.sort` has
   * already been narrowed to a key of the allowlist by Zod, and here it is used
   * ONLY as a lookup key. A key that somehow missed both falls back to the
   * default rather than reaching the query builder.
   */
  const sortKey = Object.hasOwn(productTableConfig.sortable, query.sort)
    ? query.sort
    : productTableConfig.defaultSort.key;

  const [labels, [rows, total], totalProducts, activeProducts] =
    await Promise.all([
      loadLookupLabels(),
      productRepository.searchPaginated({
        search: query.q || undefined,
        tagCode: query.tag,
        filterTypeCode: query.filterType,
        isActive: query.status === "all" ? undefined : query.status === "active",
        isReturnable:
          query.returnable === "any" ? undefined : query.returnable === "yes",
        sort: sortKey,
        dir: query.dir === "desc" ? "DESC" : "ASC",
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      productRepository.count(),
      productRepository.count({ isActive: true }),
    ]);

  const kpis: ProductCatalogueKpisDto = {
    totalProducts,
    activeProducts,
    inactiveProducts: totalProducts - activeProducts,
    activeSharePercent:
      totalProducts === 0
        ? null
        : Math.round((activeProducts / totalProducts) * 100),
    // TODO(wave-4): rank by order-line volume and revenue for `month` once
    // orders exist. Deliberately NOT joined from productRepository — one
    // repository per entity, so this becomes an order-line repository call.
    topByVolume: null,
    topByRevenue: null,
    month: currentMonth(),
    movementAvailable: false,
  };

  return {
    result: {
      rows: rows.map((row) => toProductListItemDto(row, labels)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    kpis,
  };
}

/** One product, with everything the detail page renders. */
export async function getProduct(id: string): Promise<ProductDetailDto> {
  const [product, labels] = await Promise.all([
    productRepository.findById(id),
    loadLookupLabels(),
  ]);

  if (!product) throw new NotFoundError("Product", { id });

  return {
    ...toProductDto(product, labels),
    // TODO(wave-4): aggregate order lines by channel for the selected month,
    // and derive the price history from document revisions. Both belong to
    // their own repositories — this service calls them, it does not join here.
    movement: emptyMovement(currentMonth()),
    priceHistory: [],
    usageCount: 0,
  };
}

/**
 * The order-form picker. `sort_order` first, so the owner can pin the two
 * products that make up ninety per cent of sales to the top of every dropdown.
 *
 * Orders and party orders both depend on this shape, so the hint is built here
 * rather than in each caller: two 20 L jars that differ only by temperature are
 * told apart by `20L · ₹45.00`, not by their titles.
 */
export async function listProductOptions(
  q: string,
): Promise<ProductOptionDto[]> {
  const [rows] = await productRepository.searchPaginated({
    search: q || undefined,
    isActive: true,
    sort: "sortOrder",
    dir: "ASC",
    skip: 0,
    take: 50,
  });

  return rows.map((product) => ({
    id: product.id,
    label: product.title,
    hint: `${formatLitres(product.litres)} · ${formatINR(product.basePrice)}`,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A tag or filter type can be retired between the form loading and the owner
 * pressing Save. Failing as a FIELD error rather than a 500 is what lets the
 * form say "The tag «Chilled» was removed while you were typing".
 */
async function assertLookupsExist(
  tagCode: string | undefined,
  filterTypeCode: string | undefined,
  em: EntityManager,
): Promise<void> {
  const fieldErrors: Record<string, string[]> = {};

  if (tagCode !== undefined) {
    const tag = await productTagRepository.findByCode(tagCode, em);
    if (!tag) fieldErrors.tagCode = ["products.errors.tagMissing"];
    else if (!tag.isActive) fieldErrors.tagCode = ["products.errors.tagRetired"];
  }

  if (filterTypeCode !== undefined) {
    const filterType = await productFilterTypeRepository.findByCode(
      filterTypeCode,
      em,
    );
    if (!filterType) {
      fieldErrors.filterTypeCode = ["products.errors.filterTypeMissing"];
    } else if (!filterType.isActive) {
      fieldErrors.filterTypeCode = ["products.errors.filterTypeRetired"];
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(fieldErrors, "products.errors.couldNotSave");
  }
}

/**
 * TRANSACTIONAL: the lookup checks and the insert must be atomic, or a tag
 * retired a millisecond later leaves a product pointing at a dead code — which
 * the FK would refuse anyway, as a 500 instead of a field error.
 *
 * A duplicate title is NOT rejected. A plant may legitimately stock two similar
 * jars, so the form warns and still allows the save.
 * See .claude/design/MODULES/02-products.md §5.4
 */
export async function createProduct(
  userId: string,
  input: CreateProductInput,
): Promise<ProductDto> {
  return withTx(async (em) => {
    await assertLookupsExist(input.tagCode, input.filterTypeCode, em);

    const product = await productRepository.create(
      {
        title: input.title,
        litres: input.litres,
        tagCode: input.tagCode,
        filterTypeCode: input.filterTypeCode,
        description: input.description ?? null,
        basePrice: input.basePrice,
        isReturnable: input.isReturnable,
        sortOrder: input.sortOrder,
        isActive: true,
        deactivatedAt: null,
        createdById: userId,
        updatedById: userId,
      },
      em,
    );

    logger.info({ userId, productId: product.id }, "product created");

    return toProductDto(product, await loadLookupLabels());
  }, userId);
}

/**
 * TRANSACTIONAL and row-locked: read-modify-write on a record the owner may be
 * editing in two tabs. Without the lock the later save silently discards the
 * earlier one's untouched fields.
 *
 * Raising the price here changes NOTHING about existing orders — every line
 * carries its own snapshot. That is the sentence the edit form puts on screen,
 * and it is true because of the snapshot columns, not because of anything here.
 */
export async function updateProduct(
  userId: string,
  id: string,
  input: UpdateProductInput,
): Promise<ProductDto> {
  return withTx(async (em) => {
    const product = await productRepository.findByIdForUpdate(id, em);
    if (!product) throw new NotFoundError("Product", { id });

    await assertLookupsExist(
      input.tagCode !== undefined && input.tagCode !== product.tagCode
        ? input.tagCode
        : undefined,
      input.filterTypeCode !== undefined &&
        input.filterTypeCode !== product.filterTypeCode
        ? input.filterTypeCode
        : undefined,
      em,
    );

    if (input.title !== undefined) product.title = input.title;
    if (input.litres !== undefined) product.litres = input.litres;
    if (input.tagCode !== undefined) product.tagCode = input.tagCode;
    if (input.filterTypeCode !== undefined) {
      product.filterTypeCode = input.filterTypeCode;
    }
    if (input.description !== undefined) {
      product.description = input.description;
    }
    if (input.basePrice !== undefined) product.basePrice = input.basePrice;
    if (input.isReturnable !== undefined) {
      product.isReturnable = input.isReturnable;
    }
    if (input.sortOrder !== undefined) product.sortOrder = input.sortOrder;

    if (input.isActive !== undefined && input.isActive !== product.isActive) {
      product.isActive = input.isActive;
      // The instant matters for "deactivated on", so this one is a real Date.
      product.deactivatedAt = input.isActive ? null : new Date();
    }

    product.updatedById = userId;

    const saved = await productRepository.save(product, em);
    logger.info({ userId, productId: id }, "product updated");

    return toProductDto(saved, await loadLookupLabels());
  }, userId);
}

/**
 * Deactivation is NEVER blocked, unlike staff.
 *
 * A deactivated product breaks nothing: it leaves new order forms, and every
 * past order still renders from its own snapshot. There is deliberately no
 * "in use" check here to fail on.
 * See .claude/design/MODULES/02-products.md §3.5
 */
export async function deactivateProduct(
  userId: string,
  id: string,
): Promise<ProductDto> {
  return setActive(userId, id, false);
}

export async function reactivateProduct(
  userId: string,
  id: string,
): Promise<ProductDto> {
  return setActive(userId, id, true);
}

async function setActive(
  userId: string,
  id: string,
  isActive: boolean,
): Promise<ProductDto> {
  return withTx(async (em) => {
    const product = await productRepository.findByIdForUpdate(id, em);
    if (!product) throw new NotFoundError("Product", { id });

    // Already in the target state: return the record rather than throwing, so
    // a double-clicked Undo is a no-op instead of an error toast.
    if (product.isActive !== isActive) {
      product.isActive = isActive;
      product.deactivatedAt = isActive ? null : new Date();
      product.updatedById = userId;
      await productRepository.save(product, em);
      logger.info(
        { userId, productId: id, isActive },
        isActive ? "product reactivated" : "product deactivated",
      );
    }

    return toProductDto(product, await loadLookupLabels());
  }, userId);
}
