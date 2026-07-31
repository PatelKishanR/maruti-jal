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
  },

  // Fail loudly rather than shipping a broken build.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default withNextIntl(nextConfig);
