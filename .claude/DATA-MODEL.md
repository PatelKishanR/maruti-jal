# Data Model

PostgreSQL (Neon) + TypeORM. This is the authoritative schema specification.

---

## 1. Platform decisions

| # | Decision | Choice | Reasoning |
|---|---|---|---|
| D-1 | Primary keys | `uuid` with `gen_random_uuid()` | Safe to generate before insert, no ID guessing in URLs, no collisions across environments |
| D-2 | Human document numbers | `bigint` identity column + a generated `code` such as `'ORD-' \|\| lpad(order_no::text, 6, '0')` | A water plant runs on register numbers, not UUIDs. Generated means gapless-enough, sortable, searchable, and no trigger code |
| D-3 | Money | `numeric(12,2)`. Rates that divide use `numeric(14,6)` | Exact decimal. Never `float`, `double` or `real` |
| D-4 | Money arithmetic | **All monetary maths happens in PostgreSQL** — generated columns, triggers, SQL aggregates | Summing money in JavaScript reintroduces floating-point error. TypeScript formats money; it never adds it |
| D-5 | Dates | Business dates are `date`, carried as `'YYYY-MM-DD'` strings. Instants are `timestamptz`. Server runs UTC, displays IST | "Which day was this order?" is a calendar concept. Storing it as a timestamp causes off-by-one-day bugs at midnight |
| D-6 | Naming | `snake_case` in the database, `camelCase` in TypeScript, via a naming strategy | Idiomatic on both sides with no per-column mapping |
| D-7 | Schema changes | `synchronize: false` **always**, even locally. Migrations only | `synchronize` issues `DROP COLUMN` without a prompt, cannot express triggers or partial indexes, and races across serverless cold starts |
| D-8 | Deletes | Soft delete (`deleted_at`) everywhere, plus `is_active` where the owner asked for deactivate/reactivate | "Deactivate" and "delete" are different verbs and the owner named both |
| D-9 | Extensions | `pgcrypto`, `pg_trgm`, `citext` | Trigram search across name, phone and address is the most-used feature in the app |
| D-10 | Language columns | **No `*_en` / `*_gu` pairs anywhere** | One field per name, any script. See [I18N.md](I18N.md) |

---

## 2. Entity map

```
users
staff ──┬── delivery_orders ──┬── order_items ──< order_item_return_events
        │                     └── payments
        ├── coin_issues ──┬── coin_issue_items ──< coin_issue_return_events
        │                 └── payments
        └── expenses (optional link)

product_tags ──────┐
                   ├── products ──┬── order_items         (FK + snapshot)
product_filter_types ┘            ├── party_order_items   (FK + snapshot)
                                  └── direct_sales        (optional)

coin_types ──┬── coin_issue_items
             ├── payments (mode = COIN)
             ├── coin_adjustments
             └── coin_ledger_entries      ← append-only spine

party_orders ── party_order_days ── party_order_items
             └── payments

direct_sales
expense_categories ── expenses

document_revisions · audit_logs · app_settings
```

---

## 3. Enums vs lookup tables

**Native PostgreSQL enums for sets that drive code branching. Lookup tables for business vocabulary.**

The split matters. Values that appear in `if` and `switch` statements must not change without a deployment — a new value the code doesn't handle is a runtime bug. Native enums make that impossible by construction.

Product tags and filter types are the opposite: the owner will plausibly want "Chilled", "RO" or "Alkaline" without waiting for a developer. Those get lookup tables with a text primary key, so `products.tag_code` stays readable in raw SQL and filterable without a join, while remaining foreign-key protected.

### 3.1 Native enums

```sql
CREATE TYPE user_role            AS ENUM ('OWNER','ADMIN','MANAGER','VIEWER');
CREATE TYPE order_status         AS ENUM ('DRAFT','CONFIRMED','CANCELLED');
CREATE TYPE payment_status       AS ENUM ('UNPAID','PARTIAL','PAID','OVERPAID','REFUND_DUE');
CREATE TYPE return_status        AS ENUM ('NOT_RETURNED','PARTIAL','COMPLETE','NOT_APPLICABLE');
CREATE TYPE payment_mode         AS ENUM ('CASH','COIN','UPI','BANK_TRANSFER','WRITE_OFF');
CREATE TYPE payment_direction    AS ENUM ('IN','OUT');
CREATE TYPE payment_context      AS ENUM ('ORDER','COIN_ISSUE','PARTY_ORDER');
CREATE TYPE coin_issue_status    AS ENUM ('OPEN','SETTLED','CANCELLED');
CREATE TYPE party_order_status   AS ENUM ('DRAFT','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE day_delivery_status  AS ENUM ('SCHEDULED','DELIVERED','SKIPPED','CANCELLED');
CREATE TYPE ledger_movement_type AS ENUM ('OPENING','ISSUE','ISSUE_RETURN','ORDER_RECEIPT',
                                          'ADJUSTMENT_IN','ADJUSTMENT_OUT','ISSUE_CANCELLED');
CREATE TYPE ledger_source_type   AS ENUM ('COIN_ISSUE_ITEM','COIN_ISSUE_RETURN_EVENT',
                                          'PAYMENT','COIN_ADJUSTMENT');
CREATE TYPE adjustment_reason    AS ENUM ('OPENING_STOCK','MINTED','PURCHASED','LOST',
                                          'DAMAGED','STOLEN','RECONCILIATION');
CREATE TYPE expense_payment_mode AS ENUM ('CASH','UPI','BANK_TRANSFER','CHEQUE');
CREATE TYPE audit_action         AS ENUM ('INSERT','UPDATE','SOFT_DELETE','RESTORE','CANCEL');
```

