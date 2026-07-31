import type {
  PartyOrder,
  PartyOrderDay,
  PartyOrderItem,
  Payment,
} from "@/lib/db/entities";
import type {
  DayDeliveryStatus,
  PartyOrderStatus,
  PaymentMode,
  PaymentStatus,
} from "@/lib/db/entities/enums";
import type { ListResult } from "@/lib/table/types";

/**
 * Plain shapes crossing the server → client boundary.
 *
 * TypeORM entities are CLASS INSTANCES, and React's server-component
 * serialiser rejects any object whose prototype isn't Object.prototype.
 * Mapping once here also keeps `searchBlob`, `deletedById` and every other
 * internal column out of the browser by construction.
 * See .claude/ARCHITECTURE.md §4.1
 *
 * **Every business date is `'YYYY-MM-DD'`; every instant is an ISO string.**
 * The `date` columns already arrive as strings (a global pg type parser sees to
 * it), so a party schedule cannot drift by a day between the database and the
 * calendar grid. See .claude/ARCHITECTURE.md §9.2
 *
 * **No total in here is computed in TypeScript.** `lineTotal`, `dayTotal`,
 * `totalAmount`, `paidAmount`, `advanceAmount` and `outstandingAmount` are all
 * generated columns or trigger-maintained rollups — this file copies them.
 * Unit COUNTS are summed here, because a count is not money.
 * See .claude/ARCHITECTURE.md §9.1
 */

export interface PartyOrderItemDto {
  id: string;
  lineNo: number;
  productId: string;
  /** The snapshot, not a live join — a rename must not rewrite a past event. */
  productTitle: string;
  productLitres: number;
  /** The LIST price when the line was created. Drives the override strip. */
  productBasePrice: number;
  /** The negotiated rate. Events are always negotiated. */
  unitPrice: number;
  quantity: number;
  /** NULL until someone reconciles on the day. */
  deliveredQuantity: number | null;
  /** Generated: `round(coalesce(delivered, planned) * unit_price, 2)`. */
  lineTotal: number;
}

export interface PartyOrderDayDto {
  id: string;
  /** `'YYYY-MM-DD'`. Unique within the booking. */
  serviceDate: string;
  deliveryStatus: DayDeliveryStatus;
  assignedStaffId: string | null;
  /** Resolved by the service from the staff repository, never a join here. */
  assignedStaffName: string | null;
  /** ISO instant, stamped when the day is marked delivered. */
  deliveredAt: string | null;
  /** Trigger-maintained Σ of this day's `line_total`. */
  dayTotal: number;
  /** Σ of `coalesce(delivered, planned)`. A count, so summing it here is fine. */
  totalUnits: number;
  notes: string | null;
  items: PartyOrderItemDto[];
}

/** How far through its schedule a booking is — the `3/5 days` fraction. */
export interface PartyOrderProgressDto {
  totalDays: number;
  deliveredDays: number;
  skippedDays: number;
  cancelledDays: number;
  scheduledDays: number;
  /** The next day still SCHEDULED, `'YYYY-MM-DD'`. Drives `next 20 Aug`. */
  nextServiceDate: string | null;
}

export interface PartyOrderListItemDto {
  id: string;
  /** `PTY-000045` — generated, never editable. */
  code: string;
  partyName: string;
  phone: string;
  altPhone: string | null;
  deliveryAddress: string;
  status: PartyOrderStatus;
  paymentStatus: PaymentStatus;
  firstServiceDate: string | null;
  lastServiceDate: string | null;
  totalAmount: number;
  paidAmount: number;
  advanceAmount: number;
  refundedAmount: number;
  /** Signed. Negative means the company owes a refund. */
  outstandingAmount: number;
  progress: PartyOrderProgressDto;
  /** The row the owner is looking for at 6 am gets a blue left border. */
  hasDeliveryToday: boolean;
}

export interface PartyOrderDto extends PartyOrderListItemDto {
  createdAt: string;
  updatedAt: string;
  /** Optimistic lock — the edit form sends it back. */
  version: number;
}

