import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ProductTag } from './product-tag.entity';
import { ProductFilterType } from './product-filter-type.entity';
import { bigintToNumber, money, qty3 } from '@/lib/db/transformers';

/**
 * The sellable catalogue — jars, bottles and cans.
 *
 * Order lines snapshot every commercial attribute of a product at the moment
 * they are created, so changing a price here never rewrites history. The FK is
 * retained purely so revenue-by-product has a stable grouping key.
 * See .claude/DATA-MODEL.md §6
 *
 * Every @Column declares its type EXPLICITLY, and every relation carries
 * `Relation<T>` — which prevents circular-import type erosion under bundlers
 * once Order → Product → Order cycles appear.
 * See .claude/ARCHITECTURE.md §1.1
 */
@Entity('products')
export class Product extends BaseEntity {
  /** Identity column; `code` below is derived from it. See DATA-MODEL D-2 */
  @Column({
    type: 'bigint',
    name: 'product_no',
    generated: 'identity',
    generatedIdentity: 'ALWAYS',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  productNo!: number;

  @Index('uq_products_code', { unique: true })
  @Column({
    type: 'text',
    generatedType: 'STORED',
    asExpression: `'PRD-' || lpad(product_no::text, 6, '0')`,
    insert: false,
    update: false,
  })
  code!: string;

  /**
   * One field, any script (D-10). ICU collation so a Gujarati catalogue sorts
   * correctly. See .claude/DATA-MODEL.md §5.4
   */
  @Column({ type: 'text', collation: 'gu-IN-x-icu' })
  title!: string;

  /** numeric(7,3) — 20 litre jars, 0.5 litre bottles, both exact. */
  @Column({ type: 'numeric', precision: 7, scale: 3, transformer: qty3 })
  litres!: number;

  /**
   * Business vocabulary lives in a lookup table keyed by its own code, so this
   * column is filterable and readable in raw SQL without a join, yet still
   * foreign-key protected. ON UPDATE CASCADE means correcting a mistyped code
   * upstream is safe. See .claude/DATA-MODEL.md §3
   */
  @ManyToOne(() => ProductTag, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'tag_code', referencedColumnName: 'code' })
  tag!: Relation<ProductTag>;

  @Column({ type: 'text', name: 'tag_code' })
  tagCode!: string;

  @ManyToOne(() => ProductFilterType, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'filter_type_code', referencedColumnName: 'code' })
  filterType!: Relation<ProductFilterType>;

  @Column({ type: 'text', name: 'filter_type_code' })
  filterTypeCode!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * The list price. numeric(12,2) with the money transformer — never a float,
   * and never summed in TypeScript. See .claude/DATA-MODEL.md D-3, D-4
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'base_price',
    transformer: money,
  })
  basePrice!: number;

  /**
   * Snapshotted onto every order line, because return rules must not change
   * retroactively if a product is reclassified. See .claude/DATA-MODEL.md §6
   */
  @Column({ type: 'boolean', name: 'is_returnable', default: true })
  isReturnable!: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  /** An instant, not a business date — hence timestamptz and a real Date. */
  @Column({ type: 'timestamptz', name: 'deactivated_at', nullable: true })
  deactivatedAt!: Date | null;

  @Column({ type: 'smallint', name: 'sort_order', default: 100 })
  sortOrder!: number;

  /**
   * One trigram-indexed predicate behind the single search box.
   * `code` is excluded because PostgreSQL forbids a generated column from
   * referencing another generated column (see the §5.5 note); code lookups get
   * their own trigram index.
   *
   * `select: false` — a WHERE predicate, not a displayed value.
   */
  @Column({
    type: 'text',
    name: 'search_blob',
    generatedType: 'STORED',
    asExpression: `title || ' ' || coalesce(description, '')`,
    insert: false,
    update: false,
    select: false,
  })
  searchBlob!: string;
}