**`payment_mode.WRITE_OFF` is deliberate.** Cash businesses forgive ₹20 balances. Modelling it as a payment mode keeps outstanding at zero truthfully, instead of leaving phantom dues on the books forever.

---

## 4. Shared column block

Every business table carries these. Referenced below as **«audit»**.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `created_at` | `timestamptz` | NO | `now()` |
| `updated_at` | `timestamptz` | NO | `now()` |
| `deleted_at` | `timestamptz` | YES | `NULL` |
| `created_by_id` | `uuid` | YES | FK → `users(id)` |
| `updated_by_id` | `uuid` | YES | FK → `users(id)` |
| `deleted_by_id` | `uuid` | YES | FK → `users(id)` |

**Append-only tables** — `payments`, `*_return_events`, `coin_ledger_entries`, `audit_logs` — carry only `id`, `created_at` and `created_by_id`. No `updated_at`, no `deleted_at`. See §9.

---

## 5. Tables

### 5.1 `users`

App logins. **Not** the same as delivery staff.

| Column | Type | Null | Constraints |
|---|---|---|---|
| «audit» | | | |
| `name` | `text` | NO | Non-empty |
| `email` | `citext` | NO | Unique among non-deleted |
| `password_hash` | `text` | NO | bcrypt, cost 12 |
| `role` | `user_role` | NO | Default `'ADMIN'` |
| `locale` | `varchar(5)` | NO | Default `'en'` — the user's UI language |
| `is_active` | `boolean` | NO | Default `true` |
| `last_login_at` | `timestamptz` | YES | |

### 5.2 `staff`

| Column | Type | Null | Constraints |
|---|---|---|---|
| «audit» | | | |
| `staff_no` / `code` | `bigint` / `text` | NO | Identity / generated `'STF-'…`, unique |
| `name` | `text` | NO | 1–120 chars. **ICU collation `gu-IN-x-icu`**. No script restriction |
| `phone` | `varchar(20)` | NO | Format-checked. Unique among non-deleted |
| `alt_phone` | `varchar(20)` | YES | |
| `address` | `text` | YES | Any script |
| `note` | `text` | YES | Any script |
| `joined_on` | `date` | YES | |
| `is_active` | `boolean` | NO | Default `true` |
| `search_blob` | `text` | NO | Generated: name ‖ phone ‖ alt_phone ‖ address |

**Why `search_blob`:** the owner wants one search box matching name *or* phone *or* address. Three separate indexes force three OR-branches; one generated column with one trigram index gives a single fast predicate.

### 5.3 `product_tags`, `product_filter_types`

Identical shape. `code` `text` PK (uppercase, checked) · `label` `text` unique · `sort_order` `smallint` · `is_active` `boolean`.

Seeded: tags `NORMAL`/"Normal", `COLD`/"Cold". Filter types `NORMAL`/"Normal", `FILTERED`/"Filtered", `DOUBLE_FILTERED`/"Double Filtered". All editable — rename to Gujarati if preferred.

### 5.4 `products`

| Column | Type | Null | Constraints |
|---|---|---|---|
| «audit» | | | |
| `product_no` / `code` | `bigint` / `text` | NO | Identity / `'PRD-'…`, unique |
| `title` | `text` | NO | Non-empty. **One field, any script.** ICU collation |
| `litres` | `numeric(7,3)` | NO | Greater than 0 |
| `tag_code` | `text` | NO | FK → `product_tags(code)`, ON UPDATE CASCADE, ON DELETE RESTRICT |
| `filter_type_code` | `text` | NO | FK → `product_filter_types(code)`, same |
| `description` | `text` | YES | |
| `base_price` | `numeric(12,2)` | NO | Zero or more |
| `is_returnable` | `boolean` | NO | Default `true` |
| `is_active` | `boolean` | NO | Default `true` |
| `deactivated_at` | `timestamptz` | YES | |
| `sort_order` | `smallint` | NO | Default 100 |
| `search_blob` | `text` | NO | Generated from title ‖ description |

### 5.5 `delivery_orders`

