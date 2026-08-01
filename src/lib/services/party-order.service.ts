import "server-only";
import type { EntityManager } from "typeorm";
import { withTx } from "@/lib/db/data-source";
import { partyOrderRepository } from "@/lib/repositories/party-order.repository";
import { partyOrderDayRepository } from "@/lib/repositories/party-order-day.repository";
import { partyOrderItemRepository } from "@/lib/repositories/party-order-item.repository";
import { paymentRepository } from "@/lib/repositories/payment.repository";
import { productRepository } from "@/lib/repositories/product.repository";
import { staffRepository } from "@/lib/repositories/staff.repository";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { addDays, daysBetween, monthBounds, todayIST } from "@/lib/dates";
import { formatQuantity } from "@/lib/money";
import {
  partyOrderTableConfig,
  type PartyOrderDeliveryFilter,
  type PartyOrderPaymentFilter,
  type PartyOrderSortKey,
} from "@/lib/table/configs/party-order";
import type {
  DayDeliveryStatus,
  PartyOrderStatus,
  PaymentStatus,
} from "@/lib/db/entities/enums";
import type {
  PartyOrder,
  PartyOrderDay,
  PartyOrderItem,
  Product,
} from "@/lib/db/entities";
import {
  billedQuantity,
  progressFromDays,
  toPartyOrderDayDto,
  toPartyOrderDto,
  toPartyOrderListItemDto,
  toPartyPaymentDto,
  type PartyCalendarDeliveryDto,
  type PartyCalendarDto,
  type PartyOrderDetailDto,
  type PartyOrderDto,
  type PartyOrderKpisDto,
  type PartyOrderListResponseDto,
  type PartyOrderOptionDto,
  type PartyOrderProgressDto,
} from "@/lib/dto/party-order.dto";
import type {
  AddPartyOrderDaysInput,
  CancelPartyOrderInput,
  CreatePartyOrderDayInput,
  CreatePartyOrderInput,
  PartyCalendarQuery,
  PartyOrderListQuery,
  PartyOrderOptionsQuery,
  RecordPartyPaymentInput,
  UpdatePartyOrderDayInput,
  UpdatePartyOrderInput,
} from "@/lib/validation/party-order";
import type { PartyOrderItemInput } from "@/lib/validation/party-order";

/**
 * Business rules for event bookings. Spec: .claude/MODULES/05-party-orders.md
 *
 * Three facts shape everything here:
 *
 * 1. **A booking is ONE ROW PER DATE**, never a recurrence rule. The repeat
 *    generator in the UI produces rows and then gets out of the way, so
 *    everything below treats a generated day and a hand-added day identically.
 *    See .claude/DATA-MODEL.md §5.16
 *
 * 2. **No total in this file is computed in TypeScript.** `line_total` is a
 *    generated column, `day_total` and `total_amount` are trigger-maintained,
 *    and `outstanding_amount` is generated from the header. Every write here
 *    therefore RE-READS the aggregate before mapping it — the entity in memory
 *    is stale the moment a child row lands.
 *    See .claude/ARCHITECTURE.md §9.1 · db/migrations/…-Rollups.ts §E
 *
 * 3. **An advance is a SUBSET of `paid_amount`**, flagged rather than bucketed.
 *    Nothing here adds it a second time.
 *
 * Repositories only — no `getRepository`, no SQL. Returns DTOs, never entities.
 * See .claude/ARCHITECTURE.md §4
 */

/* ═══════════════════════════════════════════════════════════════════════
   Filter vocabulary → database enums

   The owner thinks in "upcoming / in progress / completed"; the column holds
   CONFIRMED / IN_PROGRESS / COMPLETED. The mapping lives here, once, because
   the config is client-safe and must not import entity enums.
   ═══════════════════════════════════════════════════════════════════════ */

const DELIVERY_FILTER_STATUSES: Record<
  PartyOrderDeliveryFilter,
  PartyOrderStatus[] | undefined
> = {
  all: undefined,
  // A booking nobody has delivered against yet is "upcoming", whatever its
  // dates say — see the note in table/configs/party-order.ts.
  upcoming: ["DRAFT", "CONFIRMED"],
  inProgress: ["IN_PROGRESS"],
  completed: ["COMPLETED"],
  cancelled: ["CANCELLED"],
};

const PAYMENT_FILTER_STATUSES: Record<
  PartyOrderPaymentFilter,
  PaymentStatus[] | undefined
