import { User } from './user.entity';

/**
 * STATIC ARRAY — never a glob.
 *
 * `entities: ['src/**\/*.entity.ts']` is the most common TypeORM-in-Next
 * failure after decorators. Bundlers erase the filesystem, so the glob
 * resolves to zero entities and you get "No metadata found" — in production
 * only. See .claude/ARCHITECTURE.md §1.3
 *
 * Every new entity must be imported and added here.
 */
export const entities = [User] as const;

export { User } from './user.entity';
export { BaseEntity } from './base.entity';
export type { UserRole, Locale } from './user.entity';
export { USER_ROLES, LOCALES } from './user.entity';
