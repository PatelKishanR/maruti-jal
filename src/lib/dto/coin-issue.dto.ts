import type {
  CoinIssue,
  CoinIssueItem,
  CoinIssueReturnEvent,
  Payment,
} from "@/lib/db/entities";
import type {
  CoinIssueStatus,
  PaymentDirection,
  PaymentMode,
  PaymentStatus,
} from "@/lib/db/entities/enums";
import type { ListResult } from "@/lib/table/types";
import type { CoinIssueStatusFilter } from "@/lib/table/configs/coin-issue";
import { ROUNDING_STUB_LIMIT } from "@/lib/validation/coin-issue";
import type { CoinBalanceDriftDto } from "./coin-drift.dto";

/**
 * Plain shapes crossing the server → client boundary.
 *
 * TypeORM entities are CLASS INSTANCES and React's server-component serialiser
 * rejects them outright ("Only plain objects can be passed to Client
 * Components"). Mapping once here is also the only place a field can be kept
 * off the wire. See .claude/ARCHITECTURE.md §4.1 rule 8
 *
 * ── The one number this module is about ──────────────────────────────────
 *
 * `outstandingAmount` is SIGNED, and every screen in the module is arranged
 * around that sign:
 *
 *   > 0  the staff member still owes us      → amber, `₹500 due`
 *   = 0  the relationship is closed          → green, `Settled`
 *   < 0  WE owe HIM a refund                 → BLUE, `Refund ₹500`
 *
 * A negative pending is not a loss and must never render in Danger red. It is
 * a routine consequence of paying up front and returning unsold coins.
 * See MODULES/04-coins.md §6.1 and design §6.4
 *
 * Nothing here computes a TOTAL. Every rollup below — issued, returned, paid,
 * refunded, net payable, outstanding — is a trigger-maintained or generated
 * column on `coin_issues`, read straight off the row. The KPI strip is summed
 * in SQL by the repository. See .claude/ARCHITECTURE.md §9.1
 */

/* ── Lines ────────────────────────────────────────────────────────────── */

export interface CoinIssueLineDto {
  id: string;
  coinTypeId: string;
  /**
   * The SNAPSHOT taken at handover, not the live coin type's name. Renaming
   * "Blue Token" to "Blue Coin" next month must not rewrite what was handed
   * over in August. See .claude/DATA-MODEL.md §6
   */
  coinTypeName: string;
  /** Live, from the coin type — a colour is decoration, never a fact. */
  colourHex: string | null;
  packets: number;
  /** Snapshots. All four are `update: false` and trigger-protected. */
  coinsPerPacket: number;
  packetAmount: number;
  perCoinPrice: number;
  /** Generated: `packets × coinsPerPacketSnapshot`. */
  coinsIssued: number;
  /** Trigger-maintained cache of Σ the return events on this line. */
  coinsReturned: number;
  /** Generated: issued − returned. What is still out with the staff member. */
  coinsOutstanding: number;
  /** Generated: `round(packets × packetAmountSnapshot, 2)`. */
  lineAmount: number;
  /**
   * Σ `value_credited` over this line's return events, summed in SQL.
   *
   * NOT `coinsReturned × perCoinPrice` recomputed here: each event stored its
   * own rounded credit, and re-deriving the total would disagree with the
   * header the moment a rate divides unevenly. MODULES/04-coins.md §8.2
   */
  returnedValue: number;
  /** `lineAmount − returnedValue` — the line's share of net payable. */
  netAmount: number;
}

/* ── Events ───────────────────────────────────────────────────────────── */

export interface CoinReturnEventDto {
  id: string;
  coinIssueItemId: string;
  coinTypeName: string;
  returnDate: string;
  /** SIGNED — a reversal is negative and carries `reversesEventId`. */
  coinsReturned: number;
  unitValue: number;
  valueCredited: number;
  note: string | null;
  reversesEventId: string | null;
  createdAt: string;
}

export interface CoinPaymentDto {
  id: string;
  code: string;
  /** `OUT` is money leaving the company — a refund to the staff member. */
  direction: PaymentDirection;
  mode: PaymentMode;
  /** ALWAYS POSITIVE. The sign lives in `direction`. */
  amount: number;
  paidOn: string;
  referenceNo: string | null;
  note: string | null;
  reversesPaymentId: string | null;
  createdAt: string;
}

/* ── The issue ────────────────────────────────────────────────────────── */

export interface CoinIssueDto {
  id: string;
  code: string;
  issueNo: number;
  staffId: string;
  staffName: string;
  staffPhone: string | null;
  issueDate: string;
  /** Lifecycle. Money state is `paymentStatus`; the two are independent. */
  status: CoinIssueStatus;
  paymentStatus: PaymentStatus;
  notes: string | null;

