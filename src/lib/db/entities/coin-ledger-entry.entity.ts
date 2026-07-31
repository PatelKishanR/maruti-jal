import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { bigintToNumber, money, rate6 } from '../transformers';
import {
  LEDGER_MOVEMENT_TYPES,
  LEDGER_SOURCE_TYPES,
  type LedgerMovementType,
  type LedgerSourceType,
} from './enums';
import { CoinType } from './coin-type.entity';
import { CoinIssueItem } from './coin-issue-item.entity';
import { CoinIssueReturnEvent } from './coin-issue-return-event.entity';
import { CoinAdjustment } from './coin-adjustment.entity';
import { Payment } from './payment.entity';

/**
 * APPEND-ONLY — the auditable spine of the whole coin module.
 *
 * Every single change in coin stock writes exactly one row here. Nothing else
 * may change `coin_types.balance_coins`; that column is a cache this table
 * maintains through a trigger, and `v_coin_balance_drift` exists to prove the
 * two agree. Corrections are reversing INSERTs — a BEFORE UPDATE OR DELETE
 * trigger raises unconditionally and both verbs are revoked from the
 * application role.
 *
 * Like every append-only table it carries only `id`, `created_at` and
 * `created_by_id`, so it deliberately does NOT extend BaseEntity.
 * See .claude/DATA-MODEL.md §4, §5.14 and §9
 *
 * ── Why four typed FKs plus a generated `source_id` ──────────────────────
 *
 * The owner asked for a polymorphic `source_type` / `source_id` pair. Pure
 * polymorphism — a bare uuid with no foreign key — means the ledger can point
 * at rows that no longer exist. In an auditable stock register that is fatal:
 * you cannot join without a CASE, nothing stops a dangling reference, and the
 * one question the ledger exists to answer ("where did this coin go?") becomes
 * unanswerable the first time a parent row is removed.
 *
 * So this table keeps FOUR REAL FOREIGN KEYS with RESTRICT semantics — a coin
 * issue with ledger movements physically cannot be deleted — and then DERIVES
 * `source_id` as a generated `coalesce()` over them. Exactly one is non-null,
 * `source_type` must agree with which one it is, and both facts are table
 * constraints.
 *
 * The result is polymorphic ergonomics — `WHERE source_type = 'PAYMENT' AND
 * source_id = $1`, served by one index — with ZERO integrity loss and ZERO
 * write-side bookkeeping. Four nullable uuids cost 8 bytes each; that is the
 * entire price. See .claude/DATA-MODEL.md §5.14
 *
 * ── Movement sign map ────────────────────────────────────────────────────
 *   OPENING          adjustment (reason OPENING_STOCK)   +
 *   ISSUE            coin issue item                     −
 *   ISSUE_RETURN     coin issue return event             +
 *   ORDER_RECEIPT    payment, mode COIN, direction IN    +
 *   ADJUSTMENT_IN    adjustment                          +
 *   ADJUSTMENT_OUT   adjustment                          −
 *   ISSUE_CANCELLED  coin issue item                     +
 * A table constraint checks the sign of `coins_delta` against `movement_type`.
 */
