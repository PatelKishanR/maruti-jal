# Architecture

Next.js (App Router) · TypeORM · Neon PostgreSQL · TypeScript

This document covers how the stack fits together, where the sharp edges are, and the order in which to build so the risky parts get proven first.

---

## 1. TypeORM inside Next.js — the highest-risk area

Most Next.js + TypeORM projects fail in one of five ways. All five are avoidable, but only if handled deliberately from day one.

### 1.1 Declare every type explicitly

TypeORM only needs decorator metadata when you *omit* the type. Two tools in this stack cannot reliably emit that metadata:

- **Turbopack / SWC** — decorator metadata support has been the flakiest corner of Next.js's decorator story
- **esbuild**, which runs the migration CLI and the test runner — has never implemented decorator metadata emission, and has stated it as a non-goal

So an entity that relies on inferred types may compile in the app but **fail in the migration CLI** — or worse, generate a migration with the wrong column types.

**The rule, enforced by lint:**

```ts
// ❌ NEVER — depends on emitted metadata
@Column() name: string;
@ManyToOne(() => Staff) staff: Staff;

// ✅ ALWAYS — zero metadata required
@Column({ type: 'varchar', length: 120 })
name!: string;

@ManyToOne(() => Staff, { nullable: false, onDelete: 'RESTRICT' })
@JoinColumn({ name: 'staff_id' })
staff!: Relation<Staff>;

@Column({ type: 'uuid', name: 'staff_id' })
staffId!: string;
```

`Relation<T>` on every relation property prevents circular-import type erosion under bundlers — a real problem once `Order → Staff → Order` cycles appear.

Metadata emission is still enabled as belt-and-braces, but nothing depends on it.

**Escape hatch:** TypeORM's `EntitySchema` API defines entities as plain objects with no decorators. Keep the layering such that swapping is mechanical — entities are imported only by the barrel file and the repositories. Don't start there; decorators are more readable. But know the exit exists, and prove in Phase 0 that it isn't needed.

### 1.2 `useDefineForClassFields: false`

Not optional, and not widely documented for TypeORM specifically.

At the ES2022 target this defaults to `true`, which makes `name!: string` emit a property definition that **overwrites whatever TypeORM assigns**. The symptom is "my entity loads but every property is `undefined`", which looks like a database problem and isn't.

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false,     // ← required. See above.
    "strict": true,
    "strictPropertyInitialization": false // entity props are assigned by the ORM
  }
}
```

### 1.3 A static entity array, never a glob

```ts
// src/lib/db/entities/index.ts
import 'server-only';
import { AdminUser } from './admin-user.entity';
import { Staff }     from './staff.entity';
// … the rest

export const entities = [AdminUser, Staff, /* … */] as const;
```

`entities: ['src/**/*.entity.ts']` is the most common failure after decorators. Bundlers erase the filesystem, so the glob resolves to zero entities and you get "no metadata found" **in production only**.

### 1.4 External packages

```ts
// next.config.ts
const nextConfig = {
  serverExternalPackages: [
    'typeorm', 'reflect-metadata', 'pg', 'pg-query-stream', 'bcryptjs', 'pino', 'pino-pretty',
  ],
};
```

Without this, the bundler tries to statically analyse TypeORM's dynamic driver requires — mysql, oracledb, mongodb and the rest — and either warns endlessly or fails the build.

> On older Next.js versions this key lives under `experimental.serverComponentsExternalPackages`. Having it under the wrong key silently does nothing, which presents as "TypeORM randomly doesn't work".

### 1.5 The connection singleton

Two distinct failures get conflated:

1. **Concurrent initialisation** — two requests both see "not connected" and both open pools. Fixed by caching the *promise*, not the resolved connection.
2. **Stale entity classes after hot reload** — Next.js re-evaluates the server module graph, so entity classes get new object identities while the cached connection still holds the old ones. Looking up a repository then fails with "no metadata found" for a class the connection has never seen.

The fix for (2) is a module-evaluation epoch: a fresh object identity created every time the module is evaluated. If it differs from what's cached globally, the module graph was rebuilt and the cached connection is stale by definition.

```ts
// src/lib/db/data-source.ts
import 'server-only';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { types } from 'pg';
import { entities } from './entities';

