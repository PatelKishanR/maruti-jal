import type {
  DeliveryOrder,
  OrderItem,
  OrderItemReturnEvent,
  Payment,
} from "@/lib/db/entities";
import type {
  OrderStatus,
  PaymentDirection,
  PaymentMode,
  PaymentStatus,
  ReturnStatus,
} from "@/lib/db/entities/enums";
import type { ListResult } from "@/lib/table/types";

/**
 * Plain shapes crossing the server → client boundary.
 *
 * TypeORM entities are CLASS INSTANCES and React's server-component serialiser
 * rejects them outright ("Only plain objects can be passed to Client
 * Components"). Mapping once here is also the only place a field can be kept
 * off the wire. See .claude/ARCHITECTURE.md §4.1 rule 8
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONE THING THIS FILE EXISTS TO MAKE EXPLICABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **The order total goes DOWN when unsold jars come home.** An order raised at
 * ₹1,400 for 40 jars becomes ₹1,330 the moment 2 unsold jars come back, because
 * `order_items.line_total` is generated as
 *
 *     round((quantity − returned_filled_qty) × unit_price, 2)
 *
 * The staff member is billed for what he SOLD, not for what he took. That is
 * decision D5 and MODULES/03 §9, and it is the single most counter-intuitive
 * rule in the application: to anyone who has not read that paragraph, a total
 * that changed after creation reads as a bug.
 *
 * So every level of this contract carries BOTH halves of the arithmetic, and
 * neither half is ever recomputed by the reader:
 *
 *   line   `grossLineTotal` − `filledReturnCredit` = `lineTotal`
 *   order  `grossAmount`    − `filledReturnCredit` = `subtotalAmount`
 *
 * The right-hand side is the stored, database-owned figure. The left-hand
 * figures are aggregated IN SQL by the repository — never summed in TypeScript,
 * here or in the components downstream. A UI that adds rupees in a `reduce`
 * reintroduces exactly the float error the numeric schema exists to prevent.
 * See .claude/ARCHITECTURE.md §9.1
 *
 * ── The two independent questions ────────────────────────────────────────
 *
 * MODULES/03 §1: "the order screen shows two independent things: how much money
 * is still to collect, and how many jars are still out". They are two badges,
 * two filters and two statuses — `paymentStatus` and `returnStatus` — and one
 * is never derived from the other. An order can be fully paid with twelve jars
 * out, and fully returned with nothing collected.
 *
 * `outstandingAmount` is SIGNED, exactly like the coin register:
 *
 *   > 0  still to collect                → amber, `₹450 due`
 *   = 0  closed                          → green, `Paid`
 *   < 0  collected more than due         → yellow, `Overpaid` (allowed, §5.1)
 */

/* ── Lines ────────────────────────────────────────────────────────────── */

export interface OrderLineDto {
  id: string;
  /** Position, and the line's identity. Uniqueness is `(order_id, line_no)`. */
  lineNo: number;
  /** Kept for analytics grouping only — every string below is a snapshot. */
  productId: string;

  /**
   * The SNAPSHOTS, taken when the line was created and immutable afterwards.
   * Renaming, reclassifying or repricing the product tomorrow must not rewrite
   * what left the plant today. See .claude/DATA-MODEL.md §6
   */
  productTitle: string;
  productLitres: number;
  productTagCode: string;
  productFilterTypeCode: string;
  /** Snapshotted, so reclassifying a product cannot retroactively make an old
   *  line returnable. Non-returnable lines are excluded from every jar count. */
  isReturnable: boolean;
  /** The LIST price at order time — what makes `isPriceOverridden` meaningful. */
  productBasePrice: number;

  /** The bargained rate — what was actually charged. */
  unitPrice: number;
  /** Generated: `unit_price IS DISTINCT FROM product_base_price`. */
  isPriceOverridden: boolean;
  /** Signed: negative is a discount, positive a premium. Per jar. */
  priceDelta: number;
  priceOverrideNote: string | null;

  /** What went out on the vehicle. */
  quantity: number;

  /* Return counters — trigger-maintained caches over the append-only events. */
  returnedEmptyQty: number;
  /** Unsold. THIS is the number that reduces the line total. */
  returnedFilledQty: number;
  lostQty: number;
  /** Generated: `quantity − empty − filled − lost`. Still with customers. */
  pendingQty: number;

