import {
  Entity,
  Column,
  Index,
  Check,
  ManyToOne,
  OneToMany,
  JoinColumn,
  VersionColumn,
  type Relation,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Staff } from './staff.entity';
import { OrderItem } from './order-item.entity';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  RETURN_STATUSES,
  type OrderStatus,
  type PaymentStatus,
  type ReturnStatus,
} from './enums';
import { bigintToNumber, money } from '@/lib/db/transformers';

/**
 * A morning's load-out: which staff member took which jars, on what date, at
 * what price — and everything that has happened to that load since.
 *
 * Two independent questions hang off every row and both are answered without a
 * join: how much money is still to collect (`outstanding_amount`) and how many
 * jars are still out (`qty_pending`). Those are the list page's headline
 * filters, so they are indexed columns rather than correlated subqueries.
 * See .claude/DATA-MODEL.md §8.1
 *
 * THE ROLLUPS ARE NOT WRITTEN BY THIS APPLICATION. Money and jar totals are
 * maintained by database triggers over `order_items`, `order_item_return_events`
 * and `payments`, because they must be correct no matter who writes — a server
 * action, a future import script, or the owner running an UPDATE in the Neon
 * console at 11pm. Every such column below is `update: false`.
 * See .claude/DATA-MODEL.md §8.2
 *
 * Every @Column declares its type EXPLICITLY. Bare `@Column()` relies on
 * emitted decorator metadata, which esbuild — the toolchain running our
 * migration CLI — has never implemented. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('delivery_orders')
@Check('chk_delivery_orders_discount_non_negative', '"discount_amount" >= 0')
export class DeliveryOrder extends BaseEntity {
  /**
   * A water plant runs on register numbers, not uuids. `order_no` is a plain
   * identity column and `code` is derived from it in the database, which is
   * gapless-enough, sortable and searchable with no trigger code to maintain.
   * See .claude/DATA-MODEL.md D-2
   *
   * BY DEFAULT rather than ALWAYS: the application never supplies a value
   * (`insert: false` sees to that), but ALWAYS would reject an explicit one
   * during a data import or a restore, which is exactly when you need it.
   */
  @Column({
    type: 'bigint',
    name: 'order_no',
    generated: 'identity',
    generatedIdentity: 'BY DEFAULT',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  orderNo!: number;

  @Index('uq_delivery_orders_code', { unique: true })
  @Column({
    type: 'text',
    generatedType: 'STORED',
    asExpression: `'ORD-' || lpad(order_no::text, 6, '0')`,
    insert: false,
    update: false,
  })
  code!: string;

  /**
   * RESTRICT, not CASCADE: a staff member with delivery history physically
   * cannot be removed from under it. See .claude/DATA-MODEL.md §10.6
   */
  @ManyToOne(() => Staff, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'staff_id' })
  staff!: Relation<Staff>;

  @Column({ type: 'uuid', name: 'staff_id' })
  staffId!: string;

  /**
   * A calendar concept, carried as 'YYYY-MM-DD' end to end. Never a Date — the
   * driver would decode it to local midnight and a UTC server would silently
   * shift it a day. See .claude/ARCHITECTURE.md §9.2
   */
  @Column({ type: 'date', name: 'order_date', default: () => 'CURRENT_DATE' })
  orderDate!: string;

  @Column({
    type: 'enum',
    enum: ORDER_STATUSES,
    enumName: 'order_status',
    default: 'CONFIRMED',
  })
  status!: OrderStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /* ── Money rollups ──────────────────────────────────────────────────────
     All of these except `discount_amount` are trigger-maintained. */

  /** Σ of `order_items.line_total`. Trigger-maintained — see the class note. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'subtotal_amount',
    default: 0,
    transformer: money,
    update: false,
  })
  subtotalAmount!: number;

  /** Header round-off. The ONLY money field the admin edits directly. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'discount_amount',
    default: 0,
    transformer: money,
  })
  discountAmount!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'total_amount',
    generatedType: 'STORED',
    asExpression: 'subtotal_amount - discount_amount',
    insert: false,
    update: false,
    transformer: money,
  })
  totalAmount!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'paid_cash_amount',
    default: 0,
    transformer: money,
    update: false,
  })
  paidCashAmount!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'paid_coin_amount',
    default: 0,
    transformer: money,
    update: false,
  })
  paidCoinAmount!: number;

  /** UPI, bank transfer and write-offs. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'paid_other_amount',
    default: 0,
    transformer: money,
    update: false,
  })
  paidOtherAmount!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'paid_total_amount',
    default: 0,
    transformer: money,
    update: false,
  })
  paidTotalAmount!: number;

  /** Money returned to the staff member via OUT-direction payments. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'refunded_amount',
    default: 0,
    transformer: money,
    update: false,
  })
  refundedAmount!: number;

  /**
   * The "payment pending" filter column, and the only place the sign matters:
   * NEGATIVE means the company owes the staff member a refund.
   * See .claude/DATA-MODEL.md §10.3
   *
   * The expression repeats `subtotal_amount - discount_amount` instead of
   * referencing `total_amount`. That is not sloppiness — PostgreSQL refuses to
   * let one generated column reference another, so the duplication is required.
   * See .claude/DATA-MODEL.md §5.5
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'outstanding_amount',
    generatedType: 'STORED',
    asExpression:
      'subtotal_amount - discount_amount - paid_total_amount + refunded_amount',
    insert: false,
    update: false,
    transformer: money,
  })
  outstandingAmount!: number;

  /**
   * Trigger-maintained. An enum cannot be produced by a generated column, which
   * is precisely why this one is a trigger rather than arithmetic.
   * See .claude/DATA-MODEL.md §8.2
   */
  @Column({
    type: 'enum',
    enum: PAYMENT_STATUSES,
    enumName: 'payment_status',
    name: 'payment_status',
    default: 'UNPAID',
    update: false,
  })
  paymentStatus!: PaymentStatus;

  /* ── Jar rollups — trigger-maintained ───────────────────────────────── */

  /** Returnable line items only. Disposable bottles never enter these counts. */
  @Column({
    type: 'integer',
    name: 'qty_issued',
    default: 0,
    update: false,
  })
  qtyIssued!: number;

  @Column({
    type: 'integer',
    name: 'qty_returned_empty',
    default: 0,
    update: false,
  })
  qtyReturnedEmpty!: number;

  @Column({
    type: 'integer',
    name: 'qty_returned_filled',
    default: 0,
    update: false,
  })
  qtyReturnedFilled!: number;

  /** Written off explicitly, or orders sit pending forever. */
  @Column({
    type: 'integer',
    name: 'qty_lost',
    default: 0,
    update: false,
  })
  qtyLost!: number;

  /** The "jars out" filter column. */
  @Column({
    type: 'integer',
    name: 'qty_pending',
    generatedType: 'STORED',
    asExpression:
      'qty_issued - qty_returned_empty - qty_returned_filled - qty_lost',
    insert: false,
    update: false,
  })
  qtyPending!: number;

  @Column({
    type: 'enum',
    enum: RETURN_STATUSES,
    enumName: 'return_status',
    name: 'return_status',
    default: 'NOT_RETURNED',
    update: false,
  })
  returnStatus!: ReturnStatus;

  /* ── Timeline — trigger-stamped, powers "days outstanding" ageing ────── */

  @Column({
    type: 'timestamptz',
    name: 'first_payment_at',
    nullable: true,
    update: false,
  })
  firstPaymentAt!: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'last_payment_at',
    nullable: true,
    update: false,
  })
  lastPaymentAt!: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'fully_paid_at',
    nullable: true,
    update: false,
  })
  fullyPaidAt!: Date | null;

  @Column({
    type: 'timestamptz',
    name: 'fully_returned_at',
    nullable: true,
    update: false,
  })
  fullyReturnedAt!: Date | null;

  /**
   * Optimistic lock. Two admins editing the same order → the second save fails
   * loudly with "changed by Ramesh 30 seconds ago, reload" instead of silently
   * discarding the first one's work. See .claude/DATA-MODEL.md §9
   */
  @VersionColumn({ type: 'integer' })
  version!: number;

  @OneToMany(() => OrderItem, (item) => item.order)
  items!: Relation<OrderItem>[];
}
