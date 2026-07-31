import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

/**
 * Business vocabulary, NOT a code branch — which is why this is a lookup table
 * and not a native enum. The owner will plausibly want "Chilled", "RO" or
 * "Alkaline" without waiting for a deployment; nothing in the application
 * switches on the value. See .claude/DATA-MODEL.md §3
 *
 * The primary key is the CODE itself rather than a uuid, so `products.tag_code`
 * stays readable in raw SQL and filterable without a join while remaining
 * foreign-key protected. Referencing FKs are ON UPDATE CASCADE, so correcting a
 * mistyped code is safe.
 *
 * Deliberately does NOT extend BaseEntity: §5.3 gives this table a text primary
 * key and no audit block. Rows are retired with `is_active` — the FK from
 * `products` is ON DELETE RESTRICT, so a tag in use physically cannot be
 * deleted.
 *
 * Every @Column declares its type EXPLICITLY. Bare `@Column()` relies on
 * emitted decorator metadata, which esbuild — the toolchain running our
 * migration CLI — has never implemented. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('product_tags')
export class ProductTag {
  /** Uppercase, CHECK-constrained in the migration. Seeded: NORMAL, COLD. */
  @PrimaryColumn({ type: 'text' })
  code!: string;

  /** The editable display name. Rename to Gujarati and nothing else changes. */
  @Index('uq_product_tags_label', { unique: true })
  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'smallint', name: 'sort_order', default: 100 })
  sortOrder!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;
}