// Fix PostgreSQL → JS coercion once, globally.
types.setTypeParser(1082, (v) => v);        // date    → 'YYYY-MM-DD' string, NOT a Date
types.setTypeParser(1700, (v) => v);        // numeric → string, never a lossy float
types.setTypeParser(20,  (v) => Number(v)); // int8    → number

const MODULE_EPOCH = Object.freeze({});
const g = globalThis as typeof globalThis & {
  __mj_ds?: Promise<DataSource>;
  __mj_epoch?: object;
};

export function getDataSource(): Promise<DataSource> {
  // Dev only: the module graph was rebuilt, so the cached connection holds dead classes.
  if (process.env.NODE_ENV !== 'production' && g.__mj_epoch !== MODULE_EPOCH) {
    const stale = g.__mj_ds;
    g.__mj_ds = undefined;
    g.__mj_epoch = MODULE_EPOCH;
    if (stale) void stale.then((ds) => ds.destroy()).catch(() => {});
  }

  if (!g.__mj_ds) {
    // Cache the PROMISE before awaiting, so concurrent callers share one initialise().
    g.__mj_ds = createDataSource()
      .initialize()
      .catch((err) => {
        g.__mj_ds = undefined; // a failed init must not be cached forever
        throw err;
      });
  }
  return g.__mj_ds;
}
```

`import 'server-only'` at the top means that if anyone ever imports an entity from a client component, the build fails with a readable error instead of trying to bundle TypeORM into the browser.

### 1.6 Turbopack contingency

Phase 0 must run **both** the dev server and a production build, and hit a real query, under Turbopack.

If decorators misbehave, in order: (a) confirm no entity relies on inferred types, (b) fall back to the webpack flag if the installed Next.js version still ships it, (c) switch entities to `EntitySchema`.

**Decide this in Phase 0, not in month three.**

---

## 2. Neon

### 2.1 Driver choice

**Plain `pg` against the pooled endpoint. Not the Neon serverless driver.**

That driver exists to make PostgreSQL reachable over HTTP or WebSocket from Edge runtimes. This app runs on Node, so it isn't needed. TypeORM's PostgreSQL driver also reaches into `pg` internals — `Pool`, `Client`, `types`, optional streaming, native binding probes — so aliasing it is fragile and unsupported. Bad trade.

### 2.2 Two connection strings

```bash
# App runtime — PgBouncer transaction pooling
DATABASE_URL="postgresql://…@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"

# Migrations, generation and seeds — direct compute, session-level features work
DATABASE_URL_UNPOOLED="postgresql://…@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

The `-pooler` infix is the only difference. **The project's original `.env` had only the direct form**, which is the single most reliable way to exhaust Neon connections under serverless.

### 2.3 Pool settings and why each matters

| Setting | Value | Reason |
|---|---|---|
| `max` | 3 | Each serverless instance gets its own pool, so the real number is 3 × warm instances. Behind PgBouncer, 3 is comfortable; a single request never runs 10 parallel queries |
| `idleTimeoutMillis` | 10,000 | Long-lived idle sockets against a serverless proxy get reaped underneath you, surfacing as "connection terminated unexpectedly" on the *next* query |
| `connectionTimeoutMillis` | 15,000 | **Deliberately generous.** Neon autosuspends after five minutes idle, so the first query of the morning waits for a compute cold start. A 5-second timeout produces mystifying intermittent failures |
| `keepAlive` | true | Pairs with the short idle timeout |

### 2.4 PgBouncer transaction-mode constraints

These bite silently:

- **No session-scoped `SET`, no advisory locks, no `LISTEN`/`NOTIFY`.** Row-level `SELECT … FOR UPDATE` inside a transaction is fine — which is exactly what the coin ledger uses
- **Named prepared statements aren't shared across pooled sessions.** The `pg` driver uses unnamed statements by default and TypeORM doesn't opt in, so this is safe — but never enable a "prepare" flag
- **Run migrations on the unpooled URL.** DDL through the pooler is a coin flip

### 2.5 Region

The Neon project is in `ap-southeast-1` (Singapore). Deployment platforms commonly default to a US region. TypeORM issues two to four round trips per page, so a cross-region deployment pays roughly 230 ms × N on every request.

**Pin the deployment region to Singapore.** Verify in Phase 0.

---

## 3. Migrations

