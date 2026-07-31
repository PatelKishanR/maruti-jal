import {
  Entity,
  Column,
  Index,
  Check,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  type Relation,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

/**
 * APPEND-ONLY. One row per physical event: "8 empties and 2 filled came back
 * on Thursday, recorded by Ramesh."
 *
 * This table does NOT extend BaseEntity. Append-only tables carry only `id`,
 * `created_at` and `created_by_id` — no `updated_at`, no `deleted_at`. A
 * BEFORE UPDATE OR DELETE trigger raises unconditionally, and UPDATE and
 * DELETE are revoked from the application role. A mistake is corrected by
 * inserting a REVERSAL row; both stay visible.
 * See .claude/DATA-MODEL.md §4 and §9
 *
 * Why events rather than a mutable counter on the line:
 *  - jars trickle back over days, so the domain is inherently multi-event;
 *  - a counter answers "how many" but never "when, and who recorded it" —
 *    exactly the question asked when the numbers don't add up;
 *  - two admins recording returns against a counter produce a classic lost
 *    update. Appending rows and recomputing is correct under any interleaving;
 *  - "jars returned per day" becomes a GROUP BY instead of an impossibility.
 * See .claude/DATA-MODEL.md §7
 *
 * Every @Column declares its type EXPLICITLY — see .claude/ARCHITECTURE.md §1.1
 */
@Entity('order_item_return_events')
/**
 * A normal event has non-negative quantities summing above zero. A reversal has
 * non-positive quantities and points at the event it undoes. Nothing else is a
 * valid row. See .claude/DATA-MODEL.md §5.7
 */
@Check(
  'chk_oire_normal_or_reversal',
  '(' +
    '"reverses_event_id" IS NULL ' +
    'AND "empty_qty" >= 0 AND "filled_qty" >= 0 AND "lost_qty" >= 0 ' +
    'AND ("empty_qty" + "filled_qty" + "lost_qty") > 0' +
    ') OR (' +
    '"reverses_event_id" IS NOT NULL ' +
    'AND "empty_qty" <= 0 AND "filled_qty" <= 0 AND "lost_qty" <= 0 ' +
    'AND ("empty_qty" + "filled_qty" + "lost_qty") < 0' +
    ')',
)
export class OrderItemReturnEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OrderItem, (item) => item.returnEvents, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem!: Relation<OrderItem>;

  @Column({ type: 'uuid', name: 'order_item_id' })
  orderItemId!: string;

  /**
   * The day the jars physically came back, which is often not the day it was
   * keyed in. 'YYYY-MM-DD' end to end — see .claude/ARCHITECTURE.md §9.2
   */
  @Column({ type: 'date', name: 'return_date' })
  returnDate!: string;

  /** The customer kept the water and returned the jar. */
  @Column({ type: 'integer', name: 'empty_qty', default: 0 })
  emptyQty!: number;

  /** Unsold, came home full — credited back off the line total (decision D5). */
  @Column({ type: 'integer', name: 'filled_qty', default: 0 })
  filledQty!: number;

  /** Written off explicitly, or the jars-out number inflates permanently. */
  @Column({ type: 'integer', name: 'lost_qty', default: 0 })
  lostQty!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /**
   * Set only on a reversal. Unique among non-null values, so one event can be
   * reversed at most once — reversing a reversal would make the arithmetic
   * unauditable.
   */
  @Index('uq_oire_reverses_event', {
    unique: true,
    where: '"reverses_event_id" IS NOT NULL',
  })
  @ManyToOne(() => OrderItemReturnEvent, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reverses_event_id' })
  reversesEvent!: Relation<OrderItemReturnEvent> | null;

  @Column({ type: 'uuid', name: 'reverses_event_id', nullable: true })
  reversesEventId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById!: string | null;
}
