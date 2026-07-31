import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Expense buckets — "Diesel", "Vehicle repair", "Salary".
 *
 * Unlike product tags this one is keyed by uuid, because `expenses.category_id`
 * is a uuid FK in §5.19 and the label is free text the owner retypes far more
 * casually than a product tag code. See .claude/DATA-MODEL.md §5.19
 *
 * Every @Column declares its type EXPLICITLY — esbuild, which runs our
 * migration CLI, emits no decorator metadata. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('expense_categories')
export class ExpenseCategory extends BaseEntity {
  /**
   * Unique among non-deleted rows only, so a category that was deleted by
   * mistake and re-created does not collide with its own tombstone (D-8).
   */
  @Index('uq_expense_categories_name', {
    unique: true,
    where: '"deleted_at" IS NULL',
  })
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'smallint', name: 'sort_order', default: 100 })
  sortOrder!: number;

  /** Retiring a category must not orphan the expenses filed under it (§10.6). */
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;
}
