import "server-only";
import bcrypt from "bcryptjs";
import { withTx } from "@/lib/db/data-source";
import { userRepository } from "@/lib/repositories/user.repository";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { toUserDto, type UserDto } from "@/lib/dto/user.dto";

/**
 * Business rules for accounts and sign-in.
 *
 * This layer NEVER touches the database directly — every read and write goes
 * through `userRepository`. It owns transaction boundaries, and it maps
 * entities to DTOs before anything leaves.
 * See .claude/ARCHITECTURE.md §4
 */

/**
 * A bcrypt hash of a value nobody knows.
 *
 * When no account matches we still compare against this. Without it an unknown
 * email returns in ~1ms and a known one in ~150ms, and that difference alone
 * enumerates accounts. See MODULES/00-auth.md §5.1
 */
const DUMMY_HASH = "$2a$12$N9qo8uLOickgx2ZMRZoMye1VdLLBQ1Xv0kCLu5xVJvXqfFqPMEwHi";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  locale: string;
  sessionVersion: number;
}

/**
 * Verify credentials.
 *
 * Returns null for EVERY failure — wrong password, unknown email, deactivated
 * account. The caller cannot tell them apart, and neither can an attacker.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await userRepository.findByEmailWithPassword(email);

  // Always compare, even with no user — constant-ish work either way.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!user || !user.isActive || !passwordMatches) {
    logger.warn(
      {
        email,
        reason: !user ? "no-user" : !user.isActive ? "inactive" : "bad-password",
      },
      "sign-in failed",
    );
    return null;
  }

  // Fire-and-forget: a slow write here would show up as a slow login.
  void userRepository
    .touchLastLogin(user.id)
    .catch((e) => logger.error({ err: String(e) }, "failed to stamp lastLoginAt"));

  logger.info({ userId: user.id }, "sign-in ok");

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
    sessionVersion: user.sessionVersion,
  };
}

export async function getUserById(id: string): Promise<UserDto> {
  const user = await userRepository.findById(id);
  if (!user) throw new NotFoundError("Account");
  return toUserDto(user);
}

/**
 * Is this token still valid for this account?
 *
 * The JWT carries the sessionVersion it was minted with. Changing a password
 * bumps the stored value, so every other device's token stops matching.
 */
export async function isSessionValid(
  userId: string,
  tokenSessionVersion: number | undefined,
): Promise<boolean> {
  const state = await userRepository.findSessionState(userId);
  return (
    !!state && state.isActive && state.sessionVersion === tokenSessionVersion
  );
}

export async function countAccounts(): Promise<number> {
  return userRepository.count();
}

/**
 * Change password.
 *
 * TRANSACTIONAL and row-locked: the read of the current hash and the write of
 * the new one must be atomic, or two concurrent changes can lose one another.
 * Bumping sessionVersion invalidates every OTHER session.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ sessionVersion: number }> {
  return withTx(async (em) => {
    const user = await userRepository.findByIdWithPasswordForUpdate(userId, em);
    if (!user) throw new NotFoundError("Account");

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new ConflictError(
        "Current password incorrect",
        "account.changePasswordModal.errors.currentWrong",
      );
    }

    const reused = await bcrypt.compare(newPassword, user.passwordHash);
    if (reused) {
      throw new ConflictError(
        "New password same as current",
        "account.changePasswordModal.errors.sameAsCurrent",
      );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    user.sessionVersion += 1;
    user.updatedById = userId;

    await userRepository.save(user, em);
    logger.info({ userId }, "password changed");

    return { sessionVersion: user.sessionVersion };
  });
}

/**
 * Update name and email.
 *
 * TRANSACTIONAL: the uniqueness check and the write must be atomic, or two
 * concurrent updates could both pass the check and both commit.
 */
export async function updateProfile(
  userId: string,
  data: { name: string; email: string },
): Promise<UserDto> {
  return withTx(async (em) => {
    const user = await userRepository.findByIdForUpdate(userId, em);
    if (!user) throw new NotFoundError("Account");

    if (user.email.toLowerCase() !== data.email.toLowerCase()) {
      const taken = await userRepository.isEmailTakenByOther(
        data.email,
        userId,
        em,
      );
      if (taken) {
        throw new ConflictError(
          "Email already in use",
          "account.errors.emailTaken",
        );
      }
    }

    user.name = data.name;
    user.email = data.email;
    user.updatedById = userId;

    const saved = await userRepository.save(user, em);
    return toUserDto(saved);
  });
}

export async function updatePreferences(
  userId: string,
  data: { locale: "en" | "gu"; theme: "light" | "dark" | "system" },
): Promise<UserDto> {
  await userRepository.updateById(userId, { ...data, updatedById: userId });
  return getUserById(userId);
}

/* ═══════════════════════════════════════════════════════════════════════
   Rate limiting — 5 failures per IP per 15 minutes.

   In-memory, which is correct for a single-instance deployment and honest
   about its limits: it resets on restart and does not span instances. For one
   admin account that is sufficient. If this ever runs multi-instance, move the
   counter into Postgres behind a RateLimitRepository.
   See MODULES/00-auth.md §5.2
   ═══════════════════════════════════════════════════════════════════════ */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; firstAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.firstAt > WINDOW_MS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.firstAt + WINDOW_MS - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.firstAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAt: now });
    return;
  }

  bucket.count += 1;

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      if (now - v.firstAt > WINDOW_MS) buckets.delete(k);
    }
  }
}

export function clearAttempts(key: string): void {
  buckets.delete(key);
}