> = {
  all: undefined,
  unpaid: ["UNPAID"],
  partial: ["PARTIAL"],
  paid: ["PAID"],
  overpaid: ["OVERPAID"],
  refundDue: ["REFUND_DUE"],
};

/* ═══════════════════════════════════════════════════════════════════════
   Shared loading helpers
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Staff names for a set of day assignments.
 *
 * One `findById` per DISTINCT staff member rather than a join: `party_order_days`
 * belongs to the party-order aggregate and `staff` does not, so a join would put
 * two entities in one repository. The distinct set is a handful of people even
 * across a month of deliveries. See .claude/ARCHITECTURE.md §4.1 rule 4
 */
async function resolveStaffNames(
  ids: readonly (string | null)[],
  em?: EntityManager,
): Promise<Map<string, string>> {
  const distinct = [...new Set(ids.filter((id): id is string => !!id))];
  if (distinct.length === 0) return new Map();

  const rows = await Promise.all(
    distinct.map((id) => staffRepository.findById(id, em)),
  );

  const names = new Map<string, string>();
  for (const staff of rows) {
    if (staff) names.set(staff.id, staff.name);
  }
  return names;
}

/** Which payments have been reversed by some LATER entry. A set, not money. */
function reversedPaymentIds(
  payments: readonly { reversesPaymentId: string | null }[],
): Set<string> {
  const ids = new Set<string>();
  for (const payment of payments) {
    if (payment.reversesPaymentId) ids.add(payment.reversesPaymentId);
  }
  return ids;
}

/**
 * The whole booking, mapped.
 *
 * Called after every write as well as by `GET`, because the rollup triggers ran
 * inside the transaction and the entity the write returned no longer matches
 * the row.
 */
async function loadDetail(
  id: string,
  em?: EntityManager,
): Promise<PartyOrderDetailDto> {
  const order = await partyOrderRepository.findByIdWithSchedule(id, em);
  if (!order) throw new NotFoundError("Party order", { id });

  const days = sortDays(order.days ?? []);
  const [payments, staffNames] = await Promise.all([
    paymentRepository.findByPartyOrderId(id, em),
    resolveStaffNames(
      days.map((day) => day.assignedStaffId),
      em,
    ),
  ]);

  const dayDtos = days.map((day) => toPartyOrderDayDto(day, staffNames));
  const reversed = reversedPaymentIds(payments);

  return {
    ...toPartyOrderDto(order, progressFromDays(days), todayIST()),
    days: dayDtos,
    payments: payments.map((payment) => toPartyPaymentDto(payment, reversed)),
    // A COUNT of jars over the days that bill, which is the one sum TypeScript
    // is allowed to do. Skipped and cancelled days deliver nothing.
    totalUnits: dayDtos
      .filter(
        (day) =>
          day.deliveryStatus !== "SKIPPED" && day.deliveryStatus !== "CANCELLED",
      )
      .reduce((sum, day) => sum + day.totalUnits, 0),
  };
}

/**
 * Ascending by date, always.
 *
 * The repository asks for it in SQL, but a day inserted inside the same
 * transaction arrives in insert order, and the timeline reads forwards.
 * String comparison IS date comparison for `'YYYY-MM-DD'`.
 */