  /* ── The D5 arithmetic, spelled out so a screen never has to guess ──── */

  /** `round(quantity × unitPrice, 2)` — the line as raised. */
  grossLineTotal: number;
  /** `quantity − returnedFilledQty`. What he is actually billed for. */
  chargeableQuantity: number;
  /** `grossLineTotal − lineTotal` ≥ 0. The credit for unsold jars. */
  filledReturnCredit: number;
  /** GENERATED: `round((quantity − returnedFilledQty) × unitPrice, 2)`. */
  lineTotal: number;

  /** False for a disposable bottle, or when nothing is left out on the line. */
  canReturn: boolean;
}

/**
 * A still-open line belonging to some OTHER order of the same staff member.
 *
 * This is what makes §6.2 work: a customer hands back last week's jar when this
 * week's staff member calls, and it must be attributed to the line it went out
 * on. Carries its parent order's identity because the picker groups by order.
 */
export interface OpenReturnLineDto {
  orderItemId: string;
  orderId: string;
  orderCode: string;
  orderNo: number;
  orderDate: string;
  /** How long these jars have been out. Drives the ageing chip. */
  daysOut: number;
  lineNo: number;
  productId: string;
  productTitle: string;
  productLitres: number;
  unitPrice: number;
  quantity: number;
  returnedEmptyQty: number;
  returnedFilledQty: number;
  lostQty: number;
  /** Always > 0 — a line with nothing out is not an open line. */
  pendingQty: number;
}

/* ── Events ───────────────────────────────────────────────────────────── */

/**
 * One physical return: "8 empties and 2 filled came back on Thursday."
 *
 * APPEND-ONLY. A mistake is corrected by a REVERSAL — negative quantities and a
 * `reversesEventId` — and both rows stay visible. Hiding reversals would defeat
 * the point of the log, so the timeline renders them.
 */
export interface OrderReturnEventDto {
  id: string;
  orderItemId: string;
  /** Snapshot title of the line's product, so the timeline reads on its own. */
  productTitle: string;
  lineNo: number;
  returnDate: string;
  /** SIGNED — all three are ≤ 0 on a reversal. */
  emptyQty: number;
  filledQty: number;
  lostQty: number;
  /** `empty + filled + lost`. Negative on a reversal. */
  totalQty: number;
  note: string | null;
  reversesEventId: string | null;
  isReversal: boolean;
  createdAt: string;
}

export interface OrderPaymentDto {
  id: string;
  code: string;
  /** `OUT` is money leaving the company — a refund to the staff member. */
  direction: PaymentDirection;
  mode: PaymentMode;
  /** ALWAYS POSITIVE. The sign lives in `direction`, never in the number. */
  amount: number;
  paidOn: string;
  /* Set on a COIN payment and null on every other mode. */
  coinTypeId: string | null;
  coinCount: number | null;
  /** `rate6` SNAPSHOT of the per-coin price at receipt, not a live lookup. */
  coinUnitValue: number | null;
  referenceNo: string | null;
  note: string | null;
  reversesPaymentId: string | null;
  createdAt: string;
}

/* ── Items summary ────────────────────────────────────────────────────── */

/**
 * The list's `3 items / 62 units` chip — and the header's half of the D5
 * explanation.
 *
 * Every figure is a SQL aggregate over `order_items`, computed by the
 * repository in one grouped query for the whole page. `unitCount` counts every
 * line; `delivery_orders.qty_issued` counts only the RETURNABLE ones, which is
 * why both exist and why they legitimately differ on an order carrying
 * disposable bottles.
 */
export interface OrderItemsSummaryDto {
  lineCount: number;
  /** Σ quantity across all lines, returnable or not. */
  unitCount: number;
  /** Σ `round(quantity × unitPrice, 2)` — the order as raised. */
  grossAmount: number;
  /** Σ `round(returnedFilledQty × unitPrice, 2)` — the unsold-jar credit. */
  filledReturnCredit: number;
}

/* ── The order ────────────────────────────────────────────────────────── */

export interface DeliveryOrderDto {
  id: string;
  code: string;
  orderNo: number;
  staffId: string;
  staffName: string;
  staffPhone: string | null;
  orderDate: string;
  /** Lifecycle only. The money and jar states are the two statuses below. */
  status: OrderStatus;
  notes: string | null;

  /* ── Money. Every figure is stored; none is computed here. ──────────── */

