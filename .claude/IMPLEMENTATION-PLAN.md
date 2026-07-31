# Implementation Plan

How the app gets built, in what order, and what "done" means at each step.

Requirements live in [PRD.md](PRD.md) · schema in [DATA-MODEL.md](DATA-MODEL.md) · technical decisions in [ARCHITECTURE.md](ARCHITECTURE.md) · visual rules in [design/DESIGN-STANDARDS.md](design/DESIGN-STANDARDS.md).

---

## Sequencing principle

**Prove every unknown before building on top of it.** Three things could derail this project, and all three are front-loaded:

| Unknown | Proven in | Why it's risky |
|---|---|---|
| TypeORM surviving Next.js's bundler in a production build | Phase 0 | Decorator metadata is unreliable under Turbopack and unsupported by esbuild. Fails in ways that look random |
| The shared DataTable generalising across nine modules | Phase 2 | If the abstraction is wrong, you find out at module seven and rewrite eight |
| The coin ledger staying balanced under concurrency | Phase 4 | Silent corruption in the module the whole business runs on |

Everything after Phase 5 is repetition.

---

## Phase 0 — Foundation

**Goal:** a running Next.js app that reads and writes the database through TypeORM, in dev *and* in a production build.

| Step | Deliverable |
|---|---|
| 0.1 | `package.json`, `tsconfig.json`, `next.config.ts`, PostCSS, `.nvmrc` |
| 0.2 | NovaSpark tokens as Tailwind theme + CSS variables, light and dark |
| 0.3 | TypeORM DataSource singleton — promise-cached, HMR-safe, pg type parsers |
| 0.4 | `User` entity + entities barrel (static array, never a glob) |
| 0.5 | CLI DataSource on the **unpooled** URL, migration scripts |
| 0.6 | First migration — `pgcrypto`, `user_role` enum, `users` table |
| 0.7 | Seed script creating the owner account |

### Exit criteria — all five, or Phase 1 does not start

- [ ] `npm run dev` serves a page that reads from the database
- [ ] Edit an entity, save, reload twice → **no** `EntityMetadataNotFoundError`
- [ ] `npm run build && npm start` works
- [ ] `npm run db:generate` succeeds under the esbuild-based CLI
- [ ] A row written from the app is visible in the Neon console

> If any fail, fix it here. Do not proceed with a workaround you don't understand — see [ARCHITECTURE.md](ARCHITECTURE.md) §1.6 for the decorator fallback ladder.

---

## Phase 1 — Auth & shell ⬅ *current target*

**Goal:** you can sign in, the app remembers your language and theme, and every other route is protected.

| Step | Deliverable | Spec |
|---|---|---|
| 1.1 | `next-intl` without routing, `messages/en.json` + `messages/gu.json` | [I18N.md](I18N.md) |
| 1.2 | Fonts — Inter + JetBrains Mono + **Noto Sans Gujarati** | [design/DESIGN-STANDARDS.md](design/DESIGN-STANDARDS.md) §2.2 |
| 1.3 | UI primitives — button, input, label, checkbox, card, alert, dialog, badge | [design/COMPONENT-INVENTORY.md](design/COMPONENT-INVENTORY.md) |
| 1.4 | Error hierarchy, logger, `createAction` wrapper | [ARCHITECTURE.md](ARCHITECTURE.md) §5.2, §10 |
| 1.5 | Auth.js split config — Edge-safe half + Node half | [ARCHITECTURE.md](ARCHITECTURE.md) §10.3 |
| 1.6 | `middleware.ts` protecting everything but `/login` | |
| 1.7 | Login page + form, all states | [design/MODULES/00-auth.md](design/MODULES/00-auth.md) §3 |
| 1.8 | App shell — 240px sidebar, 64px topbar, user menu, language + theme toggles | [design/DESIGN-STANDARDS.md](design/DESIGN-STANDARDS.md) §3 |
| 1.9 | Account settings + change-password modal | [design/MODULES/00-auth.md](design/MODULES/00-auth.md) §6–7 |
| 1.10 | Rate limiting — 5 failures per IP per 15 min | [MODULES/00-auth.md](MODULES/00-auth.md) §5.2 |

### Exit criteria

- [ ] Sign in with the seeded account; wrong details give the **identical** message either way
- [ ] Signed-out access to `/` redirects to `/login`, then returns to `/` after signing in
- [ ] Switching to ગુજરાતી translates the whole shell, with correct script shaping and Latin digits
- [ ] Dark mode toggles with no flash of the wrong theme on reload
- [ ] Change password works and invalidates other sessions
- [ ] Sixth failed attempt is rate-limited with a live countdown
- [ ] Screens match [design/MODULES/00-auth.md](design/MODULES/00-auth.md) at the §9 checklist level

---

## Phase 2 — DataTable + Staff

The reference module. Build `lib/table/*` and `components/data-table/*` first, then Staff end-to-end.