function sortDays<T extends { serviceDate: string }>(days: readonly T[]): T[] {
  return [...days].sort((a, b) =>
    a.serviceDate < b.serviceDate ? -1 : a.serviceDate > b.serviceDate ? 1 : 0,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Reads
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * The list, its KPI strip and each row's `3/5 days`, in one response.
 *
 * The KPIs cover every booking rather than the twenty-five on screen, so they
 * are their own aggregates — but they travel with the list because the page
 * renders them together, and two round trips would only let the strip and the
 * table disagree while one was in flight.
 */
export async function listPartyOrders(
  query: PartyOrderListQuery,
): Promise<PartyOrderListResponseDto> {
  /**
   * The injection defence restated at the point of use: `query.sort` is already
   * narrowed to a key of the allowlist by Zod, and here it is used ONLY as a
   * lookup key. Anything that somehow missed both falls back to the default.
   * See .claude/ARCHITECTURE.md §6.2
   */
  const sort = (
    Object.hasOwn(partyOrderTableConfig.sortable, query.sort)
      ? query.sort
      : partyOrderTableConfig.defaultSort.key
  ) as PartyOrderSortKey;

  const [{ rows, total }, kpis] = await Promise.all([
    partyOrderRepository.searchPaginated({
      search: query.q || undefined,
      status: DELIVERY_FILTER_STATUSES[query.delivery],
      paymentStatus: PAYMENT_FILTER_STATUSES[query.payment],
      dateFrom: query.from,
      dateTo: query.to,
      outstandingOnly: query.outstanding,
      sort,
      direction: query.dir === "desc" ? "DESC" : "ASC",
      page: query.page,
      pageSize: query.pageSize,
    }),
    getPartyOrderKpis(),
  ]);

  const progressRows = await partyOrderDayRepository.progressByOrderIds(
    rows.map((row) => row.id),
  );
  const progressById = new Map<string, PartyOrderProgressDto>(
    progressRows.map((row) => [
      row.partyOrderId,
      {
        totalDays: row.totalDays,
        deliveredDays: row.deliveredDays,
        skippedDays: row.skippedDays,
        cancelledDays: row.cancelledDays,
        scheduledDays: row.scheduledDays,
        nextServiceDate: row.nextServiceDate,
      },
    ]),
  );

  const today = todayIST();

  return {
    result: {
      rows: rows.map((row) =>
        toPartyOrderListItemDto(
          row,
          // A booking with no days yet still gets a well-formed progress block.
          progressById.get(row.id) ?? {
            totalDays: 0,
            deliveredDays: 0,
            skippedDays: 0,
            cancelledDays: 0,
            scheduledDays: 0,
            nextServiceDate: null,
          },
          today,
        ),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    kpis,
  };
}

/** The four KPI cards — design §3.3. Every money figure comes out of SQL. */
async function getPartyOrderKpis(): Promise<PartyOrderKpisDto> {
  const today = todayIST();
  const month = monthBounds(today);
  // The last day of the previous month is the day before this month's first.
  const previousMonth = monthBounds(addDays(month.from, -1));

  const [
    activeParties,
    startingThisWeek,
    daysScheduled,
    todaysOrders,
    thisMonth,
    lastMonth,
    outstanding,
  ] = await Promise.all([
    partyOrderRepository.countByStatus(["CONFIRMED", "IN_PROGRESS"]),
    partyOrderRepository.countStartingBetween(today, addDays(today, 6)),
    partyOrderDayRepository.countScheduledFrom(today),
    partyOrderRepository.findWithDeliveriesOn(today),
    partyOrderDayRepository.summariseBetween(month.from, month.to),
    partyOrderDayRepository.summariseBetween(
      previousMonth.from,
      previousMonth.to,
    ),
    partyOrderRepository.sumOutstanding(),
  ]);

  const todaysDays = todaysOrders.flatMap((order) => order.days ?? []);
  const staffNames = await resolveStaffNames(
    todaysDays.map((day) => day.assignedStaffId),
  );

  return {
    activeParties,
    startingThisWeek,
    daysScheduled,
    deliveriesToday: todaysDays.length,
    // Jars, not rupees — a count is the one thing TypeScript may add up.
    unitsToday: todaysDays.reduce(
      (sum, day) =>
        sum +
        (day.items ?? []).reduce(
          (dayUnits, item) => dayUnits + billedQuantity(item),
          0,
        ),
      0,
    ),
    staffToday: [...new Set(todaysDays.map((day) => day.assignedStaffId))]
      .filter((id): id is string => !!id)
      .map((id) => staffNames.get(id))
      .filter((name): name is string => !!name)
      .sort((a, b) => a.localeCompare(b)),
    revenueThisMonth: thisMonth.amount,
    bookingsThisMonth: thisMonth.bookings,
    revenuePreviousMonth: lastMonth.amount,
    month: month.from.slice(0, 7),
    totalOutstanding: outstanding.amount,
    partiesOutstanding: outstanding.parties,
    oldestOutstandingDays: outstanding.oldestServiceDate
      ? Math.max(0, daysBetween(outstanding.oldestServiceDate, today))
      : null,
  };
}

export async function getPartyOrder(id: string): Promise<PartyOrderDetailDto> {
  return loadDetail(id);
}

/**
 * The booking picker — "add a delivery day to which booking?" on the calendar.
 *
 * Every module ships one of these, because later modules pick from it.
 * See .claude/MODULE-RECIPE.md §5
 */
export async function listPartyOrderOptions(
  query: PartyOrderOptionsQuery,
): Promise<PartyOrderOptionDto[]> {
  const orders = await partyOrderRepository.findActive(query.q || undefined);

  return orders.map((order) => ({
    id: order.id,
    label: order.partyName,
    // Two halls can share a name; the code and the phone are what tell them
    // apart on a list read at speed.
    hint: `${order.code} · ${order.phone}`,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════
   Calendar — design §10
   ═══════════════════════════════════════════════════════════════════════ */

/** 1970-01-05 was a Monday, and the grid starts on Monday. */
const MONDAY_EPOCH = "1970-01-05";

/** 0 = Monday … 6 = Sunday, by whole-day string arithmetic. */
function weekdayIndex(iso: string): number {
  return ((daysBetween(MONDAY_EPOCH, iso) % 7) + 7) % 7;
}

/**
 * Every party delivery in one month's GRID.
 *
 * The window is padded out to whole Monday→Sunday weeks so the page can chunk
 * the dates by seven without doing any date arithmetic of its own. The footer
 * totals still cover the MONTH, which is what the band claims to summarise.
 */
export async function getPartyCalendar(
  query: PartyCalendarQuery,
): Promise<PartyCalendarDto> {
  const today = todayIST();
  const month = query.month ?? today.slice(0, 7);
  const bounds = monthBounds(`${month}-01`);

  const from = addDays(bounds.from, -weekdayIndex(bounds.from));
  const to = addDays(bounds.to, 6 - weekdayIndex(bounds.to));

  const orders = await partyOrderRepository.findWithDeliveriesBetween(from, to);

  const days = orders.flatMap((order) =>
    (order.days ?? []).map((day) => ({ order, day })),
  );

  const staffNames = await resolveStaffNames(
    days.map(({ day }) => day.assignedStaffId),
  );

  const deliveries: PartyCalendarDeliveryDto[] = days.map(({ order, day }) => ({
    dayId: day.id,
    partyOrderId: order.id,
    code: order.code,
    partyName: order.partyName,
    serviceDate: day.serviceDate,
    deliveryStatus: day.deliveryStatus,
    assignedStaffId: day.assignedStaffId,
    assignedStaffName: day.assignedStaffId
      ? (staffNames.get(day.assignedStaffId) ?? null)
      : null,
    units: (day.items ?? []).reduce(
      (sum, item) => sum + billedQuantity(item),
      0,
    ),
    dayTotal: day.dayTotal,
    itemsSummary: itemsSummary(day.items ?? []),
  }));

  const liveOrderIds = [...new Set(orders.map((order) => order.id))];

  const [totals, dayTotals] = await Promise.all([
    partyOrderDayRepository.summariseBetween(bounds.from, bounds.to, liveOrderIds),
    // The whole GRID, not just the month: a cell belonging to the previous
    // month still shows what is going out that day.
    partyOrderDayRepository.totalsByDate(from, to, liveOrderIds),
  ]);

  return {
    month,
    from,
    to,
    deliveries,
    dayTotals,
    staff: [...staffNames.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    totals: {
      bookings: totals.bookings,
      days: totals.days,
      // Units are counted here rather than in SQL because they are a count, and
      // only over days inside the month proper.
      units: deliveries
        .filter(
          (delivery) =>
            delivery.serviceDate >= bounds.from &&
            delivery.serviceDate <= bounds.to &&
            delivery.deliveryStatus !== "CANCELLED",
        )
        .reduce((sum, delivery) => sum + delivery.units, 0),
      amount: totals.amount,
    },
  };
}

/** `20L Jar × 50 · 1L Bottle × 100` — built once, for the pill's tooltip. */
function itemsSummary(items: readonly PartyOrderItem[]): string {
  return [...items]
    .sort((a, b) => a.lineNo - b.lineNo)
    .map(
      (item) =>
        `${item.productTitle} × ${formatQuantity(billedQuantity(item))}`,
    )
    .join(" · ");
}

/* ═══════════════════════════════════════════════════════════════════════
   Writes
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * The products a schedule refers to, checked in one round trip.
 *
 * A product can be deleted between the wizard loading and the owner pressing
 * `Book party order`. Failing as a FIELD error rather than a foreign-key 500 is
 * what lets the form say which line went wrong.
 */
async function loadProducts(
  items: readonly PartyOrderItemInput[],
  em: EntityManager,
): Promise<Map<string, Product>> {
  const ids = [...new Set(items.map((item) => item.productId))];
  if (ids.length === 0) return new Map();

  const products = await productRepository.findManyByIds(ids, em);
  const byId = new Map(products.map((product) => [product.id, product]));

  if (byId.size !== ids.length) {
    throw new ValidationError(
      { items: ["partyOrders.errors.productMissing"] },
      "partyOrders.errors.couldNotSave",
    );
  }

  return byId;
}

/**
 * A day's lines, snapshotting each product's commercial attributes.
 *
 * `line_total` is a GENERATED column — `round(coalesce(delivered, planned) *
 * unit_price, 2)` — and is never written here. Nor is `day_total`: the rollup
 * trigger owns it. See .claude/DATA-MODEL.md §5.17
 */
async function insertItems(
  partyOrderDayId: string,
  items: readonly PartyOrderItemInput[],
  products: Map<string, Product>,
  em: EntityManager,
): Promise<void> {
  let lineNo = 1;

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) {
      throw new ValidationError(
        { items: ["partyOrders.errors.productMissing"] },
        "partyOrders.errors.couldNotSave",
      );
    }

    await partyOrderItemRepository.create(
      {
        partyOrderDayId,
        // Uniqueness is (day, line_no), NOT (day, product) — the same product
        // twice at two negotiated rates is legal. DATA-MODEL §5.6
        lineNo: lineNo++,
        productId: product.id,
        productTitle: product.title,
        productLitres: product.litres,
        productTagCode: product.tagCode,
        productFilterTypeCode: product.filterTypeCode,
        productBasePrice: product.basePrice,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        deliveredQuantity: item.deliveredQuantity ?? null,
      },
      em,
    );
  }
}

/** One scheduled date, plus its lines. A new day always starts SCHEDULED. */
async function insertDay(
  partyOrderId: string,
  input: CreatePartyOrderDayInput,
  products: Map<string, Product>,
  em: EntityManager,
): Promise<PartyOrderDay> {
  const day = await partyOrderDayRepository.create(
    {
      partyOrderId,
      serviceDate: input.serviceDate,
      deliveryStatus: "SCHEDULED",
      assignedStaffId: input.assignedStaffId ?? null,
      deliveredAt: null,
      notes: input.notes ?? null,
    },
    em,
  );

  await insertItems(day.id, input.items, products, em);
  return day;
}

/**
 * Where a booking is in its life, derived from its days.
 *
 * `party_orders.status` is the one header column the rollup triggers do NOT
 * maintain — a status is a business decision, and the database has no opinion
 * about whether an event has "started". CANCELLED is terminal and never
 * recomputed away.
 */
function deriveStatus(
  current: PartyOrderStatus,
  days: readonly { deliveryStatus: DayDeliveryStatus }[],
): PartyOrderStatus {
  if (current === "CANCELLED") return "CANCELLED";
  if (days.length === 0) return "CONFIRMED";

  const settled = days.every((day) => day.deliveryStatus !== "SCHEDULED");
  if (settled) return "COMPLETED";

  const started = days.some((day) => day.deliveryStatus !== "SCHEDULED");
  return started ? "IN_PROGRESS" : "CONFIRMED";
}

/**
 * Re-reads the days and moves the header's status to match them.
 *
 * Runs inside the caller's transaction, AFTER the day writes, so it sees what
 * the rollup triggers saw.
 */
async function syncStatus(
  partyOrderId: string,
  userId: string,
  em: EntityManager,
): Promise<void> {
  const order = await partyOrderRepository.findById(partyOrderId, em);
  if (!order || order.status === "CANCELLED") return;

  const days = await partyOrderDayRepository.findByOrderId(partyOrderId, em);
  const next = deriveStatus(order.status, days);

  if (next !== order.status) {
    order.status = next;
    order.updatedById = userId;
    await partyOrderRepository.save(order, em);
  }
}

/** A booking cannot be edited once it is cancelled — design §11.5. */
function assertNotCancelled(order: PartyOrder): void {
  if (order.status === "CANCELLED") {
    throw new ConflictError(
      `${order.code} is cancelled and cannot be changed`,
      "partyOrders.errors.bookingCancelled",
      { partyOrderId: order.id, code: order.code },
    );
  }
}

/**
 * Book a party: header, every day, every line and an optional deposit — one
 * transaction.
 *
 * Half a booking is worse than none: a header with no schedule reads as a
 * booking for nothing, and days with no header cannot exist at all. The advance
 * belongs inside the same unit for the same reason — money recorded against a
 * booking that rolled back is money nobody can find.
 * See .claude/ARCHITECTURE.md §4.4
 */
export async function createPartyOrder(
  userId: string,
  input: CreatePartyOrderInput,
): Promise<PartyOrderDetailDto> {
  return withTx(async (em) => {
    const days = sortDays(input.days);
    const products = await loadProducts(
      days.flatMap((day) => day.items),
      em,
    );

    const order = await partyOrderRepository.create(
      {
        partyName: input.partyName,
        phone: input.phone,
        altPhone: input.altPhone ?? null,
        deliveryAddress: input.deliveryAddress,
        notes: input.notes ?? null,
        status: "CONFIRMED",
        createdById: userId,
        updatedById: userId,
      },
      em,
    );

    for (const day of days) {
      await insertDay(order.id, day, products, em);
    }

    if (input.advance) {
      await insertPayment(order.id, { ...input.advance, isAdvance: true }, userId, em);
    }

    logger.info(
      {
        userId,
        partyOrderId: order.id,
        days: days.length,
        advance: input.advance ? input.advance.amount : 0,
      },
      "party order booked",
    );

    // Re-read: total_amount, the service window and payment_status were all
    // written by triggers after the insert above returned.
    return loadDetail(order.id, em);
  }, userId);
}

/**
 * Party details only. The schedule has its own endpoints.
 *
 * TRANSACTIONAL and row-locked, plus an explicit version check: two admins on
 * one booking must not have the second save silently discard the first one's
 * untouched fields. See .claude/DATA-MODEL.md §9
 */
export async function updatePartyOrder(
  userId: string,
  id: string,
  input: UpdatePartyOrderInput,
): Promise<PartyOrderDto> {
  return withTx(async (em) => {
    const order = await partyOrderRepository.findByIdForUpdate(id, em);
    if (!order) throw new NotFoundError("Party order", { id });
    assertNotCancelled(order);

    if (input.version !== undefined && input.version !== order.version) {
      throw new ConflictError(
        `${order.code} was changed by someone else`,
        "partyOrders.errors.staleVersion",
        {
          partyOrderId: order.id,
          code: order.code,
          version: order.version,
          updatedAt: order.updatedAt.toISOString(),
        },
      );
    }

    // PATCH is partial: `undefined` means "leave alone", which is a different
    // instruction from `null` meaning "clear this field".
    if (input.partyName !== undefined) order.partyName = input.partyName;
    if (input.phone !== undefined) order.phone = input.phone;
    if (input.altPhone !== undefined) order.altPhone = input.altPhone;
    if (input.deliveryAddress !== undefined) {
      order.deliveryAddress = input.deliveryAddress;
    }
    if (input.notes !== undefined) order.notes = input.notes;
    order.updatedById = userId;

    const saved = await partyOrderRepository.save(order, em);
    logger.info({ userId, partyOrderId: id }, "party order updated");

    const days = await partyOrderDayRepository.findByOrderId(id, em);
    return toPartyOrderDto(saved, progressFromDays(days), todayIST());
  }, userId);
}

/**
 * Cancel the booking, and with it every day that has not happened.
 *
 * Cancelling the days is the point rather than a side effect: `total_amount`
 * excludes CANCELLED days, so the total drops to what was actually delivered,
 * and a deposit already taken correctly flips the booking to REFUND_DUE.
 * Delivered and skipped days are left exactly as they are — billing history is
 * preserved. See .claude/MODULES/05-party-orders.md §7
 *
 * TODO(schema): `party_orders` has no `cancelled_at` / `cancel_reason` column,
 * so the reason reaches the audit log and nothing else. The design's cancelled
 * banner ("Reason: …") cannot render until those columns exist.
 */
export async function cancelPartyOrder(
  userId: string,
  id: string,
  input: CancelPartyOrderInput,
): Promise<PartyOrderDto> {
  return withTx(async (em) => {
    const order = await partyOrderRepository.findByIdForUpdate(id, em);
    if (!order) throw new NotFoundError("Party order", { id });

    // Idempotent, unlike a void: a double-tapped Cancel is a no-op rather than
    // an error toast on a booking that is already cancelled.
    if (order.status !== "CANCELLED") {
      const days = await partyOrderDayRepository.findByOrderId(id, em);

      for (const day of days) {
        if (day.deliveryStatus === "SCHEDULED") {
          day.deliveryStatus = "CANCELLED";
          await partyOrderDayRepository.save(day, em);
        }
      }

      order.status = "CANCELLED";
      order.updatedById = userId;
      await partyOrderRepository.save(order, em);

      logger.info(
        { userId, partyOrderId: id, code: order.code, reason: input.reason },
        "party order cancelled",
      );
    }

    const fresh = await partyOrderRepository.findById(id, em);
    const days = await partyOrderDayRepository.findByOrderId(id, em);
    return toPartyOrderDto(fresh ?? order, progressFromDays(days), todayIST());
  }, userId);
}

/**
 * Add days — BULK, because the repeat generator adds a run of them.
 *
 * Half a generated schedule is worse than none: the owner cannot tell which
 * dates landed without reading all of them. See .claude/ARCHITECTURE.md §4.4
 */
export async function addPartyOrderDays(
  userId: string,
  id: string,
  input: AddPartyOrderDaysInput,
): Promise<PartyOrderDetailDto> {
  return withTx(async (em) => {
    const order = await partyOrderRepository.findByIdForUpdate(id, em);
    if (!order) throw new NotFoundError("Party order", { id });
    assertNotCancelled(order);

    const existing = await partyOrderDayRepository.findByOrderId(id, em);
    const taken = new Set(existing.map((day) => day.serviceDate));
    const days = sortDays(input.days);

    for (const day of days) {
      // The unique index says the same thing, but a 23505 reaches the owner as
      // a 500 while this reaches the form as a field error naming the date.
      if (taken.has(day.serviceDate)) {
        throw new ConflictError(
          `${day.serviceDate} is already scheduled on ${order.code}`,
          "partyOrders.errors.duplicateDate",
          { partyOrderId: id, code: order.code, serviceDate: day.serviceDate },
        );
      }
      taken.add(day.serviceDate);
    }

    const products = await loadProducts(
      days.flatMap((day) => day.items),
      em,
    );

    for (const day of days) {
      await insertDay(id, day, products, em);
    }

    await syncStatus(id, userId, em);

    logger.info(
      { userId, partyOrderId: id, added: days.length },
      "party order days added",
    );

    return loadDetail(id, em);
  }, userId);
}

/**
 * One day: its date, status, staff, notes and — optionally — its whole line
 * list.
 *
 * `items` absent means "leave the lines alone", so `Mark skipped` and
 * `Assign staff` never resend a schedule they did not touch. Present means the
 * lines are REPLACED: a line's snapshot columns are immutable by design, so
 * changing what is on a day is a delete and an insert, not an update.
 * See .claude/DATA-MODEL.md §6, §10.7
 *
 * Locks child → parent, the same order as everywhere else in the app, because
 * the rollup triggers take the day lock before the header lock.
 * See .claude/ARCHITECTURE.md §4.3
 */
export async function updatePartyOrderDay(
  userId: string,
  id: string,
  dayId: string,
  input: UpdatePartyOrderDayInput,
): Promise<PartyOrderDetailDto> {
  return withTx(async (em) => {
    const day = await partyOrderDayRepository.findByIdForUpdate(dayId, em);
    if (!day || day.partyOrderId !== id) {
      throw new NotFoundError("Party order day", { partyOrderId: id, dayId });
    }

    const order = await partyOrderRepository.findByIdForUpdate(id, em);
    if (!order) throw new NotFoundError("Party order", { id });
    assertNotCancelled(order);

    if (input.serviceDate !== undefined && input.serviceDate !== day.serviceDate) {
      const existing = await partyOrderDayRepository.findByOrderId(id, em);
      if (
        existing.some(
          (other) =>
            other.id !== dayId && other.serviceDate === input.serviceDate,
        )
      ) {
        throw new ConflictError(
          `${input.serviceDate} is already scheduled on ${order.code}`,
          "partyOrders.errors.duplicateDate",
          {
            partyOrderId: id,
            code: order.code,
            serviceDate: input.serviceDate,
          },
        );
      }
      day.serviceDate = input.serviceDate;
    }

    if (input.deliveryStatus !== undefined) {
      // `delivered_at` is a real INSTANT — it records when the jars actually
      // went out, which is a moment, not a business date.
      if (input.deliveryStatus === "DELIVERED" && day.deliveryStatus !== "DELIVERED") {
        day.deliveredAt = new Date();
      } else if (input.deliveryStatus !== "DELIVERED") {
        day.deliveredAt = null;
      }
      day.deliveryStatus = input.deliveryStatus;
    }

    if (input.assignedStaffId !== undefined) {
      day.assignedStaffId = input.assignedStaffId;
    }
    if (input.notes !== undefined) day.notes = input.notes;

    await partyOrderDayRepository.save(day, em);

    if (input.items !== undefined) {
      const products = await loadProducts(input.items, em);
      // Delete first, then insert: (day, line_no) is a plain unique index, so
      // the old line 1 has to be gone before the new line 1 arrives.
      await partyOrderItemRepository.deleteByDayId(dayId, em);
      await insertItems(dayId, input.items, products, em);
    }

    await syncStatus(id, userId, em);

    logger.info(
      { userId, partyOrderId: id, dayId, status: day.deliveryStatus },
      "party order day updated",
    );

    return loadDetail(id, em);
  }, userId);
}

/**
 * Remove a day from the schedule.
 *
 * A DELIVERED day is never removable — only cancellable — because deleting it
 * would rewrite what the party was billed for water it received.
 * See .claude/MODULES/05-party-orders.md §7
 */
export async function removePartyOrderDay(
  userId: string,
  id: string,
  dayId: string,
): Promise<PartyOrderDetailDto> {
  return withTx(async (em) => {
    const day = await partyOrderDayRepository.findByIdForUpdate(dayId, em);
    if (!day || day.partyOrderId !== id) {
      throw new NotFoundError("Party order day", { partyOrderId: id, dayId });
    }

    const order = await partyOrderRepository.findByIdForUpdate(id, em);
    if (!order) throw new NotFoundError("Party order", { id });
    assertNotCancelled(order);

    if (day.deliveryStatus === "DELIVERED") {
      throw new ConflictError(
        `${day.serviceDate} is delivered and can only be cancelled`,
        "partyOrders.errors.deliveredDayNotRemovable",
        { partyOrderId: id, dayId, serviceDate: day.serviceDate },
      );
    }

    // A hard delete, unlike anything on a header: a day is a child of the
    // party-order aggregate with no independent soft delete, and its removal is
    // recorded against the aggregate. Its items cascade.
    // See .claude/DATA-MODEL.md §4
    await partyOrderDayRepository.hardDeleteById(dayId, em);

    await syncStatus(id, userId, em);

    logger.info(
      { userId, partyOrderId: id, dayId, serviceDate: day.serviceDate },
      "party order day removed",
    );

    return loadDetail(id, em);
  }, userId);
}

/**
 * Money in, against the booking rather than against a day — which is how
 * parties actually pay: a deposit, some cash mid-event, the balance at the end.
 *
 * An ADVANCE is allowed to exceed the current total. A party that pays ₹20,000
 * before the schedule is finished is normal, and the booking correctly shows a
 * refund due until more days are added. `advance_amount` is a breakdown of
 * `paid_amount`, not a second bucket — the rollup writes both from the same
 * rows. See .claude/MODULES/05-party-orders.md §9
 */
export async function recordPartyPayment(
  userId: string,
  id: string,
  input: RecordPartyPaymentInput,
): Promise<PartyOrderDetailDto> {
  return withTx(async (em) => {
    const order = await partyOrderRepository.findByIdForUpdate(id, em);
    if (!order) throw new NotFoundError("Party order", { id });
    assertNotCancelled(order);

    /**
     * The idempotency check. The modal mints one id per open, so an impatient
     * second tap on a flaky connection returns the booking as it already stands
     * instead of charging the party twice. The unique index is the real
     * guarantee; this turns a 23505 into a clean response.
     * See .claude/DATA-MODEL.md §10.11
     */
    if (
      input.clientRequestId &&
      (await paymentRepository.existsByClientRequestId(input.clientRequestId, em))
    ) {
      logger.info(
        { userId, partyOrderId: id, clientRequestId: input.clientRequestId },
        "party payment already recorded",
      );
      return loadDetail(id, em);
    }

    const payment = await insertPayment(id, input, userId, em);

    logger.info(
      {
        userId,
        partyOrderId: id,
        paymentId: payment.id,
        amount: input.amount,
        isAdvance: input.isAdvance,
      },
      "party payment recorded",
    );

    return loadDetail(id, em);
  }, userId);
}

/**
 * The one place a party payment row is built.
 *
 * `direction` carries the sign, so `amount` is always positive — a signed
 * amount makes "how much did we collect?" and "how much did we refund?" stop
 * being separately answerable. See .claude/DATA-MODEL.md §5.8
 */
async function insertPayment(
  partyOrderId: string,
  input: RecordPartyPaymentInput,
  userId: string,
  em: EntityManager,
) {
  return paymentRepository.create(
    {
      contextType: "PARTY_ORDER",
      partyOrderId,
      orderId: null,
      coinIssueId: null,
      direction: "IN",
      mode: input.mode,
      amount: input.amount,
      isAdvance: input.isAdvance,
      paidOn: input.paidOn,
      referenceNo: input.referenceNo ?? null,
      note: input.note ?? null,
      clientRequestId: input.clientRequestId ?? null,
      // Parties pay in cash, UPI or bank transfer — never coins. §9.1
      coinTypeId: null,
      coinCount: null,
      coinUnitValue: null,
      createdById: userId,
    },
    em,
  );
}
