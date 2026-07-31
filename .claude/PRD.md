# Maruti Jal — Product Requirements

**Status:** Draft for owner sign-off
**Scope:** Requirements only. No implementation has begun.

---

## 1. Context

Maruti Jal is a mineral-water plant that supplies water three ways: delivery staff take loads of jars out on a route and bring back empties plus cash; event and party clients order across multiple days; and walk-in customers fill their own containers at the plant.

Today all of it — who took how many jars, who returned what, who owes money, how many prepaid coins are in circulation — lives in registers and in memory. Money and jars leak in the gaps between them.

This project builds an internal admin web app so the owner can answer at any moment:

> **How much cash is outstanding? How many jars are out? How many coins are unaccounted for? Is the business actually profitable?**

### 1.1 Goals

| Goal | How the app delivers it |
|---|---|
| Nothing leaves the plant unrecorded | Every jar, coin and rupee moves through a transaction record |
| Outstanding money is always visible | Cached payment status on every order, filterable in one click |
| Outstanding jars are always visible | Independent return tracking with its own status and filter |
| Coins reconcile to the last token | Append-only ledger per coin type with a running balance |
| Profit is knowable, not guessed | Expenses module feeding an executive P&L view |
| The owner can use it in Gujarati | Full bilingual UI, screens and printed documents |

### 1.2 Non-goals for version 1

Physical jar/bottle stock reconciliation · staff mobile app or logins · an end-customer master with per-customer ledgers · GST invoicing · future-dated price changes · SMS/WhatsApp reminders · route planning · multi-plant support.

These are recorded in §9 so the schema stays additive rather than needing a rewrite when they arrive.

---

## 2. Decisions locked with the owner

Each of these was an open question that materially changes the design. All are settled.

| # | Decision | Choice | Consequence |
|---|---|---|---|
| D1 | Deliverable for this round | **Documents only** | No code until this PRD is signed off |
| D2 | Who logs in | **A single admin account** | Staff are records, not users. A `role` column exists from day one so more logins are config later, not a migration |
| D3 | Order granularity | **Staff-level** | An order is a daily loading slip against a staff member. No end-customer master |
| D4 | Extra modules | **Expenses** and **Reports & Exports** included | Physical jar stock deferred to future scope |
| D5 | Unsold filled jars | **Staff is billed only for what he sold** | Filled returns are credited back, so an order total *decreases* as unsold jars come home. This is why rollups must be database-maintained |
| D6 | GST / tax | **None** | All prices are final amounts. Adding tax later is a real data migration, not a tweak — this decision is deliberate, not deferred |
| D7 | Cross-order jar returns | **Attributed to the original order line** | The return screen lists every open line for that staff member across all past orders, so old orders actually close. A per-staff running jar balance is also shown as the headline operational number |
| D8 | Coin pricing | **Staff owe full face value** | No staff margin on coins; a ₹1,000 packet is a ₹1,000 debt |
| D9 | Languages | **English + Gujarati**, whole platform | See §5 and [I18N.md](I18N.md) |
| D10 | Typed data | **One free-text field, any script** | Never paired English/Gujarati columns. A product has one title; type it in whichever script you prefer |
| D11 | Numbers and money | **Latin digits always** | `₹1,23,456.00` in both languages — easier to cross-check against registers, bank statements and UPI apps |
| D12 | Exports | **Gujarati must render in PDF and CSV** | Needs an embedded Gujarati font and UTF-8 BOM handling |

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **Staff** | A delivery person who takes jars out and returns with empties, cash and coins. Does not log in |
| **Product** | A sellable container type — e.g. a 20-litre cold double-filtered jar |
| **Delivery Order** | A daily loading slip: staff X took these items on this date. The core operational record |
| **Return** | A later event recording jars coming back against an order line, split into empty / filled / lost |
| **Coin** | The company's own prepaid token. Customers buy coins with cash, then pay for water with coins |
| **Coin Type** | A coin denomination — name, packet size, packet price. Per-coin value is derived |
| **Coin Issue** | Admin hands packets of coins to a staff member to sell. Creates a debt from staff to company |
| **Coin Ledger** | The append-only record of every coin movement, per coin type |
| **Party Order** | An event booking with a multi-day delivery schedule |
| **Direct Sale** | A walk-in who fills their own container and pays cash on the spot |