  /** Σ `line_total` — trigger-maintained, and it FALLS when filled jars return. */
  subtotalAmount: number;
  /** The only money field the admin edits directly. */
  discountAmount: number;
  /** GENERATED: `subtotal_amount − discount_amount`. */
  totalAmount: number;
  paidCashAmount: number;
  paidCoinAmount: number;
  /** UPI, bank transfer and write-offs. */
  paidOtherAmount: number;
  paidTotalAmount: number;
  refundedAmount: number;
  /** GENERATED and SIGNED. Negative means more was collected than was due. */
  outstandingAmount: number;
  paymentStatus: PaymentStatus;
  /** Positive part of `outstandingAmount` — what is still to collect. */
  dueAmount: number;
  /** Magnitude of a negative `outstandingAmount`. */
  overpaidAmount: number;

  /* ── Jars. Returnable lines only, exactly like the columns behind them. */

  qtyIssued: number;
  qtyReturnedEmpty: number;
  qtyReturnedFilled: number;
  qtyLost: number;
  /** GENERATED: `issued − empty − filled − lost`. The "jars out" figure. */
  qtyPending: number;
  returnStatus: ReturnStatus;

  /* ── Timeline. Powers the "days outstanding" ageing badges. ──────────── */

  firstPaymentAt: string | null;
  lastPaymentAt: string | null;
  fullyPaidAt: string | null;
  fullyReturnedAt: string | null;
  /** Whole days since `orderDate`. */
  daysOld: number;

  /** Optimistic lock. Send it back on PATCH or a concurrent edit is lost. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * One row of the register. Design §7.
 *
 * `items` is a SQL-aggregated summary rather than the line array: the column is
 * a chip ("3 items / 62 units"), and shipping every line of every row would
 * multiply a 25-row page by its widest order for a string. The DETAIL response
 * carries the lines.
 */
export interface DeliveryOrderListItemDto extends DeliveryOrderDto {
  items: OrderItemsSummaryDto;
  /** Money left to collect or refund, and the order is not cancelled. */
  moneyPending: boolean;
  /** Jars still with customers, and the order is not cancelled. */
  jarsOut: boolean;
  /** Nothing to collect and nothing out. The green row. */
  settled: boolean;
}

export interface DeliveryOrderDetailDto extends DeliveryOrderListItemDto {
  lines: OrderLineDto[];
  /** Newest first, reversals included. */
  returns: OrderReturnEventDto[];
  /** Newest first. Append-only: corrections are reversing rows. */
  payments: OrderPaymentDto[];

  /* ── What the detail header may offer. Cancelled orders offer nothing. ── */

  canEdit: boolean;
  canRecordReturn: boolean;
  canRecordPayment: boolean;
  canRefund: boolean;
  /** §8: cancellation needs payments and returns reversed FIRST. */
  canCancel: boolean;

