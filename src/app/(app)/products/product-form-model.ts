import type { ProductDto } from "@/lib/dto/product.dto";

/**
 * The form's shape and its two pure builders.
 *
 * These live OUTSIDE product-form.tsx because that file is `"use client"`, and
 * a server component may not CALL an export of a client module — it may only
 * render it as a component or pass it as a prop. `/products/new` builds the
 * initial values on the server, so the builders have to sit on this side of
 * the boundary.
 */

export interface ProductFormInitial {
  title: string;
  litres: number | null;
  basePrice: number | null;
  tagCode: string;
  filterTypeCode: string;
  description: string;
  isReturnable: boolean;
  sortOrder: number | null;
  isActive: boolean;
}

/**
 * A fresh form: returnable ON, sort order 100, everything else blank.
 * `duplicate` pre-fills from an existing product with ` (copy)` appended.
 */
export function blankProduct(
  duplicateOf?: ProductDto,
  copySuffix = " (copy)",
): ProductFormInitial {
  if (duplicateOf) {
    return {
      title: `${duplicateOf.title}${copySuffix}`,
      litres: duplicateOf.litres,
      basePrice: duplicateOf.basePrice,
      tagCode: duplicateOf.tagCode,
      filterTypeCode: duplicateOf.filterTypeCode,
      description: duplicateOf.description ?? "",
      isReturnable: duplicateOf.isReturnable,
      sortOrder: duplicateOf.sortOrder,
      isActive: true,
    };
  }

  return {
    title: "",
    litres: null,
    basePrice: null,
    tagCode: "",
    filterTypeCode: "",
    description: "",
    isReturnable: true,
    sortOrder: 100,
    isActive: true,
  };
}

/** An existing record, ready for the edit form. */
export function toFormInitial(product: ProductDto): ProductFormInitial {
  return {
    title: product.title,
    litres: product.litres,
    basePrice: product.basePrice,
    tagCode: product.tagCode,
    filterTypeCode: product.filterTypeCode,
    description: product.description ?? "",
    isReturnable: product.isReturnable,
    sortOrder: product.sortOrder,
    isActive: product.isActive,
  };
}
