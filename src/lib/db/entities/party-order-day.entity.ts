import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { LineItemBase } from './line-item.base';
import { money } from '../transformers';
import { DAY_DELIVERY_STATUSES, type DayDeliveryStatus } from './enums';
import { PartyOrder } from './party-order.entity';
import { PartyOrderItem } from './party-order-item.entity';
import { Staff } from './staff.entity';

/**
 * ONE ROW PER DATE — not a recurrence rule.
 *
 * This is the key modelling decision of the module. The owner was explicit
 * that dates may be consecutive, alternate, or arbitrarily spaced: 50 jars on
 * the 14th, nothing on the 15th, 80 jars on the 16th.
 *
 * A recurrence rule ("every 2 days from the 14th") cannot express an arbitrary
 * gap, cannot be partly cancelled, and has nowhere to hang per-occurrence
 * data. A row per date can express ANY shape, is trivially editable ("cancel
 * Tuesday"), and lets each day carry its own status, its own assigned staff
 * member and its own total. The cost — more rows — is irrelevant at this
 * volume. The repeat-pattern builder in the UI generates these rows and then
 * gets out of the way.
 * See .claude/DATA-MODEL.md §5.16 · .claude/MODULES/05-party-orders.md §5.2
 *
 * Extends LineItemBase, not BaseEntity. A day is a child of the party-order
 * aggregate: it cascades with its booking, so it never needs an independent
 * soft delete, and cancelling a day is a STATUS CHANGE rather than a delete —
 * which is also what keeps the plain unique `(party_order_id, service_date)`
 * constraint plain. Actor columns live on the header; the per-edit history of
 * the whole aggregate lives in `document_revisions`.
 * See .claude/DATA-MODEL.md §5.16, §9
 */
/** You cannot schedule the same date twice within one booking. */
@Index('uq_party_order_days_order_date', ['partyOrderId', 'serviceDate'], {
  unique: true,
})
@Entity('party_order_days')
export class PartyOrderDay extends LineItemBase {
  /** CASCADE: a day has no meaning without its booking. */
  @ManyToOne(() => PartyOrder, (order) => order.days, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'party_order_id' })
  partyOrder!: Relation<PartyOrder>;

  @Column({ type: 'uuid', name: 'party_order_id' })
  partyOrderId!: string;

  @Column({ type: 'date', name: 'service_date' })
  serviceDate!: string;

  @Column({
    type: 'enum',
    enum: DAY_DELIVERY_STATUSES,
    enumName: 'day_delivery_status',
    name: 'delivery_status',
    default: 'SCHEDULED',
  })
  deliveryStatus!: DayDeliveryStatus;

  /**
   * SET NULL rather than RESTRICT: losing the assignment when a staff record
   * goes is acceptable — the delivery still happened and its billing is intact.
   */
  @ManyToOne(() => Staff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_staff_id' })
  assignedStaff!: Relation<Staff> | null;

  @Column({ type: 'uuid', name: 'assigned_staff_id', nullable: true })
  assignedStaffId!: string | null;

  /** Stamped when the day is marked delivered. Powers "what actually happened". */
  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt!: Date | null;

  /**
   * Σ of this day's `line_total`, trigger-maintained.
   *
   * A trigger rather than a generated column because it aggregates over a
   * child table. The booking's `total_amount` then sums only days that are
   * neither SKIPPED nor CANCELLED — which is why cancelling a day recalculates
   * the total and can flip the booking to REFUND_DUE.
   * See .claude/DATA-MODEL.md §5.16, §8.2
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'day_total',
    default: 0,
    transformer: money,
  })
  dayTotal!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => PartyOrderItem, (item) => item.day)
  items!: Relation<PartyOrderItem>[];
}
