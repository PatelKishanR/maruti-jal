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
import { money, rate6 } from '../transformers';
import { CoinIssueItem } from './coin-issue-item.entity';

/**
 * APPEND-ONLY. One physical hand-back of unsold coins against one issue line.
 *
 * Deliberately does NOT extend BaseEntity: append-only tables carry only `id`,
 * `created_at` and `created_by_id`. There is no `updated_at` because nothing is
 * ever updated, and no `deleted_at` because nothing is ever deleted. A
 * BEFORE UPDATE OR DELETE trigger raises unconditionally, and UPDATE and DELETE
 * are revoked from the application role. A mistake is corrected by inserting a
 * REVERSAL — both rows stay visible, which is the difference between an
 * accounting system and a spreadsheet.
 * See .claude/DATA-MODEL.md §4, §5.12 and §9
 */
@Entity('coin_issue_return_events')
@Index('idx_cire_item', ['coinIssueItemId', 'returnDate'])
export class CoinIssueReturnEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CoinIssueItem, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coin_issue_item_id' })
  coinIssueItem!: Relation<CoinIssueItem>;

  @Column({ type: 'uuid', name: 'coin_issue_item_id' })
  coinIssueItemId!: string;

  @Column({ type: 'date', name: 'return_date' })
  returnDate!: string;

  /**
   * SIGNED. A normal event is positive; a reversal is negative and carries
   * `reverses_event_id`. A table constraint enforces the pairing, so a negative
   * quantity can never appear without the row it corrects.
   * See .claude/DATA-MODEL.md §5.7 and §5.12
   */
  @Column({ type: 'integer', name: 'coins_returned' })
  coinsReturned!: number;

  /** The coin's per-coin price as it stood at hand-back time. */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 6,
    name: 'unit_value_snapshot',
    transformer: rate6,
  })
  unitValueSnapshot!: number;

  /**
   * STORED, not computed — and that is the point.
   *
   * Rounding `coins_returned × unit_value_snapshot` once, at write time, is
   * what keeps the issue's arithmetic internally consistent: the trigger sums
   * these two-decimal values, so the header can never disagree with the sum of
   * its events. Recomputing on read would let a later rounding change silently
   * alter a settled issue. The known consequence — 45 coins returned singly
   * credits ₹499.95 against a ₹500 packet — is settled with a write-off.
   * See .claude/DATA-MODEL.md §5.12, §10.5 and MODULES/04-coins.md §8.2
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'value_credited',
    transformer: money,
  })
  valueCredited!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /**
   * Unique among non-null rows: an event may be reversed at most once.
   * RESTRICT, so the row being corrected can never disappear beneath its
   * correction.
   */
  @ManyToOne(() => CoinIssueReturnEvent, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'reverses_event_id' })
  reversesEvent!: Relation<CoinIssueReturnEvent> | null;

  @Index('uq_cire_reverses', {
    unique: true,
    where: '"reverses_event_id" IS NOT NULL',
  })
  @Column({ type: 'uuid', name: 'reverses_event_id', nullable: true })
  reversesEventId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  /** FK → users(id). Declared as a bare uuid, exactly as BaseEntity does. */
  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById!: string | null;
}