  /**
   * The §4 edit warning — story O14, "be warned before editing an order that
   * already has payments or returns". Not a block: the server allows the edit
   * and refuses only the specific impossibility (a quantity below what has
   * already come back, or removing a line with history).
   */
  hasPayments: boolean;
  hasReturns: boolean;
  /** Why `canCancel` is false, so the disabled button can say so. */
  cancelBlockedBy: ("payments" | "returns")[];
}

/* ── KPI strip ────────────────────────────────────────────────────────── */

/**
 * The §7.3 strip, summed IN SQL over the SAME filter set as the table minus
 * pagination.
 *
 * Filtered rather than global on purpose: every card is a door into the list
 * behind it, and a card that ignores the active filters sends the owner
 * somewhere he cannot get back from. "Today's orders" and "today's collection"
 * are therefore this same payload with `from=to=today`.
 *
 * CANCELLED ORDERS ARE EXCLUDED FROM EVERY MONEY AND JAR FIGURE BELOW, and only
 * from those. `fn_recompute_delivery_order` does not zero a cancelled order's
 * subtotal — it has no opinion about status — so a cancelled order keeps a
 * positive `outstanding_amount` forever. Counting it as money pending would
 * inflate the chase list with orders nobody will ever collect on.
 */
export interface DeliveryOrderSummaryDto {
  /** Every order matching the filters, cancelled ones included. */
  orderCount: number;
  cancelledCount: number;
  /** Σ `total_amount`. */
  totalAmount: number;
  /** Σ `paid_total_amount` — collected AGAINST these orders. */
  collectedAmount: number;
  refundedAmount: number;
  /** Σ outstanding where positive. Always positive. The chase list's headline. */
  outstandingAmount: number;
  /** Σ |outstanding| where negative. Always positive. */
  overpaidAmount: number;
  ordersWithMoneyPending: number;
  /** Σ `qty_pending` — jars physically out with customers right now. */
  jarsOut: number;
  ordersWithJarsOut: number;
  staffWithJarsOut: number;
}

export interface DeliveryOrderListResponseDto
  extends ListResult<DeliveryOrderListItemDto> {
  summary: DeliveryOrderSummaryDto;
}

/* ── Mappers ──────────────────────────────────────────────────────────── */

/**
 * Two stored two-decimal figures, or an INTEGER times a stored two-decimal
 * figure. Never a running total: this rounds one product, exactly as the
 * generated column does, and nothing here iterates.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whole days between two business dates — string arithmetic, never `Date`. */
function daysBetweenDates(from: string, to: string): number {
  const parse = (iso: string): number => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function toOrderLineDto(item: OrderItem): OrderLineDto {
  /**
   * `quantity` is an integer and `unitPrice` carries exactly two decimals, so
   * the product is exact at two decimals before `round2` ever sees it — the
   * same arithmetic PostgreSQL performs for `line_total`, on the same inputs.
   *
   * The CREDIT is then derived by subtracting the STORED `lineTotal` rather
   * than by multiplying `returnedFilledQty` afresh. Both are exact, but only
   * one of them can never drift from the header the trigger maintains.
   */
  const grossLineTotal = round2(item.quantity * item.unitPrice);

  return {
    id: item.id,
    lineNo: item.lineNo,
    productId: item.productId,
    productTitle: item.productTitle,
    productLitres: item.productLitres,
    productTagCode: item.productTagCode,
    productFilterTypeCode: item.productFilterTypeCode,
    isReturnable: item.isReturnable,
    productBasePrice: item.productBasePrice,
    unitPrice: item.unitPrice,
    isPriceOverridden: item.isPriceOverridden,
    priceDelta: round2(item.unitPrice - item.productBasePrice),
    priceOverrideNote: item.priceOverrideNote,
    quantity: item.quantity,
    returnedEmptyQty: item.returnedEmptyQty,
    returnedFilledQty: item.returnedFilledQty,
    lostQty: item.lostQty,
    pendingQty: item.pendingQty,
    grossLineTotal,
    chargeableQuantity: item.quantity - item.returnedFilledQty,
    filledReturnCredit: round2(grossLineTotal - item.lineTotal),
    lineTotal: item.lineTotal,
    canReturn: item.isReturnable && item.pendingQty > 0,
  };
}

/** Requires `oi.order` to be joined — `findOpenLinesByStaff` joins it. */
export function toOpenReturnLineDto(
  item: OrderItem,
  today: string,
): OpenReturnLineDto {
  const order = item.order;

  return {
    orderItemId: item.id,
    orderId: item.orderId,
    orderCode: order?.code ?? "",
    orderNo: order?.orderNo ?? 0,
    orderDate: order?.orderDate ?? "",
    daysOut: order?.orderDate ? daysBetweenDates(order.orderDate, today) : 0,
    lineNo: item.lineNo,
    productId: item.productId,
    productTitle: item.productTitle,
    productLitres: item.productLitres,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    returnedEmptyQty: item.returnedEmptyQty,
    returnedFilledQty: item.returnedFilledQty,
    lostQty: item.lostQty,
    pendingQty: item.pendingQty,
  };
}

export function toOrderReturnEventDto(
  event: OrderItemReturnEvent,
  line: { lineNo: number; productTitle: string },
): OrderReturnEventDto {
  return {
    id: event.id,
    orderItemId: event.orderItemId,
    productTitle: line.productTitle,
    lineNo: line.lineNo,
    returnDate: event.returnDate,
    emptyQty: event.emptyQty,
    filledQty: event.filledQty,
    lostQty: event.lostQty,
    totalQty: event.emptyQty + event.filledQty + event.lostQty,
    note: event.note,
    reversesEventId: event.reversesEventId,
    isReversal: event.reversesEventId !== null,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toOrderPaymentDto(payment: Payment): OrderPaymentDto {
  return {
    id: payment.id,
    code: payment.code,
    direction: payment.direction,
    mode: payment.mode,
    amount: payment.amount,
    paidOn: payment.paidOn,
    coinTypeId: payment.coinTypeId,
    coinCount: payment.coinCount,
    coinUnitValue: payment.coinUnitValue,
    referenceNo: payment.referenceNo,
    note: payment.note,
    reversesPaymentId: payment.reversesPaymentId,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toDeliveryOrderDto(
  order: DeliveryOrder,
  today: string,
): DeliveryOrderDto {
  const outstanding = order.outstandingAmount;

  return {
    id: order.id,
    code: order.code,
    orderNo: order.orderNo,
    staffId: order.staffId,
    // The staff relation is joined by `searchPaginated` and
    // `findByIdWithItems`; a row read without it still renders its own code.
    staffName: order.staff?.name ?? "",
    staffPhone: order.staff?.phone ?? null,
    orderDate: order.orderDate,
    status: order.status,
    notes: order.notes,
    subtotalAmount: order.subtotalAmount,
    discountAmount: order.discountAmount,
    totalAmount: order.totalAmount,
    paidCashAmount: order.paidCashAmount,
    paidCoinAmount: order.paidCoinAmount,
    paidOtherAmount: order.paidOtherAmount,
    paidTotalAmount: order.paidTotalAmount,
    refundedAmount: order.refundedAmount,
    outstandingAmount: outstanding,
    paymentStatus: order.paymentStatus,
    dueAmount: outstanding > 0 ? outstanding : 0,
    overpaidAmount: outstanding < 0 ? -outstanding : 0,
    qtyIssued: order.qtyIssued,
    qtyReturnedEmpty: order.qtyReturnedEmpty,
    qtyReturnedFilled: order.qtyReturnedFilled,
    qtyLost: order.qtyLost,
    qtyPending: order.qtyPending,
    returnStatus: order.returnStatus,
    firstPaymentAt: order.firstPaymentAt?.toISOString() ?? null,
    lastPaymentAt: order.lastPaymentAt?.toISOString() ?? null,
    fullyPaidAt: order.fullyPaidAt?.toISOString() ?? null,
    fullyReturnedAt: order.fullyReturnedAt?.toISOString() ?? null,
    daysOld: daysBetweenDates(order.orderDate, today),
    version: order.version,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

const EMPTY_ITEMS: OrderItemsSummaryDto = {
  lineCount: 0,
  unitCount: 0,
  grossAmount: 0,
  filledReturnCredit: 0,
};

export function toDeliveryOrderListItemDto(
  order: DeliveryOrder,
  items: OrderItemsSummaryDto | undefined,
  today: string,
): DeliveryOrderListItemDto {
  const base = toDeliveryOrderDto(order, today);
  const live = order.status !== "CANCELLED";
  const moneyPending = live && base.outstandingAmount !== 0;
  const jarsOut = live && base.qtyPending > 0;

  return {
    ...base,
    items: items ?? EMPTY_ITEMS,
    moneyPending,
    jarsOut,
    settled: live && !moneyPending && !jarsOut,
  };
}

export function toDeliveryOrderDetailDto(
  order: DeliveryOrder,
  items: OrderItemsSummaryDto | undefined,
  lines: OrderLineDto[],
  returns: OrderReturnEventDto[],
  payments: OrderPaymentDto[],
  today: string,
): DeliveryOrderDetailDto {
  const base = toDeliveryOrderListItemDto(order, items, today);
  const live = order.status !== "CANCELLED";

  const hasPayments = payments.length > 0;
  const hasReturns = returns.length > 0;

  /**
   * §8: "Cancellation requires payments and returns to be reversed first.
   * Money is never cascade-deleted." Both blockers are reported so the
   * disabled button can name the one the owner has to clear.
   */
  const cancelBlockedBy: ("payments" | "returns")[] = [];
  if (hasPayments) cancelBlockedBy.push("payments");
  if (hasReturns) cancelBlockedBy.push("returns");

  return {
    ...base,
    lines,
    returns,
    payments,
    canEdit: live,
    canRecordReturn: live && lines.some((line) => line.canReturn),
    canRecordPayment: live && base.outstandingAmount > 0,
    // A refund is offered only when there is genuinely money to give back.
    canRefund: live && base.outstandingAmount < 0,
    canCancel: live && cancelBlockedBy.length === 0,
    hasPayments,
    hasReturns,
    cancelBlockedBy,
  };
}
