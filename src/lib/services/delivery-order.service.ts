import "server-only";
// The transaction manager is the ONLY ORM type a service may name — everything
// else stays behind the repositories. See .claude/ARCHITECTURE.md §14 risk 21
import type { EntityManager } from "typeorm";
import { withTx } from "@/lib/db/data-source";
import { deliveryOrderRepository } from "@/lib/repositories/delivery-order.repository";
import { orderItemRepository } from "@/lib/repositories/order-item.repository";
import { orderItemReturnEventRepository } from "@/lib/repositories/order-item-return-event.repository";
import { paymentRepository } from "@/lib/repositories/payment.repository";
import { coinTypeRepository } from "@/lib/repositories/coin-type.repository";
import { coinLedgerEntryRepository } from "@/lib/repositories/coin-ledger-entry.repository";
import { documentRevisionRepository } from "@/lib/repositories/document-revision.repository";
import { productRepository } from "@/lib/repositories/product.repository";
import { staffRepository } from "@/lib/repositories/staff.repository";
import { userRepository } from "@/lib/repositories/user.repository";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { todayIST } from "@/lib/dates";
import { parseListQuery } from "@/lib/table/parse";
import {
  deliveryOrderTableConfig,
  isDeliveryOrderSortKey,
  DELIVERY_ORDER_FILTERS,
} from "@/lib/table/configs/delivery-order";
import type { DeliveryOrder, OrderItem, Product } from "@/lib/db/entities";
import type {
  OrderStatus,
  PaymentStatus,
  ReturnStatus,
} from "@/lib/db/entities/enums";
import {
  toDeliveryOrderDetailDto,
  toDeliveryOrderListItemDto,
  toOpenReturnLineDto,
  toOrderLineDto,
  toOrderPaymentDto,
  toOrderReturnEventDto,
  type DeliveryOrderDetailDto,
  type DeliveryOrderListResponseDto,
  type OpenReturnLineDto,
} from "@/lib/dto/delivery-order.dto";
import {
  OPEN_LINES_DEFAULT_LIMIT,
  OPEN_LINES_MAX_LIMIT,
  type CancelDeliveryOrderInput,
  type CreateDeliveryOrderInput,
  type DeliveryOrderListQuery,
  type OpenReturnLinesQuery,
  type OrderCoinLineInput,
  type RecordOrderPaymentInput,
  type RecordOrderReturnInput,
  type UpdateDeliveryOrderInput,
  type UpdateOrderLineInput,
} from "@/lib/validation/delivery-order";

/* ═══════════════════════════════════════════════════════════════════════
   Errors
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * The refusal this module exists to produce cleanly.
 *
 * `chk_order_items_returns_within_quantity` refuses 12 empties against a
 * 10-jar line whatever the UI does — it holds for imports and for hand-written
 * SQL. But a raw `23514` reaching the browser is both unreadable and a leak, so
 * the ceiling is checked here first against the LOCKED row and refused with a
 * sentence that names the line and the figure the owner has to change:
 *
 *   Only 8 of "20L Jar" are still out on ORD-000041 line 2.
 */
function overReturnError(
  line: OrderItem,
  orderCode: string,
  requested: { emptyQty: number; filledQty: number; lostQty: number },
): ConflictError {
  const alreadyReturned =
    line.returnedEmptyQty + line.returnedFilledQty + line.lostQty;

  return new ConflictError(
    `Only ${line.pendingQty} of "${line.productTitle}" are still out on ${orderCode} line ${line.lineNo}`,
    "orders.errors.overReturn",
    {
      orderItemId: line.id,
      orderId: line.orderId,
      orderCode,
      lineNo: line.lineNo,
      productTitle: line.productTitle,
      quantity: line.quantity,
      alreadyReturned,
      /** The ceiling. What the form must clamp its three inputs to. */
      remainingQty: line.pendingQty,
      requestedQty: requested.emptyQty + requested.filledQty + requested.lostQty,
      requestedEmptyQty: requested.emptyQty,
      requestedFilledQty: requested.filledQty,
      requestedLostQty: requested.lostQty,
    },
  );
}

/**
 * The LAST line of defence, not the first.
 *
 * The pre-check above runs against rows this transaction has locked, so this
 * fires only in the race it cannot see — another transaction committing a
 * return between our read and our insert. There is nothing to parse out of the
 * constraint's text, so the key it throws carries no placeholders.
 */
function asReturnConflict(error: unknown): ConflictError | null {
  const e = error as {
    code?: string;
    message?: string;
    driverError?: { code?: string; message?: string };
  };
  const code = e?.code ?? e?.driverError?.code;
  if (code !== "23514") return null;

  const message = e?.driverError?.message ?? e?.message ?? "";
  if (!message.includes("chk_order_items_returns_within_quantity")) return null;

  return new ConflictError(
    "More jars were returned than went out",
    "orders.errors.overReturnRace",
  );
}

async function withReturnErrorMapping<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const mapped = asReturnConflict(error);
    if (mapped) throw mapped;
    throw error;
  }
}

/**
 * A business date may not be in the future — orders are recorded, not planned.
 *
 * `ConflictError`, not `ValidationError`: the two carry different shapes.
 * `ValidationError(fieldErrors, messageKey)` takes a
 * `Record<string, string[]>` as its FIRST argument and renders as a 422 with
 * per-field messages, which is wrong here twice over — this is a state
 * conflict rather than a malformed field, and the meta the form needs is
 * `{ date, today }` so the message can say what "today" is. A 409 with rich
 * meta is what every other date guard in this codebase throws.
 */
function assertNotFuture(date: string, messageKey: string): void {
  const today = todayIST();
  if (date > today) {
    throw new ConflictError(`Date ${date} is in the future`, messageKey, {
      date,
      today,
    });
  }
}

/**
 * Exists, is not soft-deleted, and is not cancelled.
 *
 * A cancelled order accepts no further movement of any kind. It has no jars out
 * and no money owed by definition — cancelling requires both to be reversed
 * first — so a return or a payment against one is always a mistake.
 *
 * An `asserts` signature, so every caller downstream sees a non-null
 * `DeliveryOrder` without a second check. That is what the ~30 knock-on
 * `'order' is possibly null` errors were.
 */
function assertLive(
  order: DeliveryOrder | null,
  id: string,
): asserts order is DeliveryOrder {
  if (!order || order.deletedAt) throw new NotFoundError("Order", { id });
  if (order.status === "CANCELLED") {
    throw new ConflictError(
      `Order ${order.code} is cancelled`,
      "orders.errors.cancelledNoChanges",
      { orderId: id, code: order.code },
    );
  }
}

/**
 * A discount larger than the order is worth is not a round-off, it is a typo
 * that makes `total_amount` negative and flips the order to OVERPAID with
 * nothing paid.
 *
 * Checked by READING BACK the trigger-maintained subtotal after the write, not
 * by adding up the lines here — the whole point of rule 4. Throwing rolls the
 * transaction back, so the bad discount never lands.
 */
