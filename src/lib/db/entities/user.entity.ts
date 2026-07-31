import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export const USER_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'VIEWER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LOCALES = ['en', 'gu'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * App logins. NOT the same as `staff` — staff are delivery workers who never
 * sign in. PRD decision D2: a single admin account, but the role column exists
 * from day one so adding a manager later is config, not a migration.
 *
 * Every @Column below declares its type EXPLICITLY. Bare `@Column()` relies on
 * emitted decorator metadata, which esbuild — the toolchain running our
 * migration CLI — has never implemented. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  /** citext, so casing never creates a duplicate account. */
  @Index('uq_users_email', { unique: true, where: '"deleted_at" IS NULL' })
  @Column({ type: 'citext' })
  email!: string;

  /** bcrypt, cost 12. Never selected by default — see UserRepository. */
  @Column({ type: 'text', name: 'password_hash', select: false })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: USER_ROLES,
    enumName: 'user_role',
    default: 'ADMIN',
  })
  role!: UserRole;

  /** UI language. Mirrored into a cookie so the first server paint is correct. */
  @Column({ type: 'varchar', length: 5, default: 'en' })
  locale!: Locale;

  @Column({ type: 'varchar', length: 10, default: 'system' })
  theme!: 'light' | 'dark' | 'system';

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', name: 'last_login_at', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'password_changed_at', nullable: true })
  passwordChangedAt!: Date | null;

  /**
   * Bumped on password change. The JWT carries the value it was minted with;
   * a mismatch invalidates the session. This is how "signs out other devices"
   * works without a session table.
   */
  @Column({ type: 'integer', name: 'session_version', default: 1 })
  sessionVersion!: number;
}
