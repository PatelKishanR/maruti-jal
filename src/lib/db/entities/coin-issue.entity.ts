import {
  Entity,
  Column,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  VersionColumn,
  type Relation,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { bigintToNumber, money } from '../transformers';
import {
  COIN_ISSUE_STATUSES,
  PAYMENT_STATUSES,
  type CoinIssueStatus,
  type PaymentStatus,
} from './enums';
import { Staff } from './staff.entity';
import { CoinIssueItem } from './coin-issue-item.entity';

/**
 * One handover of coin packets to a staff member.
 *
 * This row IS the owner's register row — issued · returned · collected ·
 * pending, all on one line, sortable and filterable with no joins. Every
 * rollup below is trigger-maintained or generated precisely so that the list
 * page is an indexed range scan rather than a correlated subquery.
 * See .claude/DATA-MODEL.md §5.10 and §8.1
 */
@Entity('coin_issues')
@Index('idx_ci_staff_date', ['staffId', 'issueDate'], {
  where: '"deleted_at" IS NULL',
})
export class CoinIssue extends BaseEntity {
  /**
   * A water plant runs on register numbers, not UUIDs. Identity column plus a
   * generated `code` gives a sortable, searchable, gapless-enough document
   * number with no trigger code. See .claude/DATA-MODEL.md D-2
   */
  @Column({
    type: 'bigint',
    name: 'issue_no',
    generated: 'identity',
    generatedIdentity: 'ALWAYS',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  issueNo!: number;

  @Index('uq_coin_issues_code', { unique: true })
  @Column({
    type: 'text',
    name: 'code',
    generatedType: 'STORED',
    asExpression: "'CIS-' || lpad(issue_no::text, 6, '0')",
    insert: false,
    update: false,
  })
  code!: string;

  /**
   * RESTRICT, not CASCADE. A staff member with coin history cannot be deleted
   * out from under his liabilities. See .claude/DATA-MODEL.md §10.6
   */
  @ManyToOne(() => Staff, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'staff_id' })
  staff!: Relation<Staff>;

  @Column({ type: 'uuid', name: 'staff_id' })
  staffId!: string;

  /** Business date, carried as 'YYYY-MM-DD'. See .claude/ARCHITECTURE.md §9.2 */
  @Column({ type: 'date', name: 'issue_date' })
  issueDate!: string;

  /**
   * The LIFECYCLE of the handover. Money state lives in `paymentStatus`; the
   * two are independent — a SETTLED issue is one nobody expects more movement
   * on, a PAID issue is one nobody owes money on.
   */
  @Column({
    type: 'enum',
    enum: COIN_ISSUE_STATUSES,
    enumName: 'coin_issue_status',
    default: 'OPEN',
  })
  status!: CoinIssueStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /* ── Coin rollups — trigger-maintained over coin_issue_items ─────────── */

  @Column({ type: 'integer', name: 'total_coins_issued', default: 0 })
  totalCoinsIssued!: number;

  @Column({ type: 'integer', name: 'total_coins_returned', default: 0 })
  totalCoinsReturned!: number;

  @Column({
    type: 'integer',
    name: 'coins_outstanding',
    generatedType: 'STORED',
    asExpression: 'total_coins_issued - total_coins_returned',
    insert: false,
    update: false,
  })
  coinsOutstanding!: number;

  /* ── Money rollups — trigger-maintained ──────────────────────────────── */

  /** Face value of everything handed over. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'total_amount',
    default: 0,
    transformer: money,
  })
  totalAmount!: number;

  /** Credit for unsold coins handed back, summed over the return events. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'returned_value',
    default: 0,
    transformer: money,
  })
  returnedValue!: number;

  /** Σ of IN-direction payments against this issue. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'paid_amount',
    default: 0,
    transformer: money,
  })
  paidAmount!: number;

  /** Σ of OUT-direction payments — money handed back to the staff member. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'refunded_amount',
    default: 0,
    transformer: money,
  })
  refundedAmount!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'net_payable',
    transformer: money,
    generatedType: 'STORED',
    asExpression: 'total_amount - returned_value',
    insert: false,
    update: false,
  })
  netPayable!: number;

  /**
   * SIGNED, and that is the whole point.
   *
   * Positive → the staff member still owes us. NEGATIVE → we owe HIM a refund,
   * which is what raises the blue `REFUND_DUE` badge on the register. A staff
   * member who paid ₹5,000 up front and later returned ₹1,200 of unsold coins
   * sits at −1200 here until an OUT-direction payment brings it back to zero.
   * What was already paid is never edited; the history shows both movements.
   *
   * The expression repeats `total_amount - returned_value` rather than
   * referencing `net_payable`, because PostgreSQL forbids a generated column
   * from referencing another generated column. That duplication is required,
   * not sloppy. See .claude/DATA-MODEL.md §5.5, §10.3 and MODULES/04-coins.md §6.1
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'outstanding_amount',
    transformer: money,
    generatedType: 'STORED',
    asExpression:
      'total_amount - returned_value - paid_amount + refunded_amount',
    insert: false,
    update: false,
  })
  outstandingAmount!: number;

  /**
   * Trigger-maintained from `outstanding_amount`. An enum cannot be produced by
   * a generated column in PostgreSQL, which is precisely why this one is a
   * trigger and its input is not. See .claude/DATA-MODEL.md §8.2
   */
  @Column({
    type: 'enum',
    enum: PAYMENT_STATUSES,
    enumName: 'payment_status',
    name: 'payment_status',
    default: 'UNPAID',
  })
  paymentStatus!: PaymentStatus;

  @Column({ type: 'timestamptz', name: 'settled_at', nullable: true })
  settledAt!: Date | null;

  /**
   * Optimistic lock. Two admins editing the same issue → the second save fails
   * loudly instead of silently discarding the first one's work.
   * See .claude/DATA-MODEL.md §9
   */
  @VersionColumn({ type: 'integer', name: 'version' })
  version!: number;

  /** CASCADE: lines are part of the aggregate and have no life without it. */
  @OneToMany(() => CoinIssueItem, (item) => item.coinIssue)
  items!: Relation<CoinIssueItem>[];
}
