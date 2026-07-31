import 'server-only';
import 'reflect-metadata';
import { DataSource, type EntityManager } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { types } from 'pg';
import { entities } from './entities';

/* ═══════════════════════════════════════════════════════════════════════
   pg type parsers — fix PostgreSQL → JS coercion ONCE, globally.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * oid 1082 = date.
 *
 * By default the driver decodes a date column into a JS Date at LOCAL
 * midnight. On a UTC server, a delivery date of 2026-08-05 becomes a moment
 * that, after any arithmetic and re-serialisation, can land on 2026-08-04.
 * Party schedules would drift by a day and nobody would notice for weeks.
 *
 * Keeping it a 'YYYY-MM-DD' string end to end means there is no timezone to
 * get wrong. See .claude/ARCHITECTURE.md §9.2
 */
types.setTypeParser(1082, (v) => v);

/** oid 1700 = numeric. Keep as string — Number() would reintroduce float error. */
types.setTypeParser(1700, (v) => v);

/** oid 20 = int8. Safe as a number; our counters never approach 2^53. */
types.setTypeParser(20, (v) => Number(v));

/* ═══════════════════════════════════════════════════════════════════════
   The singleton.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * A fresh object identity on every evaluation of this module.
 *
 * Next.js re-evaluates the server module graph on hot reload, which gives
 * entity CLASSES new object identities while a globally-cached DataSource
 * still holds references to the old ones. getRepository(User) then looks up a
 * class the DataSource has never seen → EntityMetadataNotFoundError.
 *
 * If this epoch differs from the cached one, the graph was rebuilt and the
 * cached DataSource is stale by definition. See .claude/ARCHITECTURE.md §1.5
 */
const MODULE_EPOCH = Object.freeze({});

type DsGlobal = typeof globalThis & {
  __mj_ds?: Promise<DataSource>;
  __mj_epoch?: object;
};
const g = globalThis as DsGlobal;

function createDataSource(): DataSource {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and fill in ' +
        'the POOLED Neon connection string (the host containing "-pooler").',
    );
  }

  if (process.env.NODE_ENV === 'production' && !url.includes('-pooler')) {
    // Not fatal — a self-hosted Postgres has no pooler host — but on Neon this
    // is the single most reliable way to exhaust the connection limit.
    console.warn(
      '[db] DATABASE_URL does not look like a pooled Neon endpoint. ' +
        'Under serverless this will exhaust connections. See ARCHITECTURE.md §2.2',
    );
  }

  const max = Number(process.env.DB_POOL_MAX ?? 3);

  return new DataSource({
    type: 'postgres',
    url,
    ssl: { rejectUnauthorized: true },
    entities: [...entities],
    migrations: [], // the app never runs migrations
    namingStrategy: new SnakeNamingStrategy(),

    /**
     * NEVER true, not even locally.
     * It issues DROP COLUMN with no prompt (rename a property, lose a column
     * of payment amounts), it cannot express triggers or partial indexes, and
     * it runs on every serverless cold start — concurrently.
     * See .claude/ARCHITECTURE.md §3.1
     */
    synchronize: false,
    migrationsRun: false,

    logging:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn', 'schema']
        : ['error'],

    poolSize: max,
    extra: {
      max,
      // Long idle sockets against a serverless proxy get reaped underneath
      // you, surfacing as "connection terminated unexpectedly" on the NEXT
      // query. Short idle + keepAlive avoids that.
      idleTimeoutMillis: 10_000,
      // Deliberately generous: Neon autosuspends after ~5 min idle, so the
      // first query of the morning waits for a compute cold start. A 5s
      // timeout produces mystifying intermittent failures.
      connectionTimeoutMillis: 15_000,
      keepAlive: true,
      application_name: 'maruti-jal-web',
      statement_timeout: 15_000,
    },
  });
}

export function getDataSource(): Promise<DataSource> {
  // Dev only: module graph rebuilt → cached DataSource holds dead classes.
  if (process.env.NODE_ENV !== 'production' && g.__mj_epoch !== MODULE_EPOCH) {
    const stale = g.__mj_ds;
    g.__mj_ds = undefined;
    g.__mj_epoch = MODULE_EPOCH;
    if (stale) void stale.then((ds) => ds.destroy()).catch(() => {});
  }

  if (!g.__mj_ds) {
    // Cache the PROMISE before awaiting, so two concurrent requests during a
    // cold start share one initialize() instead of opening two pools.
    g.__mj_ds = createDataSource()
      .initialize()
      .catch((err) => {
        // A failed init must not be cached forever, or the process never recovers.
        g.__mj_ds = undefined;
        throw err;
      });
  }

  return g.__mj_ds;
}

/** Convenience: a repository for one entity. */
export async function repo<T extends object>(entity: new () => T) {
  const ds = await getDataSource();
  return ds.getRepository<T>(entity);
}

/**
 * Run work inside a transaction.
 *
 * Transactions belong HERE and in the service layer — never in a repository
 * (uncomposable) and never in a route handler (business rules leak upward).
 * See .claude/ARCHITECTURE.md §4
 */
export async function withTx<T>(
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  const ds = await getDataSource();
  return ds.transaction('READ COMMITTED', fn);
}
