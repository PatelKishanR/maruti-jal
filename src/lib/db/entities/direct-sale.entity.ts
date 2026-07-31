import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Product } from './product.entity';
import { PAYMENT_MODES, type PaymentMode } from './enums';
import { bigintToNumber, money, qty3 } from '@/lib/db/transformers';

/**
 * Walk-in cash sales at the plant gate.
 *
 * Cash-only by construction: the owner said these are always fully paid with no
 * pending state, so the mode is pinned to CASH by a CHECK constraint rather
 * than left as a nullable status. That makes the invalid state unrepresentable
 * instead of merely discouraged. See .claude/DATA-MODEL.md §5.18
 */
export const DIRECT_SALE_MODES = ['CASH'] as const satisfies readonly PaymentMode[];
export type DirectSaleMode = (typeof DIRECT_SALE_MODES)[number];

/**
 * There are no payment rows and no status column here — that is the whole
 * point of the table. Relaxing it for UPI later is a one-line migration:
 * widen the CHECK and add 'UPI' to DIRECT_SALE_MODES above.
 *
 * Every @Column declares its type EXPLICITLY and every relation carries
 * `Relation<T>`. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('direct_sales')
export class DirectSale extends BaseEntity {
  /** Identity column; `code` below is derived from it. See DATA-MODEL D-2 */
  @Column({
    type: 'bigint',
    name: 'sale_no',
    generated: 'identity',
    generatedIdentity: 'ALWAYS',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  saleNo!: number;

  @Index('uq_direct_sales_code', { unique: true })
  @Column({
    type: 'text',
    generatedType: 'STORED',
    asExpression: `'DWS-' || lpad(sale_no::text, 6, '0')`,
    insert: false,
    update: false,
  })
  code!: string;

  /**
   * The business day the sale belongs to — 'YYYY-MM-DD', never a Date. This is
   * what the daily-sales report groups by; `sold_at` below is the instant.
   * Keeping both means a 23:50 sale still reports on the right day even if the
   * timestamp is later corrected. See .claude/DATA-MODEL.md D-5
   */
  @Column({ type: 'date', name: 'sale_date' })
  saleDate!: string;

  @Column({ type: 'timestamptz', name: 'sold_at' })
  soldAt!: Date;

  /** One field, any script — no English/Gujarati pair (D-10). CHECK non-empty. */
  @Column({ type: 'text', name: 'customer_name' })
  customerName!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  /** numeric(12,2), CHECK > 0. Never summed in TypeScript — see D-4. */
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: money })
  amount!: number;

  /**
   * Nullable: a gate sale is often recorded as a bare amount with no product
   * picked, in which case there is no litre figure to record either.
   */
  @Column({
    type: 'numeric',
    precision: 7,
    scale: 3,
    nullable: true,
    transformer: qty3,
  })
  litres!: number | null;

  /**
   * Optional — the sale may predate the product being catalogued, or be a
   * one-off. RESTRICT so a product with sales history cannot be hard-deleted
   * (§10.6).
   */
  @ManyToOne(() => Product, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product> | null;

  @Column({ type: 'uuid', name: 'product_id', nullable: true })
  productId!: string | null;

  /**
   * Reuses the shared `payment_mode` PostgreSQL type rather than minting a
   * one-value type of its own — §3.1 is the complete list of native enums and
   * there is no direct-sale-specific mode. The full label set is declared here
   * so TypeORM's schema diff does not try to drop the other labels; the CHECK
   * constraint, not the enum, is what pins this column to CASH.
   */
  @Column({
    type: 'enum',
    enum: PAYMENT_MODES,
    enumName: 'payment_mode',
    default: 'CASH',
  })
  mode!: DirectSaleMode;

  /**
   * A voided sale is kept, not deleted: the register has to show that receipt
   * DWS-000123 existed and was cancelled, or the numbering looks tampered with.
   */
  @Column({ type: 'boolean', name: 'is_voided', default: false })
  isVoided!: boolean;

  @Column({ type: 'text', name: 'void_reason', nullable: true })
  voidReason!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /**
   * "Did that customer buy from us before?" is a name-or-phone question, so one
   * generated column with one trigram index answers it in a single predicate.
   * `code` is excluded because PostgreSQL forbids a generated column from
   * referencing another generated column (§5.5 note).
   *
   * `select: false` — a WHERE predicate, not a displayed value.
   */
  @Column({
    type: 'text',
    name: 'search_blob',
    generatedType: 'STORED',
    asExpression: `customer_name || ' ' || coalesce(phone, '') || ' ' || coalesce(address, '')`,
    insert: false,
    update: false,
    select: false,
  })
  searchBlob!: string;
}
