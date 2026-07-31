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
    // Everything except Next internals, the auth API, and static assets.
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)',
  ],
};