---

## 4. Cross-cutting requirements

Built once as shared infrastructure and used by every module. Getting these right is most of the project.

### 4.1 The standard module shape

Every module ships the same five surfaces, so learning one teaches all nine:

1. **List page** — server-side search, filters, multi-column sort, pagination, status badges, row actions
2. **Create form** — validated on both client and server
3. **Edit form** — same schema, pre-filled, writes a revision
4. **Detail page** — read-only summary, related records, activity timeline
5. **KPI strip** — three to five cards at the top of the list page

### 4.2 Shared list behaviour

- All list state lives in the **URL** (`?q=&page=&sort=&dir=&status=…`). Views are shareable, browser back/forward works, and "here's the link to Ramesh's unsettled orders" becomes a real workflow
- One free-text search box per module, matching that module's designated columns
- Sort columns are **allowlisted server-side** — user input is only ever a lookup key, never a string that reaches SQL
- Page sizes 10 / 25 / 50 / 100, default 25
- Every list has **Export CSV**, respecting the filters currently applied
- Standard empty, loading and error states across all modules

### 4.3 Money

- Stored as `numeric(12,2)`. Never float, never `real`. Per-coin rates that divide use `numeric(14,6)`
- **All monetary arithmetic happens in PostgreSQL** — generated columns, triggers, SQL aggregates. TypeScript formats money; it never sums it. A `reduce((a, b) => a + b)` over amounts is a code-review failure
- Displayed as `₹1,23,456.00` with Indian lakh grouping, in a monospace `tabular-nums` right-aligned column so digits line up down the page

### 4.4 Dates

- Business dates (order date, delivery date, expense date) are `date` columns, carried as `'YYYY-MM-DD'` **strings** end to end. Database → ORM → DTO → JSON → React → `<input type="date">` all speak the same string, so there is no timezone to get wrong
- System columns (`created_at`, `updated_at`) are `timestamptz`. The server runs in UTC; display converts to IST
- Without this discipline a party schedule silently drifts by a day and nobody notices for weeks

### 4.5 Status model

Two independent axes. An order can be fully paid with jars still out, or fully returned with money still owed.

| Payment status | Meaning |
|---|---|
| `UNPAID` | Nothing collected |
| `PARTIAL` | Some collected, balance remains |
| `PAID` | Fully settled |
| `OVERPAID` | Collected more than due — amber badge, deliberately **not** blocked |
| `REFUND_DUE` | Company owes money back, mainly coin issues after returns |

| Return status | Meaning |
|---|---|
| `NOT_RETURNED` | Nothing back yet |
| `PARTIAL` | Some jars back, some still out |
| `COMPLETE` | All accounted for — returned or written off |
| `NOT_APPLICABLE` | Order contained only non-returnable products |

Both are **stored** on the header row and maintained by database trigger, so "show me everything with money pending" is a single indexed lookup rather than an aggregate over every payment ever recorded.

> **Why overpayment is allowed rather than blocked:** cash businesses take round-number payments constantly. Blocking a ₹2,000 payment against a ₹1,940 balance just pushes staff into recording false amounts, which destroys the data you built the system for.

### 4.6 Document numbering

Human-readable codes, generated by the database: `ORD-000123`, `CIS-000045`, `PTY-000012`, `DWS-000876`, `EXP-000230`, `PAY-001204`. Sortable, searchable, and impossible to duplicate.

### 4.7 Audit, revisions and history

Four separate mechanisms, because "history" means four different things:

| Question | Mechanism |
|---|---|
| What does this order look like **now**? | The live rows |
| **What changed** on this row, when, and by whom? | `audit_logs` — before/after JSON with a changed-fields list |
| Show me the order **as it stood** on 14 March | `document_revisions` — a full snapshot per edit session |
| What **physically happened** — jars back, cash in, coins moved? | Event tables: returns, payments, coin ledger |

Rules that follow from this:

