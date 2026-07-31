/**
 * Every PostgreSQL enum in the schema, in one place.
 *
 * These drive `if`/`switch` branches in application code, so a value the code
 * doesn't handle is a runtime bug. Native PG enums make that impossible by
 * construction, and adding a value is a deliberate one-line migration.
 *
 * Product tags and filter types are the deliberate exception — they are
 * business vocabulary the owner edits, so they are LOOKUP TABLES rather than
 * enums. See .claude/DATA-MODEL.md §3
 */

export const USER_ROLES = ["OWNER", "ADMIN", "MANAGER", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORDER_STATUSES = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "PARTIAL",
  "PAID",
  /** Collected more than due. Deliberately allowed — see MODULES/00-auth.md §4.5 */
  "OVERPAID",
  /** Negative outstanding: the company owes money back. */
  "REFUND_DUE",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RETURN_STATUSES = [
  "NOT_RETURNED",
  "PARTIAL",
  "COMPLETE",
  /** Order contained only non-returnable products. */
  "NOT_APPLICABLE",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const PAYMENT_MODES = [
  "CASH",
  "COIN",
  "UPI",
  "BANK_TRANSFER",
  /**
   * Cash businesses forgive ₹20 balances. Modelling it as a payment mode keeps
   * outstanding at zero truthfully instead of leaving phantom dues forever.
   */
  "WRITE_OFF",
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** The sign lives here, never in the amount — amounts are always positive. */
export const PAYMENT_DIRECTIONS = ["IN", "OUT"] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

export const PAYMENT_CONTEXTS = [
  "ORDER",
  "COIN_ISSUE",
  "PARTY_ORDER",
] as const;
export type PaymentContext = (typeof PAYMENT_CONTEXTS)[number];

export const COIN_ISSUE_STATUSES = ["OPEN", "SETTLED", "CANCELLED"] as const;
export type CoinIssueStatus = (typeof COIN_ISSUE_STATUSES)[number];

export const PARTY_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type PartyOrderStatus = (typeof PARTY_ORDER_STATUSES)[number];

export const DAY_DELIVERY_STATUSES = [
  "SCHEDULED",
  "DELIVERED",
  "SKIPPED",
  "CANCELLED",
] as const;
export type DayDeliveryStatus = (typeof DAY_DELIVERY_STATUSES)[number];

export const LEDGER_MOVEMENT_TYPES = [
  "OPENING",
  "ISSUE",
  "ISSUE_RETURN",
  "ORDER_RECEIPT",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "ISSUE_CANCELLED",
] as const;
export type LedgerMovementType = (typeof LEDGER_MOVEMENT_TYPES)[number];

export const LEDGER_SOURCE_TYPES = [
  "COIN_ISSUE_ITEM",
  "COIN_ISSUE_RETURN_EVENT",
  "PAYMENT",
  "COIN_ADJUSTMENT",
] as const;
export type LedgerSourceType = (typeof LEDGER_SOURCE_TYPES)[number];

export const ADJUSTMENT_REASONS = [
  "OPENING_STOCK",
  "MINTED",
  "PURCHASED",
  "LOST",
  "DAMAGED",
  "STOLEN",
  "RECONCILIATION",
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const EXPENSE_PAYMENT_MODES = [
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CHEQUE",
] as const;
export type ExpensePaymentMode = (typeof EXPENSE_PAYMENT_MODES)[number];

export const AUDIT_ACTIONS = [
  "INSERT",
  "UPDATE",
  "SOFT_DELETE",
  "RESTORE",
  "CANCEL",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const DOCUMENT_TYPES = [
  "ORDER",
  "COIN_ISSUE",
  "PARTY_ORDER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** UI language. Mirrored into a cookie so the first server paint is correct. */
export const LOCALES = ["en", "gu"] as const;
export type Locale = (typeof LOCALES)[number];

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
