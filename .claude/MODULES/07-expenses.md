# Module 7 — Expenses

**Goal:** make profit knowable rather than guessed.

---

## 1. In plain English

Revenue alone doesn't tell you whether the business made money. This module records what goes out — diesel, staff salary, electricity, plant maintenance, new jars, coin printing, repairs — so the executive dashboard can show real profit rather than just turnover.

Categories are yours to define. Every expense can carry a photo of the bill, and salary or advance payments can be linked to the staff member they relate to.

---

## 2. User stories

| # | As the admin, I want to… | So that… |
|---|---|---|
| E1 | define my own expense categories | they match how I actually think about the business |
| E2 | record an expense with date, category, amount, who it was paid to and a note | outgoings are on record |
| E3 | attach a photo of the bill | I have proof later |
| E4 | link an expense to a staff member for salary or advances | I can see the true cost per person |
| E5 | see expenses grouped by category and by month | I can spot where money is leaking |
| E6 | compare this month against last month | I notice a jump before it becomes a habit |
| E7 | see income minus expenses on the dashboard | I know whether the business is healthy |

---

## 3. Screens

| Route | Screen |
|---|---|
| `/expenses` | List + KPI strip |
| `/expenses/new` | Create |
| `/expenses/[id]` | Detail, with the attachment shown |
| `/expenses/[id]/edit` | Edit |
| `/expenses/categories` | Manage categories |

---

## 4. Form

| Field | Type | Required | Notes |
|---|---|---|---|
| Date | date | ✅ | Defaults to today, cannot be in the future |
| Category | select | ✅ | From your own list |
| Amount | currency | ✅ | Greater than zero |
| Payment mode | select | ✅ | Cash · UPI · Bank transfer · Cheque |
| Paid to | text | ✖ | Vendor or person. Any script |
| Linked staff | select | ✖ | For salary, advances, reimbursements |
| Note | textarea | ✖ | Any script |
| Receipt | file | ✖ | Photo or PDF of the bill |

### 4.1 Categories

A simple editable list — name and active flag. Seeded with a starting set that you can rename, extend or deactivate:

Fuel · Staff salary · Staff advance · Electricity · Plant maintenance · Bottle & jar purchase · Coin printing · Vehicle maintenance · Rent · Miscellaneous

Deactivating a category keeps it on historical expenses while removing it from the dropdown for new ones.

---

## 5. Table

**Columns:** Code · Date · Category · Paid To · Amount · Mode · Attachment · Actions

| Behaviour | Detail |
|---|---|
| **Search** | Paid to, note, expense code |
| **Filters** | Category · Date range · Payment mode · Amount range · Linked staff · Has attachment |
| **Sort** | Date · Amount · Category |
| **Default view** | This month, newest first |

### 5.1 KPI cards

This month's total expenses · Biggest category this month · Change against last month (▲ / ▼ %) · **This month's profit** (income minus expenses)

---

## 6. Business rules

| Rule | Detail |
|---|---|
| Expenses are soft-deleted | Deleting one would silently change a past month's profit figure |
| Editing writes an audit entry | Same as every other transactional record |
| A category in use cannot be deleted | Only deactivated |
| Expenses feed the profit calculation directly | Income (delivery + party + walk-in) minus expenses, over the selected period |

---

## 7. What this module deliberately does not do

It is a **cash-out register**, not an accounting system. There is no double-entry, no chart of accounts, no depreciation, no accruals, no vendor ledger with its own outstanding balances.

That's the right scope: the question being answered is *"did the business make money this month?"*, and for that a categorised list of outgoings against categorised income is sufficient and immediately understandable. Adding accounting structure would make the module harder to use and would not improve the answer.

If the business later needs vendor balances or GST-compliant books, that is a separate system, and this module's data exports cleanly into one.
