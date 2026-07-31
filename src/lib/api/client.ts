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
 */
function baseUrl(): string {
  if (typeof window !== "undefined") return "";

  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
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
  return cookie ? { cookie } : {};
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