| Column | Type | Null | Notes |
|---|---|---|---|
| «audit» | | | |
| `order_no` / `code` | `bigint` / `text` | NO | Identity / `'ORD-'…`, unique |
| `staff_id` | `uuid` | NO | FK → `staff(id)` **ON DELETE RESTRICT** |
| `order_date` | `date` | NO | Default `CURRENT_DATE` |
| `status` | `order_status` | NO | Default `'CONFIRMED'` |
| `notes` | `text` | YES | |
| **Money rollups — trigger-maintained** | | | |
| `subtotal_amount` | `numeric(12,2)` | NO | Σ of line totals |
| `discount_amount` | `numeric(12,2)` | NO | Header round-off, zero or more. **The only money field the admin edits directly** |
| `total_amount` | `numeric(12,2)` | NO | Generated: `subtotal_amount - discount_amount` |
| `paid_cash_amount` | `numeric(12,2)` | NO | |
| `paid_coin_amount` | `numeric(12,2)` | NO | |
| `paid_other_amount` | `numeric(12,2)` | NO | |
| `paid_total_amount` | `numeric(12,2)` | NO | |
| `refunded_amount` | `numeric(12,2)` | NO | |
| `outstanding_amount` | `numeric(12,2)` | NO | Generated. **The "payment pending" filter column** |
| `payment_status` | `payment_status` | NO | Trigger-maintained |
| **Jar rollups — trigger-maintained** | | | |
| `qty_issued` | `integer` | NO | Returnable items only |
| `qty_returned_empty` | `integer` | NO | |
| `qty_returned_filled` | `integer` | NO | |
| `qty_lost` | `integer` | NO | |
| `qty_pending` | `integer` | NO | Generated. **The "jars out" filter column** |
| `return_status` | `return_status` | NO | Trigger-maintained |
| **Timeline** | | | |
| `first_payment_at`, `last_payment_at`, `fully_paid_at`, `fully_returned_at` | `timestamptz` | YES | Powers "days outstanding" ageing |
| `version` | `integer` | NO | Optimistic lock |

> **PostgreSQL constraint that shapes this table:** a generated column may not reference another generated column. `outstanding_amount` therefore repeats `subtotal_amount - discount_amount` rather than referencing `total_amount`. That duplication is required, not sloppy. The same applies on `order_items`.

### 5.6 `order_items`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id`, `order_id` | `uuid` | NO | FK → `delivery_orders(id)` **ON DELETE CASCADE** |
| `line_no` | `smallint` | NO | Unique with `order_id` |
| `product_id` | `uuid` | NO | FK → `products(id)` **ON DELETE RESTRICT** |
| **Snapshots — immutable after insert** | | | |
| `product_title` | `text` | NO | |
| `product_litres` | `numeric(7,3)` | NO | |
| `product_tag_code` | `text` | NO | Snapshot text, no FK |
| `product_filter_type_code` | `text` | NO | Snapshot text, no FK |
| `product_base_price` | `numeric(12,2)` | NO | The list price **at order time** |
| `is_returnable` | `boolean` | NO | |
| **Pricing** | | | |
| `unit_price` | `numeric(12,2)` | NO | The bargained rate |
| `is_price_overridden` | `boolean` | NO | Generated: `unit_price IS DISTINCT FROM product_base_price` |
| `price_override_note` | `text` | YES | |
| `quantity` | `integer` | NO | Greater than 0 |
| **Return counters — trigger caches over the event table** | | | |
| `returned_empty_qty` | `integer` | NO | |
| `returned_filled_qty` | `integer` | NO | |
| `lost_qty` | `integer` | NO | |
| `pending_qty` | `integer` | NO | Generated |
| `line_total` | `numeric(12,2)` | NO | Generated: `round((quantity - returned_filled_qty) × unit_price, 2)` |
| **Table constraint** | | | `returned_empty + returned_filled + lost ≤ quantity` — **the over-return guard, enforced in the database** |

**No unique constraint on `(order_id, product_id)`.** Deliberate: one route order legitimately contains the same product twice at two bargained rates. Uniqueness is on `(order_id, line_no)` only.

**Why `line_total` subtracts filled returns:** decision D5 — the staff member is billed only for what he sold.

### 5.7 `order_item_return_events` *(append-only)*

`id` · `order_item_id` FK CASCADE · `return_date` `date` · `empty_qty` · `filled_qty` · `lost_qty` `integer` · `note` · `reverses_event_id` self-FK unique · `created_at` · `created_by_id`.

A normal event has non-negative quantities summing above zero. A reversal has non-positive quantities and a `reverses_event_id`. Enforced by a table constraint.

### 5.8 `payments` *(append-only, shared, exclusive-arc)*

