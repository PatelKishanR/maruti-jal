# Maruti Jal — Business Management App

Internal admin web app for **Maruti Jal**, a mineral-water plant supplying water through three channels:

1. **Route delivery** — staff load jars, deliver them, and return with empties, cash and coins
2. **Party / event orders** — multi-day delivery schedules for weddings, functions and corporate events
3. **Direct walk-in supply** — customers fill their own containers at the plant

The app exists to answer four questions at any moment:

> How much cash is outstanding? How many jars are out? How many coins are unaccounted for? Is the business actually profitable?

---

## Status

**Planning and design specification complete. No application code has been written yet.**

This repository currently contains requirements and design documentation only. Implementation begins after review and sign-off.

---

## Documentation

Everything lives under [`.claude/`](.claude/).

### Requirements

| Document | What's in it |
|---|---|
| [.claude/PRD.md](.claude/PRD.md) | Product requirements — context, locked decisions, cross-cutting rules, verification plan, build order |
| [.claude/MODULES/](.claude/MODULES/) | One functional spec per module: user stories, screens, forms, tables, business rules |
| [.claude/DATA-MODEL.md](.claude/DATA-MODEL.md) | Database schema — entities, columns, relations, enums, indexes, integrity rules |
| [.claude/ARCHITECTURE.md](.claude/ARCHITECTURE.md) | Next.js + TypeORM + Neon wiring, layering, DataTable pattern, risk register |
| [.claude/I18N.md](.claude/I18N.md) | Bilingual (English + Gujarati) strategy |

### Design

| Document | What's in it |
|---|---|
| [.claude/design/STITCH-WORKFLOW.md](.claude/design/STITCH-WORKFLOW.md) | **Start here to design.** Step-by-step process for building the screens in Stitch — what to paste, in what order, and how to keep it consistent |
| [.claude/design/DESIGN-STANDARDS.md](.claude/design/DESIGN-STANDARDS.md) | **The design authority.** Every screen in the app follows this — layout system, components, states, tables, forms, badges, charts, motion, accessibility |
| [.claude/design/COMPONENT-INVENTORY.md](.claude/design/COMPONENT-INVENTORY.md) | Every reusable component with variants, sizes and states — **build this set in Stitch first**, before any screen |
| [.claude/design/novaspark-design-system.md](.claude/design/novaspark-design-system.md) | The underlying NovaSpark tokens — colours, type scale, spacing, shadows |
| [.claude/design/MODULES/](.claude/design/MODULES/) | Screen-by-screen UI specs per module, each with a ready-to-paste Stitch prompt |

**Start with [.claude/PRD.md](.claude/PRD.md) for what the app does, and [.claude/design/DESIGN-STANDARDS.md](.claude/design/DESIGN-STANDARDS.md) for how it looks.**

---

## Modules

| # | Module | Purpose | Spec | Design |
|---|---|---|---|---|
| 0 | Auth & Account | Sign in, password, language and theme preferences | [spec](.claude/MODULES/00-auth.md) | [design](.claude/design/MODULES/00-auth.md) |
| 1 | Staff | Delivery people, and what each one owes | [spec](.claude/MODULES/01-staff.md) | [design](.claude/design/MODULES/01-staff.md) |
| 2 | Products | What you sell and what it costs | [spec](.claude/MODULES/02-products.md) | [design](.claude/design/MODULES/02-products.md) |
| 3 | Delivery Orders | Jar issue, returns, cash/coin collection | [spec](.claude/MODULES/03-delivery-orders.md) | [design](.claude/design/MODULES/03-delivery-orders.md) |
| 4 | Coins | Token types, issues, returns, stock ledger | [spec](.claude/MODULES/04-coins.md) | [design](.claude/design/MODULES/04-coins.md) |
| 5 | Party Orders | Event bookings with multi-day schedules | [spec](.claude/MODULES/05-party-orders.md) | [design](.claude/design/MODULES/05-party-orders.md) |
| 6 | Direct Sales | Walk-in customers, cash only | [spec](.claude/MODULES/06-direct-sales.md) | [design](.claude/design/MODULES/06-direct-sales.md) |
| 7 | Expenses | Outgoings by category, so profit is real | [spec](.claude/MODULES/07-expenses.md) | [design](.claude/design/MODULES/07-expenses.md) |
| 8 | Dashboards | Per-module KPIs plus an executive view | [spec](.claude/MODULES/08-dashboards.md) | [design](.claude/design/MODULES/08-dashboards.md) |
| 9 | Reports & Exports | Statements, reconciliations, CSV and PDF | [spec](.claude/MODULES/09-reports.md) | [design](.claude/design/MODULES/09-reports.md) |

---

## Designing in Stitch

**Follow [STITCH-WORKFLOW.md](.claude/design/STITCH-WORKFLOW.md)** — it's the full step-by-step process.

The short version: **do not paste the standards or NovaSpark files into Stitch.** They're too long and get diluted. Instead, run the component-sheet prompt from [COMPONENT-INVENTORY.md](.claude/design/COMPONENT-INVENTORY.md) §15 first, screenshot the result, then attach that screenshot to every subsequent prompt. Each screen section in the module files ends with a self-contained **Stitch prompt** block written for exactly this.

**Module order** — Auth as a quick warm-up, then Staff, because Staff establishes the list / detail / form pattern that seven other modules reuse:

`00 Auth → 01 Staff → 02 Products → 06 Direct Sales → 07 Expenses → 03 Delivery Orders → 04 Coins → 05 Party Orders → 08 Dashboards → 09 Reports`

If a module design ever contradicts [DESIGN-STANDARDS.md](.claude/design/DESIGN-STANDARDS.md), the standards win. New patterns go into the standards first, so the other eight modules can use them.

---

## Intended stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) — frontend and backend |
| ORM | TypeORM |
| Database | Neon serverless PostgreSQL |
| UI | Tailwind CSS + shadcn/ui + Lucide icons |
| Forms | react-hook-form + Zod |
| i18n | next-intl (English + Gujarati) |
| Auth | Auth.js v5, credentials, single admin account |

Decisions and reasoning in [.claude/ARCHITECTURE.md](.claude/ARCHITECTURE.md).

---

## ⚠️ Outstanding security item

**The Neon database password needs to be rotated.**

The original `.env` held the live connection string in plaintext in a repository with no `.gitignore`. A `.gitignore` and `.env.example` have been added, so the secret will not enter git history — but the password itself was exposed and should be considered compromised.

1. Neon console → your project → **Roles** → reset the password for `neondb_owner`
2. Copy `.env.example` to `.env.local`
3. Fill in **both** connection strings:
   - `DATABASE_URL` — the **pooled** host (contains `-pooler`), used by the app
   - `DATABASE_URL_UNPOOLED` — the **direct** host, used only by migrations and seeds
4. Delete the old `.env`

Using the direct host as the app's runtime connection is the most common way to exhaust Neon's connection limit under serverless. Full explanation in [.claude/ARCHITECTURE.md](.claude/ARCHITECTURE.md) §2.

---

## Getting started

Nothing to run yet — the app has not been scaffolded. Once implementation begins, this section will cover install, migrations, seeding and the dev server.
