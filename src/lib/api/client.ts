import type { ApiResponse } from "./handler";

/**
 * The ONLY way the frontend reaches data.
 *
 * No component — server or client — imports a service, a repository or the
 * DataSource. Everything goes through here, which means the API is a real
 * contract that can be tested, versioned and eventually consumed by something
 * that isn't this app.
 *
 * See .claude/ARCHITECTURE.md §4
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageKey: string,
    readonly fieldErrors?: Record<string, string[]>,
    readonly meta?: Record<string, unknown>,
  ) {
    super(`${code} (${status})`);
    this.name = "ApiError";
  }
}

/**
 * Absolute base URL.
 *
 * Client-side, a relative path is fine. Server-side, `fetch` has no notion of
 * "this site", so an absolute origin is required.
 *
 * WHICH origin matters more than it looks. `VERCEL_URL` is the PER-DEPLOYMENT
 * hostname (`maruti-jal-a1b2c3-scope.vercel.app`), and Vercel's Deployment
 * Protection covers those generated URLs while exempting the assigned
 * production domain. A server component fetching its own API through
 * `VERCEL_URL` therefore gets Vercel's SSO page — HTML, status 401 — rather
 * than this app's JSON. `VERCEL_PROJECT_PRODUCTION_URL` is the exempt domain,
 * so it is preferred whenever we are actually serving production.
 */
function baseUrl(): string {
  if (typeof window !== "undefined") return "";

  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && !(onVercel() && isLoopback(explicit))) return normaliseOrigin(explicit);

  if (explicit) {
    // Almost always `.env.local` copied wholesale into the Vercel dashboard.
    // Honouring it would make every server-side fetch ECONNREFUSED inside the
    // function, which surfaces as "signed out immediately after signing in".
    console.warn(
      `[api] Ignoring NEXT_PUBLIC_APP_URL=${explicit} — a loopback address cannot be reached from a Vercel function.`,
    );
  }

  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

function onVercel(): boolean {
  return !!process.env.VERCEL;
}

function isLoopback(url: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
}

/** Tolerate `example.com`, `https://example.com/` and everything between. */
function normaliseOrigin(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * Forward the incoming request's cookies when calling from a Server Component.
 *
 * Without this the API route sees an anonymous request and returns 401 — the
 * single most common mistake when a server component calls its own API.
 */
async function serverHeaders(): Promise<HeadersInit> {
  if (typeof window !== "undefined") return {};

  // Imported lazily so this module stays usable in client components.
  const { headers } = await import("next/headers");
  const incoming = await headers();
  const cookie = incoming.get("cookie");

  const out: Record<string, string> = {};
  if (cookie) out.cookie = cookie;

  /**
   * Vercel's sanctioned way past Deployment Protection for machine callers.
   * Only present when "Protection Bypass for Automation" is switched on; it is
   * the belt to `baseUrl()`'s braces, and covers preview deployments, where the
   * production domain is not the right target.
   */
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) out["x-vercel-protection-bypass"] = bypass;

  return out;
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;

  const res = await fetch(`${baseUrl()}${path}`, {
    ...rest,
    // Never serve a stale figure from a cache the user cannot see.
    cache: "no-store",
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(await serverHeaders()),
      ...rest.headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  let payload: ApiResponse<T>;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      res.status,
      "BAD_RESPONSE",
      "common.somethingWentWrong",
    );
  }

  if (!payload.ok) {
    throw new ApiError(
      res.status,
      payload.code,
      payload.messageKey,
      payload.fieldErrors,
      payload.meta,
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "GET" }),

  post: <T>(path: string, json?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "POST", json }),

  patch: <T>(path: string, json?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PATCH", json }),

  put: <T>(path: string, json?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PUT", json }),

  del: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "DELETE" }),
};
