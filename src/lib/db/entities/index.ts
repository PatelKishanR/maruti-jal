/**
 * Entity barrel.
 *
 * The `entities` array is a STATIC LIST — never a glob. Bundlers erase the
 * filesystem, so `entities: ['src/**\/*.entity.ts']` resolves to zero entities
 * and fails with "No metadata found" in production only.
 * See .claude/ARCHITECTURE.md §1.3
 *
 * Every new entity must be imported and added to the array below.
 */

// Auth
import { User } from "./user.entity";

// Masters
import { Staff } from "./staff.entity";
import { ProductTag } from "./product-tag.entity";
import { ProductFilterType } from "./product-filter-type.entity";
import { Product } from "./product.entity";
import { ExpenseCategory } from "./expense-category.entity";
import { Expense } from "./expense.entity";
import { DirectSale } from "./direct-sale.entity";
import { AppSetting } from "./app-setting.entity";

// Delivery orders
import { DeliveryOrder } from "./delivery-order.entity";
import { OrderItem } from "./order-item.entity";
import { OrderItemReturnEvent } from "./order-item-return-event.entity";

// Coins
import { CoinType } from "./coin-type.entity";
import { CoinIssue } from "./coin-issue.entity";
import { CoinIssueItem } from "./coin-issue-item.entity";
import { CoinIssueReturnEvent } from "./coin-issue-return-event.entity";
import { CoinAdjustment } from "./coin-adjustment.entity";
import { CoinLedgerEntry } from "./coin-ledger-entry.entity";

// Party orders
import { PartyOrder } from "./party-order.entity";
import { PartyOrderDay } from "./party-order-day.entity";
import { PartyOrderItem } from "./party-order-item.entity";

// Shared / audit
import { Payment } from "./payment.entity";
import { DocumentRevision } from "./document-revision.entity";
import { AuditLog } from "./audit-log.entity";

export const entities = [
  User,
  Staff,
  ProductTag,
  ProductFilterType,
  Product,
  ExpenseCategory,
  Expense,
  DirectSale,
  AppSetting,
  DeliveryOrder,
  OrderItem,
  OrderItemReturnEvent,
  CoinType,
  CoinIssue,
  CoinIssueItem,
  CoinIssueReturnEvent,
  CoinAdjustment,
  CoinLedgerEntry,
  PartyOrder,
  PartyOrderDay,
  PartyOrderItem,
  Payment,
  DocumentRevision,
  AuditLog,
] as const;

// ---- Base classes -----------------------------------------------------------
export { BaseEntity } from "./base.entity";
export { LineItemBase } from "./line-item.base";

// ---- Entities ---------------------------------------------------------------
export { User } from "./user.entity";
export { Staff } from "./staff.entity";
export { ProductTag } from "./product-tag.entity";
export { ProductFilterType } from "./product-filter-type.entity";
export { Product } from "./product.entity";
export { ExpenseCategory } from "./expense-category.entity";
export { Expense } from "./expense.entity";
export { DirectSale } from "./direct-sale.entity";
export { AppSetting } from "./app-setting.entity";
export type { JsonValue } from "./app-setting.entity";
export { DeliveryOrder } from "./delivery-order.entity";
export { OrderItem } from "./order-item.entity";
export { OrderItemReturnEvent } from "./order-item-return-event.entity";
export { CoinType } from "./coin-type.entity";
export { CoinIssue } from "./coin-issue.entity";
export { CoinIssueItem } from "./coin-issue-item.entity";
export { CoinIssueReturnEvent } from "./coin-issue-return-event.entity";
export { CoinAdjustment } from "./coin-adjustment.entity";
export { CoinLedgerEntry } from "./coin-ledger-entry.entity";
export { PartyOrder } from "./party-order.entity";
export { PartyOrderDay } from "./party-order-day.entity";
export { PartyOrderItem } from "./party-order-item.entity";
export { Payment } from "./payment.entity";
export { DocumentRevision } from "./document-revision.entity";
export { AuditLog } from "./audit-log.entity";

// ---- Enums ------------------------------------------------------------------
export * from "./enums";
