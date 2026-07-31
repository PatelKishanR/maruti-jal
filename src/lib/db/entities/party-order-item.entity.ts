import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { LineItemBase } from './line-item.base';
import { money, qty3 } from '../transformers';
import { PartyOrderDay } from './party-order-day.entity';
import { Product } from './product.entity';

/**
 * One product line on one delivery day of a party booking.
 *
 * Carries the product foreign key AND a full copy of the product's commercial
 * attributes at the moment the line was created. The FK exists purely so
 * revenue-by-product has a stable grouping key across a rename; everything
 * printed on a statement comes from the snapshot.
 * See .claude/DATA-MODEL.md §6
 *
 * Extends LineItemBase, not BaseEntity — it is a child of the party-order
 * aggregate, whose actor columns and revision history sit on the header, and
 * whose cascade makes an independent soft delete meaningless.
 */
/**
 * Uniqueness is on (day, line_no) — NOT (day, product_id). One day's schedule
 * legitimately contains the same product twice at two negotiated rates.
 * See .claude/DATA-MODEL.md §5.6
 */
@Index('uq_party_order_items_day_line', ['partyOrderDayId', 'lineNo'], {
  unique: true,
})
@Entity('party_order_items')
export class PartyOrderItem extends LineItemBase {
  @ManyToOne(() => PartyOrderDay, (day) => day.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'party_order_day_id' })
  day!: Relation<PartyOrderDay>;

  @Column({ type: 'uuid', name: 'party_order_day_id' })
  partyOrderDayId!: string;

  @Column({ type: 'smallint', name: 'line_no' })
  lineNo!: number;

  /** RESTRICT: a product with billing history physically cannot be deleted. */
  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product>;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  /* ═══════════════════════════════════════════════════════════════════════
     SNAPSHOT BLOCK — immutable after insert

     `update: false` here, plus a trigger that raises if any of these change.
     A price rise or a product rename next quarter must not silently rewrite
     what a six-month-old party was billed. To put a different product on a
     line, delete the line and add a new one — which is recorded as a revision.
     See .claude/DATA-MODEL.md §6, §10.7
     ═══════════════════════════════════════════════════════════════════════ */

  @Column({ type: 'text', name: 'product_title', update: false })
  productTitle!: string;

  @Column({
    type: 'numeric',
    precision: 7,
    scale: 3,
    name: 'product_litres',
    update: false,
    transformer: qty3,
  })
  productLitres!: number;

  /** Snapshot text, no FK — the lookup row may be renamed or retired later. */
  @Column({ type: 'text', name: 'product_tag_code', update: false })
  productTagCode!: string;

  @Column({ type: 'text', name: 'product_filter_type_code', update: false })
  productFilterTypeCode!: string;

  /** The LIST price at booking time. Makes "how much did we discount?" answerable. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'product_base_price',
    update: false,
    transformer: money,
  })
  productBasePrice!: number;

  /* ═══════════════════════════════════════════════════════════════════════
     PRICING AND QUANTITY
     ═══════════════════════════════════════════════════════════════════════ */

  /** The negotiated rate — events are always negotiated. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'unit_price',
    transformer: money,
  })
  unitPrice!: number;

  /** Planned quantity, entered when the schedule is built. */
  @Column({ type: 'integer' })
  quantity!: number;

  /** Actual quantity, entered on the day. NULL until someone reconciles. */
  @Column({ type: 'integer', name: 'delivered_quantity', nullable: true })
  deliveredQuantity!: number | null;

  /**
   * Bills the PLANNED quantity until actuals are entered, then switches to the
   * actual — which is what makes the booking total a usable quote from the
   * moment the schedule exists, and correct from the moment the event ends.
   * A `coalesce` in the generated column means no nightly job and no window
   * where the two disagree.
   * See .claude/DATA-MODEL.md §5.17
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'line_total',
    generatedType: 'STORED',
    asExpression:
      'round(coalesce(delivered_quantity, quantity)::numeric * unit_price, 2)',
    insert: false,
    update: false,
    transformer: money,
  })
  lineTotal!: number;
}