  totalCoinsIssued: number;
  totalCoinsReturned: number;
  coinsOutstanding: number;

  /** Face value of everything handed over — the register's `ISSUED`. */
  totalAmount: number;
  returnedValue: number;
  /** Generated: `totalAmount − returnedValue`. */
  netPayable: number;
  /** Σ IN-direction payments — the register's `COLLECTED`. */
  paidAmount: number;
  /** Σ OUT-direction payments. */
  refundedAmount: number;
  /** SIGNED. The register's `PENDING`. Negative means we owe a refund. */
  outstandingAmount: number;

  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One register row. Design §6.
 *
 * `lines` travels WITH the row rather than being fetched when the chevron is
 * clicked: the breakdown is three short columns per coin type, the page is 25
 * rows, and an expand that waits on a round trip reads as the app hesitating.
 * See design §6.6 — "the panel itself appears instantly".
 */
export interface CoinIssueListItemDto extends CoinIssueDto {
  /**
   * The register's own status vocabulary, not the raw `payment_status`.
   * The owner reads this column as "what do I do about this row?".
   */
  registerStatus: CoinIssueStatusFilter;
  /** Pending is non-zero but under ₹1 — rounding, not money. §8.2 */
  roundingStub: boolean;
  /** Pending < 0. Drives the blue left border and the `Refund ₹x` badge. */
  refundDue: boolean;
  /** Positive part of pending — what is still to collect. */
  dueAmount: number;
  /** Magnitude of a negative pending — what we owe back. */
  refundAmount: number;
  lines: CoinIssueLineDto[];
}

export interface CoinIssueDetailDto extends CoinIssueListItemDto {
  returns: CoinReturnEventDto[];
  payments: CoinPaymentDto[];
  /** False on a cancelled issue, or when nothing is left to hand back. */
  canRecordReturn: boolean;
  /** False on a cancelled issue, or when pending is already zero. */
  canRecordPayment: boolean;
  canCancel: boolean;
  /** `Settle difference` is offered only for a rounding stub. */
  canSettleDifference: boolean;
}

/* ── KPI strip ────────────────────────────────────────────────────────── */

/**
 * The §6.2 KPI strip, summed in SQL over the SAME filter set as the table
 * (search, staff, coin type, date range, status) minus the pagination.
 *
 * Filtered rather than global on purpose: every card is a door into the list
 * behind it, and a card that ignores the filters sends the owner somewhere he
 * cannot get back from. It also means the coin-issue create form can ask for
 * one staff member's position with the same endpoint.
 */
export interface CoinIssueSummaryDto {
  /** Issues with a non-zero pending figure, either direction. */
  openIssues: number;
  totalIssues: number;
  /** Σ `coins_outstanding` — coins physically out with staff right now. */
  coinsOutWithStaff: number;
  staffWithCoins: number;
  /** Σ pending where pending > 0. Always positive. */
  pendingAmount: number;
  /** Σ |pending| where pending < 0. Always positive. */
  refundsDueAmount: number;
  staffWithRefunds: number;
}

export interface CoinIssueListResponseDto
  extends ListResult<CoinIssueListItemDto> {
  summary: CoinIssueSummaryDto;
  /**
   * §13, the non-dismissible banner. Empty forever if the ledger is healthy;
   * a single row is a Sev-1. Carried on the list payload so the register can
   * warn BEFORE the owner acts on any figure on the screen.
   */
  drift: CoinBalanceDriftDto[];
}

/**
 * The context line under the staff picker on the create form. Design §7.3
 *
 * Signed, exactly like the register: positive means he owes, negative means we
 * owe him — and the form says so in blue rather than amber.
 */
export interface CoinIssueStaffSummaryDto {
  staffId: string;
  openIssues: number;
  outstandingAmount: number;
  coinsOutstanding: number;
}

/** Option shape for `<EntityCombobox>`. Structural on purpose — a service must
 *  not import a client component. */
export interface CoinIssueOptionDto {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/* ── Mappers ──────────────────────────────────────────────────────────── */

/**
 * The register's status vocabulary, derived from ONE signed number.
 *
 * Deliberately not a straight read of `payment_status`: `OVERPAID` and
 * `REFUND_DUE` are the same instruction to the owner ("give money back"), and
 * a `PAID` row whose pending is zero is simply closed. Design §6.4
 */
export function registerStatusOf(issue: CoinIssue): CoinIssueStatusFilter {
  if (issue.status === "CANCELLED") return "cancelled";
  if (issue.outstandingAmount < 0) return "refund_due";
  if (issue.outstandingAmount === 0) return "settled";
  return issue.paidAmount > 0 ? "partial" : "pending";
}

/** Non-zero, but under a rupee: rounding rather than money. §8.2 */
export function isRoundingStub(outstanding: number): boolean {
  return outstanding !== 0 && Math.abs(outstanding) < ROUNDING_STUB_LIMIT;
}

export function toCoinIssueLineDto(
  item: CoinIssueItem,
  returned: { coins: number; value: number } = { coins: 0, value: 0 },
): CoinIssueLineDto {
  const returnedValue = returned.value;

  return {
    id: item.id,
    coinTypeId: item.coinTypeId,
    coinTypeName: item.coinTypeNameSnapshot,
    colourHex: item.coinType?.colourHex ?? null,
    packets: item.packets,
    coinsPerPacket: item.coinsPerPacketSnapshot,
    packetAmount: item.packetAmountSnapshot,
    perCoinPrice: item.perCoinPriceSnapshot,
    coinsIssued: item.coinsIssued,
    coinsReturned: item.coinsReturned,
    coinsOutstanding: item.coinsOutstanding,
    lineAmount: item.lineAmount,
    returnedValue,
    // Two stored two-decimal figures subtracted, not a fresh multiplication —
    // this is the same arithmetic the header's generated column performs.
    netAmount: Math.round((item.lineAmount - returnedValue) * 100) / 100,
  };
}

export function toCoinIssueDto(issue: CoinIssue): CoinIssueDto {
  return {
    id: issue.id,
    code: issue.code,
    issueNo: issue.issueNo,
    staffId: issue.staffId,
    // The staff relation is joined by `searchPaginated` and
    // `findByIdWithItems`; a row read without it still renders its own code.
    staffName: issue.staff?.name ?? "",
    staffPhone: issue.staff?.phone ?? null,
    issueDate: issue.issueDate,
    status: issue.status,
    paymentStatus: issue.paymentStatus,
    notes: issue.notes,
    totalCoinsIssued: issue.totalCoinsIssued,
    totalCoinsReturned: issue.totalCoinsReturned,
    coinsOutstanding: issue.coinsOutstanding,
    totalAmount: issue.totalAmount,
    returnedValue: issue.returnedValue,
    netPayable: issue.netPayable,
    paidAmount: issue.paidAmount,
    refundedAmount: issue.refundedAmount,
    outstandingAmount: issue.outstandingAmount,
    settledAt: issue.settledAt?.toISOString() ?? null,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  };
}

export function toCoinIssueListItemDto(
  issue: CoinIssue,
  lines: CoinIssueLineDto[],
): CoinIssueListItemDto {
  const base = toCoinIssueDto(issue);
  const outstanding = base.outstandingAmount;

  return {
    ...base,
    registerStatus: registerStatusOf(issue),
    roundingStub: isRoundingStub(outstanding),
    refundDue: outstanding < 0,
    dueAmount: outstanding > 0 ? outstanding : 0,
    refundAmount: outstanding < 0 ? -outstanding : 0,
    lines,
  };
}

export function toCoinIssueDetailDto(
  issue: CoinIssue,
  lines: CoinIssueLineDto[],
  returns: CoinReturnEventDto[],
  payments: CoinPaymentDto[],
): CoinIssueDetailDto {
  const base = toCoinIssueListItemDto(issue, lines);
  const live = base.status !== "CANCELLED";

  return {
    ...base,
    returns,
    payments,
    canRecordReturn: live && lines.some((line) => line.coinsOutstanding > 0),
    canRecordPayment: live && base.outstandingAmount !== 0,
    canCancel: live,
    canSettleDifference: live && base.roundingStub,
  };
}

export function toCoinReturnEventDto(
  event: CoinIssueReturnEvent,
  coinTypeName: string,
): CoinReturnEventDto {
  return {
    id: event.id,
    coinIssueItemId: event.coinIssueItemId,
    coinTypeName,
    returnDate: event.returnDate,
    coinsReturned: event.coinsReturned,
    unitValue: event.unitValueSnapshot,
    valueCredited: event.valueCredited,
    note: event.note,
    reversesEventId: event.reversesEventId,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toCoinPaymentDto(payment: Payment): CoinPaymentDto {
  return {
    id: payment.id,
    code: payment.code,
    direction: payment.direction,
    mode: payment.mode,
    amount: payment.amount,
    paidOn: payment.paidOn,
    referenceNo: payment.referenceNo,
    note: payment.note,
    reversesPaymentId: payment.reversesPaymentId,
    createdAt: payment.createdAt.toISOString(),
  };
}