Serves delivery orders, coin issues **and** party orders from one table.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id`, `payment_no` / `code` | | NO | `'PAY-'…`, unique |
| `context_type` | `payment_context` | NO | |
| `order_id` | `uuid` | YES | FK → `delivery_orders(id)` CASCADE |
| `coin_issue_id` | `uuid` | YES | FK → `coin_issues(id)` CASCADE |
| `party_order_id` | `uuid` | YES | FK → `party_orders(id)` CASCADE |
| `direction` | `payment_direction` | NO | `OUT` = refund from company |
| `mode` | `payment_mode` | NO | |
| `amount` | `numeric(12,2)` | NO | Greater than 0 — **sign lives in `direction`, never in the number** |
| `is_advance` | `boolean` | NO | Party orders |
| `paid_on` | `date` | NO | |
| `coin_type_id` | `uuid` | YES | FK → `coin_types(id)` RESTRICT |
| `coin_count` | `integer` | YES | |
| `coin_unit_value` | `numeric(14,6)` | YES | Snapshot at receipt |
| `reference_no` | `text` | YES | UPI transaction / cheque number |
| `note` | `text` | YES | |
| `reverses_payment_id` | `uuid` | YES | Self-FK, unique |
| `client_request_id` | `text` | YES | **Unique.** Idempotency key — kills double-submit on a flaky connection |
| **Constraints** | | | Exactly one context FK set, matching `context_type` · `mode = 'COIN'` if and only if the three coin fields are set **and** `amount = round(coin_count × coin_unit_value, 2)` |

**Why exclusive-arc FKs rather than a bare `payable_type` / `payable_id` pair:** pure polymorphism loses referential integrity. Nothing stops a payment pointing at a deleted order, and you cannot join without a `CASE`. Three nullable FKs cost 8 bytes each and buy real foreign keys, real cascades, and index-friendly lookups.

### 5.9 `coin_types`

| Column | Type | Null | Notes |
|---|---|---|---|
| «audit» | | | |
| `name` | `text` | NO | Unique among non-deleted, case-insensitive. Any script |
| `coins_per_packet` | `integer` | NO | Greater than 0 |
| `packet_amount` | `numeric(12,2)` | NO | Zero or more |
| `per_coin_price` | `numeric(14,6)` | NO | Generated: `round(packet_amount / coins_per_packet, 6)`. Division by zero impossible thanks to the constraint above |
| `balance_coins` | `integer` | NO | Trigger-maintained cache of the ledger balance |
| `colour_hex` | `varchar(7)` | YES | UI badge |
| `is_active` | `boolean` | NO | |

**Opening stock is not a column.** It is an `OPENING` row in the ledger, so the ledger remains the single source of truth.

### 5.10 `coin_issues`

| Column | Type | Notes |
|---|---|---|
| «audit», `issue_no` / `code` | | `'CIS-'…`, unique |
| `staff_id` | `uuid` | FK → `staff(id)` RESTRICT |
| `issue_date` | `date` | |
| `status` | `coin_issue_status` | |
| `total_coins_issued`, `total_coins_returned` | `integer` | Trigger |
| `coins_outstanding` | `integer` | Generated |
| `total_amount`, `returned_value`, `paid_amount`, `refunded_amount` | `numeric(12,2)` | Trigger |
| `net_payable` | `numeric(12,2)` | Generated: `total_amount - returned_value` |
| `outstanding_amount` | `numeric(12,2)` | Generated. **Negative means the company owes the staff member a refund** |
| `settled_at` | `timestamptz` | |
| `version` | `integer` | Optimistic lock |

This delivers the owner's register row directly — **issued · returned · collected · pending** all on one row, no joins, sortable and filterable.

### 5.11 `coin_issue_items`

`id` · `coin_issue_id` FK CASCADE · `coin_type_id` FK RESTRICT · `packets` (> 0) · snapshots (`coins_per_packet_snapshot`, `packet_amount_snapshot`, `per_coin_price_snapshot`, `coin_type_name_snapshot`) · `coins_issued` generated · `line_amount` generated · `coins_returned` trigger-maintained · `coins_outstanding` generated.

Unique on `(coin_issue_id, coin_type_id)`. Constraint: `0 ≤ coins_returned ≤ coins_issued` — the over-return guard.

### 5.12 `coin_issue_return_events` *(append-only)*

`id` · `coin_issue_item_id` FK CASCADE · `return_date` · `coins_returned` · `unit_value_snapshot` `numeric(14,6)` · `value_credited` `numeric(12,2)` stored explicitly · `note` · `reverses_event_id` · `created_at` · `created_by_id`.

`value_credited` is stored rather than computed, because rounding it once at write time is what keeps the issue's arithmetic consistent. See §10.5.

### 5.13 `coin_adjustments`

`id` · «audit» (no soft delete — corrections are new rows) · `coin_type_id` FK RESTRICT · `adjustment_date` · `direction` · `coins` (> 0) · `reason` · `note` **NOT NULL and non-empty** · `approved_by_id`.

**The mandatory note is a control, not a nicety.** A stock adjustment with no explanation is how theft hides.

### 5.14 `coin_ledger_entries` *(append-only — the spine)*

Every change in coin stock writes exactly one row here. Nothing else may change `coin_types.balance_coins`.

| Column | Type | Notes |
|---|---|---|
| `id`, `coin_type_id` | `uuid` | FK RESTRICT |
| `entry_seq` | `bigint` | Per-coin-type sequence assigned under a row lock. Unique with `coin_type_id` |
| `entry_date` | `date` | |
| `occurred_at` | `timestamptz` | |
| `movement_type` | `ledger_movement_type` | |
| `coins_delta` | `integer` | Signed. Negative leaves company stock. Never zero |
| `balance_after_coins` | `integer` | **Constraint: ≥ 0** |
| `unit_value` | `numeric(14,6)` | |
| `value_delta` | `numeric(12,2)` | Signed |
| `coin_issue_item_id` | `uuid` | FK RESTRICT, nullable |
| `coin_issue_return_event_id` | `uuid` | FK RESTRICT, nullable |
| `payment_id` | `uuid` | FK RESTRICT, nullable |
| `coin_adjustment_id` | `uuid` | FK RESTRICT, nullable |
| `source_type` | `ledger_source_type` | The polymorphic discriminator |
| `source_id` | `uuid` | **Generated** as `coalesce()` of the four FKs |
| `staff_id` | `uuid` | Denormalised for "coins with staff X" reporting |
| `note`, `created_at`, `created_by_id` | | |

**Constraints:** exactly one source FK is non-null · `source_type` matches which FK is populated · the sign of `coins_delta` matches `movement_type`.

#### Why this design

The owner asked for a polymorphic `source_type` / `source_id`. Pure polymorphism — a bare uuid with no foreign key — means the ledger can point at rows that no longer exist. That is fatal for an auditable stock register.

This design keeps **four real foreign keys with restrict semantics** (so a coin issue with ledger movements physically cannot be deleted) and then **derives** `source_id` as a generated `coalesce()`. You get polymorphic ergonomics — `WHERE source_type = 'PAYMENT' AND source_id = $1` — with zero integrity loss and zero write-side bookkeeping.

#### Movement sign map

| Movement | Source | Delta |
|---|---|---|
| `OPENING` | adjustment (reason `OPENING_STOCK`) | + |
| `ISSUE` | coin issue item | − |
| `ISSUE_RETURN` | coin issue return event | + |
| `ORDER_RECEIPT` | payment, mode COIN, direction IN | + |
| `ADJUSTMENT_IN` | adjustment | + |
| `ADJUSTMENT_OUT` | adjustment | − |
| `ISSUE_CANCELLED` | coin issue item | + |

### 5.15 `party_orders`

«audit» · `party_no` / `code` `'PTY-'…` · `party_name` · `phone` · `alt_phone` · `delivery_address` · `notes` · `status` · `first_service_date` / `last_service_date` (trigger) · `total_days` · `total_amount` · `advance_amount` · `paid_amount` · `refunded_amount` · `outstanding_amount` (generated) · `payment_status` · `search_blob` · `version`.

### 5.16 `party_order_days`

`id` · `party_order_id` FK CASCADE · `service_date` **unique with `party_order_id`** · `delivery_status` · `assigned_staff_id` FK SET NULL · `delivered_at` · `day_total` (trigger, excluding skipped and cancelled days) · `notes`.

**One row per date, not a recurrence rule.** The owner said dates may be consecutive, alternate, or arbitrarily spaced. A rule cannot express arbitrary gaps; a row per date expresses anything, is trivially editable, and lets each day carry its own status, staff and total.

### 5.17 `party_order_items`

`id` · `party_order_day_id` FK CASCADE · `line_no` · `product_id` FK RESTRICT · the same snapshot block as `order_items` · `unit_price` · `quantity` (planned) · `delivered_quantity` (nullable, actual) · `line_total` generated as `round(coalesce(delivered_quantity, quantity) × unit_price, 2)`.

Bills the planned quantity until actuals are entered.

### 5.18 `direct_sales`

«audit» · `sale_no` / `code` `'DWS-'…` · `sale_date` · `sold_at` `timestamptz` · `customer_name` (non-empty, any script) · `phone` · `address` · `amount` (> 0) · `litres` · `product_id` FK RESTRICT nullable · `mode` **constrained to `'CASH'`** · `is_voided` · `void_reason` · `note` · `search_blob`.

**No payment rows and no status column.** The owner said always fully paid, no pending state — encoding that as a constraint rather than a nullable status makes the invalid state unrepresentable. Relaxing it for UPI later is a one-line migration.

### 5.19 `expense_categories`, `expenses`

**`expense_categories`** — `id` · `name` unique · `sort_order` · `is_active`.

**`expenses`** — «audit» · `expense_no` / `code` `'EXP-'…` · `expense_date` · `category_id` FK RESTRICT · `amount` (> 0) · `payment_mode` · `paid_to` · `staff_id` FK nullable · `note` · `attachment_url` · `search_blob`.

### 5.20 `document_revisions`

`id` `bigint` · `document_type` (`ORDER` / `COIN_ISSUE` / `PARTY_ORDER`) · `document_id` · `revision_no` (unique with the first two) · `snapshot` `jsonb` — the full aggregate · `diff` `jsonb` — `{field: [before, after]}` · `change_reason` · `actor_id` and `actor_name` (name snapshotted so history survives user deletion) · `created_at`.

**One row per edit session, not per column.** The edit action wraps the whole aggregate mutation in one transaction and writes exactly one revision at the end.

### 5.21 `audit_logs`

`id` `bigint` · `table_name` · `record_id` · `action` · `before` / `after` `jsonb` · `changed_fields` `text[]` (GIN indexed) · `actor_id`, `actor_name`, `actor_role` · `request_id` · `ip` · `created_at`.

Written by a generic trigger. The actor comes from a per-request session variable, which is what allows a database-level trigger to record *who* without every statement remembering to set it.

Partition by month from day one if multi-year retention is wanted — cheap now, painful to retrofit.

### 5.22 `app_settings`

`key` `text` PK · `value` `jsonb` · `description` · «audit».

Seeded with `orders.charge_basis = "SOLD"` (decision D5 — flipping to `"ISSUED"` is a config change, not a migration), `business.profile`, and `coins.allow_negative_balance = false`.

---

## 6. Price snapshotting

**Every order line stores the product foreign key *and* a full copy of the product's commercial attributes at the moment the line was created.**

| Snapshot | Purpose |
|---|---|
| `product_title`, `product_litres`, `product_tag_code`, `product_filter_type_code` | Reprint a six-month-old statement exactly as issued, even after a rename or reclassification |
| `product_base_price` | The list price then — makes `is_price_overridden` meaningful and "how much did we discount last quarter?" answerable |
| `unit_price` | What was actually charged |
| `is_returnable` | Return rules must not change retroactively if a product is reclassified |

The `product_id` foreign key is retained purely for analytics — revenue-by-product needs a stable grouping key, and a renamed product must still roll up to one line.

**Snapshots are immutable**, enforced by a trigger that raises if any snapshot column changes. To put a different product on a line, remove the line and add a new one — which is recorded as a revision.

---

## 7. Returns and payments as events

**Returns are an append-only event table, with trigger-maintained counters on the line item. Payments work the same way.**

| Reason | Detail |
|---|---|
| **The domain is multi-event** | Jars issued Monday get 4 empties back Tuesday, 6 more Thursday, 2 still out a fortnight later. A mutable counter answers "how many" but never "when, and who recorded it" — exactly the question asked when the numbers don't add up |
| **Corrections are auditable** | Typing 40 instead of 4 is fixed by a reversal row; both stay visible |
| **Concurrency safety** | Two admins recording returns against mutable counters produce a classic lost update: both read 4, one writes 8, the other writes 6. Appending two rows and recomputing is correct under any interleaving |
| **Symmetry with payments** | Instalment payments already require an append-only table. One shape means one mental model, one UI pattern, one reconciliation routine |
| **Time series for free** | "Jars returned per day" is a `GROUP BY`. With mutable counters that report cannot be built retroactively |

**Trigger contract:**

```
AFTER INSERT ON order_item_return_events
  → lock the parent order_items row
  → recompute the three counters from the sum over events
  → generated columns (pending_qty, line_total) recompute automatically
  → cascade to delivery_orders: subtotal, qty rollups, return_status, fully_returned_at
