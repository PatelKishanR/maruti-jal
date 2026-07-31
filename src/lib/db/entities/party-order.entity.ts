import {
  Column,
  Entity,
  Index,
  OneToMany,
  VersionColumn,
  type Relation,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { money, bigintToNumber } from '../transformers';
import {
  PARTY_ORDER_STATUSES,
  PAYMENT_STATUSES,
  type PartyOrderStatus,
  type PaymentStatus,
} from './enums';
import { PartyOrderDay } from './party-order-day.entity';

/**
 * An event booking — a wedding hall taking water across several days.
 *
 * A party order is really a CALENDAR of deliveries: the header holds the
 * client and the money, `party_order_days` holds one row per service date, and
 * `party_order_items` holds that day's lines. Payments are recorded against
 * the header, not the day, because that is how clients actually pay.
 *
 * Deliberately independent of `delivery_orders`: a party delivery is not a
 * route order, does not go through the jar return flow, and does not touch a
 * staff member's jar balance. See .claude/MODULES/05-party-orders.md §10
 */
@Entity('party_orders')
export class PartyOrder extends BaseEntity {
  /**
   * The register number. BY DEFAULT rather than ALWAYS so a data import or a
   * restore can supply an explicit value; the application never does, because
   * `insert: false` sees to that. See .claude/DATA-MODEL.md D-2
   */
  @Column({
    type: 'bigint',
    name: 'party_no',
    generated: 'identity',
    generatedIdentity: 'BY DEFAULT',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  partyNo!: number;

  @Index('uq_party_orders_code', { unique: true })
  @Column({
    type: 'text',
    generatedType: 'STORED',
    asExpression: `'PTY-' || lpad(party_no::text, 6, '0')`,
    insert: false,
    update: false,
  })
  code!: string;

  /* ═══════════════════════════════════════════════════════════════════════
     THE CLIENT
     ═══════════════════════════════════════════════════════════════════════ */

  /** One field, any script. No `*_en` / `*_gu` pair anywhere. See DATA-MODEL D-10 */
  @Column({ type: 'text', name: 'party_name' })
  partyName!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 20, name: 'alt_phone', nullable: true })
  altPhone!: string | null;

  @Column({ type: 'text', name: 'delivery_address' })
  deliveryAddress!: string;

  /** Access instructions, contact person — whatever is useful on the day. */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: PARTY_ORDER_STATUSES,
    enumName: 'party_order_status',
    default: 'CONFIRMED',
  })
  status!: PartyOrderStatus;

  /* ═══════════════════════════════════════════════════════════════════════
     SCHEDULE WINDOW — trigger-maintained from party_order_days

     Not generated columns: they aggregate over a CHILD table, which a
     generated column cannot do. See .claude/DATA-MODEL.md §8.2
     ═══════════════════════════════════════════════════════════════════════ */

  @Column({ type: 'date', name: 'first_service_date', nullable: true })
  firstServiceDate!: string | null;

  @Column({ type: 'date', name: 'last_service_date', nullable: true })
  lastServiceDate!: string | null;

  @Column({ type: 'integer', name: 'total_days', default: 0 })
  totalDays!: number;

  /* ═══════════════════════════════════════════════════════════════════════
     MONEY — trigger-maintained, because the list page filters and sorts on it

     Computed on read, "show me parties with money outstanding, sorted, page 3"
     becomes a correlated subquery PostgreSQL cannot index. Cached, it is an
     indexed range scan. See .claude/DATA-MODEL.md §8.1
     ═══════════════════════════════════════════════════════════════════════ */

  /** Σ of `day_total` over days that are not SKIPPED and not CANCELLED. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'total_amount',
    default: 0,
    transformer: money,
  })
  totalAmount!: number;

  /**
   * The subset of `paid_amount` flagged `is_advance` — a deposit taken at
   * booking. Reported separately, but NOT added separately: an advance is
   * already money received, so counting it twice would understate what is due.
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'advance_amount',
    default: 0,
    transformer: money,
  })
  advanceAmount!: number;

  /** Σ of all IN-direction payments, advances included. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'paid_amount',
    default: 0,
    transformer: money,
  })
  paidAmount!: number;

  /** Σ of all OUT-direction payments. Money already returned to the client. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'refunded_amount',
    default: 0,
    transformer: money,
  })
  refundedAmount!: number;

  /**
   * THE "payment pending" FILTER COLUMN.
   *
   * Signed on purpose: negative means the company owes the client a refund,
   * which is exactly what happens when a day is cancelled after the deposit
   * was taken. The status flips to REFUND_DUE and it is settled by an
   * OUT-direction payment — what was paid is never mutated.
   * See .claude/DATA-MODEL.md §10.3
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'outstanding_amount',
    generatedType: 'STORED',
    asExpression: 'round(total_amount - paid_amount + refunded_amount, 2)',
    insert: false,
    update: false,
    transformer: money,
  })
  outstandingAmount!: number;

  /** Trigger-maintained: PostgreSQL will not produce an enum in a generated column. */
  @Column({
    type: 'enum',
    enum: PAYMENT_STATUSES,
    enumName: 'payment_status',
    name: 'payment_status',
    default: 'UNPAID',
  })
  paymentStatus!: PaymentStatus;

  /**
   * One search box matching name OR phone OR address.
   *
   * Three separate columns force three OR-branches and three indexes; one
   * generated column under one trigram index gives a single fast predicate.
   *
   * `code` is NOT folded in: it is itself a generated column, and PostgreSQL
   * forbids a generated column referencing another one. Searching by code is a
   * separate trigram index on `code`. See .claude/DATA-MODEL.md §5.2, §5.5
   */
  @Column({
    type: 'text',
    name: 'search_blob',
    generatedType: 'STORED',
    asExpression:
      "coalesce(party_name, '') || ' ' || coalesce(phone, '') || ' ' || " +
      "coalesce(alt_phone, '') || ' ' || coalesce(delivery_address, '')",
    insert: false,
    update: false,
  })
  searchBlob!: string;

  /**
   * Optimistic lock. Two admins editing the same booking → the second save
   * fails loudly instead of silently discarding the first one's work.
   * See .claude/DATA-MODEL.md §9
   */
  @VersionColumn({ type: 'integer', name: 'version' })
  version!: number;

  @OneToMany(() => PartyOrderDay, (day) => day.partyOrder)
  days!: Relation<PartyOrderDay>[];
}
