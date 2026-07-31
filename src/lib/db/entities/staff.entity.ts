import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { bigintToNumber } from '@/lib/db/transformers';

/**
 * Delivery workers. NOT app logins — see `users` for those. A staff member
 * never signs in; the admin records everything on their behalf.
 *
 * Every @Column declares its type EXPLICITLY. Bare `@Column()` relies on
 * emitted decorator metadata, which esbuild — the toolchain running our
 * migration CLI — has never implemented. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('staff')
export class Staff extends BaseEntity {
  /**
   * A water plant runs on register numbers, not UUIDs. `staff_no` is a plain
   * identity column and `code` is derived from it in the database, which is
   * gapless-enough, sortable and searchable with no trigger code to maintain.
   * See .claude/DATA-MODEL.md D-2
   */
  @Column({
    type: 'bigint',
    name: 'staff_no',
    generated: 'identity',
    generatedIdentity: 'ALWAYS',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  staffNo!: number;

  @Index('uq_staff_code', { unique: true })
  @Column({
    type: 'text',
    generatedType: 'STORED',
    asExpression: `'STF-' || lpad(staff_no::text, 6, '0')`,
    insert: false,
    update: false,
  })
  code!: string;

  /**
   * One name field, any script — no `*_en` / `*_gu` pair (D-10). The ICU
   * collation makes Gujarati names sort the way a Gujarati reader expects
   * rather than by UTF-8 code point. See .claude/DATA-MODEL.md §5.2
   */
  @Column({ type: 'text', collation: 'gu-IN-x-icu' })
  name!: string;

  /**
   * Unique only among NON-DELETED rows. When someone leaves, their number has
   * to become available for the next person to use.
   * See .claude/DATA-MODEL.md §10.15
   */
  @Index('uq_staff_phone', { unique: true, where: '"deleted_at" IS NULL' })
  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 20, name: 'alt_phone', nullable: true })
  altPhone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /**
   * A calendar date, carried as 'YYYY-MM-DD' end to end. Typed as a Date it
   * would decode to local midnight and drift a day under UTC.
   * See .claude/ARCHITECTURE.md §9.2
   */
  @Column({ type: 'date', name: 'joined_on', nullable: true })
  joinedOn!: string | null;

  /** "Deactivate" and "delete" are different verbs — the owner named both (D-8). */
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  /**
   * The owner wants one search box matching name OR phone OR address. Three
   * separate indexes force three OR-branches; one generated column carries a
   * single trigram index and a single fast predicate.
   * See .claude/DATA-MODEL.md §5.2
   *
   * `code` is deliberately absent: PostgreSQL forbids a generated column from
   * referencing another generated column (see the §5.5 note), and code lookups
   * are served by their own trigram index anyway.
   *
   * `select: false` — this is a WHERE predicate, never a value anyone displays,
   * and it roughly doubles the row width on every list query if selected.
   */
  @Column({
    type: 'text',
    name: 'search_blob',
    generatedType: 'STORED',
    asExpression: `name || ' ' || phone || ' ' || coalesce(alt_phone, '') || ' ' || coalesce(address, '')`,
    insert: false,
    update: false,
    select: false,
  })
  searchBlob!: string;
}