export interface PartyPaymentDto {
  id: string;
  code: string;
  /** `IN` is money received; `OUT` is a refund paid back. */
  direction: "IN" | "OUT";
  mode: PaymentMode;
  amount: number;
  /**
   * A SUBSET of what is paid, not a separate bucket — subtracting both would
   * double-count. See .claude/MODULES/05-party-orders.md §7
   */
  isAdvance: boolean;
  paidOn: string;
  referenceNo: string | null;
  note: string | null;
  /** Set on the reversing entry; the original stays visible forever. */
  reversesPaymentId: string | null;
  /** True when some LATER entry reverses this one. Drives the ⋯ menu. */
  isReversed: boolean;
  createdAt: string;
}

export interface PartyOrderDetailDto extends PartyOrderDto {
  /** Ascending by date — the timeline reads forwards. */
  days: PartyOrderDayDto[];
  /** Newest first — the timeline component does not sort. */
  payments: PartyPaymentDto[];
  /** Σ of `coalesce(delivered, planned)` over billable days. A count. */
  totalUnits: number;
}

export interface PartyOrderKpisDto {
  activeParties: number;
  startingThisWeek: number;
  /** SCHEDULED days from today onwards, across every live booking. */
  daysScheduled: number;
  deliveriesToday: number;
  unitsToday: number;
  /** Who is out today. Already de-duplicated and ordered. */
  staffToday: string[];
  /** Billable value of this month's days. From SQL, never a TS sum. */
  revenueThisMonth: number;
  bookingsThisMonth: number;
  /** Same figure for the previous month, so the card can show a trend. */
  revenuePreviousMonth: number;
  /** `YYYY-MM` the revenue card covers. */
  month: string;
  totalOutstanding: number;
  partiesOutstanding: number;
  /** Days since the oldest outstanding booking's first service date. */
  oldestOutstandingDays: number | null;
}

export interface PartyOrderListResponseDto {
  result: ListResult<PartyOrderListItemDto>;
  kpis: PartyOrderKpisDto;
}

/**
 * The picker option. Structurally identical to `ComboboxOption` in
 * `components/form`, declared here so a service never imports a client
 * component for a type.
 */
