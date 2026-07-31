import 'server-only';
import { z } from 'zod';
import { auth } from '@/auth';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { UserRole } from '@/lib/db/entities';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      /** Message-catalogue key, resolved by the client in the active language. */
      messageKey: string;
      code?: string;
      /** field name -> catalogue keys */
      fieldErrors?: Record<string, string[]>;
      meta?: Record<string, unknown>;
    };

export interface ActionContext {
  userId: string;
  role: UserRole;
  email: string;
}

/**
 * Wrapper for every Server Action.
 *
 * Server Actions are PUBLIC POST ENDPOINTS. Middleware is not the security
 * boundary — authorisation must be re-checked inside each action. Because
 * `roles` is a required parameter, it is impossible to write an action without
 * declaring who may call it. That is the entire point of this wrapper.
 * See .claude/ARCHITECTURE.md §5.2
 */
export function createAction<S extends z.ZodTypeAny, T>(opts: {
  schema: S;
  roles: UserRole[];
  name: string;
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>;
}) {
  return async (input: unknown): Promise<ActionResult<T>> => {
    const started = Date.now();

    const session = await auth();
    if (!session?.user?.id) {
      return { ok: false, messageKey: 'common.notSignedIn', code: 'UNAUTHENTICATED' };
    }

    const ctx: ActionContext = {
      userId: session.user.id,
      role: session.user.role as UserRole,
      email: session.user.email ?? '',
    };

    if (!opts.roles.includes(ctx.role)) {
      logger.warn({ action: opts.name, userId: ctx.userId, role: ctx.role }, 'forbidden');
      return { ok: false, messageKey: 'common.noAccess', code: 'FORBIDDEN' };
    }

    const parsed = opts.schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        messageKey: 'common.fixHighlighted',
        code: 'VALIDATION',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    try {
      const data = await opts.handler(parsed.data, ctx);
      logger.info(
        { action: opts.name, userId: ctx.userId, durationMs: Date.now() - started },
        'action ok',
      );
      return { ok: true, data };
    } catch (e) {
      if (e instanceof AppError) {
        logger.warn({ action: opts.name, code: e.code, meta: e.meta }, e.message);
        return {
          ok: false,
          messageKey: e.messageKey,
          code: e.code,
          fieldErrors: e.fieldErrors,
          meta: e.meta,
        };
      }

      // Unknown: log everything, return nothing useful to the browser.
      logger.error({ action: opts.name, userId: ctx.userId, err: String(e) }, 'unhandled action error');
      return { ok: false, messageKey: 'common.somethingWentWrong', code: 'INTERNAL' };
    }
  };
}
