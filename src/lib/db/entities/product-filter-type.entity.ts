import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

/**
 * Identical in shape and reasoning to `product_tags` — business vocabulary the
 * owner edits, so a lookup table with a text primary key rather than a native
 * enum. See .claude/DATA-MODEL.md §3 and §5.3
 *
 * Kept as a separate table rather than one `lookup_values` table with a
 * discriminator: `products` needs two independent foreign keys, and a shared
 * table would make each of them point at the wrong vocabulary half the time.
 *
 * Every @Column declares its type EXPLICITLY — esbuild, which runs our
 * migration CLI, emits no decorator metadata. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('product_filter_types')
export class ProductFilterType {
  /**
   * Uppercase, CHECK-constrained in the migration.
   * Seeded: NORMAL, FILTERED, DOUBLE_FILTERED.
   */
  @PrimaryColumn({ type: 'text' })
  code!: string;

  @Index('uq_product_filter_types_label', { unique: true })
  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'smallint', name: 'sort_order', default: 100 })
  sortOrder!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;
}