@Entity('coin_ledger_entries')
@Index('uq_ledger_seq', ['coinTypeId', 'entrySeq'], { unique: true })
@Index('idx_ledger_source', ['sourceType', 'sourceId'])
@Index('idx_ledger_staff', ['staffId', 'entryDate'], {
  where: '"staff_id" IS NOT NULL',
})
export class CoinLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CoinType, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coin_type_id' })
  coinType!: Relation<CoinType>;

  @Column({ type: 'uuid', name: 'coin_type_id' })
  coinTypeId!: string;

  /**
   * Per-coin-type sequence, assigned under the coin type's row lock inside the
   * same transaction as the insert — NOT a shared sequence, which would gap on
   * rollback and interleave types.
   *
   * This is what makes the running balance reproducible: order by `entry_seq`
   * and you get the exact order the balances were computed in, regardless of
   * clock skew or two writers committing microseconds apart. The unique index
   * on (coin_type_id, entry_seq) is the hard guarantee that two concurrent
   * issues cannot both claim the same slot. See .claude/DATA-MODEL.md §10.2
   */
  @Column({
    type: 'bigint',
    name: 'entry_seq',
    transformer: bigintToNumber,
  })
  entrySeq!: number;

  @Column({ type: 'date', name: 'entry_date' })
  entryDate!: string;

  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({
    type: 'enum',
    enum: LEDGER_MOVEMENT_TYPES,
    enumName: 'ledger_movement_type',
    name: 'movement_type',
  })
  movementType!: LedgerMovementType;

  /**
   * SIGNED, and never zero. Negative means coins left company stock.
   * A zero movement is not a movement, so a constraint rejects it rather than
   * letting no-op rows pad the audit trail.
   */
  @Column({ type: 'integer', name: 'coins_delta' })
  coinsDelta!: number;

  /**
   * The running balance AFTER this movement, with a `>= 0` table constraint.
   *
   * This is the whole negative-stock defence: the balance is computed under the
   * coin type's row lock inside the same transaction as the insert, so two
   * people issuing the last ten coins at the same moment cannot both pass — the
   * second transaction recomputes against the first's committed row and the
   * constraint refuses it. See .claude/DATA-MODEL.md §10.2
   */
  @Column({ type: 'integer', name: 'balance_after_coins' })
  balanceAfterCoins!: number;

  /** Per-coin value at the moment of the movement. */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 6,
    name: 'unit_value',
    transformer: rate6,
  })
  unitValue!: number;

  /** Signed, matching `coins_delta`. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'value_delta',
    transformer: money,
  })
  valueDelta!: number;

  /* ── The exclusive arc: exactly one of the four is non-null ──────────────
   *
   * All four are ON DELETE RESTRICT. That is not defensive styling — it is the
   * mechanism by which a coin issue, a return event, a payment or an adjustment
   * with ledger consequences becomes physically undeletable.
   */

  @ManyToOne(() => CoinIssueItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coin_issue_item_id' })
  coinIssueItem!: Relation<CoinIssueItem> | null;

  @Column({ type: 'uuid', name: 'coin_issue_item_id', nullable: true })
  coinIssueItemId!: string | null;

  @ManyToOne(() => CoinIssueReturnEvent, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'coin_issue_return_event_id' })
  coinIssueReturnEvent!: Relation<CoinIssueReturnEvent> | null;

  @Column({
    type: 'uuid',
    name: 'coin_issue_return_event_id',
    nullable: true,
  })
  coinIssueReturnEventId!: string | null;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_id' })
  payment!: Relation<Payment> | null;

  @Column({ type: 'uuid', name: 'payment_id', nullable: true })
  paymentId!: string | null;

  @ManyToOne(() => CoinAdjustment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coin_adjustment_id' })
  coinAdjustment!: Relation<CoinAdjustment> | null;

  @Column({ type: 'uuid', name: 'coin_adjustment_id', nullable: true })
  coinAdjustmentId!: string | null;

  /** The discriminator. A constraint checks it against which FK is populated. */
  @Column({
    type: 'enum',
    enum: LEDGER_SOURCE_TYPES,
    enumName: 'ledger_source_type',
    name: 'source_type',
  })
  sourceType!: LedgerSourceType;

  /**
   * GENERATED — never written, never able to disagree with the foreign keys it
   * is derived from. This is the column that buys the polymorphic query shape
   * described at the top of this file, at the cost of nothing at all.
   */
  @Column({
    type: 'uuid',
    name: 'source_id',
    generatedType: 'STORED',
    asExpression:
      'coalesce(coin_issue_item_id, coin_issue_return_event_id, payment_id, coin_adjustment_id)',
    insert: false,
    update: false,
  })
  sourceId!: string;

  /**
   * DENORMALISED copy for "which coins are out with staff X" reporting, which
   * would otherwise need a three-table join on the hottest report in the
   * module. The foreign key to `staff` is declared in the migration; no ORM
   * relation is declared here deliberately, so the spine's import graph stays
   * narrow. Null for movements with no staff member involved — opening stock,
   * adjustments. See .claude/DATA-MODEL.md §5.14
   */
  @Column({ type: 'uuid', name: 'staff_id', nullable: true })
  staffId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  /** FK → users(id). Bare uuid, exactly as BaseEntity treats its actor columns. */
  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById!: string | null;
}