function assertDiscountWithinSubtotal(order: DeliveryOrder): void {
  if (order.discountAmount > order.subtotalAmount) {
    throw new ConflictError(
      `Discount ${order.discountAmount} exceeds the order subtotal ${order.subtotalAmount}`,
      "orders.errors.discountExceedsSubtotal",
      {
        orderId: order.id,
        code: order.code,
        discountAmount: order.discountAmount,
        subtotalAmount: order.subtotalAmount,
      },
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════════════════════ */

/** The three buckets a return splits into, per line. §6 */
interface ReturnBuckets {
  emptyQty: number;
  filledQty: number;
  lostQty: number;
}

/**
 * Round to paise.
 *
 * The "never do money arithmetic in TypeScript" rule has exactly one exception,
 * and this is it: a COIN payment's `amount` must equal
 * `round(coin_count * coin_unit_value, 2)` or `chk_payments_coin_fields`
 * rejects the row. The database is still the authority — this only computes the
 * value the constraint is about to verify.
 *
 * No `Number.EPSILON` fudge. PostgreSQL's `round()` on numeric is
 * half-away-from-zero, and for the positive amounts this ever sees `Math.round`
 * is exactly that. Nudging the input first can carry a value that sits just
 * under a half-paisa boundary over it, and then the figure this computes and
 * the figure the CHECK recomputes disagree — which is the one outcome the
 * function exists to prevent.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministic ordering for lock acquisition.
 *
 * Every `FOR UPDATE` set in this file is sorted with this before it is walked.
 * Two clerks whose sets overlap but who lock in different orders deadlock, and
 * that failure is intermittent and does not reproduce on demand.
 * See .claude/ARCHITECTURE.md §4.3
 */
function ascending(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Lock a set of order headers, ascending by id.
 *
 * A cross-order return touches several orders at once (§6.2), and two clerks
 * whose return sets overlap in different orders is the textbook deadlock. The
 * lines are already locked by the time this runs — child before parent, always.
 */
async function lockOrders(
  orderIds: string[],
  em: EntityManager,
): Promise<Map<string, DeliveryOrder>> {
  const out = new Map<string, DeliveryOrder>();
  for (const id of [...new Set(orderIds)].sort(ascending)) {
    const order = await deliveryOrderRepository.findByIdForUpdate(id, em);
    if (!order || order.deletedAt) throw new NotFoundError("Order", { id });
    out.set(id, order);
  }
  return out;
}

/**
 * The staff member an order may be raised for, or have jars returned against.
 *
 * Inactive staff are refused on CREATE only. An order already on the books
 * keeps accepting returns and payments after its staff member leaves —
 * refusing them would strand his jars and his debt permanently.
 */
async function loadStaff(
  staffId: string,
  em: EntityManager,
  requireActive: boolean,
): Promise<{ id: string; name: string }> {
  const staff = await staffRepository.findById(staffId, em);
  if (!staff || staff.deletedAt) {
    throw new NotFoundError("Staff", { id: staffId });
  }
  if (requireActive && !staff.isActive) {
    throw new ConflictError(
      `Staff "${staff.name}" is inactive`,
      "orders.errors.staffInactive",
      { staffId: staff.id, staffName: staff.name },
    );
  }
  return { id: staff.id, name: staff.name };
}

/**
 * The products a set of lines refers to, in ONE round trip.
 *
 * A product can be deleted or deactivated between the form loading and the
 * owner pressing Save. Failing as a FIELD error rather than a foreign-key 500
 * is what lets the form say which line went wrong.
 */
async function loadProducts(
  productIds: string[],
  em: EntityManager,
): Promise<Map<string, Product>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();

  const products = await productRepository.findManyByIds(ids, em);
  const byId = new Map(products.map((product) => [product.id, product]));

  for (const id of ids) {
    const product = byId.get(id);
    if (!product || product.deletedAt) {
      throw new ValidationError(
        { items: ["orders.errors.productMissing"] },
        "orders.errors.couldNotSave",
      );
    }
    if (!product.isActive) {
      throw new ConflictError(
        `Product "${product.title}" is inactive`,
        "orders.errors.productInactive",
        { productId: product.id, productTitle: product.title },
      );
    }
  }

  return byId;
}

/**
 * Snapshot a product's whole commercial identity onto a new line.
 *
 * All seven values are `update: false` and a trigger raises if they move by any
 * other route: a six-month-old statement must reprint exactly as it was issued
 * even after a rename, a reclassification or a price rise. To put a different
 * product on a line you delete the line and add another — which is recorded as
 * a revision. See .claude/DATA-MODEL.md §6, §10.7
 *
 * `unitPrice ?? basePrice` is what makes "charged price pre-filled with the base
 * price" true on the server too, so a line the owner never touched cannot come
 * back priced at zero because a controlled input emptied itself.
 *
 * `line_total` is DELIBERATELY ABSENT from this object. It is generated.
 */
async function insertLine(
  orderId: string,
  lineNo: number,
  line: { productId: string; quantity: number; unitPrice: number | null; priceOverrideNote: string | null },
  product: Product,
  em: EntityManager,
): Promise<OrderItem> {
  return orderItemRepository.create(
    {
      orderId,
      // Uniqueness is `(order_id, line_no)`, and DELIBERATELY NOT
      // `(order_id, product_id)`: one route order legitimately holds the same
      // product twice at two bargained rates. DATA-MODEL §5.6
      lineNo,
      productId: product.id,
      productTitle: product.title,
      productLitres: product.litres,
      productTagCode: product.tagCode,
      productFilterTypeCode: product.filterTypeCode,
      productBasePrice: product.basePrice,
      isReturnable: product.isReturnable,
      unitPrice: line.unitPrice ?? product.basePrice,
      priceOverrideNote: line.priceOverrideNote,
      quantity: line.quantity,
    },
    em,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Payments and the coin ledger
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Coins handed over by customers, going back into company stock.
 *
 * This is the RETURN LEG of the coin lifecycle (MODULES/03 §5.1: "coins
 * received here are added back to that coin type's stock, via a ledger entry —
 * this happens automatically, you never record it twice"), and it is the one
 * place the delivery-order module writes to `coin_ledger_entries`.
 *
 * Three things are non-negotiable:
 *
 *  - `coin_unit_value` is a `rate6` SNAPSHOT read off the LOCKED coin type. A
 *    price change next month must not rewrite what these coins were worth
 *    today, and `chk_payments_coin_fields` re-checks that `amount` equals
 *    `round(coin_count × coin_unit_value, 2)`.
 *  - `entry_seq` and `balance_after_coins` go in as PLACEHOLDER ZEROS.
 *    `fn_coin_ledger_assign_seq` takes the coin type's row lock, reads the
 *    ledger's own latest balance and overwrites both. Anything computed here
 *    would be a guess made outside that lock, and under two concurrent writers
 *    it would be the wrong one.
 *  - The movement is POSITIVE. `chk_ledger_sign` allows no other sign for
 *    `ORDER_RECEIPT`, which is also why a REFUND cannot be paid in coins.
 */
async function writeCoinReceipt(
  em: EntityManager,
  args: {
    paymentId: string;
    coinTypeId: string;
    coinCount: number;
    unitValue: number;
    amount: number;
    entryDate: string;
    staffId: string;
    note: string | null;
    userId: string;
  },
): Promise<void> {
  await coinLedgerEntryRepository.create(
    {
      coinTypeId: args.coinTypeId,
      entryDate: args.entryDate,
      occurredAt: new Date(),
      movementType: "ORDER_RECEIPT",
      coinsDelta: args.coinCount,
      unitValue: args.unitValue,
      valueDelta: args.amount,
      sourceType: "PAYMENT",
      paymentId: args.paymentId,
      staffId: args.staffId,
      note: args.note,
      // Placeholders — the trigger replaces both under the coin type's lock.
      entrySeq: 0,
      balanceAfterCoins: 0,
      createdById: args.userId,
    },
    em,
  );
}

/**
 * One submission of the payment modal → one CASH/UPI/BANK_TRANSFER row plus one
 * COIN row per coin type, all inside the caller's transaction.
 *
 * Several `payments` rows rather than one blended row because `payments` has a
 * single `mode` and a single coin arc: `paid_cash_amount`, `paid_coin_amount`
 * and `paid_other_amount` on the header are `FILTER (WHERE mode = …)` sums, so
 * one row per mode is exactly what makes those three columns meaningful.
 *
 * THE IDEMPOTENCY KEY GOES ON THE FIRST ROW ONLY. `uq_payments_client_request_id`
 * is unique across the whole table, so it cannot be repeated across the rows of
 * one submission. That is sufficient: all of them commit or none do, so the key
 * being present proves the whole submission landed.
 *
 * Coin types are locked ASCENDING BY ID, matching the order the ledger trigger
 * takes them in.
 */
async function writePayment(
  em: EntityManager,
  args: {
    orderId: string;
    staffId: string;
    direction: "IN" | "OUT";
    mode: "CASH" | "UPI" | "BANK_TRANSFER";
    amount: number;
    coins: OrderCoinLineInput[];
    paidOn: string;
    referenceNo: string | null;
    note: string | null;
    clientRequestId: string | null;
    userId: string;
  },
): Promise<{ paymentCount: number; coinValue: number }> {
  let clientRequestId = args.clientRequestId;
  let paymentCount = 0;
  let coinValue = 0;

  if (args.amount > 0) {
    await paymentRepository.create(
      {
        contextType: "ORDER",
        orderId: args.orderId,
        direction: args.direction,
        mode: args.mode,
        amount: args.amount,
        paidOn: args.paidOn,
        referenceNo: args.referenceNo,
        note: args.note,
        clientRequestId,
        createdById: args.userId,
      },
      em,
    );
    clientRequestId = null;
    paymentCount += 1;
  }

  if (args.coins.length === 0) return { paymentCount, coinValue };

  const coinTypeIds = [...new Set(args.coins.map((c) => c.coinTypeId))].sort(
    ascending,
  );
  const coinTypes = await coinTypeRepository.findByIdsForUpdate(
    coinTypeIds,
    em,
  );
  const byId = new Map(coinTypes.map((coinType) => [coinType.id, coinType]));

  for (const id of coinTypeIds) {
    const coinType = byId.get(id);
    if (!coinType || coinType.deletedAt) {
      throw new NotFoundError("Coin type", { id });
    }
    if (!coinType.isActive) {
      throw new ConflictError(
        `Coin type "${coinType.name}" is inactive`,
        "orders.errors.coinTypeInactive",
        { coinTypeId: coinType.id, coinTypeName: coinType.name },
      );
    }
  }

  // Same order as the locks above, so the ledger trigger's own FOR UPDATE on
  // coin_types re-takes locks this transaction already holds.
  const ordered = [...args.coins].sort((a, b) =>
    ascending(a.coinTypeId, b.coinTypeId),
  );

  for (const coin of ordered) {
    const coinType = byId.get(coin.coinTypeId);
    if (!coinType) throw new NotFoundError("Coin type", { id: coin.coinTypeId });

    // Rounded ONCE, here, and stored. `chk_payments_coin_fields` recomputes the
    // identical expression, and the ledger row carries the same figure, so the
    // payment, the constraint and the spine cannot disagree by a paisa.
    const amount = round2(coin.coinCount * coinType.perCoinPrice);

    const payment = await paymentRepository.create(
      {
        contextType: "ORDER",
        orderId: args.orderId,
        direction: args.direction,
        mode: "COIN",
        amount,
        paidOn: args.paidOn,
        coinTypeId: coinType.id,
        coinCount: coin.coinCount,
        coinUnitValue: coinType.perCoinPrice,
        referenceNo: null,
        note: args.note,
        clientRequestId,
        createdById: args.userId,
      },
      em,
    );
    clientRequestId = null;
    paymentCount += 1;
    coinValue = round2(coinValue + amount);

    await writeCoinReceipt(em, {
      paymentId: payment.id,
      coinTypeId: coinType.id,
      coinCount: coin.coinCount,
      unitValue: coinType.perCoinPrice,
      amount,
      entryDate: args.paidOn,
      staffId: args.staffId,
      note: args.note,
      userId: args.userId,
    });
  }

  return { paymentCount, coinValue };
}

/* ═══════════════════════════════════════════════════════════════════════
   Revisions
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * `document_revisions`, ONE ROW PER EDIT SESSION.
 *
 * The AuditTriggers migration is explicit that this is the service layer's job
 * and cannot be a trigger: a row trigger sees one row of one table at a time,
 * so it cannot know that the header UPDATE, four line INSERTs and two line
 * DELETEs it just observed were ONE human decision, cannot assemble the whole
 * aggregate, and cannot know the reason the owner typed into the dialog.
 *
 * `audit_logs` and this table are complementary, not alternatives: audit_logs
 * answers "what changed, when, by whom" and is written by the database whoever
 * writes; this answers "show me the order as it stood on 14 March".
 *
 * `nextRevisionNo` is a MAX + 1 read-modify-write, which is safe here because
 * the edit already holds a `FOR UPDATE` lock on the order header;
 * `uq_document_revisions_doc_rev` is the loud backstop.
 */
async function writeRevision(
  em: EntityManager,
  args: {
    order: DeliveryOrderDetailDto;
    before: DeliveryOrderDetailDto | null;
    changeReason: string | null;
    userId: string;
  },
): Promise<void> {
  const revisionNo = await documentRevisionRepository.nextRevisionNo(
    "ORDER",
    args.order.id,
    em,
  );

  // Snapshotted, not joined: a revision list that renders "(deleted user)" for
  // edits made by someone who has since left is useless in exactly the audit
  // conversation it exists for. DATA-MODEL §5.20
  const actor = await userRepository.findById(args.userId, em);

  await documentRevisionRepository.create(
    {
      documentType: "ORDER",
      documentId: args.order.id,
      revisionNo,
      snapshot: args.order as unknown as Record<string, unknown>,
      // NULL on revision 1, which has nothing to diff against.
      diff: args.before ? diffOrders(args.before, args.order) : null,
      changeReason: args.changeReason,
      actorId: args.userId,
      actorName: actor?.name ?? null,
    },
    em,
  );
}

/** Header fields worth showing side by side. Rollups are excluded: they are
 *  consequences of the edit, not the edit, and would bury the one changed
 *  discount under sixteen recalculated columns. */
const REVISION_FIELDS = [
  "staffId",
  "staffName",
  "orderDate",
  "status",
  "discountAmount",
  "notes",
] as const;

function diffOrders(
  before: DeliveryOrderDetailDto,
  after: DeliveryOrderDetailDto,
): Record<string, [unknown, unknown]> {
  const diff: Record<string, [unknown, unknown]> = {};

  for (const field of REVISION_FIELDS) {
    if (before[field] !== after[field]) {
      diff[field] = [before[field], after[field]];
    }
  }

  // Lines are diffed as a whole rather than field by field: a line is
  // identified by position, and "line 2 changed" is the question a human asks.
  const key = (order: DeliveryOrderDetailDto) =>
    order.lines.map(
      (line) =>
        `${line.lineNo}:${line.productId}:${line.quantity}:${line.unitPrice}`,
    );
  const beforeLines = key(before);
  const afterLines = key(after);
  if (beforeLines.join("|") !== afterLines.join("|")) {
    diff.lines = [before.lines, after.lines];
  }

  return diff;
}

/* ═══════════════════════════════════════════════════════════════════════
   Reads
   ═══════════════════════════════════════════════════════════════════════ */

function searchParamsFrom(rawQuery: DeliveryOrderListQuery) {
  // Everything hostile is neutralised here: the sort key is only ever a lookup
  // into the TableConfig allowlist. See .claude/ARCHITECTURE.md §6.2
  const query = parseListQuery(
    {
      page: rawQuery.page,
      pageSize: rawQuery.pageSize,
      q: rawQuery.q,
      sort: rawQuery.sort,
      dir: rawQuery.dir,
      [DELIVERY_ORDER_FILTERS.staffId]: rawQuery.staffId,
      [DELIVERY_ORDER_FILTERS.from]: rawQuery.from,
      [DELIVERY_ORDER_FILTERS.to]: rawQuery.to,
      [DELIVERY_ORDER_FILTERS.status]: rawQuery.status,
      [DELIVERY_ORDER_FILTERS.paymentStatus]: rawQuery.paymentStatus,
      [DELIVERY_ORDER_FILTERS.returnStatus]: rawQuery.returnStatus,
      [DELIVERY_ORDER_FILTERS.moneyPending]: rawQuery.moneyPending,
      [DELIVERY_ORDER_FILTERS.jarsOut]: rawQuery.jarsOut,
    },
    deliveryOrderTableConfig,
  );

  const filters = query.filters;
  const pick = (key: string) => filters[key] as string | undefined;

  const status = pick(DELIVERY_ORDER_FILTERS.status) as OrderStatus | undefined;
  const moneyPending = pick(DELIVERY_ORDER_FILTERS.moneyPending) === "1";
  const jarsOut = pick(DELIVERY_ORDER_FILTERS.jarsOut) === "1";

  /**
   * A quick chip means "show me what is unfinished", and a CANCELLED order is
   * not unfinished — it is over. Its subtotal survives cancellation (the rollup
   * function has no opinion about status), so without this the chase list would
   * fill up with orders nobody will ever collect on. An explicit `?status=`
   * still wins, so `status=CANCELLED&moneyPending=1` remains answerable.
   */
  const impliedStatus: OrderStatus[] | undefined =
    !status && (moneyPending || jarsOut) ? ["DRAFT", "CONFIRMED"] : undefined;

  return {
    query,
    params: {
      search: query.q || undefined,
      staffId: pick(DELIVERY_ORDER_FILTERS.staffId),
      dateFrom: pick(DELIVERY_ORDER_FILTERS.from),
      dateTo: pick(DELIVERY_ORDER_FILTERS.to),
      status: status ? [status] : impliedStatus,
      paymentStatus: pick(DELIVERY_ORDER_FILTERS.paymentStatus)
        ? [pick(DELIVERY_ORDER_FILTERS.paymentStatus) as PaymentStatus]
        : undefined,
      returnStatus: pick(DELIVERY_ORDER_FILTERS.returnStatus)
        ? [pick(DELIVERY_ORDER_FILTERS.returnStatus) as ReturnStatus]
        : undefined,
      paymentPending: moneyPending || undefined,
      jarsOut: jarsOut || undefined,
    },
  };
}

/**
 * The register and its KPI strip in ONE payload.
 *
 * Two round trips would land a beat apart and read as the page still loading;
 * worse, the strip would briefly disagree with the table under it.
 */
export async function listDeliveryOrders(
  rawQuery: DeliveryOrderListQuery,
): Promise<DeliveryOrderListResponseDto> {
  const { query, params } = searchParamsFrom(rawQuery);
  const today = todayIST();

  const [page, summary] = await Promise.all([
    deliveryOrderRepository.searchPaginated({
      ...params,
      page: query.page,
      pageSize: query.pageSize,
      sort: isDeliveryOrderSortKey(query.sort.key) ? query.sort.key : "date",
      direction: query.sort.dir === "asc" ? "ASC" : "DESC",
    }),
    deliveryOrderRepository.summary(params),
  ]);

  // One grouped query for the whole page's `3 items / 62 units` chips and the
  // D5 figures behind them — never a query per row.
  const items = await orderItemRepository.aggregateByOrderIds(
    page.rows.map((order) => order.id),
  );

  return {
    rows: page.rows.map((order) =>
      toDeliveryOrderListItemDto(order, items.get(order.id), today),
    ),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    pageCount: Math.max(1, Math.ceil(page.total / page.pageSize)),
    summary,
  };
}

/**
 * Header, lines, the returns timeline, the payments timeline and every
 * `can…` flag the detail header needs.
 *
 * Called INSIDE the write transactions below too, after the triggers have
 * recomputed the rollups, so the response a form gets back is the state the
 * database actually holds rather than what the caller hoped for.
 */
async function loadDetail(
  id: string,
  em?: EntityManager,
): Promise<DeliveryOrderDetailDto> {
  const order = await deliveryOrderRepository.findByIdWithItems(id, em);
  if (!order || order.deletedAt) throw new NotFoundError("Order", { id });

  const lines = [...(order.items ?? [])].sort((a, b) => a.lineNo - b.lineNo);
  const lineIds = lines.map((line) => line.id);

  const [items, events, payments] = await Promise.all([
    orderItemRepository.aggregateByOrderIds([id], em),
    orderItemReturnEventRepository.findByOrderItemIds(lineIds, em),
    paymentRepository.findByOrderId(id, em),
  ]);

  const lineById = new Map(
    lines.map((line) => [
      line.id,
      { lineNo: line.lineNo, productTitle: line.productTitle },
    ]),
  );

  return toDeliveryOrderDetailDto(
    order,
    items.get(id),
    lines.map(toOrderLineDto),
    events.map((event) =>
      toOrderReturnEventDto(
        event,
        lineById.get(event.orderItemId) ?? { lineNo: 0, productTitle: "" },
      ),
    ),
    payments.map(toOrderPaymentDto),
    todayIST(),
  );
}

export function getDeliveryOrder(id: string): Promise<DeliveryOrderDetailDto> {
  return loadDetail(id);
}

/**
 * Every still-open line for one staff member, across ALL his orders. §6.2
 *
 * This is what makes old orders close. A customer routinely hands back last
 * week's jar when this week's staff member calls, and unless the return can be
 * attributed to the line the jar actually went out on, the old order sits open
 * forever and the jars-out figure inflates permanently.
 *
 * Returned NEWEST FIRST, which is the order §6.2 specifies for the picker.
 * Automatic attribution — `recordOrderReturn`'s `allocations` — walks the same
 * set OLDEST first, for exactly the opposite and equally deliberate reason.
 */
export async function listOpenReturnLines(
  query: OpenReturnLinesQuery,
): Promise<OpenReturnLineDto[]> {
  const staff = await staffRepository.findById(query.staffId);
  if (!staff || staff.deletedAt) {
    throw new NotFoundError("Staff", { id: query.staffId });
  }

  const limit = Math.min(
    OPEN_LINES_MAX_LIMIT,
    Math.max(1, Number(query.limit ?? OPEN_LINES_DEFAULT_LIMIT)),
  );

  const lines = await orderItemRepository.findOpenLinesByStaff(query.staffId, {
    excludeOrderId: query.excludeOrderId,
    limit,
  });

  const today = todayIST();

  return lines
    .filter((line) => !query.productId || line.productId === query.productId)
    .map((line) => toOpenReturnLineDto(line, today));
}

/* ═══════════════════════════════════════════════════════════════════════
   Writes
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * A morning's load-out.
 *
 * TRANSACTIONAL across four tables — the header, one line per product, and
 * optionally the payment taken on the spot plus its ledger rows. A partial
 * write would leave jars off the books that somebody owes for, which is the one
 * thing this module exists to make impossible.
 *
 * The sequence is deliberate:
 *   1. the idempotency check, so a retry after a timeout does not double-bill
 *   2. resolve the staff member and every product, in two round trips
 *   3. write the header
 *   4. write the lines — the item trigger rolls each one up to the header
 *   5. write the payment, if one was taken, and its coin ledger rows
 *   6. read the header back and refuse an impossible discount
 *
 * NOTHING here computes `subtotal_amount`, `line_total` or `total_amount`.
 */
export async function createDeliveryOrder(
  input: CreateDeliveryOrderInput,
  userId: string,
): Promise<DeliveryOrderDetailDto> {
  assertNotFuture(input.orderDate, "orders.errors.orderDateFuture");

  return withTx(async (em) => {
    /**
     * A retry after a timeout carries the same id. Return what the first
     * attempt produced rather than raising the same order twice.
     *
     * LIMIT, stated plainly: the key is stored on the PAYMENT row, because
     * `delivery_orders` has no `client_request_id` column. An order created
     * with NO payment is therefore not protected against a double submit.
     * Reported as a schema gap rather than papered over with a best-effort
     * duplicate check that would refuse two genuine orders to the same staff
     * member on the same morning — which is a normal day.
     */
    if (input.clientRequestId) {
      const previous = await paymentRepository.findByClientRequestId(
        input.clientRequestId,
        em,
      );
      if (previous?.orderId) return loadDetail(previous.orderId, em);
    }

    const staff = await loadStaff(input.staffId, em, true);
    const products = await loadProducts(
      input.items.map((item) => item.productId),
      em,
    );

    const order = await deliveryOrderRepository.create(
      {
        staffId: staff.id,
        orderDate: input.orderDate,
        status: "CONFIRMED",
        discountAmount: input.discountAmount,
        notes: input.notes,
        createdById: userId,
        updatedById: userId,
      },
      em,
    );

    let lineNo = 1;
    for (const line of input.items) {
      const product = products.get(line.productId);
      if (!product) {
        throw new ValidationError(
          { items: ["orders.errors.productMissing"] },
          "orders.errors.couldNotSave",
        );
      }
      await insertLine(order.id, lineNo, line, product, em);
      lineNo += 1;
    }

    if (input.payment) {
      await writePayment(em, {
        orderId: order.id,
        staffId: staff.id,
        direction: "IN",
        mode: input.payment.mode,
        amount: input.payment.amount,
        coins: input.payment.coins,
        // Money taken at handover is dated to the handover, not to whenever
        // the form was submitted.
        paidOn: input.orderDate,
        referenceNo: input.payment.referenceNo,
        note: input.payment.note,
        clientRequestId: input.clientRequestId,
        userId,
      });
    }

    // Read back INSIDE the transaction: the item and payment triggers have
    // already recomputed the header's rollups by now.
    const saved = await deliveryOrderRepository.findById(order.id, em);
    if (saved) assertDiscountWithinSubtotal(saved);

    const detail = await loadDetail(order.id, em);
    await writeRevision(em, {
      order: detail,
      before: null,
      changeReason: null,
      userId,
    });

    logger.info(
      {
        orderId: order.id,
        staffId: staff.id,
        lines: input.items.length,
        paidAtCreate: input.payment?.amount ?? 0,
        userId,
      },
      "delivery order created",
    );

    return detail;
  }, userId);
}

/**
 * Edit an order that is already on the books. Story O6, warned by O14.
 *
 * ALLOWED, BUT NARROWLY. Three things are refused rather than warned about,
 * because each would destroy a fact rather than change one:
 *
 *  - a quantity below what has already come back on that line. The database
 *    would refuse it anyway (`returned + lost ≤ quantity`); refusing it here
 *    names the line.
 *  - removing a line that has return history. `order_item_return_events` is
 *    `ON DELETE CASCADE`, so the delete would silently erase append-only rows.
 *  - moving an order to a different staff member once jars or money have moved.
 *    The returns and payments already recorded belong to the first man.
 *
 * The SNAPSHOT columns are never updated — changing a line's product is a
 * remove plus an add, which is why `id`-less lines are appended rather than
 * matched by product. See .claude/DATA-MODEL.md §6, §10.7
 *
 * Locks child → parent: every existing line, ascending by id, then the header.
 */
export async function updateDeliveryOrder(
  id: string,
  input: UpdateDeliveryOrderInput,
  userId: string,
): Promise<DeliveryOrderDetailDto> {
  if (input.orderDate) {
    assertNotFuture(input.orderDate, "orders.errors.orderDateFuture");
  }

  return withReturnErrorMapping(() =>
    withTx(async (em) => {
      /**
       * Two reads on purpose. The first only discovers WHICH rows to lock; the
       * rows this function then reasons about are the ones the second read
       * returned, under `FOR UPDATE` and in ascending id order. Editing against
       * the unlocked copy would mean checking `quantity < returned` against
       * counters a concurrent return may already have moved.
       */
      const existing = await orderItemRepository.findManyByIdsForUpdate(
        (await orderItemRepository.findByOrderId(id, em)).map((line) => line.id),
        em,
      );

      const order = await deliveryOrderRepository.findByIdForUpdate(id, em);
      assertLive(order, id);

      if (input.version !== undefined && input.version !== order.version) {
        throw new ConflictError(
          `${order.code} was changed by someone else`,
          "orders.errors.staleVersion",
          {
            orderId: order.id,
            code: order.code,
            version: order.version,
            updatedAt: order.updatedAt.toISOString(),
          },
        );
      }

      const before = await loadDetail(id, em);

      const hasMovement =
        before.hasPayments ||
        before.hasReturns ||
        order.qtyReturnedEmpty +
          order.qtyReturnedFilled +
          order.qtyLost >
          0;

      if (input.staffId !== undefined && input.staffId !== order.staffId) {
        if (hasMovement) {
          throw new ConflictError(
            `${order.code} already has payments or returns against ${before.staffName}`,
            "orders.errors.staffLockedByHistory",
            {
              orderId: order.id,
              code: order.code,
              staffId: order.staffId,
              staffName: before.staffName,
            },
          );
        }
        const staff = await loadStaff(input.staffId, em, true);
        order.staffId = staff.id;
      }

      if (input.orderDate !== undefined) order.orderDate = input.orderDate;
      if (input.notes !== undefined) order.notes = input.notes;
      if (input.discountAmount !== undefined) {
        order.discountAmount = input.discountAmount;
      }
      order.updatedById = userId;
      await deliveryOrderRepository.save(order, em);

      if (input.items) {
        await applyLineChanges(id, order.code, existing, input.items, em);
      }

      const saved = await deliveryOrderRepository.findById(id, em);
      if (saved) assertDiscountWithinSubtotal(saved);

      const detail = await loadDetail(id, em);
      await writeRevision(em, {
        order: detail,
        before,
        changeReason: input.changeReason,
        userId,
      });

      logger.info(
        {
          orderId: id,
          userId,
          lines: input.items?.length,
          hadMovement: hasMovement,
        },
        "delivery order updated",
      );

      return detail;
    }, userId),
  );
}

/**
 * Reconcile the line set: update, append, remove.
 *
 * LINE NUMBERS ARE NEVER RENUMBERED. `uq_order_items_order_line` is a plain
 * unique constraint, so shuffling `line_no` mid-transaction would collide with
 * itself; and a line is identified by its position, which a return event and a
 * revision both refer to. Removing line 2 of 3 therefore leaves a gap, which is
 * correct rather than untidy.
 */
async function applyLineChanges(
  orderId: string,
  orderCode: string,
  existing: OrderItem[],
  input: UpdateOrderLineInput[],
  em: EntityManager,
): Promise<void> {
  const byId = new Map(existing.map((line) => [line.id, line]));
  const kept = new Set<string>();
  const additions = input.filter((line) => !line.id);

  const products = await loadProducts(
    additions.map((line) => line.productId),
    em,
  );

  for (const line of input) {
    if (!line.id) continue;

    const current = byId.get(line.id);
    if (!current) {
      throw new NotFoundError("Order line", { orderId, orderItemId: line.id });
    }
    kept.add(line.id);

    const returned =
      current.returnedEmptyQty + current.returnedFilledQty + current.lostQty;
    if (line.quantity < returned) {
      throw new ConflictError(
        `${returned} of "${current.productTitle}" have already come back on ${orderCode} line ${current.lineNo}`,
        "orders.errors.quantityBelowReturned",
        {
          orderId,
          orderCode,
          orderItemId: current.id,
          lineNo: current.lineNo,
          productTitle: current.productTitle,
          alreadyReturned: returned,
          requestedQuantity: line.quantity,
        },
      );
    }

    if (line.productId !== current.productId) {
      throw new ConflictError(
        `Line ${current.lineNo} of ${orderCode} carries "${current.productTitle}"`,
        "orders.errors.productImmutable",
        {
          orderId,
          orderCode,
          orderItemId: current.id,
          lineNo: current.lineNo,
          productTitle: current.productTitle,
        },
      );
    }

    // Only the three mutable fields. Everything else on this row is
    // `update: false` and trigger-protected.
    current.quantity = line.quantity;
    if (line.unitPrice !== null) current.unitPrice = line.unitPrice;
    current.priceOverrideNote = line.priceOverrideNote;
    await orderItemRepository.save(current, em);
  }

  for (const line of existing) {
    if (kept.has(line.id)) continue;

    const returned =
      line.returnedEmptyQty + line.returnedFilledQty + line.lostQty;
    if (returned > 0) {
      throw new ConflictError(
        `Line ${line.lineNo} of ${orderCode} has ${returned} jars already returned`,
        "orders.errors.lineHasReturns",
        {
          orderId,
          orderCode,
          orderItemId: line.id,
          lineNo: line.lineNo,
          productTitle: line.productTitle,
          alreadyReturned: returned,
        },
      );
    }
    await orderItemRepository.deleteById(line.id, em);
  }

  // Appended at MAX + 1, read fresh so a concurrent append cannot collide.
  let lineNo = await orderItemRepository.nextLineNo(orderId, em);
  for (const line of additions) {
    const product = products.get(line.productId);
    if (!product) {
      throw new ValidationError(
        { items: ["orders.errors.productMissing"] },
        "orders.errors.couldNotSave",
      );
    }
    await insertLine(orderId, lineNo, line, product, em);
    lineNo += 1;
  }
}

/**
 * Jars come home. Story O7, O8, O9 — and the reason the order total moves.
 *
 * ONE INSERT PER LINE INTO AN APPEND-ONLY TABLE, never an update to a counter.
 * `fn_order_item_return_events_rollup` recomputes the line's three counters
 * from the sum over its events under the line's row lock, then recomputes the
 * header. That is what makes two clerks recording returns at the same moment
 * correct under any interleaving. DATA-MODEL §7
 *
 * **The FILLED bucket is why the order total falls.** `line_total` is
 * `round((quantity − returned_filled_qty) × unit_price, 2)`, so 2 unsold jars
 * coming home take ₹70 off a ₹1,400 order. The staff member sold 38 and owes
 * for 38. Decision D5.
 *
 * CROSS-ORDER. `lines[].orderItemId` may belong to another of the same staff
 * member's orders (§6.2), and `allocations` spreads a bare "8 jars came back"
 * across his open lines OLDEST ORDER FIRST — which is what lets old orders
 * actually close. An explicit line always wins over an allocation.
 *
 * Locks child → parent: every touched line ascending by id, then every touched
 * order header ascending by id. Both sets can span several orders, which is
 * exactly why the order of acquisition is fixed rather than incidental.
 */
export async function recordOrderReturn(
  orderId: string,
  input: RecordOrderReturnInput,
  userId: string,
): Promise<DeliveryOrderDetailDto> {
  assertNotFuture(input.returnDate, "orders.errors.returnDateFuture");

  return withReturnErrorMapping(() =>
    withTx(async (em) => {
      const anchor = await deliveryOrderRepository.findById(orderId, em);
      assertLive(anchor, orderId);

      /**
       * The candidate set, resolved BEFORE any lock is taken so the lock order
       * can be decided once and honoured exactly.
       *
       * Allocations pull in every open line of this staff member because the
       * jars could land on any of them; the read is unlocked and only decides
       * WHICH rows to lock. The allocation itself is computed further down from
       * the LOCKED rows, so a concurrent return cannot make it stale.
       */
      const candidates =
        input.allocations.length > 0
          ? await orderItemRepository.findOpenLinesByStaff(anchor.staffId, {}, em)
          : [];

      const wantedProducts = new Set(
        input.allocations.map((allocation) => allocation.productId),
      );

      const lineIds = [
        ...new Set([
          ...input.lines.map((line) => line.orderItemId),
          ...candidates
            .filter((line) => wantedProducts.has(line.productId))
            .map((line) => line.id),
        ]),
      ].sort(ascending);

      const locked = await orderItemRepository.findManyByIdsForUpdate(
        lineIds,
        em,
      );
      const lineById = new Map(locked.map((line) => [line.id, line]));

      for (const line of input.lines) {
        if (!lineById.has(line.orderItemId)) {
          throw new NotFoundError("Order line", {
            orderId,
            orderItemId: line.orderItemId,
          });
        }
      }

      // Parent lock, after every child. The anchor is included even when none
      // of its own lines were touched, because its detail is what we return.
      const orders = await lockOrders(
        [orderId, ...locked.map((line) => line.orderId)],
        em,
      );

      for (const line of locked) {
        const parent = orders.get(line.orderId);
        if (!parent) continue;
        if (parent.status === "CANCELLED") {
          throw new ConflictError(
            `Order ${parent.code} is cancelled`,
            "orders.errors.cancelledNoChanges",
            { orderId: parent.id, code: parent.code },
          );
        }
        /**
         * A jar can only be returned against the man it went out with.
         * Without this, the picker's staff filter would be the only thing
         * standing between a hand-crafted request and one staff member's jars
         * being written off another's order.
         */
        if (parent.staffId !== anchor.staffId) {
          throw new ConflictError(
            `Order ${parent.code} belongs to a different staff member`,
            "orders.errors.lineOtherStaff",
            {
              orderId: parent.id,
              code: parent.code,
              orderItemId: line.id,
              staffId: parent.staffId,
            },
          );
        }
        if (input.returnDate < parent.orderDate) {
          throw new ConflictError(
            `Return date precedes ${parent.code}'s order date`,
            "orders.errors.returnBeforeOrder",
            {
              orderId: parent.id,
              code: parent.code,
              returnDate: input.returnDate,
              orderDate: parent.orderDate,
            },
          );
        }
      }

      // ── Merge explicit lines with automatic attribution ─────────────────
      const totals = new Map<
        string,
        { emptyQty: number; filledQty: number; lostQty: number }
      >();
      const add = (
        orderItemId: string,
        qty: { emptyQty: number; filledQty: number; lostQty: number },
      ) => {
        const current = totals.get(orderItemId) ?? {
          emptyQty: 0,
          filledQty: 0,
          lostQty: 0,
        };
        totals.set(orderItemId, {
          emptyQty: current.emptyQty + qty.emptyQty,
          filledQty: current.filledQty + qty.filledQty,
          lostQty: current.lostQty + qty.lostQty,
        });
      };

      for (const line of input.lines) add(line.orderItemId, line);

      if (input.allocations.length > 0) {
        allocateOldestFirst(input, locked, orders, totals, add);
      }

      // ── The ceiling, checked against the LOCKED rows ────────────────────
      const writes: {
        line: OrderItem;
        qty: { emptyQty: number; filledQty: number; lostQty: number };
      }[] = [];

      for (const [orderItemId, qty] of totals) {
        const line = lineById.get(orderItemId);
        if (!line) {
          throw new NotFoundError("Order line", { orderId, orderItemId });
        }
        const total = qty.emptyQty + qty.filledQty + qty.lostQty;
        if (total === 0) continue;

        if (!line.isReturnable) {
          throw new ConflictError(
            `"${line.productTitle}" is not a returnable product`,
            "orders.errors.lineNotReturnable",
            {
              orderItemId: line.id,
              orderId: line.orderId,
              lineNo: line.lineNo,
              productTitle: line.productTitle,
            },
          );
        }
        if (total > line.pendingQty) {
          const parent = orders.get(line.orderId);
          throw overReturnError(line, parent?.code ?? "", qty);
        }
        writes.push({ line, qty });
      }

      if (writes.length === 0) {
        throw new ConflictError(
          "Nothing to return",
          "orders.errors.returnAllZero",
          { orderId },
        );
      }

      // Ascending line id, matching the lock order taken above.
      writes.sort((a, b) => ascending(a.line.id, b.line.id));

      for (const write of writes) {
        await orderItemReturnEventRepository.create(
          {
            orderItemId: write.line.id,
            returnDate: input.returnDate,
            emptyQty: write.qty.emptyQty,
            filledQty: write.qty.filledQty,
            lostQty: write.qty.lostQty,
            note: input.note,
            createdById: userId,
          },
          em,
        );
      }

      logger.info(
        {
          orderId,
          lines: writes.length,
          orders: new Set(writes.map((w) => w.line.orderId)).size,
          filledReturned: writes.reduce((n, w) => n + w.qty.filledQty, 0),
          userId,
        },
        "order return recorded",
      );

      return loadDetail(orderId, em);
    }, userId),
  );
}

/**
 * "8 jars came back" with no line named → spread OLDEST ORDER FIRST.
 *
 * The picker lists open lines newest first, because that is what the clerk is
 * looking at; automatic attribution walks the same set in the opposite
 * direction, because the business need is the reverse — old orders have to
 * close, and a jar attributed to today's order leaves last month's open
 * forever. MODULES/03 §6.2, story O9.
 *
 * Only jar COUNTS are added here, never money. The rows are the ones this
 * transaction has already locked, so the `pendingQty` each allocation is
 * clamped to cannot move underneath it.
 */
function allocateOldestFirst(
  input: RecordOrderReturnInput,
  locked: OrderItem[],
  orders: Map<string, DeliveryOrder>,
  totals: Map<string, ReturnBuckets>,
  add: (
    orderItemId: string,
    qty: { emptyQty: number; filledQty: number; lostQty: number },
  ) => void,
): void {
  const open = locked
    .filter((line) => line.isReturnable && line.pendingQty > 0)
    .sort((a, b) => {
      const left = orders.get(a.orderId);
      const right = orders.get(b.orderId);
      if (left && right && left.orderDate !== right.orderDate) {
        return left.orderDate < right.orderDate ? -1 : 1;
      }
      if (left && right && left.orderNo !== right.orderNo) {
        return left.orderNo - right.orderNo;
      }
      return a.lineNo - b.lineNo;
    });

  for (const allocation of input.allocations) {
    const buckets: ("emptyQty" | "filledQty" | "lostQty")[] = [
      "emptyQty",
      "filledQty",
      "lostQty",
    ];

    for (const bucket of buckets) {
      let remaining = allocation[bucket];
      if (remaining <= 0) continue;

      for (const line of open) {
        if (remaining === 0) break;
        if (line.productId !== allocation.productId) continue;

        // Headroom left on this line after everything already assigned to it,
        // explicitly or by an earlier bucket of this same allocation.
        const assigned = totals.get(line.id);
        const used = assigned
          ? assigned.emptyQty + assigned.filledQty + assigned.lostQty
          : 0;
        const headroom = line.pendingQty - used;
        if (headroom <= 0) continue;

        const take = Math.min(headroom, remaining);
        add(line.id, {
          emptyQty: bucket === "emptyQty" ? take : 0,
          filledQty: bucket === "filledQty" ? take : 0,
          lostQty: bucket === "lostQty" ? take : 0,
        });
        remaining -= take;
      }

      if (remaining > 0) {
        throw new ConflictError(
          `${remaining} jars could not be attributed to any open line`,
          "orders.errors.allocationUnplaceable",
          {
            productId: allocation.productId,
            bucket,
            unplacedQty: remaining,
            requestedQty: allocation[bucket],
          },
        );
      }
    }
  }
}

/**
 * Money against an order — an instalment, or a refund.
 *
 * ONE endpoint for both directions, because they are one table and one act:
 * `direction` is `IN` for money collected and `OUT` for money given back. It
 * arrives in the body, fixed by which button opened the modal, and is never a
 * toggle the user can flip mid-entry.
 *
 * OVERPAYMENT IS DELIBERATELY ALLOWED (§5.1). A cash business takes round-number
 * payments constantly, and refusing ₹2,000 against a ₹1,940 balance just
 * teaches staff to record false amounts. The trigger flips `payment_status` to
 * `OVERPAID`, which is a truthful state the register renders in yellow.
 * A REFUND larger than what is owed is a different matter — that is money
 * leaving the business against nothing — and is refused.
 *
 * COINS COLLECTED HERE GO BACK INTO STOCK, automatically, through an
 * `ORDER_RECEIPT` ledger row per coin type. This is the return leg of the coin
 * lifecycle and must never be recorded a second time by hand.
 */
export async function recordOrderPayment(
  orderId: string,
  input: RecordOrderPaymentInput,
  userId: string,
): Promise<DeliveryOrderDetailDto> {
  assertNotFuture(input.paidOn, "orders.errors.paymentDateFuture");

  return withTx(async (em) => {
    if (input.clientRequestId) {
      const previous = await paymentRepository.findByClientRequestId(
        input.clientRequestId,
        em,
      );
      // The retry already landed. Returning the current state is the whole
      // point of the key — a conflict here would read as "it failed".
      if (previous) return loadDetail(orderId, em);
    }

    const order = await deliveryOrderRepository.findByIdForUpdate(orderId, em);
    assertLive(order, orderId);

    if (input.paidOn < order.orderDate) {
      throw new ConflictError(
        "Payment date precedes the order date",
        "orders.errors.paymentBeforeOrder",
        { paidOn: input.paidOn, orderDate: order.orderDate },
      );
    }

    if (input.direction === "OUT") {
      const refundable =
        order.outstandingAmount < 0 ? -order.outstandingAmount : 0;

      if (refundable === 0) {
        throw new ConflictError(
          "Nothing to refund on this order",
          "orders.errors.nothingToRefund",
          { orderId, outstandingAmount: order.outstandingAmount },
        );
      }
      if (input.amount > refundable) {
        throw new ConflictError(
          `Refund exceeds the ${refundable} owed back`,
          "orders.errors.refundExceeds",
          { maxAmount: refundable, requestedAmount: input.amount },
        );
      }
    }

    const written = await writePayment(em, {
      orderId,
      staffId: order.staffId,
      direction: input.direction,
      mode: input.mode,
      amount: input.amount,
      coins: input.coins,
      paidOn: input.paidOn,
      referenceNo: input.referenceNo,
      note: input.note,
      clientRequestId: input.clientRequestId,
      userId,
    });

    logger.info(
      {
        orderId,
        direction: input.direction,
        amount: input.amount,
        coinValue: written.coinValue,
        rows: written.paymentCount,
        userId,
      },
      "order payment recorded",
    );

    return loadDetail(orderId, em);
  }, userId);
}

/**
 * Cancel an order. §8: "Cancellation requires payments and returns to be
 * reversed first. Money is never cascade-deleted."
 *
 * So this REFUSES rather than unwinds. Reversing a payment or a return is an
 * append-only act with its own audit trail and its own reason; doing it
 * silently as a side effect of a cancel would destroy the record of money and
 * jars that genuinely moved. The 409 names which of the two is in the way, and
 * the detail DTO carries the same information as `cancelBlockedBy` so the
 * button can be disabled with an explanation rather than failing on click.
 *
 * Not a delete: `order_items` cascades, `payments` cascades, and
 * `order_item_return_events` cascades — a hard delete would take the entire
 * history with it. Cancelled is a status.
 */
export async function cancelDeliveryOrder(
  orderId: string,
  input: CancelDeliveryOrderInput,
  userId: string,
): Promise<DeliveryOrderDetailDto> {
  return withTx(async (em) => {
    const order = await deliveryOrderRepository.findByIdForUpdate(orderId, em);
    if (!order || order.deletedAt) {
      throw new NotFoundError("Order", { id: orderId });
    }

    // Idempotent: a double-tapped Cancel is a no-op, not an error toast on an
    // order that is already cancelled.
    if (order.status === "CANCELLED") return loadDetail(orderId, em);

    const before = await loadDetail(orderId, em);

    if (before.cancelBlockedBy.length > 0) {
      throw new ConflictError(
        `${order.code} still has ${before.cancelBlockedBy.join(" and ")} against it`,
        "orders.errors.cancelBlocked",
        {
          orderId,
          code: order.code,
          blockedBy: before.cancelBlockedBy,
          paymentCount: before.payments.length,
          returnCount: before.returns.length,
          paidTotalAmount: order.paidTotalAmount,
          qtyReturned:
            order.qtyReturnedEmpty + order.qtyReturnedFilled + order.qtyLost,
        },
      );
    }

    order.status = "CANCELLED";
    order.notes = input.reason
      ? [order.notes, input.reason].filter(Boolean).join("\n")
      : order.notes;
    order.updatedById = userId;
    await deliveryOrderRepository.save(order, em);

    const detail = await loadDetail(orderId, em);
    await writeRevision(em, {
      order: detail,
      before,
      changeReason: input.reason,
      userId,
    });

    logger.info(
      { orderId, code: order.code, reason: input.reason, userId },
      "delivery order cancelled",
    );

    return detail;
  }, userId);
}
