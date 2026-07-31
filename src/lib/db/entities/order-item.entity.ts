import {
  Entity,
  Column,
  Check,
  Unique,
  ManyToOne,
  OneToMany,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { LineItemBase } from './line-item.base';
import { DeliveryOrder } from './delivery-order.entity';
import { Product } from './product.entity';
import { OrderItemReturnEvent } from './order-item-return-event.entity';
import { money, qty3 } from '@/lib/db/transformers';

/**
 * One line of a delivery order.
 *
 * `LineItemBase`, not `BaseEntity` — id and timestamps, no soft delete and no
 * actor columns. .claude/DATA-MODEL.md §5.6 enumerates this table's columns as
 * `id` plus business columns with no «audit» block, and §11 confirms it: every
 * soft-deletable table's indexes carry `WHERE deleted_at IS NULL`, while
 * `idx_oi_order` and `idx_oi_pending` do not. Lines are owned by their order
 * (ON DELETE CASCADE) and their history lives in `document_revisions` and
 * `audit_logs`, so they need no soft-delete of their own — which also keeps the
 * unique key below plain rather than partial.
 *
 * Every @Column declares its type EXPLICITLY — see .claude/ARCHITECTURE.md §1.1
 */
@Entity('order_items')
/**
 * Uniqueness is on `(order_id, line_no)` and DELIBERATELY NOT on
 * `(order_id, product_id)`. One route order legitimately contains 20-litre jars
 * at ₹35 for one customer and ₹30 for another, so the same product appears
 * twice at two bargained rates. Lines are identified by position, not product.
 * See .claude/DATA-MODEL.md §5.6
 */
@Unique('uq_order_items_order_line', ['orderId', 'lineNo'])
/**
 * The over-return guard, enforced in the DATABASE rather than the UI, so it
 * holds for imports and direct SQL too. See .claude/DATA-MODEL.md §10.1
 */
@Check(
  'chk_order_items_returns_within_quantity',
  '"returned_empty_qty" >= 0 AND "returned_filled_qty" >= 0 AND "lost_qty" >= 0 ' +
    'AND ("returned_empty_qty" + "returned_filled_qty" + "lost_qty") <= "quantity"',
)
@Check('chk_order_items_quantity_positive', '"quantity" > 0')
export class OrderItem extends LineItemBase {
  @ManyToOne(() => DeliveryOrder, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<DeliveryOrder>;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @Column({ type: 'smallint', name: 'line_no' })
  lineNo!: number;

  /**
   * RESTRICT: a product with sales history cannot be deleted from under it.
   * The foreign key is kept purely for analytics — revenue-by-product needs a
   * stable grouping key so a renamed product still rolls up to one line. Every
   * value actually DISPLAYED comes from the snapshot columns below.
   * See .claude/DATA-MODEL.md §6
   */
  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product>;

  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  /* ── Snapshots — IMMUTABLE after insert ─────────────────────────────────
     A full copy of the product's commercial attributes at the moment the line
     was created, so a six-month-old statement reprints exactly as issued even
     after a rename, a reclassification or a price rise. `update: false` stops
     TypeORM writing them; a database trigger raises if they change by any
     other route. To put a different product on a line, delete the line and add
     a new one — which is recorded as a revision.
     See .claude/DATA-MODEL.md §6 and §10.7 */

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

  /** Snapshot text, deliberately no FK — the lookup row may be renamed later. */
  @Column({ type: 'text', name: 'product_tag_code', update: false })
  productTagCode!: string;

  @Column({ type: 'text', name: 'product_filter_type_code', update: false })
  productFilterTypeCode!: string;

  /** The list price AT ORDER TIME. Makes `is_price_overridden` meaningful. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'product_base_price',
    update: false,
    transformer: money,
  })
  productBasePrice!: number;

  /** Snapshotted so return rules cannot change retroactively. */
  @Column({ type: 'boolean', name: 'is_returnable', update: false })
  isReturnable!: boolean;

  /* ── Pricing ────────────────────────────────────────────────────────── */

  /** The bargained rate — what was actually charged. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'unit_price',
    transformer: money,
  })
  unitPrice!: number;

  /** `IS DISTINCT FROM` rather than `<>` so a NULL either side still compares. */
  @Column({
    type: 'boolean',
    name: 'is_price_overridden',
    generatedType: 'STORED',
    asExpression: 'unit_price IS DISTINCT FROM product_base_price',
    insert: false,
    update: false,
  })
  isPriceOverridden!: boolean;

  /** Free text — "Sharma ji regular rate". */
  @Column({ type: 'text', name: 'price_override_note', nullable: true })
  priceOverrideNote!: string | null;

  @Column({ type: 'integer' })
  quantity!: number;

  /* ── Return counters — trigger caches over `order_item_return_events` ───
     Written only by the AFTER INSERT trigger on the event table, which locks
     this row and recomputes all three from the sum over events. Recomputing
     rather than incrementing is what makes concurrent returns correct under
     any interleaving. See .claude/DATA-MODEL.md §7 */

  @Column({
    type: 'integer',
    name: 'returned_empty_qty',
    default: 0,
    update: false,
  })
  returnedEmptyQty!: number;

  @Column({
    type: 'integer',
    name: 'returned_filled_qty',
    default: 0,
    update: false,
  })
  returnedFilledQty!: number;

  @Column({
    type: 'integer',
    name: 'lost_qty',
    default: 0,
    update: false,
  })
  lostQty!: number;

  /** Calculated, never typed — which removes a whole class of entry error. */
  @Column({
    type: 'integer',
    name: 'pending_qty',
    generatedType: 'STORED',
    asExpression:
      'quantity - returned_empty_qty - returned_filled_qty - lost_qty',
    insert: false,
    update: false,
  })
  pendingQty!: number;

  /**
   * Decision D5: the staff member is billed only for what he SOLD, so filled
   * (unsold) jars coming home REDUCE the line — and therefore the order total.
   * An order created at ₹1,400 for 40 jars becomes ₹1,330 once 2 unsold jars
   * come back. That is correct, and it is the whole reason the header rollups
   * must be maintained by the database rather than computed once at creation.
   * See .claude/MODULES/03-delivery-orders.md §9
   *
   * The chargeable quantity is spelled out inline rather than referenced from
   * its own generated column: PostgreSQL forbids a generated column referencing
   * another generated column. See .claude/DATA-MODEL.md §5.5
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'line_total',
    generatedType: 'STORED',
    asExpression:
      'round((quantity - returned_filled_qty)::numeric * unit_price, 2)',
    insert: false,
    update: false,
    transformer: money,
  })
  lineTotal!: number;

  @OneToMany(() => OrderItemReturnEvent, (event) => event.orderItem)
  returnEvents!: Relation<OrderItemReturnEvent>[];
}
