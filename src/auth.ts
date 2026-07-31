import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { verifyCredentials } from '@/lib/services/auth.service';

/**
 * NODE-ONLY HALF. Imports the database and bcrypt, so it must never be
 * reachable from middleware (which runs at the Edge).
 * See .claude/ARCHITECTURE.md §10.3
 */
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  keepSignedIn: z.union([z.boolean(), z.string()]).optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        keepSignedIn: { type: 'text' },
      },

      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await verifyCredentials(parsed.data.email, parsed.data.password);
        if (!user) return null;

        const keepSignedIn =
          parsed.data.keepSignedIn === true || parsed.data.keepSignedIn === 'true';

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          locale: user.locale,
          sessionVersion: user.sessionVersion,
          keepSignedIn,
        };
      },
    }),
  ],
});
