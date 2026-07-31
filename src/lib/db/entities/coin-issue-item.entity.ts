import {
  Entity,
  Column,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
  Unique,
} from 'typeorm';
import { LineItemBase } from './line-item.base';
import { money, rate6 } from '../transformers';
import { CoinIssue } from './coin-issue.entity';
import { CoinType } from './coin-type.entity';

/**
 * One coin type on one handover: "3 packets of Blue Token".
 *
 * Carries «audit» like every other business table — this is not an append-only
 * table, and removing a line is a soft delete recorded as a document revision.
 * See .claude/DATA-MODEL.md §4, §5.11 and §6
 */
@Entity('coin_issue_items')
@Unique('uq_cii_issue_type', ['coinIssueId', 'coinTypeId'])
export class CoinIssueItem extends LineItemBase {
  /** CASCADE: a line has no meaning without its issue. */
  @ManyToOne(() => CoinIssue, (issue) => issue.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'coin_issue_id' })
  coinIssue!: Relation<CoinIssue>;

  @Column({ type: 'uuid', name: 'coin_issue_id' })
  coinIssueId!: string;

  /**
   * RESTRICT. Retained purely so that "coins issued by type" rolls up to one
   * stable grouping key even after a rename — the commercial facts of the line
   * live in the snapshot block below, not here.
   * See .claude/DATA-MODEL.md §6
   */
  @ManyToOne(() => CoinType, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coin_type_id' })
  coinType!: Relation<CoinType>;

  @Column({ type: 'uuid', name: 'coin_type_id' })
  coinTypeId!: string;

  @Column({ type: 'integer' })
  packets!: number;

  /* ── Snapshots — immutable after insert ──────────────────────────────────
   *
   * `update: false` on all four, backed by a trigger that raises if any of them
   * changes. Repricing a coin type next month must not silently rewrite what a
   * staff member owed last month. Verified by a test: create issue → change the
   * coin type's packet amount → assert the line amount is unchanged.
   * See .claude/DATA-MODEL.md §6, §10.7 and MODULES/04-coins.md §8
   */

  @Column({
    type: 'integer',
    name: 'coins_per_packet_snapshot',
    update: false,
  })
  coinsPerPacketSnapshot!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'packet_amount_snapshot',
    transformer: money,
    update: false,
  })
  packetAmountSnapshot!: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 6,
    name: 'per_coin_price_snapshot',
    transformer: rate6,
    update: false,
  })
  perCoinPriceSnapshot!: number;

  @Column({ type: 'text', name: 'coin_type_name_snapshot', update: false })
  coinTypeNameSnapshot!: string;

  /* ── Derived ─────────────────────────────────────────────────────────── */

  /** Generated from the SNAPSHOT, never from the live coin type. */
  @Column({
    type: 'integer',
    name: 'coins_issued',
    generatedType: 'STORED',
    asExpression: 'packets * coins_per_packet_snapshot',
    insert: false,
    update: false,
  })
  coinsIssued!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'line_amount',
    transformer: money,
    generatedType: 'STORED',
    asExpression: 'round(packets::numeric * packet_amount_snapshot, 2)',
    insert: false,
    update: false,
  })
  lineAmount!: number;

  /**
   * Trigger-maintained cache of the sum over `coin_issue_return_events`.
   *
   * A mutable counter written by application code would lose updates the moment
   * two admins record returns at once: both read 4, one writes 8, the other
   * writes 6. Appending events and recomputing under a row lock is correct
   * under any interleaving. See .claude/DATA-MODEL.md §7
   */
  @Column({ type: 'integer', name: 'coins_returned', default: 0 })
  coinsReturned!: number;

  /**
   * Repeats `packets * coins_per_packet_snapshot` rather than referencing
   * `coins_issued`: PostgreSQL forbids a generated column from referencing
   * another generated column. See .claude/DATA-MODEL.md §5.5
   *
   * The over-return guard — `0 ≤ coins_returned ≤ coins_issued` — is a table
   * constraint, so 60 coins returned against a 50-coin line is rejected by the
   * database rather than by the UI. See .claude/DATA-MODEL.md §5.11 and §10.1
   */
  @Column({
    type: 'integer',
    name: 'coins_outstanding',
    generatedType: 'STORED',
    asExpression: 'packets * coins_per_packet_snapshot - coins_returned',
    insert: false,
    update: false,
  })
  coinsOutstanding!: number;
}
