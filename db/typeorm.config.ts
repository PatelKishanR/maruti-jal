import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { entities } from '../src/lib/db/entities';

// Load .env.local first (Next's convention for secrets), then .env as a fallback.
config({ path: '.env.local' });
config({ path: '.env' });

/**
 * CLI-ONLY DataSource. The application never imports this file.
 *
 * Uses the DIRECT (unpooled) Neon endpoint, because DDL through PgBouncer's
 * transaction pooling is unreliable. Globs are fine here — tsx runs real files
 * off disk, unlike the bundled app. See .claude/ARCHITECTURE.md §3
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  entities: [...entities],
  migrations: ['db/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: ['query', 'error'],
});
