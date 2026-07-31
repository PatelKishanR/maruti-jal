# Module 2 — Product Management

**Goal:** define exactly what you sell, and what it normally costs.

---

## 1. In plain English

Every kind of container you sell is a product — a 20-litre jar, a 1-litre bottle, a cold 500 ml bottle. Each one records how much water it holds, whether it's normal or cold, what level of filtration it went through, and its standard price.

That standard price is the starting point for every order. Staff bargain, so orders can override it line by line — but the product's price is what the form fills in first.

Products you stop selling are **deactivated**, not deleted. They disappear from new order forms while every old order that used them still displays perfectly.

---

## 2. User stories

| # | As the admin, I want to… | So that… |
|---|---|---|
| P1 | create a product with title, litres, tag, filter type, description and base price | orders can be raised against a defined item |
| P2 | search, sort, filter and page through the catalogue | it stays manageable as the range grows |
| P3 | edit a product and its price | I can raise prices without touching past orders |
| P4 | deactivate a product I no longer sell, and reactivate it later | it leaves new order forms but old orders still render |
| P5 | view a product's detail and how much of it has moved | I see what actually sells |
| P6 | add a new tag or filter type myself | I'm not blocked waiting on a developer to add "Chilled" |
| P7 | mark a product as non-returnable | disposable bottles don't sit "pending return" forever |

---

## 3. Screens

| Route | Screen |
|---|---|
| `/products` | List + KPI strip |
| `/products/new` | Create form |
| `/products/[id]` | Detail + movement summary |
| `/products/[id]/edit` | Edit form |
| `/products/tags` | Manage tags (lookup) |
| `/products/filter-types` | Manage filter types (lookup) |

---

## 4. Form — Add / Edit Product

| Field | Type | Required | Notes |
|---|---|---|---|
| Title | text | ✅ | **One field, any script** — `20L Jar` or `૨૦ લિટર જાર` |
| Litres | decimal | ✅ | Greater than 0. Three decimal places, covering 0.500 L pouches through 20.000 L jars |
| Tag | select | ✅ | Normal / Cold. A **lookup table** — add your own values |
| Filter type | select | ✅ | Normal / Filtered / Double Filtered. Also a lookup table |
| Description | textarea | ✖ | Any script |
| Base price | currency | ✅ | Zero or more |
| **Returnable** | toggle | ✅ | See §6.1 |
| Sort order | number | ✖ | Controls the order in dropdowns — put your bestseller first |
| Active | toggle | — | Edit form only |

---

## 5. Table — Product list

**Columns:** Code · Title · Litres · Tag · Filter Type · Base Price · Returnable · Status · Actions

| Behaviour | Detail |
|---|---|
| **Search** | Title, description |
| **Filters** | Tag · Filter type · Status · Returnable |
| **Sort** | Title · Litres · Base price · Created date |
| **Row actions** | View · Edit · Deactivate / Reactivate |

### 5.1 KPI cards

Total products · Active products · Highest-volume product this month · Highest-revenue product this month

### 5.2 Detail page

Specs, current price, and a movement summary: units sold this month and lifetime, split by channel (delivery / party / walk-in), plus average realised price against the base price — which shows how much is actually being discounted in the field.

---

## 6. Business rules

### 6.1 The returnable flag

If **on**, this product's containers enter the jar-return flow — issued jars must eventually come back as empty, filled or lost.

If **off**, the product is never counted in return tracking. A sealed 1-litre bottle is sold outright; without this flag every such sale would sit permanently "pending return" and the jars-out number would be meaningless.

### 6.2 Price changes never rewrite history

Every order line **snapshots** the product's title, litres, tag, filter type, base price and returnable flag at the moment the order was created.

A March invoice reprints identically after a June price rise or a rename. Snapshots are immutable — the database refuses any attempt to change one. If the wrong product is on a line, the line is removed and a new one added, which is recorded as a revision.

The product reference is kept alongside the snapshot for reporting, so a renamed product still rolls up to a single line in "revenue by product".

### 6.3 Deletion is impossible; deactivation is the tool

Three layers protect history: a restrict constraint on every reference, soft deletion, and the snapshot columns. A product used by any order cannot be removed even directly in the database console.

### 6.4 Tags and filter types are data, not code

These two are **lookup tables** rather than fixed code values, specifically so the owner can add "Chilled", "RO" or "Alkaline" without a developer. They ship seeded in English and are fully editable — rename them to Gujarati and that name is what everyone sees.

Statuses (`ACTIVE`, `PAID`, `PARTIAL`) are the opposite: they drive branching logic in code, so they are fixed values that cannot change without a deployment.
