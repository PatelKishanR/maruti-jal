import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  /**
   * Keep these in node_modules require() space.
   *
   * Without this the bundler tries to statically analyse TypeORM's dynamic
   * driver requires (mysql, oracledb, mongodb, sql.js, …) and either warns
   * endlessly or hard-fails the build.
   *
   * On Next < 15 this key lives at experimental.serverComponentsExternalPackages.
   * Having it under the wrong key silently does nothing, which presents as
   * "TypeORM randomly doesn't work". See .claude/ARCHITECTURE.md §1.4
   */
  serverExternalPackages: [
    'typeorm',
    'reflect-metadata',
    'pg',
    'pg-query-stream',
    'bcryptjs',
  ],

  experimental: {
    serverActions: { bodySizeLimit: '2mb' },

    /**
     * DO NOT MINIFY THE SERVER BUNDLE.
     *
     * TypeORM keys its entity-metadata graph by CLASS NAME. The production
     * minifier renames every class to a single letter, distinct entities
     * collide, and `validateDependencies` then reports a cycle that does not
     * exist in the source:
     *
     *   CircularRelationsError: Circular relations detected: TypeORMi -> m -> i
     *
     * It surfaces as `?error=Configuration` at sign-in, because the throw
     * happens inside the credentials `authorize` callback — the same opaque
     * message a missing AUTH_SECRET produces.
     *
     * This is invisible in development: `next dev` does not minify, so the
     * whole app works locally and fails on the first deploy. `npm run build &&
     * npm start` is the only way to catch it without deploying, which is why
     * ARCHITECTURE §1.6 makes that a Phase 0 exit criterion.
     *
     * Costs a larger server bundle. Server bundle size affects cold start
     * slightly and nothing else — it is never shipped to a browser.
     */
    serverMinification: false,
  },

  // Fail loudly rather than shipping a broken build.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default withNextIntl(nextConfig);
