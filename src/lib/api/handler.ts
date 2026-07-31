import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/lib/db/entities";

export interface ApiContext {
  userId: string;
  role: UserRole;
  email: string;
  requestId: string;
}

/** Uniform success envelope. */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

/** Uniform failure envelope. `messageKey` is a catalogue key, not a sentence. */
export interface ApiFailure {
  ok: false;
  code: string;
  messageKey: string;
  fieldErrors?: Record<string, string[]>;
  meta?: Record<string, unknown>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

type ZodAny = z.ZodTypeAny;

interface HandlerArgs<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  req: NextRequest;
  ctx: ApiContext;
}

interface CreateApiHandlerOptions<
  BS extends ZodAny | undefined,
  QS extends ZodAny | undefined,
  PS extends ZodAny | undefined,
  R,
> {
  /** Route name for logs, e.g. "PATCH /api/account/profile". */
  name: string;
  /**
   * Roles permitted to call this route. Required — it is impossible to write a
   * route without deciding who may reach it.
   * Pass `"public"` for genuinely unauthenticated routes.
   */
  roles: UserRole[] | "public";
  /** Validates the JSON request body. Omit for GET/DELETE. */
  body?: BS;
  /** Validates URL search params. */
  query?: QS;
  /** Validates dynamic route segments. */
  params?: PS;
  /** HTTP status on success. Defaults to 200. */
  status?: number;
  handler: (
    args: HandlerArgs<
      BS extends ZodAny ? z.infer<BS> : undefined,
      QS extends ZodAny ? z.infer<QS> : undefined,
      PS extends ZodAny ? z.infer<PS> : undefined
    >,
  ) => Promise<R>;
}

function fail(
  status: number,
  body: ApiFailure,
  requestId: string,
): NextResponse<ApiFailure> {
  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": requestId },
  });
}

/**
 * The single entry point for every API route.
 *
 * Responsibilities, in order:
 *   1. authenticate            — session or 401
 *   2. authorise               — role or 403
 *   3. VALIDATE body, query and params — Zod or 422 with field errors
 *   4. call the service        — the route contains no business logic
 *   5. map errors to HTTP      — AppError carries its own status; anything
 *                                else is logged in full and returned as a
 *                                generic 500, so stack traces never leak
 *
 * Routes never touch the database. They call services; services call
 * repositories. See .claude/ARCHITECTURE.md §4
 */
export function createApiHandler<
  BS extends ZodAny | undefined,
  QS extends ZodAny | undefined,
  PS extends ZodAny | undefined,
  R,
>(opts: CreateApiHandlerOptions<BS, QS, PS, R>) {
  /**
   * Next 15 types the second argument as required, with `params` always a
   * Promise — even for routes with no dynamic segments.
   */
  return async function route(
    req: NextRequest,
    routeCtx: { params: Promise<Record<string, string | string[]>> },
  ): Promise<NextResponse> {
    const started = Date.now();
    const requestId = crypto.randomUUID();

    // ---- 1 & 2: authentication and authorisation -------------------------
    let ctx: ApiContext = {
      userId: "",
      role: "VIEWER",
      email: "",
      requestId,
    };

    if (opts.roles !== "public") {
      const session = await auth();

      if (!session?.user?.id) {
        return fail(
          401,
          { ok: false, code: "UNAUTHENTICATED", messageKey: "common.notSignedIn" },
          requestId,
        );
      }

      ctx = {
        userId: session.user.id,
        role: session.user.role as UserRole,
        email: session.user.email ?? "",
        requestId,
      };

      if (!opts.roles.includes(ctx.role)) {
        logger.warn(
          { route: opts.name, userId: ctx.userId, role: ctx.role, requestId },
          "forbidden",
        );
        return fail(
          403,
          { ok: false, code: "FORBIDDEN", messageKey: "common.noAccess" },
          requestId,
        );
      }
    }

    // ---- 3: validation ---------------------------------------------------
    const fieldErrors: Record<string, string[]> = {};
    let body: unknown;
    let query: unknown;
    let params: unknown;

    if (opts.body) {
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return fail(
          400,
          {
            ok: false,
            code: "INVALID_JSON",
            messageKey: "common.invalidRequest",
          },
          requestId,
        );
      }

      const parsed = opts.body.safeParse(raw);
      if (!parsed.success) {
        Object.assign(fieldErrors, parsed.error.flatten().fieldErrors);
      } else {
        body = parsed.data;
      }
    }

    if (opts.query) {
      const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
      const parsed = opts.query.safeParse(raw);
      if (!parsed.success) {
        Object.assign(fieldErrors, parsed.error.flatten().fieldErrors);
      } else {
        query = parsed.data;
      }
    }

    if (opts.params) {
      const raw = routeCtx?.params ? await routeCtx.params : {};
      const parsed = opts.params.safeParse(raw);
      if (!parsed.success) {
        Object.assign(fieldErrors, parsed.error.flatten().fieldErrors);
      } else {
        params = parsed.data;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return fail(
        422,
        {
          ok: false,
          code: "VALIDATION",
          messageKey: "common.fixHighlighted",
          fieldErrors,
        },
        requestId,
      );
    }

    // ---- 4 & 5: call the service, map errors -----------------------------
    try {
      const data = await opts.handler({
        body,
        query,
        params,
        req,
        ctx,
      } as never);

      logger.info(
        {
          route: opts.name,
          userId: ctx.userId || undefined,
          durationMs: Date.now() - started,
          requestId,
        },
        "api ok",
      );

      return NextResponse.json(
        { ok: true, data } satisfies ApiSuccess<R>,
        { status: opts.status ?? 200, headers: { "x-request-id": requestId } },
      );
    } catch (e) {
      if (e instanceof AppError) {
        logger.warn(
          { route: opts.name, code: e.code, meta: e.meta, requestId },
          e.message,
        );
        return fail(
          e.httpStatus,
          {
            ok: false,
            code: e.code,
            messageKey: e.messageKey,
            fieldErrors: e.fieldErrors,
            meta: e.meta,
          },
          requestId,
        );
      }

      logger.error(
        { route: opts.name, userId: ctx.userId || undefined, err: String(e), requestId },
        "unhandled api error",
      );
      return fail(
        500,
        { ok: false, code: "INTERNAL", messageKey: "common.somethingWentWrong" },
        requestId,
      );
    }
  };
}
