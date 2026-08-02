import type { DeliveryOrderDetailDto } from "@/lib/dto/delivery-order.dto";

/**
 * The form's shape and its builders.
 *
 * A plain `.ts` module, deliberately: `order-form.tsx` is `"use client"`, and a
 * server component may RENDER a client component but may not CALL one of its
 * exports. `/orders/new` builds the initial values on the server, so the
 * builders have to live on this side of the boundary.
 */

export interface OrderFormLine {
  /** Present only for an existing line on the edit form. */
  id?: string;
  productId: string;
  productTitle: string;
  /** The catalogue price, for comparison. Never sent. */
  basePrice: number;
  quantity: number | null;
  /** `null` means "charge the base price" — the API treats it that way too. */
  unitPrice: number | null;
  isReturnable: boolean;
}

export interface OrderFormValues {
  staffId: string;
  staffLabel: string;
  orderDate: string;
  discountAmount: number | null;
  notes: string;
  lines: OrderFormLine[];
}

export function blankLine(): OrderFormLine {
  return {
    productId: "",
    productTitle: "",
    basePrice: 0,
    quantity: null,
    unitPrice: null,
    isReturnable: true,
  };
}

export function blankOrder(orderDate: string): OrderFormValues {
  return {
    staffId: "",
    staffLabel: "",
    orderDate,
    discountAmount: null,
    notes: "",
    lines: [blankLine()],
  };
}

/** An existing order, ready for the edit form. */
export function toFormValues(order: DeliveryOrderDetailDto): OrderFormValues {
  return {
    staffId: order.staffId,
    staffLabel: order.staffName,
    orderDate: order.orderDate,
    discountAmount: order.discountAmount || null,
    notes: order.notes ?? "",
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      // The SNAPSHOT, not the product's title today. A line reprints as it was
      // issued even if the catalogue has since been renamed.
      productTitle: line.productTitle,
      basePrice: line.productBasePrice,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      isReturnable: line.isReturnable,
    })),
  };
}

/**
 * Line total for the LIVE PREVIEW only.
 *
 * The figure that is stored is a generated column; this exists so the owner can
 * see the bill add up as he types. Rounded per line exactly as the database
 * does, and nothing here accumulates across lines beyond the visible subtotal.
 */
export function previewLineTotal(line: OrderFormLine): number {
  const price = line.unitPrice ?? line.basePrice;
  return Math.round((line.quantity ?? 0) * price * 100) / 100;
}

export function previewSubtotal(lines: OrderFormLine[]): number {
  return Math.round(lines.reduce((sum, l) => sum + previewLineTotal(l), 0) * 100) / 100;
}

/** Charged below (or above) the catalogue price — the bargain worth surfacing. */
export function priceDelta(line: OrderFormLine): number {
  if (line.unitPrice === null) return 0;
  return Math.round((line.unitPrice - line.basePrice) * 100) / 100;
}