export interface PartyOrderOptionDto {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════
   Calendar — design §10
   ═══════════════════════════════════════════════════════════════════════ */

/** One pill in a calendar cell. */
export interface PartyCalendarDeliveryDto {
  dayId: string;
  partyOrderId: string;
  code: string;
  partyName: string;
  serviceDate: string;
  deliveryStatus: DayDeliveryStatus;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  units: number;
  dayTotal: number;
  /** `20L Jar × 50 · 1L Bottle × 100` — built once, for the pill tooltip. */
  itemsSummary: string;
}

export interface PartyCalendarDto {
  /** `YYYY-MM`. */
  month: string;
  /** Inclusive bounds of the grid's data window, `'YYYY-MM-DD'`. */
  from: string;
  to: string;
  deliveries: PartyCalendarDeliveryDto[];
  /** Every staff member with a delivery this month — the chip row. */
  staff: { id: string; name: string }[];
  totals: {
    bookings: number;
    days: number;
    units: number;
    /** From a SQL aggregate over `party_order_days`. */
    amount: number;
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Mappers
   ═══════════════════════════════════════════════════════════════════════ */

/** What a line actually bills: the actual figure once it exists, else the plan. */
export function billedQuantity(item: {
  quantity: number;
  deliveredQuantity: number | null;
}): number {
  return item.deliveredQuantity ?? item.quantity;
}

export function toPartyOrderItemDto(item: PartyOrderItem): PartyOrderItemDto {
  return {
    id: item.id,
    lineNo: item.lineNo,
    productId: item.productId,
    productTitle: item.productTitle,
    productLitres: item.productLitres,
    productBasePrice: item.productBasePrice,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    deliveredQuantity: item.deliveredQuantity,
    lineTotal: item.lineTotal,
  };
}

export function toPartyOrderDayDto(
  day: PartyOrderDay,
  staffNames: ReadonlyMap<string, string>,
): PartyOrderDayDto {
  const items = (day.items ?? []).map(toPartyOrderItemDto);

  return {
    id: day.id,
    serviceDate: day.serviceDate,
    deliveryStatus: day.deliveryStatus,
    assignedStaffId: day.assignedStaffId,
    assignedStaffName: day.assignedStaffId
      ? (staffNames.get(day.assignedStaffId) ?? null)
      : null,
    deliveredAt: day.deliveredAt?.toISOString() ?? null,
    dayTotal: day.dayTotal,
    // A COUNT of jars, not money — this is the one sum TypeScript may do.
    totalUnits: items.reduce((sum, item) => sum + billedQuantity(item), 0),
    notes: day.notes,
    items,
  };
}

/** A booking with no schedule rows yet still has a well-formed progress block. */
export function emptyProgress(totalDays = 0): PartyOrderProgressDto {
  return {
    totalDays,
    deliveredDays: 0,
    skippedDays: 0,
    cancelledDays: 0,
    scheduledDays: totalDays,
    nextServiceDate: null,
  };
}

export function toPartyOrderListItemDto(
  order: PartyOrder,
  progress: PartyOrderProgressDto,
  today: string,
): PartyOrderListItemDto {
  return {
    id: order.id,
    code: order.code,
    partyName: order.partyName,
    phone: order.phone,
    altPhone: order.altPhone,
    deliveryAddress: order.deliveryAddress,
    status: order.status,
    paymentStatus: order.paymentStatus,
    firstServiceDate: order.firstServiceDate,
    lastServiceDate: order.lastServiceDate,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    advanceAmount: order.advanceAmount,
    refundedAmount: order.refundedAmount,
    outstandingAmount: order.outstandingAmount,
    progress,
    hasDeliveryToday:
      order.status !== "CANCELLED" &&
      order.firstServiceDate !== null &&
      order.lastServiceDate !== null &&
      order.firstServiceDate <= today &&
      order.lastServiceDate >= today,
  };
}

export function toPartyOrderDto(
  order: PartyOrder,
  progress: PartyOrderProgressDto,
  today: string,
): PartyOrderDto {
  return {
    ...toPartyOrderListItemDto(order, progress, today),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    version: order.version,
  };
}

export function toPartyPaymentDto(
  payment: Payment,
  reversedIds: ReadonlySet<string>,
): PartyPaymentDto {
  return {
    id: payment.id,
    code: payment.code,
    direction: payment.direction,
    mode: payment.mode,
    amount: payment.amount,
    isAdvance: payment.isAdvance,
    paidOn: payment.paidOn,
    referenceNo: payment.referenceNo,
    note: payment.note,
    reversesPaymentId: payment.reversesPaymentId,
    isReversed: reversedIds.has(payment.id),
    createdAt: payment.createdAt.toISOString(),
  };
}

/**
 * Progress derived from days already in memory.
 *
 * Used on the DETAIL page, where the whole schedule is loaded anyway. The LIST
 * page cannot do this — it would mean loading every day of every booking on the
 * page — so it uses a grouped SQL aggregate instead.
 */
export function progressFromDays(
  days: readonly { serviceDate: string; deliveryStatus: DayDeliveryStatus }[],
): PartyOrderProgressDto {
  let delivered = 0;
  let skipped = 0;
  let cancelled = 0;
  let scheduled = 0;
  let next: string | null = null;

  for (const day of days) {
    switch (day.deliveryStatus) {
      case "DELIVERED":
        delivered += 1;
        break;
      case "SKIPPED":
        skipped += 1;
        break;
      case "CANCELLED":
        cancelled += 1;
        break;
      default:
        scheduled += 1;
        if (next === null || day.serviceDate < next) next = day.serviceDate;
    }
  }

  return {
    totalDays: days.length,
    deliveredDays: delivered,
    skippedDays: skipped,
    cancelledDays: cancelled,
    scheduledDays: scheduled,
    nextServiceDate: next,
  };
}