A **separate CLI connection** that the app never imports. It uses the direct URL, and file globs are fine here because the CLI runs real files off disk.

```ts
// db/typeorm.config.ts — CLI ONLY
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL_UNPOOLED,   // direct endpoint, never -pooler
  ssl: { rejectUnauthorized: true },
  entities: [...entities],
  migrations: ['db/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
});
```

Scripts: `db:generate` · `db:migrate` · `db:revert` · `db:show` · `db:seed` · `db:reset`.

### 3.1 Why `synchronize: true` is off everywhere

- It issues `DROP COLUMN` when it thinks a column is gone. **Rename a property and your payment amounts are deleted.** There is no confirmation prompt
- It runs on every connection init — meaning on every serverless cold start, concurrently. Multiple instances racing DDL against one database will deadlock or corrupt
- It cannot express triggers, partial indexes, generated columns or data backfills — all of which this schema depends on

Schema changes come exclusively from generating a migration, **reading the generated SQL** (especially the down-migration, which is often generated wrong), committing it, and running it as a discrete deployment step.

### 3.2 Deployment ordering

Run migrations as a separate pipeline step *before* promoting the new build, using the unpooled URL. Never enable "run migrations on startup" in the app.

---

## 4. Layering — the core rule of this codebase

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND        src/app/**  ·  src/components/**               │
│                  Pages, layouts, client components.             │
│                  Reaches data ONLY via lib/api/client.          │
└────────────────────────────┬────────────────────────────────────┘
                             │  HTTP (fetch)
┌────────────────────────────▼────────────────────────────────────┐
│  API             src/app/api/**/route.ts                        │
│                  Authenticate → authorise → VALIDATE body,      │
│                  query and params → call a service → map errors │
│                  to HTTP. No business logic. No SQL.            │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  SERVICE         src/lib/services/**                            │
│                  Business rules. OWNS THE TRANSACTION.          │
│                  Returns DTOs. Talks to the DB only through     │
│                  repositories.                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │  EntityManager passed down
┌────────────────────────────▼────────────────────────────────────┐
│  REPOSITORY      src/lib/repositories/**                        │
│                  THE ONLY LAYER THAT TOUCHES THE DATABASE.      │
│                  One repository per entity. Never opens a       │
│                  transaction. Returns entities.                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                        PostgreSQL
```

**Each layer talks only to the one directly below it. No shortcuts.**

### 4.1 Hard rules

| # | Rule | Why |
|---|---|---|
| 1 | **The frontend never imports a service, a repository or the DataSource.** All data is read and written through `lib/api/client`. Type-only imports of DTOs are fine — they are erased at compile time | The API becomes a real contract: testable on its own, versionable, and consumable later by something that isn't this app |
| 2 | **API routes call services, never repositories.** A route that reaches a repository has skipped every business rule the service enforces | Rules live in exactly one place |
| 3 | **Services never write SQL and never call `getRepository`.** Every read and write goes through a repository | One place to change when a query is wrong |
| 4 | **One repository per entity.** A repository queries its own table only. If a service needs two entities, it calls two repositories | Prevents the "god repository" that eventually owns half the schema |
| 5 | **Repositories never call services, and never call each other.** Dependencies point one way | A cycle here becomes untestable within a month |
| 6 | **Transactions begin and end in the service layer.** Never in a repository (uncomposable), never in a route (rules leak upward) | Several repository calls commit or roll back as one unit |
| 7 | **Every repository method takes an optional `EntityManager`.** Absent → default connection. Present → join the caller's transaction | This is what makes repositories composable inside a service transaction |
| 8 | **Services return DTOs, never entities.** TypeORM entities are class instances; React's serialiser rejects them outright, and a `passwordHash` on an entity is one careless spread from the browser | Mapping once at the service boundary fixes it in one place instead of forty |
| 9 | **Every API route validates body, query and params with Zod.** No exceptions, including internal-looking routes | An unvalidated route is where the first production bug comes from |
| 10 | **Every API route declares its permitted roles.** `roles` is a required parameter of `createApiHandler` | It is impossible to write a route without deciding who may reach it |

**This is enforced automatically.** `npm run check:layering` walks `src/` and fails the build on any violation. It is part of `npm run verify`, which is what CI runs. The rule is not a convention anyone has to remember.

### 4.2 BaseRepository

Every repository extends `BaseRepository<T>`, which supplies `findById` · `findOneBy` · `findManyBy` · `exists` · `count` · `create` · `save` · `updateById` · `softDeleteById` · `restoreById` · `findByIdForUpdate` — each accepting an optional `EntityManager`.

Entity-specific queries are added as methods on the subclass:

```ts
class UserRepository extends BaseRepository<User> {
  protected readonly target = User;
  protected readonly alias = "u";

  async findByEmailWithPassword(email: string, em?: EntityManager) {
    const qb = await this.qb(em);
    return qb.addSelect("u.passwordHash")
             .where("u.email = :email", { email: email.toLowerCase() })
             .getOne();
  }
}

export const userRepository = new UserRepository();
```

Exported as a singleton instance, not a class — callers never construct one.

### 4.3 Transactions

A service opens a transaction with `withTx` and passes the `EntityManager` to every repository call inside it. **If a request writes to more than one table, it must be transactional.**

```ts
export async function changePassword(userId: string, current: string, next: string) {
  return withTx(async (em) => {
    // Row-locked: the read and the write must be atomic, or two concurrent
    // changes lose one another.
    const user = await userRepository.findByIdWithPasswordForUpdate(userId, em);
    if (!user) throw new NotFoundError("Account");
    // …validate, mutate…
    await userRepository.save(user, em);           // ← same transaction
    return { sessionVersion: user.sessionVersion };
  });
}
```

**Locking discipline:** acquire locks in a consistent order everywhere — child → parent → grandparent, and ascending id within a set. Violating this produces intermittent deadlocks that are miserable to reproduce.

### 4.4 Operations that must be transactional

| Operation | Why | Locking |
|---|---|---|
| Order create — header + lines | A partial write leaves a phantom order | — |
| **Return reconciliation** | Read-modify-write on return counters; two clerks would double-count | Lock the order row |
| **Coin issue** — header + lines + ledger rows + balance updates | The ledger and the balance must never diverge | Lock each coin type row, **in ascending id order** to prevent deadlock |
| **Coin return** | Same | Same |
| **Payment recording** | Read-modify-write on cached paid amounts | Lock the target header |
| Party order create — header + generated schedule | Half a delivery schedule is worse than none | — |
| Any write plus its audit row | Audit must be atomic with the fact it records | — |

Reads for list tables and dashboards are non-transactional.

---

## 5. The API layer

**Every read and every write crosses an HTTP API route.** Server Actions are not used for data access.

| Concern | Mechanism |
|---|---|
| Reads (server components and client) | `GET /api/…` via `lib/api/client` |
| Writes | `POST` / `PATCH` / `PUT` / `DELETE` via `lib/api/client` |
| Sign-in | `signIn()` from `next-auth/react`, which posts to `/api/auth/callback/credentials` |
| Exports | `GET /api/reports/…` returning a stream |

### 5.1 `createApiHandler`

One wrapper behind every route. It runs, in order:

1. **Authenticate** — session, or `401`
2. **Authorise** — `roles`, or `403`
3. **Validate** — `body`, `query` and `params` Zod schemas, or `422` with field errors
4. **Call the service** — the route itself contains no logic
5. **Map errors** — `AppError` carries its own HTTP status; anything else is logged in full and returned as a generic `500`, so stack traces never reach the browser

```ts
export const PATCH = createApiHandler({
  name: "PATCH /api/account/profile",
  roles: ["OWNER", "ADMIN"],          // required — no route without a decision
  body: updateProfileSchema,          // validated before the handler runs
  handler: ({ body, ctx }) => updateProfile(ctx.userId, body),
});
```

`roles` and the validation schemas are constructor parameters rather than something you remember to call, so an unguarded or unvalidated route cannot be written by accident.

### 5.2 Response envelope

Uniform, so the client has one shape to handle:

```jsonc
{ "ok": true,  "data": { … } }
{ "ok": false, "code": "VALIDATION", "messageKey": "common.fixHighlighted",
  "fieldErrors": { "email": ["auth.errors.emailInvalid"] } }
```

`messageKey` is a **message-catalogue key, never a sentence** — otherwise a Gujarati UI receives English server errors. Every response carries an `x-request-id` that also appears in the logs.

### 5.3 The API client

`lib/api/client` is the only thing the frontend imports for data. It handles the two things that are easy to get wrong when a **server component** calls the app's own API:

- **Absolute origin.** `fetch` on the server has no notion of "this site"
- **Cookie forwarding.** Without it the route sees an anonymous request and returns 401 — the single most common mistake in this pattern

Failures throw `ApiError` carrying status, code, `messageKey` and `fieldErrors`, so a form can route server-side field errors into the same `FieldError` component as client-side ones. One error-display path, not two.

### 5.4 The cost, stated plainly

A server component fetching its own API pays an extra HTTP hop compared with calling a service in-process — roughly a millisecond on localhost, more under load.

That is a deliberate trade. What it buys: the API is a real, testable contract; the data path is identical whether the caller is a page, a client component, or a future mobile app; and no rendering code can drift into holding business logic. For an internal tool at this scale the latency is irrelevant and the discipline is worth more.

If a specific page ever becomes measurably slow because of it, the fix is to cache that route's response — not to bypass the layer.

### 5.3 Revalidation

Mutations invalidate the list path, the detail path, and the cached dashboard aggregates by tag.

List pages read search parameters, so they re-run per request anyway — the reason to still invalidate them is the **client-side router cache**, without which navigating back to a list after an edit can show a stale snapshot.

Dashboards are the opposite: expensive aggregates you *want* cached, with a short revalidation window and tag-based invalidation from mutations.

---

## 6. The shared DataTable

Built **once, before the second module**, and used by nine.

### 6.1 The contract

Each module declares a table config:

- `sortable` — a map from public sort key to a **hard-coded SQL column string**
- `searchable` — the columns included in free-text search
- `filters` — a map from filter key to a validation schema
- defaults for sort, page size and maximum page size

### 6.2 The injection defence is structural

User input is only ever used as a **lookup key into the allowlist**, never as a value that reaches SQL. `?sort=id;DROP TABLE staff` simply misses the map and falls back to the default sort. Unknown filter keys are dropped; known ones are schema-validated.

There is no escaping to get wrong, because nothing user-supplied is ever interpolated.

### 6.3 Two details that are expensive to fix later

**Use skip/take, not offset/limit.** When a query joins a to-many relation, `LIMIT 10` limits *joined rows* — so page 1 might show 3 orders. Skip/take makes the ORM run a two-phase distinct-id subquery and paginate entities correctly. Centralised in the shared helper so module code never paginates by hand.

**Always add a stable tiebreaker.** Sorting by a non-unique column without one lets equal-valued rows shuffle between pages, so users see the same record twice and miss another entirely. Every sort appends an id ordering.

### 6.4 Client side

TanStack Table in fully manual mode — manual pagination, sorting and filtering — rendered through the component library's table primitives. All state lives in the URL via a shared hook, so views are shareable and browser navigation works.

While the server re-queries, the table body dims rather than being replaced by a skeleton. The data stays on screen, which reads as fast rather than as reloading. The search input debounces before updating the URL.

---

## 7. Validation and forms

Validation schemas live in their own module, imported by **both** the client form and the server action. They import nothing server-side, so they're safe in both places.

**react-hook-form** with a schema resolver, through the component library's form components. Chosen because order lines and party schedules are dynamic field arrays, which is painful with anything else.

**Server-side field errors are piped back into the form's error state**, so one message component renders both client and server errors. There is no second error-display code path — which is where localisation and styling usually diverge.

Error messages are **keys**, resolved through the active language catalogue. See [I18N.md](I18N.md) §5.4.

---

## 8. UI

**Tailwind + shadcn/ui + Lucide**, confirmed. For a nine-module CRUD admin tool this is close to optimal: you own the component source, so a deeply customised table isn't fighting a library; Radix provides the accessibility the design system demands; and Lucide is already the default icon set, matching the design document.

The alternative — a batteries-included data grid — is rejected because the table needs here are server-driven and modest, and a grid library would pull in a second, conflicting design language.

### 8.1 Design tokens

The critical move: **define the component library's semantic token names using NovaSpark values** rather than inventing a parallel token set. Every component is then on-brand with zero per-component overrides.

| Design system element | Mapping |
|---|---|
| Nova Blue `#2563EB` | `--primary`, `--ring`, sidebar active |
| Spark Red / Green / Orange | `--destructive`, `--success`, `--warning` |
| Gray 900 / 600 / 300 / 100 | `--foreground`, `--muted-foreground`, `--input`, `--muted` |
| 4px spacing scale | **Maps 1:1 onto Tailwind's default scale** — no custom config needed |
| Radius 4 / 8 / 12 / 16 | `--radius-sm` … `--radius-xl` |
| Shadow sm/md/lg/xl | Verbatim |
| Type scale Display → Caption | Custom text sizes |
| Sidebar 240px / 64px | Sidebar width tokens |
| Dark mode mapping table | Applied directly, with Nova Blue lifted one step to hold 4.5:1 contrast on the dark background |

Fonts: Inter, plus **Noto Sans Gujarati** in the stack — see [I18N.md](I18N.md) §5.3. Money columns use the monospace font with tabular numerals so digits align down the page.

One status badge component with a variant map from domain status to token pair, so a settled record is the same green in every module.

---

## 9. Money and dates

### 9.1 Money

`numeric(12,2)` in the database, returned as a **string** by the driver, and formatted for display. **All arithmetic happens in SQL** — generated columns, triggers, aggregates.

The alternative approach of integer paise with JavaScript arithmetic was considered and rejected here, because this schema deliberately puts every rollup in the database. Adding a paise convention would protect JavaScript arithmetic that shouldn't exist in the first place, while making every column name and DTO field noisier.

**The rule that makes this safe:** a `reduce((a, b) => a + b)` over monetary values in TypeScript is a code-review failure. If a total is needed, it comes from SQL.

Caveat for raw dashboard queries: `SUM` over a numeric returns a numeric, which the driver keeps as a string. Convert explicitly at the boundary.

### 9.2 Dates

The trap: drivers decode a date column into a local-midnight timestamp. On a UTC server, a delivery date of `2026-08-05` becomes a moment that, after any arithmetic and re-serialisation, can land on `2026-08-04`. Party schedules would be off by a day and nobody would notice for weeks.

**The fix is a global type parser** that leaves date columns as `'YYYY-MM-DD'` strings. Database → ORM → DTO → JSON → React → date input all speak the same string. No timezone exists to get wrong.

Calendar arithmetic (generating a party schedule) operates on the strings. Display formatting converts to IST and localises month names. The server runs in UTC so the local zone can never leak into anything.

---

## 10. Errors, logging and auth

### 10.1 Errors

A small error hierarchy — not found, conflict, forbidden, insufficient stock, validation — each carrying a code, an HTTP status, a **user-safe message**, and structured metadata.

Services throw these. The action wrapper is the only place that catches them. Unknown errors are logged with context and returned as a generic message.

### 10.2 Logging

Structured logging with **redaction configured for passwords, tokens, cookies and the database URL**. A payment payload accidentally logged whole is how credentials leak.

Every mutation logs actor, action, entity, id and duration.

Separately, an **audit table** — because this is a money application and log files get rotated away. Audit rows are written inside the same transaction as the change they record.

### 10.3 Auth

Auth.js with credentials, bcrypt (the pure-JS build, so there are no native bindings to break under serverless bundling), and JWT sessions with no database adapter — which keeps session verification runnable in middleware without a database call.

**The split-config pattern is mandatory.** Middleware runs at the Edge and cannot load TypeORM or bcrypt, so the configuration is split: an Edge-safe half with the session callbacks and no providers, used by middleware; and a Node-only half that adds the database-backed credentials provider.

Even where a newer framework version allows a Node runtime in middleware, keep the split — a middleware that *cannot* reach the database is a middleware nobody can accidentally put business logic into.

The login check does constant-ish work whether or not the user exists, so timing can't be used to enumerate accounts.

### 10.4 Role gating — three layers

| Layer | Mechanism | Purpose |
|---|---|---|
| Navigation | Sidebar hides links the role can't use | UX only, never a control |
| Route | Middleware plus a role check per protected segment | Blocks casual URL access |
| **Action / service** | Required role list in the action wrapper | **The actual security boundary** |

---

## 11. Project structure

```
db/                          ← CLI only; the app never imports this
  typeorm.config.ts          migration connection, unpooled URL
  migrations/
  seed.ts  seed-data/  reset.ts

src/
  instrumentation.ts         warm the pool at boot, not on first request
  middleware.ts              Edge; auth config only — never imports the database
  auth.ts  auth.config.ts    Node half / Edge half

  app/
    (app)/                   authenticated shell — sidebar, topbar, node runtime
      page.tsx               executive dashboard
      staff/  products/  orders/  coins/  party-orders/
      direct-sales/  expenses/  reports/
    login/
    api/                     THE ONLY server-side entry point for data
      account/  auth/  dashboard/  …

  components/
    ui/                      component library primitives
    data-table/              THE shared table — built once, used nine times
    form/  layout/  common/

  lib/
    api/                     client.ts (FE→API), handler.ts (route wrapper), routes.ts
    db/                      data-source, transactions, entities
    repositories/            base.repository.ts + one per entity — ONLY layer touching the DB
    services/                business rules, transactions, DTO mapping
    dto/  validation/  table/
    money.ts  dates.ts  errors.ts  logger.ts

scripts/
  check-layering.mjs         fails the build on any layering violation

messages/
  en.json  gu.json
```

Each module folder follows the same shape — list page, columns, filters, actions, new, detail, edit, form component — so the ninth module is written the same way as the second.

---

## 12. Testing

**Tier 1 — pure unit tests.** Fast, run on every save. This is where the bugs that cost money live, and all of them are pure functions by design:

- Currency parsing and formatting, including Indian lakh grouping and Latin digits under both locales
- Calendar arithmetic — month ends, leap day, year boundaries, single-day ranges
- **Table query parsing, with explicit injection attempts** — `?sort=id;DROP TABLE staff`, prototype keys, absurd page sizes, negative pages, unknown filters
- Payment allocation and coin ledger delta arithmetic

**Tier 2 — service integration tests against a real database.** Transactions, locks and constraints cannot be proven against a mock. Locally via Docker; in CI via a **Neon branch per run** — a copy-on-write clone of the production schema in seconds, which is also how risky migrations get rehearsed.

Must-have cases:
- **Two concurrent coin issues of the last ten coins — exactly one succeeds**
- Return reconciliation under concurrent submissions
- Payment allocation atomicity: force a mid-transaction failure, assert nothing persisted
- The coin ledger balance invariant after a randomised sequence of 200 operations
- Price change after order creation leaves the line total unchanged

**Tier 3 — browser tests, four flows only:** login; order → issue → return → payment → settled; coin issue → return → ledger balances; table search + filter + sort + page 2 surviving a reload.

Component tests for CRUD forms are skipped — low value, high churn. The DataTable itself *is* tested, because nine modules depend on it.

---

## 13. Seed data

Idempotent (upsert by natural key, safe to re-run), deterministic (a fixed random seed, so "the bug on Ramesh's third order" reproduces on every machine), and **realistic** — Gujarati and Hindi names, ten-digit phone numbers, genuine jar and bottle sizes, plausible coin denominations. Testing money formatting with English names and dollar amounts misses the Indian grouping bugs, and testing with English-only names misses every Gujarati rendering bug.

Two details that matter:

1. **Seed transactional data through the real services, not raw inserts.** A seed that writes ledger rows directly can produce an unbalanced ledger, and you'll lose a day debugging a bug that exists only in seed data. Going through the service also exercises it two hundred times before a human touches it
2. **Seed enough — 400 orders, not 5.** Pagination, sort stability, search and slow queries are invisible at five rows and obvious at four hundred. Volume is the cheapest performance test available

The reset script must refuse to run unless the target host is local or a database branch. One reset against the wrong environment is a very bad afternoon.

---

## 14. Risk register

| # | Risk | Mitigation |
|---|---|---|
| 1 | Decorator metadata unsupported by esbuild, flaky under Turbopack → "column type not defined" | Explicit types in every decorator; lint rule banning bare `@Column()`; proven in Phase 0 across dev, build and CLI; `EntitySchema` as escape hatch |
| 2 | `useDefineForClassFields` defaults true → entity properties silently undefined | Set false explicitly, with a comment explaining why |
| 3 | Entity globs resolve to nothing once bundled → fails in production only | Static array in a barrel; never a glob under `src/` |
| 4 | Hot-reload leaves stale entity classes | Module-epoch invalidation |
| 5 | Concurrent cold starts open duplicate pools | Cache the promise; clear it on rejection |
| 6 | **The existing `.env` uses the direct endpoint** → connection exhaustion | Pooled host for the app, direct only for migrations |
| 7 | Neon autosuspend → first request of the day times out | Generous connect timeout; warm at boot; disable autosuspend once in real use |
| 8 | Cross-region deployment → hundreds of ms per round trip | Pin the region to Singapore; verify in Phase 0 |
| 9 | Pooler is transaction-mode — no advisory locks, no session `SET` | Row-level locking only, which is what the design uses; migrations on the direct URL |
| 10 | `synchronize: true` drops columns silently | Off in both connections, permanently |
| 11 | Entities are class instances → "only plain objects" serialisation error | Services return DTOs; `server-only` imports make violations fail at build |
| 12 | Numeric and bigint return strings; `SUM` returns numeric | Global type parsers; explicit conversion in raw queries |
| 13 | Date columns decoded as local midnight → schedules off by one | Global parser keeps dates as strings |
| 14 | Offset/limit with to-many joins → wrong page sizes | Centralised in the shared helper |
| 15 | Sort parameters interpolated into SQL | Allowlist keys; explicit injection tests |
| 16 | Server Actions are unauthenticated POST endpoints by default | Wrapper requires session and roles |
| 17 | Middleware runs at Edge and can't import the ORM | Split auth config |
| 18 | Local Node version ahead of the deploy target | Pin the engine version and match locally |
| 19 | **Live credentials one `git add .` from permanent history** | `.gitignore` added; password must be rotated |
| 20 | Rows shuffle between pages on non-unique sorts | Stable tiebreaker in the shared helper |
| 21 | TypeORM's long-term maintenance trajectory | Kept behind repositories and DTOs; services never import ORM types beyond the transaction manager. Swapping ORMs becomes a repository rewrite, not an app rewrite |
| 22 | Trigram search degrades once orders reach five figures | GIN indexes on every searchable column, added with each module |
| 23 | **Gujarati renders as boxes in PDF exports** | Embed a Gujarati font subset; verify complex-script shaping in Phase 1, not at the end |
| 24 | Gujarati CSV shows as mojibake in Excel | UTF-8 with byte-order mark |
| 25 | Layouts break under longer Gujarati strings | Every screen checked in both languages as it is built |

---

## 15. Build order

Sequencing principle: **prove every unknown before building on top of it.** The three unknowns are the ORM surviving the bundler in a production build, the shared table generalising across nine modules, and the coin ledger staying balanced under concurrency.

| Phase | Work | Exit criteria |
|---|---|---|
| **0** | `.gitignore` and rotated credentials. One trivial entity, the connection singleton, the migration CLI, one list page | Dev server works · edit an entity and reload twice with no metadata error · production build works · migration generation works under the CLI toolchain · deployed and working in the Neon region. **Nothing else starts until all five are green.** If any fail, spend the time here — do not proceed with a workaround you don't understand |
| **1** | Design tokens, both fonts, component library, app shell, bilingual setup with a language switcher, money/date/error/logging utilities, the action wrapper, auth and login | Log in, get bounced when signed out, dark mode with no flash, **Gujarati shell with correct shaping and Latin digits**, and a Gujarati name rendering correctly in a test PDF |
| **2** | The shared DataTable + **Staff** end to end | Staff complete, table code contains **zero** Staff-specific logic, Gujarati input works through the full path. Write down the "add a module" recipe |
| **3** | Products, coin types, expense categories | Each takes a fraction of the time Staff took. If not, the Phase 2 abstraction is wrong — fix it while only three modules depend on it |
| **4** | **Coin ledger** — issues, returns, payments, adjustments, ledger view, reconciliation | Two simultaneous issues of the last ten coins, exactly one succeeds |
| **5** | Delivery orders — items, returns, payments. Coin payments call into Phase 4, which is why coins came first | The four PRD scenarios pass as integration tests |
| **6** | Party orders, schedule builder, calendar | |
| **7** | Direct sales, expenses | Nearly mechanical by now |
| **8** | Dashboards, reports, CSV and PDF exports | Coin reconciliation banner live; Gujarati verified in a real PDF |
| **9** | Hardening — index tuning from real query plans, audit UI, backups, browser smoke suite | |

Phases 0, 2 and 4 carry the risk. Everything after Phase 5 is repetition.