```

**Deadlock discipline:** every trigger acquires locks in the fixed order *child → parent → grandparent*, and application code never locks a header before a line.

---

## 8. Cached rollups: why, and how they stay correct

### 8.1 Why cache

The requirement that decides it: *filters and sorts on "payment pending" and "jars out", combined with search and pagination.*

Computed on read, every list query becomes a correlated subquery — which PostgreSQL cannot index. Page 20 would re-aggregate 525 orders' worth of items, returns and payments in order to discard 500 of them. It degrades linearly and is the single most common cause of "the list page got slow" in this kind of application.

Cached, the same query is an indexed range scan. Constant time regardless of history size.

### 8.2 Generated columns vs triggers

| Mechanism | Used for | Reason |
|---|---|---|
| `GENERATED ALWAYS AS … STORED` | `outstanding_amount`, `total_amount`, `pending_qty`, `line_total`, `coins_issued`, `per_coin_price`, `source_id`, `code` | Pure arithmetic on same-row columns. Impossible to desync. Zero code |
| Trigger | Cross-row rollups, enum statuses, timeline stamps | Requires aggregation over child tables, or produces an enum — which PostgreSQL may refuse in a generated column |

**Triggers rather than service-layer code**, because the values must be correct no matter who writes: a server action, a future import script, or the owner running an `UPDATE` in the Neon console at 11pm. A trigger is the only place that guarantees this.

### 8.3 Drift detection is mandatory

Ship views whose job is to return zero rows:

- `v_order_rollup_drift` — header rollups against the sum of their source rows
- `v_coin_balance_drift` — `coin_types.balance_coins` against both the ledger sum and the latest `balance_after_coins`

Checked nightly and surfaced on the dashboard. **A non-empty drift view is a Sev-1.**

---

## 9. Audit, revisions and history

Four mechanisms, four questions:

| Question | Mechanism |
|---|---|
| What does this order look like **now**? | The live rows |
| **What changed**, when, by whom? | `audit_logs` |
| Show me the order **as it stood** on 14 March | `document_revisions` |
| What **physically happened**? | Event tables — returns, payments, coin ledger |

**Append-only enforcement:** on `payments`, `*_return_events`, `coin_ledger_entries` and `audit_logs`, a `BEFORE UPDATE OR DELETE` trigger raises unconditionally, and `UPDATE` and `DELETE` are revoked from the application role. Reversals are inserts.

This is the difference between an accounting system and a spreadsheet.

**Optimistic locking:** a `version` column on orders, coin issues and party orders. Two admins editing the same record → the second save fails loudly with *"changed by Ramesh 30 seconds ago, reload"* instead of silently discarding work.

---

## 10. Integrity risks and mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 10.1 | **Over-return** — 12 empties against a 10-jar line | High | Table constraint plus a row lock in the trigger. Rejected at the database, not the UI |
| 10.2 | **Negative coin stock** — issuing 500 when 300 remain | High | `balance_after_coins ≥ 0` constraint. Every issue computes the balance under a row lock, so two concurrent issues cannot both pass |
| 10.3 | **Refund owed to staff** | High | Signed `outstanding_amount`, `REFUND_DUE` status, red badge, settled by an `OUT`-direction payment. What was paid is never mutated |
| 10.4 | **Payment exceeds total** | Medium | **Deliberately allowed.** Status becomes `OVERPAID` with an amber badge. Blocking pushes staff into recording false amounts |
| 10.5 | **Coin rounding drift** — ₹500 ÷ 45 coins = ₹11.111111 | High | Rate at six decimals, every row-level amount rounded and stored at two. Consequence: 45 coins returned singly credits ₹499.95, a five-paise gap. Reconciled by a "settle difference" write-off |
| 10.6 | **Deleting a product or staff member with history** | High | Restrict constraints, soft delete, and snapshots — three layers, so history survives even a direct database `DELETE` |
| 10.7 | **Price change rewriting history** | High | Snapshot block plus immutability trigger. Verified by a test: create order → change base price → assert the line total is unchanged |
| 10.8 | **Coins double-counted** | High | Structural separation — `ORDER_RECEIPT` movements never touch `coin_issue_items.coins_returned`. Plus a coins-in-circulation view to surface gaps |
| 10.9 | **Cross-order jar returns** | High | The return dialog lists all open lines for that staff member across orders (decision D7), plus a per-staff jar balance view as the true operational number |
| 10.10 | **Concurrent edits** | Medium | Version column |
| 10.11 | **Double-submitted payment** | Medium | Unique `client_request_id`; the client generates it once per form open, so retries are idempotent |
| 10.12 | **Cancelling an order with payments or returns** | Medium | Blocked until they are reversed. Money is never cascade-deleted |
| 10.13 | **Deadlocks between order and coin triggers** | Medium | Fixed lock order, documented. Violating it produces intermittent deadlock errors that are miserable to diagnose |
| 10.14 | **Cache drift** | Medium | Drift views plus a nightly check |
| 10.15 | **Staff phone reused after someone leaves** | Low | Unique only among non-deleted rows, so the number frees up |

---

## 11. Indexes

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- STAFF
CREATE INDEX idx_staff_search_trgm ON staff USING gin (search_blob gin_trgm_ops);
CREATE INDEX idx_staff_active      ON staff (is_active, name)   WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_staff_phone ON staff (phone)             WHERE deleted_at IS NULL;

-- PRODUCTS
CREATE INDEX idx_products_search_trgm ON products USING gin (search_blob gin_trgm_ops);
CREATE INDEX idx_products_filters ON products (tag_code, filter_type_code, is_active)
  WHERE deleted_at IS NULL;

-- DELIVERY ORDERS  (default list = newest first, paginated)
CREATE INDEX idx_orders_date_no    ON delivery_orders (order_date DESC, order_no DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_staff_date ON delivery_orders (staff_id, order_date DESC)
  WHERE deleted_at IS NULL;
-- the two headline filters: tiny partial indexes, always hot
CREATE INDEX idx_orders_payment_pending ON delivery_orders (order_date DESC, staff_id)
  WHERE deleted_at IS NULL AND outstanding_amount > 0;
CREATE INDEX idx_orders_return_pending  ON delivery_orders (order_date DESC, staff_id)
  WHERE deleted_at IS NULL AND qty_pending > 0;
CREATE INDEX idx_orders_code_trgm ON delivery_orders USING gin (code gin_trgm_ops);

-- ORDER ITEMS
CREATE INDEX idx_oi_order   ON order_items (order_id, line_no);
CREATE INDEX idx_oi_product ON order_items (product_id);
CREATE INDEX idx_oi_pending ON order_items (order_id) WHERE pending_qty > 0;
CREATE INDEX idx_oire_item  ON order_item_return_events (order_item_id, return_date DESC);

-- PAYMENTS  (one partial index per arc — no wasted entries on null rows)
CREATE INDEX idx_pay_order ON payments (order_id, paid_on DESC)       WHERE order_id       IS NOT NULL;
CREATE INDEX idx_pay_issue ON payments (coin_issue_id, paid_on DESC)  WHERE coin_issue_id  IS NOT NULL;
CREATE INDEX idx_pay_party ON payments (party_order_id, paid_on DESC) WHERE party_order_id IS NOT NULL;
CREATE INDEX idx_pay_coin  ON payments (coin_type_id, paid_on DESC)   WHERE mode = 'COIN';
CREATE UNIQUE INDEX uq_pay_client_req ON payments (client_request_id)
  WHERE client_request_id IS NOT NULL;

-- COINS
CREATE INDEX idx_ci_staff_date ON coin_issues (staff_id, issue_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_ci_pending    ON coin_issues (issue_date DESC)
  WHERE deleted_at IS NULL AND outstanding_amount <> 0;
CREATE UNIQUE INDEX uq_ledger_seq ON coin_ledger_entries (coin_type_id, entry_seq DESC);
CREATE INDEX idx_ledger_source    ON coin_ledger_entries (source_type, source_id);
CREATE INDEX idx_ledger_staff     ON coin_ledger_entries (staff_id, entry_date DESC)
  WHERE staff_id IS NOT NULL;

-- PARTY ORDERS
CREATE INDEX idx_po_search_trgm ON party_orders USING gin (search_blob gin_trgm_ops);
CREATE INDEX idx_po_pending ON party_orders (first_service_date DESC)
  WHERE deleted_at IS NULL AND outstanding_amount > 0;
CREATE UNIQUE INDEX uq_pod_order_date ON party_order_days (party_order_id, service_date);
CREATE INDEX idx_pod_date ON party_order_days (service_date, delivery_status);

-- DIRECT SALES / EXPENSES / AUDIT
CREATE INDEX idx_ds_date     ON direct_sales (sale_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_exp_date    ON expenses (expense_date DESC)  WHERE deleted_at IS NULL;
CREATE INDEX idx_audit_record ON audit_logs (table_name, record_id, created_at DESC);
```

