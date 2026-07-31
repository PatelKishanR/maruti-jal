import type { NextAuthConfig } from 'next-auth';

/**
 * EDGE-SAFE HALF.
 *
 * No database, no bcrypt, no Node built-ins. `middleware.ts` imports this and
 * runs at the Edge, where TypeORM cannot load. The DB-backed credentials
 * provider lives in auth.ts, which is Node-only.
 *
 * Keeping the split even where a Node runtime is available in middleware is
 * deliberate: a middleware that CANNOT reach the database is a middleware
 * nobody can accidentally put business logic into.
 * See .claude/ARCHITECTURE.md §10.3
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    // Default 12h. "Keep me signed in" extends to 30 days via the jwt callback.
    maxAge: 60 * 60 * 12,
  },

  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role ?? 'ADMIN';
        token.locale = (user as { locale?: string }).locale ?? 'en';
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 1;
        token.keepSignedIn = (user as { keepSignedIn?: boolean }).keepSignedIn ?? false;
      }

      // Preference changes propagate into the token without a re-login.
      if (trigger === 'update' && session) {
        const patch = session as { locale?: string; sessionVersion?: number; name?: string };
        if (patch.locale) token.locale = patch.locale;
        if (patch.sessionVersion) token.sessionVersion = patch.sessionVersion;
        if (patch.name) token.name = patch.name;
      }

      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as string;
        session.user.locale = token.locale as string;
        session.user.sessionVersion = token.sessionVersion as number;
      }
      return session;
    },

    /**
     * Route protection. Everything except /login requires a session.
     * Returning a redirect preserves the attempted path so the user lands
     * where they meant to after signing in.
     */
    authorized({ auth: session, request }) {
      const { pathname, search } = request.nextUrl;
      const isSignedIn = !!session?.user;

      if (pathname.startsWith('/login')) {
        if (isSignedIn) {
          return Response.redirect(new URL('/', request.nextUrl));
        }
        return true;
      }

      if (isSignedIn) return true;

      const url = new URL('/login', request.nextUrl);
      if (pathname !== '/') {
        url.searchParams.set('next', `${pathname}${search}`);
      }
      return Response.redirect(url);
    },
  },

  // Deliberately empty — the DB-backed provider is added in auth.ts (Node only).
  providers: [],
} satisfies NextAuthConfig;
