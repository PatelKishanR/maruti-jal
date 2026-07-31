import 'server-only';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold =
  LEVELS[(process.env.LOG_LEVEL as Level) ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')] ??
  20;

/**
 * Keys whose values are never logged.
 *
 * A payment payload or a credentials object logged whole is how secrets leak.
 * This runs on every log call, so it must stay cheap.
 */
const REDACT = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'cookie',
  'authorization',
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'AUTH_SECRET',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.has(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function emit(level: Level, context: unknown, message: string) {
  if (LEVELS[level] < threshold) return;

  const line = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(context && typeof context === 'object' ? (redact(context) as object) : {}),
  };

  const output = level === 'error' || level === 'warn' ? console.error : console.log;
  output(process.env.NODE_ENV === 'development' ? line : JSON.stringify(line));
}

export const logger = {
  debug: (ctx: unknown, msg: string) => emit('debug', ctx, msg),
  info: (ctx: unknown, msg: string) => emit('info', ctx, msg),
  warn: (ctx: unknown, msg: string) => emit('warn', ctx, msg),
  error: (ctx: unknown, msg: string) => emit('error', ctx, msg),
};