**Exit:** Staff is complete and the table code contains **zero** Staff-specific logic. A Gujarati name survives create → search → sort → detail → edit. Write down the "add a module" recipe, including its catalogue keys — you're about to run it eight more times.

## Phase 3 — Masters

Products · coin types · expense categories. Each should take a fraction of the time Staff took. **If it doesn't, the Phase 2 abstraction is wrong — fix it now**, while only three modules depend on it.

## Phase 4 — Coin ledger

Issues, returns, payments, adjustments, ledger view, reconciliation. Deliberately before orders, because order payments in coins write to this ledger.

**Exit:** a test fires two simultaneous issues of the last ten coins and proves exactly one succeeds.

## Phase 5 — Delivery orders

Items, returns, payments, cross-order return attribution.

**Exit:** the four [PRD.md](PRD.md) §8 scenarios pass as integration tests — including the one where an order total *decreases* when unsold jars come back.

## Phase 6 — Party orders
Schedule builder, day cards, calendar, partial payments.

## Phase 7 — Direct sales + Expenses
Should be nearly mechanical by now.

## Phase 8 — Dashboards + Reports
Charts, KPI grid, the seven reports, CSV and PDF. **Verify Gujarati in a real generated PDF** — font embedding and complex-script shaping both.

## Phase 9 — Hardening
Index tuning from real query plans, audit log UI, backups, browser smoke suite.

---

## Standing rules

These apply to every phase and are not negotiable per-module.

| Rule | Why |
|---|---|
| **Explicit types in every TypeORM decorator** — never bare `@Column()` | esbuild never emits decorator metadata. Bare decorators work in the app and fail in the migration CLI |
| **`synchronize: false` everywhere**, migrations only | It issues `DROP COLUMN` with no prompt and races across cold starts |
| **Frontend never imports a service, repository or the DataSource** | All data flows FE → API → Service → Repository → DB. Enforced by `npm run check:layering` |
| **Every API route validates body, query and params** | An unvalidated route is where the first production bug comes from |
| **Every API route declares its permitted roles** | `roles` is a required parameter, so an unguarded route can't be written |
| **Only repositories touch the database** | One per entity. Services never call `getRepository` or write SQL |
| **Services return DTOs, never entities** | React's server-component serialiser rejects class instances outright |
| **Transactions live in the service layer** | Not repositories (uncomposable), not route handlers (rules leak upward). Any request writing to 2+ tables must be transactional |
| **Money maths happens in SQL** | A `reduce((a,b) => a+b)` over amounts is a code-review failure |
| **Business dates are `'YYYY-MM-DD'` strings** | Never a `Date`. Prevents the silent off-by-one-day |
| **Sort keys are allowlisted** | User input is a lookup key, never a string reaching SQL |
| **Every API route re-checks the session and role** | They are public endpoints; middleware is not the boundary |
| **No hardcoded user-facing strings** | Every one goes through the message catalogues |
| **No `[A-Za-z]` regex on any name, address or note field** | Silently blocks Gujarati input |

---

## Repository layout

```
db/                        CLI only — the app never imports this
  typeorm.config.ts        migration DataSource, unpooled URL
  migrations/
  seed.ts  reset.ts

src/
  instrumentation.ts       warm the pool at boot
  middleware.ts            Edge — auth config only, never the DB
  auth.ts  auth.config.ts  Node half / Edge half
  i18n/request.ts

  app/
    layout.tsx  globals.css
    login/
    (app)/                 authenticated shell
      page.tsx             dashboard
      settings/account/
    api/auth/[...nextauth]/

  components/
    ui/                    primitives
    data-table/            the shared table (Phase 2)
    layout/                sidebar, topbar, user menu, toggles
    common/                status badge, money, page header

  lib/
    db/                    data-source, entities, transactions
    repositories/  services/  dto/  validation/  actions/  table/
    money.ts  dates.ts  errors.ts  logger.ts  utils.ts

messages/
  en.json  gu.json
```

---

## Environment

Two connection strings, and the difference matters:

| Variable | Host | Used by |
|---|---|---|
| `DATABASE_URL` | **pooled** (contains `-pooler`) | The app |
| `DATABASE_URL_UNPOOLED` | direct | Migrations, generation, seeds |

The app on the direct host exhausts Neon's connection limit under serverless. DDL through the pooler is unreliable. See [ARCHITECTURE.md](ARCHITECTURE.md) §2.2.

Template in [`.env.example`](../.env.example).

---

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build — **run before every phase sign-off** |
| `npm run db:generate -- db/migrations/Name` | Generate a migration from entity changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:revert` | Roll back the last one |
| `npm run db:seed` | Seed reference data and the owner account |
| `npm run typecheck` | Types only, no build |
| `npm run check:layering` | Fails on any layering violation |
| `npm run verify` | typecheck + layering + build — **run before every phase sign-off** |

**Always read generated migration SQL before committing it** — the down-migration in particular is often generated wrong.