- Transactional records are **soft-deleted** only. Masters are **deactivated**, never deleted
- Payments, return events and coin ledger entries are **append-only**, enforced by a database trigger that refuses updates and deletes, plus revoked permissions on the app role. Corrections are reversing entries. This is the difference between an accounting system and a spreadsheet
- Orders, coin issues and party orders carry a version counter, so two people editing the same record get *"changed by Ramesh 30 seconds ago, reload"* instead of one silently overwriting the other

### 4.8 Authentication

A single admin account: email and password, hashed with bcrypt, JWT session, every route except `/login` protected. The users table carries a role column from day one so adding a manager or read-only login later is a configuration change rather than a migration of every query.

### 4.9 Language

The whole platform runs in English or Gujarati, switchable from the topbar. The line that keeps it clean:

> **What the app says is translated. What you type is stored exactly as you typed it.**

There are no paired English/Gujarati columns in the schema. Full detail in [I18N.md](I18N.md).

---

## 5. Modules

| # | Module | One-line purpose | Spec |
|---|---|---|---|
| 1 | Staff | Who your delivery people are, and what each currently owes | [01-staff.md](MODULES/01-staff.md) |
| 2 | Products | What you sell and what it normally costs | [02-products.md](MODULES/02-products.md) |
| 3 | Delivery Orders | Jar issue, returns, and cash/coin collection | [03-delivery-orders.md](MODULES/03-delivery-orders.md) |
| 4 | Coins | Token types, issues to staff, returns, and the stock ledger | [04-coins.md](MODULES/04-coins.md) |
| 5 | Party Orders | Event bookings with multi-day delivery schedules | [05-party-orders.md](MODULES/05-party-orders.md) |
| 6 | Direct Sales | Walk-in customers, cash only | [06-direct-sales.md](MODULES/06-direct-sales.md) |
| 7 | Expenses | Outgoings by category, so profit is real | [07-expenses.md](MODULES/07-expenses.md) |
| 8 | Dashboards | Per-module KPIs plus a combined executive view | [08-dashboards.md](MODULES/08-dashboards.md) |
| 9 | Reports & Exports | Statements, reconciliations, CSV and PDF | [09-reports.md](MODULES/09-reports.md) |

**Modules 3 and 4 carry almost all the difficulty.** Everything else is a variation on the standard module shape.

---

## 6. Non-functional requirements

| Requirement | Target |
|---|---|
| **Mobile-usable** | The owner checks the dashboard on a phone. Tables collapse to cards below the `md` breakpoint |
| **Fast entry** | The daily order form and the walk-in row are keyboard-driven. Recording a walk-in is two fields and Enter |
| **Indian formatting** | `₹12,34,567.00` lakh grouping, `DD MMM YYYY` dates, Latin digits in both languages |
| **Bilingual** | Every screen, message, validation error, report and export works in English and Gujarati. No hardcoded user-facing strings anywhere in the codebase |
| **Design system** | Implements the existing NovaSpark tokens as Tailwind theme and CSS variables, including dark mode |
| **Data safety** | Neon point-in-time restore enabled. Nothing transactional is ever hard-deleted |
| **Performance** | List pages under 500 ms at 50,000 orders. Dashboard aggregates under 1 second |
| **Accessibility** | Visible focus rings, 44×44 px touch targets, keyboard navigation, labelled icons — per the design system |

---

## 7. Data model summary

Full detail in [DATA-MODEL.md](DATA-MODEL.md). The four decisions that shape everything else:

1. **Snapshots on every line item.** Order lines copy the product's title, litres, tag, filter type, base price and returnable flag at the moment of the order. A March invoice reprints identically after a June price rise
2. **Events, not columns.** Returns and payments are append-only event tables; the counters you filter on are trigger-maintained caches over them. Jars trickle back over days, corrections must stay visible, and two admins entering returns at once must not lose each other's work
3. **Cached rollups, database-maintained.** Filtering and sorting on "payment pending" across a paginated list is impossible to index if computed on read. The cached columns are written only inside the transaction that changes their source, and a drift-detection view proves they never diverge
4. **The coin ledger is the spine.** Every coin movement writes exactly one ledger row, and nothing else may change a coin type's balance

---

## 8. Verification

This round produces documents, so verification is a review rather than a test run.

