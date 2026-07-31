import type { User } from "@/lib/db/entities";

/**
 * Plain shapes crossing the server → client boundary.
 *
 * TypeORM entities are CLASS INSTANCES, and React's server-component
 * serialiser rejects any object whose prototype isn't Object.prototype — you
 * get "Only plain objects can be passed to Client Components".
 *
 * Mapping once here also means passwordHash can never leave the server by
 * accident, because it simply isn't part of the shape.
 * See .claude/ARCHITECTURE.md §4.1
 */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  locale: string;
  theme: "light" | "dark" | "system";
  isActive: boolean;
  /** ISO strings — Date instances do survive RSC, but strings keep DTOs flat. */
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
    theme: user.theme,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
  };
}
