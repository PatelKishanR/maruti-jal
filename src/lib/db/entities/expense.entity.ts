import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ExpenseCategory } from './expense-category.entity';
import { Staff } from './staff.entity';
import { EXPENSE_PAYMENT_MODES, type ExpensePaymentMode } from './enums';
import { bigintToNumber, money } from '@/lib/db/transformers';

/**
 * Money going out. Deliberately simple: one row, one amount, no line items and
 * no payment schedule — the owner records what was spent, not how it was
 * invoiced. See .claude/DATA-MODEL.md §5.19
 *
 * Every @Column declares its type EXPLICITLY and every relation carries
 * `Relation<T>`. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('expenses')
export class Expense extends BaseEntity {
  /** Identity column; `code` below is derived from it. See DATA-MODEL D-2 */
  @Column({
    type: 'bigint',
    name: 'expense_no',
    generated: 'identity',
    generatedIdentity: 'ALWAYS',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  expenseNo!: number;

  @Index('uq_expenses_code', { unique: true })
  @Column({
    type: 'text',
    generatedType: 'STORED',
    asExpression: `'EXP-' || lpad(expense_no::text, 6, '0')`,
    insert: false,
    update: false,
  })
  code!: string;

  /**
   * "Which day was this spent?" is a calendar question. Carried as
   * 'YYYY-MM-DD' end to end so no timezone exists to get wrong (D-5).
   */
  @Column({ type: 'date', name: 'expense_date' })
  expenseDate!: string;

  /**
   * RESTRICT, not CASCADE: deleting a category must never take the expenses
   * filed under it with it. See .claude/DATA-MODEL.md §10.6
   */
  @ManyToOne(() => ExpenseCategory, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: Relation<ExpenseCategory>;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  /** numeric(12,2), CHECK > 0. Never summed in TypeScript — see D-4. */
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: money })
  amount!: number;

  /**
   * A narrower set than `payment_mode`: an expense is never settled in coins or
   * written off, but it may be paid by cheque. See .claude/DATA-MODEL.md §3.1
   */
  @Column({
    type: 'enum',
    enum: EXPENSE_PAYMENT_MODES,
    enumName: 'expense_payment_mode',
    name: 'payment_mode',
  })
  paymentMode!: ExpensePaymentMode;

  /** Free text — the payee is usually a shop, not anyone in this database. */
  @Column({ type: 'text', name: 'paid_to', nullable: true })
  paidTo!: string | null;

  /**
   * Optional link: "diesel for Ramesh's van". RESTRICT for the same reason as
   * the category — history outlives the staff record (§10.6).
   */
  @ManyToOne(() => Staff, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'staff_id' })
  staff!: Relation<Staff> | null;

  @Column({ type: 'uuid', name: 'staff_id', nullable: true })
  staffId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'text', name: 'attachment_url', nullable: true })
  attachmentUrl!: string | null;

  /**
   * Searching expenses means searching the payee and the note — the amount and
   * date have their own filters. `code` is excluded because PostgreSQL forbids
   * a generated column referencing another generated column (§5.5 note).
   *
   * `select: false` — a WHERE predicate, not a displayed value.
   */
  @Column({
    type: 'text',
    name: 'search_blob',
    generatedType: 'STORED',
    asExpression: `coalesce(paid_to, '') || ' ' || coalesce(note, '')`,
    insert: false,
    update: false,
    select: false,
  })
  searchBlob!: string;
}