1. Read this PRD and each module spec end to end, and confirm they match how the business actually works.
2. Walk these four real scenarios against [DATA-MODEL.md](DATA-MODEL.md) and confirm every field needed already exists:

   | Scenario | What it proves |
   |---|---|
   | Staff takes 40 jars, pays ₹1,000 cash + 50 coins on day 1, returns 30 empties on day 2 and 8 more on day 4, and 2 jars are written off as lost | Multi-event returns, mixed-mode partial payments, and order closure |
   | Staff takes 10 jars, sells 8, brings 2 back **filled** | The order total drops and he is billed for 8 (decision D5) |
   | Staff is issued 5 packets, pays in full, then returns 2 packets unsold | The refund-due path works end to end without editing what was already paid |
   | A 3-day wedding with a gap day, an advance, and a final settlement | Arbitrary-gap scheduling and running payment history |

3. Confirm every report in [09-reports.md](MODULES/09-reports.md) is producible from the schema with no missing data.
4. Confirm the coin ledger reconciles across a full cycle: opening → issue → order receipt → return → adjustment.
5. Confirm the language split in [I18N.md](I18N.md) is right: everything the app *says* is translated, everything you *type* is a single field in whichever script you choose.
6. Sign off, then plan the build.

---

## 9. Future scope

Deliberately excluded from version 1, listed so the schema stays additive:

| Item | Why deferred | How it would be added |
|---|---|---|
| Physical jar/bottle stock | The per-staff jar balance already answers the operational question | A container ledger per staff/customer |
| Staff mobile logins | The owner does all data entry today | A staff-facing UI plus permission rules; the role column already exists |
| End-customer master | Orders are staff-level by decision D3 | A customers table plus an optional foreign key on order lines — additive, no rewrite |
| GST invoicing | Decided against, not deferred (D6) | HSN and tax-rate columns plus a taxable/tax split. This is a genuine data migration |
| Future-dated price changes | Not needed today | A product-prices table resolved at order creation. Snapshots make this safe |
| SMS / WhatsApp reminders | Manual chasing works at current scale | An outbound message log keyed to outstanding balances |
| Route planning, multi-plant | Single plant, known routes | Out of scope for the foreseeable term |

---

## 10. Build order

Sequencing principle: **prove every unknown before building anything on top of it.** The three unknowns are TypeORM surviving Next.js's bundler in a production build, the shared table generalising across nine modules, and the coin ledger staying balanced under concurrency.

| Phase | Work | Exit criteria |
|---|---|---|
| **0** | `.gitignore` and rotated credentials. One trivial entity, the database connection singleton, the migration CLI, one list page | Dev server works · edit an entity and reload twice with no metadata error · production build works · migration generation works · deployed and working in the Neon region. **Nothing else starts until all five are green** |
| **1** | Design tokens, fonts (Inter **+ Noto Sans Gujarati**), component library, app shell, **bilingual setup with both catalogues and a language switcher**, money/date/error/logging utilities, auth and login | Log in, get bounced when signed out, toggle dark mode with no flash, **switch to Gujarati and see the whole shell translate with correctly-shaped script and Latin digits**. A Gujarati name renders correctly in a test PDF |
| **2** | The shared DataTable + **Staff** as the reference module, end to end | Staff is complete and the table code contains **zero** Staff-specific logic. Gujarati names and addresses work through entry, search, list and detail. Write down the "add a module" recipe |
| **3** | Products, coin types, expense categories | Each takes a fraction of the time Staff took. If not, the Phase 2 abstraction is wrong — fix it while only three modules depend on it |
| **4** | **Coin ledger** — issues, returns, payments, adjustments, ledger view, reconciliation | A test fires two simultaneous issues of the last 10 coins and proves exactly one succeeds |
| **5** | Delivery orders — items, returns, payments. Coin payments call into Phase 4, which is why coins came first | All four §8 scenarios pass as integration tests |
| **6** | Party orders, schedule builder, calendar | |
| **7** | Direct sales and Expenses | Nearly mechanical by this point |
| **8** | Dashboards, reports, CSV and PDF exports | Coin reconciliation banner live; Gujarati renders correctly in a real PDF statement |
| **9** | Hardening — index tuning from real query plans, audit log UI, backups, smoke test suite | |

Phases 0, 2 and 4 carry the risk. Everything after Phase 5 is repetition.
