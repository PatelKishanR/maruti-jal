import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

/**
 * Runs at the EDGE. It imports only auth.config.ts — never auth.ts, never the
 * database, never bcrypt. Importing those here fails at build time, and that
 * failure is the point: it makes the mistake impossible rather than subtle.
 *
 * This blocks casual URL access. It is NOT the security boundary — every
 * Server Action re-checks the session and role independently, because actions
 * are public POST endpoints. See .claude/ARCHITECTURE.md §10.4
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /**
     * Page routes only.
     *
     * `/api/**` is deliberately EXCLUDED. Middleware protects pages by
     * redirecting to /login — correct for a browser, useless for an API
     * client, which would receive a 302 and an HTML login page instead of a
     * JSON 401 it can act on.
     *
     * API routes authenticate themselves inside `createApiHandler`, which
     * returns a proper `401 { ok: false, code: "UNAUTHENTICATED" }`.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)',
  ],
};
