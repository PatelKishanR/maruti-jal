/**
 * Error hierarchy.
 *
 * Services throw these. `createAction` is the ONLY place that catches them and
 * turns them into a typed result. Unknown errors are logged with full context
 * and returned as a generic message — stack traces never reach the browser.
 *
 * `messageKey` is a message-catalogue key, not a sentence, so a Gujarati UI
 * doesn't get English server errors. See .claude/I18N.md §5.4
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number = 400,
    readonly messageKey: string = 'common.somethingWentWrong',
    readonly meta: Record<string, unknown> = {},
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(what: string, meta: Record<string, unknown> = {}) {
    super(`${what} not found`, 'NOT_FOUND', 404, 'common.notFound', meta);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, messageKey: string, meta: Record<string, unknown> = {}) {
    super(message, 'CONFLICT', 409, messageKey, meta);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Not allowed') {
    super(message, 'FORBIDDEN', 403, 'common.noAccess');
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Not signed in') {
    super(message, 'UNAUTHENTICATED', 401, 'common.notSignedIn');
  }
}

export class ValidationError extends AppError {
  constructor(fieldErrors: Record<string, string[]>, messageKey = 'common.fixHighlighted') {
    super('Validation failed', 'VALIDATION', 422, messageKey, {}, fieldErrors);
  }
}

/** Coin stock, jar counts — anything where the database will refuse anyway. */
export class InsufficientStockError extends AppError {
  constructor(item: string, available: number, requested: number) {
    super(
      `Insufficient stock for ${item}`,
      'INSUFFICIENT_STOCK',
      409,
      'common.insufficientStock',
      { item, available, requested },
    );
  }
}

export class RateLimitError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super(
      'Too many attempts',
      'RATE_LIMITED',
      429,
      'auth.errors.rateLimited',
      { retryAfterSeconds },
    );
  }
}