Indexes are created concurrently in a separate non-transactional migration.

**Pagination note:** keyset pagination (`WHERE (order_date, order_no) < ($1, $2)`) outperforms offset past a few hundred pages and is fully served by `idx_orders_date_no`. Recommended for the order list; offset is fine elsewhere where volumes are small.

---

## 12. Dashboard views

Plain SQL views, not materialised. At this volume — order of 10⁴–10⁵ rows per year — indexed aggregates over date ranges run in tens of milliseconds, and materialised views introduce staleness the owner will not expect from something that behaves like a cash register.

| View | Purpose |
|---|---|
| `v_order_rollup_drift` | Integrity check — must be empty |
| `v_coin_balance_drift` | Integrity check — must be empty |
| `v_coin_type_balance` | Balance, in circulation, value at risk, per type |
| `v_coins_in_circulation` | `issued − returned by staff − redeemed via orders` |
| `v_staff_outstanding` | Per staff: order dues + coin dues + jars out |
| `v_staff_jar_balance` | Per staff: all-time issued minus returned — the true operational number |
| `v_daily_sales` | Date × channel → revenue and collection |
| `v_product_sales` | Product × month → quantity, revenue, realised vs base price |
| `v_exec_summary` | Single row: today and month-to-date revenue, total receivable, jars out, coin float, upcoming events |

Add a materialised daily-metrics view **only if** the executive dashboard exceeds roughly 300 ms. Measure first.

---

## 13. Migration sequence

1. Extensions, all enum types, `users`, `app_settings`
2. Lookups (`product_tags`, `product_filter_types`) with seed data; `staff`; `products`
3. Generic `audit_logs` and its trigger function; `document_revisions`
4. `delivery_orders` → `order_items` → `order_item_return_events`
5. `payments` with the order arc (the other two arcs added in step 7)
6. Order rollup triggers and `v_order_rollup_drift`
7. `coin_types` → `coin_issues` → `coin_issue_items` → `coin_issue_return_events` → `coin_adjustments`; then add the remaining two payment arc FKs
8. `coin_ledger_entries` with its sequence and balance trigger, the append-only guard, and `v_coin_balance_drift`
9. `party_orders` → `party_order_days` → `party_order_items` with rollup triggers
10. `direct_sales`
11. `expense_categories` → `expenses`
12. All indexes, created concurrently in a separate non-transactional migration
13. Dashboard views
14. Revoke `UPDATE` and `DELETE` on append-only tables from the application role

Steps 4–6 and 7–8 are the two hard chunks. Everything else is mechanical.
