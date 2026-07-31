import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { money, rate6, bigintToNumber } from '../transformers';
import {
  PAYMENT_CONTEXTS,
  PAYMENT_DIRECTIONS,
  PAYMENT_MODES,
  type PaymentContext,
  type PaymentDirection,
  type PaymentMode,
} from './enums';
import { DeliveryOrder } from './delivery-order.entity';
import { CoinIssue } from './coin-issue.entity';
import { CoinType } from './coin-type.entity';
import { PartyOrder } from './party-order.entity';

/**
 * Every rupee that moves, for THREE different modules, in one table.
 *
 * APPEND-ONLY. It deliberately does not extend BaseEntity: no `updated_at`, no
 * `deleted_at`, no `updated_by_id`. A BEFORE UPDATE OR DELETE trigger raises
 * unconditionally and UPDATE/DELETE are revoked from the application role. A
 * mistake is corrected by inserting a REVERSING row that points at the
 * original via `reverses_payment_id` — both rows stay visible forever. This is
 * the difference between an accounting system and a spreadsheet.
 * See .claude/DATA-MODEL.md §9
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * A water plant runs on register numbers, not UUIDs. `payment_no` is a plain
   * identity column and `code` is derived from it in the database.
   * See .claude/DATA-MODEL.md D-2
   *
   * BY DEFAULT rather than ALWAYS: the application never supplies a value
   * (`insert: false` sees to that), but ALWAYS would reject an explicit one
   * during a data import or a restore, which is exactly when you need it.
   */
  @Column({
    type: 'bigint',
    name: 'payment_no',
    generated: 'identity',
    generatedIdentity: 'BY DEFAULT',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  paymentNo!: number;

  /** Generated, so it is gapless-enough, sortable and searchable with no trigger code. */
  @Index('uq_payments_code', { unique: true })
  @Column({
    type: 'text',
    generatedType: 'STORED',
    asExpression: `'PAY-' || lpad(payment_no::text, 6, '0')`,
    insert: false,
    update: false,
  })
  code!: string;

  /* ═══════════════════════════════════════════════════════════════════════
     THE EXCLUSIVE ARC

     Three nullable foreign keys, exactly one of which is set, matching
     `context_type`. Enforced by a table constraint in the migration.

     WHY NOT a bare `payable_type` / `payable_id` pair: pure polymorphism loses
     referential integrity. Nothing stops a payment pointing at an order that
     no longer exists, the database cannot cascade, and you cannot JOIN without
     a CASE expression. Three nullable uuids cost 8 bytes each on rows that
     don't use them and buy real foreign keys, real cascades, and one small
     partial index per arc instead of one bloated index over a discriminator.
     See .claude/DATA-MODEL.md §5.8
     ═══════════════════════════════════════════════════════════════════════ */

  @Column({
    type: 'enum',
    enum: PAYMENT_CONTEXTS,
    enumName: 'payment_context',
    name: 'context_type',
  })
  contextType!: PaymentContext;

  @ManyToOne(() => DeliveryOrder, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<DeliveryOrder> | null;

  @Column({ type: 'uuid', name: 'order_id', nullable: true })
  orderId!: string | null;

  @ManyToOne(() => CoinIssue, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coin_issue_id' })
  coinIssue!: Relation<CoinIssue> | null;

  @Column({ type: 'uuid', name: 'coin_issue_id', nullable: true })
  coinIssueId!: string | null;

  @ManyToOne(() => PartyOrder, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'party_order_id' })
  partyOrder!: Relation<PartyOrder> | null;

  @Column({ type: 'uuid', name: 'party_order_id', nullable: true })
  partyOrderId!: string | null;

  /* ═══════════════════════════════════════════════════════════════════════
     THE MONEY
     ═══════════════════════════════════════════════════════════════════════ */

  /** `OUT` is money leaving the company — a refund. */
  @Column({
    type: 'enum',
    enum: PAYMENT_DIRECTIONS,
    enumName: 'payment_direction',
  })
  direction!: PaymentDirection;

  @Column({ type: 'enum', enum: PAYMENT_MODES, enumName: 'payment_mode' })
  mode!: PaymentMode;

  /**
   * ALWAYS POSITIVE. Constrained to `> 0` in the database.
   *
   * The sign lives in `direction`, never in the number. A signed amount makes
   * every aggregate ambiguous — `SUM(amount)` silently nets refunds against
   * receipts, so "how much did we collect?" and "how much did we refund?" stop
   * being separately answerable. With the sign in a discriminator both are a
   * plain `WHERE`. See .claude/DATA-MODEL.md §5.8
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: money,
  })
  amount!: number;

  /** Party orders: a deposit taken before the schedule is fully built. */
  @Column({ type: 'boolean', name: 'is_advance', default: false })
  isAdvance!: boolean;

  @Column({ type: 'date', name: 'paid_on' })
  paidOn!: string;

  /* ═══════════════════════════════════════════════════════════════════════
     COIN REDEMPTION

     All three columns are required exactly when `mode = 'COIN'` and forbidden
     otherwise, and `amount` must equal `round(coin_count * coin_unit_value, 2)`.
     Both halves are table constraints, so an inconsistent coin payment cannot
     be written even by hand in the Neon console.
     ═══════════════════════════════════════════════════════════════════════ */

  @ManyToOne(() => CoinType, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coin_type_id' })
  coinType!: Relation<CoinType> | null;

  @Column({ type: 'uuid', name: 'coin_type_id', nullable: true })
  coinTypeId!: string | null;

  @Column({ type: 'integer', name: 'coin_count', nullable: true })
  coinCount!: number | null;

  /**
   * A SNAPSHOT of the coin's per-coin price at the moment of receipt, not a
   * lookup through `coin_type_id`. Repricing a coin type next month must not
   * silently rewrite what last month's payment was worth.
   *
   * Six decimals because the rate divides: ₹500 / 45 coins = ₹11.111111.
   * See .claude/DATA-MODEL.md §10.5, §10.7
   */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 6,
    name: 'coin_unit_value',
    nullable: true,
    transformer: rate6,
  })
  coinUnitValue!: number | null;

  /* ═══════════════════════════════════════════════════════════════════════
     PROVENANCE
     ═══════════════════════════════════════════════════════════════════════ */

  /** UPI transaction id, cheque number — whatever proves the transfer happened. */
  @Column({ type: 'text', name: 'reference_no', nullable: true })
  referenceNo!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** A correction is an INSERT pointing back at the row it cancels, never an UPDATE. */
  @ManyToOne(() => Payment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reverses_payment_id' })
  reversesPayment!: Relation<Payment> | null;

  /** Unique: one payment can be reversed once, or the books stop balancing. */
  @Index('uq_payments_reverses_payment', {
    unique: true,
    where: '"reverses_payment_id" IS NOT NULL',
  })
  @Column({ type: 'uuid', name: 'reverses_payment_id', nullable: true })
  reversesPaymentId!: string | null;

  /**
   * Idempotency key. The client generates it ONCE per form open, so a retry on
   * a flaky connection carries the same value and the unique index rejects the
   * duplicate. Without it, "did that save?" plus an impatient second tap is a
   * customer paying twice on paper. See .claude/DATA-MODEL.md §10.11
   */
  @Index('uq_payments_client_request_id', {
    unique: true,
    where: '"client_request_id" IS NOT NULL',
  })
  @Column({ type: 'text', name: 'client_request_id', nullable: true })
  clientRequestId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById!: string | null;
}

/*
 * The remaining §11 indexes for this table — one partial index per arc, plus
 * (coin_type_id, paid_on DESC) WHERE mode = 'COIN' — are created in the
 * concurrent-index migration. They carry a DESC sort key, which TypeORM's
 * @Index decorator cannot express, so declaring them here would generate the
 * wrong DDL. Only the semantic UNIQUE constraints live on the entity.
 */
