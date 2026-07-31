import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import {
  ADJUSTMENT_REASONS,
  PAYMENT_DIRECTIONS,
  type AdjustmentReason,
  type PaymentDirection,
} from './enums';
import { CoinType } from './coin-type.entity';

/**
 * A direct correction to coin stock: new coins purchased, or coins lost,
 * damaged or written off. Also the vehicle for a coin type's OPENING stock.
 *
 * Deliberately does NOT extend BaseEntity — it carries «audit» MINUS the soft
 * delete pair. An adjustment is a statement about physical reality at a moment
 * in time; you do not un-state it, you state a correcting one. Removing the
 * `deleted_at` column makes "quietly make that shrinkage disappear" impossible
 * rather than merely discouraged. See .claude/DATA-MODEL.md §5.13
 */
@Entity('coin_adjustments')
@Index('idx_cadj_type_date', ['coinTypeId', 'adjustmentDate'])
export class CoinAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** RESTRICT — a coin type with adjustment history cannot be deleted. */
  @ManyToOne(() => CoinType, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coin_type_id' })
  coinType!: Relation<CoinType>;

  @Column({ type: 'uuid', name: 'coin_type_id' })
  coinTypeId!: string;

  @Column({ type: 'date', name: 'adjustment_date' })
  adjustmentDate!: string;

  /**
   * Reuses the `payment_direction` enum rather than minting a near-identical
   * one: IN adds stock, OUT removes it, and the schema already has exactly that
   * two-valued vocabulary. The sign lives here, never in `coins`.
   * See .claude/DATA-MODEL.md §3.1
   */
  @Column({
    type: 'enum',
    enum: PAYMENT_DIRECTIONS,
    enumName: 'payment_direction',
  })
  direction!: PaymentDirection;

  /** Always positive — a table constraint enforces `coins > 0`. */
  @Column({ type: 'integer' })
  coins!: number;

  @Column({
    type: 'enum',
    enum: ADJUSTMENT_REASONS,
    enumName: 'adjustment_reason',
  })
  reason!: AdjustmentReason;

  /**
   * NOT NULL and non-empty, enforced by a table constraint.
   *
   * The mandatory note is a control, not a nicety: a stock adjustment with no
   * explanation is how theft hides. A dropdown reason is easy to click through;
   * a sentence someone has to type and sign their name against is not.
   * See .claude/DATA-MODEL.md §5.13 and MODULES/04-coins.md §7.2
   */
  @Column({ type: 'text' })
  note!: string;

  /** FK → users(id). Bare uuid, exactly as BaseEntity treats its actor columns. */
  @Column({ type: 'uuid', name: 'approved_by_id', nullable: true })
  approvedById!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById!: string | null;

  @Column({ type: 'uuid', name: 'updated_by_id', nullable: true })
  updatedById!: string | null;
}
