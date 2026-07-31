"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { signInSchema } from "@/lib/validation/auth";
import {
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
} from "@/lib/services/auth.service";
import { logger } from "@/lib/logger";

export type SignInState =
  | { status: "idle" }
  | { status: "error"; messageKey: string; params?: Record<string, string | number> }
  | { status: "fieldError"; fieldErrors: Record<string, string[]> };

/**
 * Sign-in action.
 *
 * Note what is NOT distinguished here: an unknown email and a wrong password
 * both return `auth.errors.invalidCredentials`. Telling them apart would let
 * an attacker enumerate which addresses are worth attacking, and with a single
 * known account that is most of the work done for them.
 * See MODULES/00-auth.md §5.1
 */
export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    keepSignedIn: formData.get("keepSignedIn") === "on",
    redirectTo: formData.get("redirectTo") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "fieldError",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Rate limit per client IP. In-memory — correct for single-instance, and
  // honest about resetting on restart. See auth.service.ts
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";

  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return {
      status: "error",
      messageKey: "auth.errors.rateLimited",
      params: { minutes: Math.ceil(limit.retryAfterSeconds / 60) },
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      keepSignedIn: String(parsed.data.keepSignedIn),
      redirectTo: parsed.data.redirectTo,
    });
  } catch (error) {
    // signIn throws a redirect on SUCCESS — Next.js uses a thrown error for
    // navigation, so this must be re-thrown rather than swallowed.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      clearAttempts(ip);
      throw error;
    }

    if (error instanceof AuthError) {
      recordFailedAttempt(ip);
      return { status: "error", messageKey: "auth.errors.invalidCredentials" };
    }

    logger.error({ err: String(error) }, "sign-in threw");
    return { status: "error", messageKey: "auth.errors.network" };
  }

  // Unreachable in practice — signIn always redirects on success.
  clearAttempts(ip);
  return { status: "idle" };
}
