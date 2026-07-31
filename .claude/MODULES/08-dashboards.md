# Module 8 — Dashboards

**Goal:** answer the four business questions on one screen, and make every number a door into the detail behind it.

---

## 1. Two levels

| Level | Where | Answers |
|---|---|---|
| **Module dashboards** | A KPI strip at the top of each list page | "What's happening in *this* area today?" |
| **Executive dashboard** | The home page, `/` | "How is the business doing overall?" |

---

## 2. Module KPI strips

Specified in each module's own spec. Summarised here:

| Module | KPI cards |
|---|---|
| Staff | Total staff · Active · Cash outstanding · Jars out |
| Products | Total products · Active · Top product by volume · Top product by revenue |
| Delivery Orders | Today's orders · Today's collection · Total outstanding cash · Total jars out |
| Coin types | Coin types · Coins in stock · Value in stock · Coins out with staff |
| Coin issues | Open issues · Coins out with staff · Pending collection · Refunds due |
| Party Orders | Active parties · Deliveries today · Party revenue this month · Party outstanding |
| Direct Sales | Today's count · Today's collection · This month's revenue · Average sale |
| Expenses | This month's expenses · Biggest category · vs last month · This month's profit |

---

## 3. Executive dashboard

The owner's home screen — the whole business on one page.

### Row 1 — Today

| Card | Detail |
|---|---|
| **Today's revenue** | Split three ways: delivery · party · walk-in |
| **Today's collection** | Split by form: cash vs coins |
| **Today's expenses** | |
| **Today's net** | Collection minus expenses |

### Row 2 — Money at risk

The row the owner will look at first.

| Card | Detail |
|---|---|
| Cash outstanding from staff | Across all delivery orders |
| Outstanding from parties | Across all party orders |
| Coin dues from staff | Across all coin issues |
| **Total jars out** | With a red sub-count: *"out 7+ days"* |

### Row 3 — Charts

| Chart | Shows |
|---|---|
| Revenue trend, last 30 days | Stacked by channel — delivery / party / walk-in |
| Revenue vs expenses, last 6 months | Two series with a profit line |
| Top 5 products this month | By volume |
| Collection mix this month | Cash vs coins |

### Row 4 — Operational tables

| Table | Contents |
|---|---|
| **Staff scoreboard** | Per staff member: orders this month, revenue, cash outstanding, jars out, coin dues. Sortable. **The single most useful table in the app** |
| **Coin position** | Per coin type: stock, out with staff, value, link to the ledger |
| **Attention needed** | One merged action list: overdue payments · jars out 7+ days · coin issues unsettled 15+ days · party deliveries scheduled today |
| **Today's schedule** | Party deliveries due today, with assigned staff |

### Global date filter

Today · This week · This month · Last month · Custom range.

Applies to rows 1 and 3. Rows 2 and 4 are always current state — an outstanding balance isn't a period figure.

---

## 4. Rules

### 4.1 Every number is clickable

Every KPI deep-links into the relevant list with filters already applied:

| Card | Destination |
|---|---|
| Total jars out | Order list, filtered to return pending |
| Cash outstanding from staff | Order list, filtered to payment pending |
| Coin dues from staff | Coin issue register, filtered to unsettled |
| Today's walk-in collection | Direct sales, filtered to today |

**A dashboard number you cannot drill into is a dead end.** It tells you something is wrong without telling you where, which sends the owner back to the registers the app was built to replace.

### 4.2 Aggregates, not loops

Dashboard figures come from indexed SQL aggregates over the cached rollup columns — never from loading orders into memory and adding them up. At 50,000 orders the difference is between a page that loads and one that times out.

Results are cached briefly and invalidated whenever a relevant record changes, so the numbers are never stale in a way the owner would notice.

### 4.3 The coin reconciliation banner

If a coin type's cached balance ever disagrees with the sum of its ledger, a red banner appears on the dashboard naming the coin type and the discrepancy.

This is what turns *"the coin numbers are wrong somehow"* — an unfixable complaint — into a specific bug with a specific record. It should never fire. That it exists is the point.

---

## 5. Mobile

The owner will check this on a phone.

Below the `md` breakpoint the KPI rows stack two-up, charts become full-width and scroll horizontally where needed, and the operational tables collapse into cards. The "money at risk" row is ordered first on mobile, because that is what gets checked on the way to the plant.
