# Module 6 — Direct Water Supply (walk-in)

**Goal:** count the cash that currently walks in and out of the plant unrecorded.

---

## 1. In plain English

Someone drives up to the plant with their own cans, fills them, pays cash, and leaves. Nothing is owed. Nothing is returned.

This module exists purely so that revenue stream is **counted** rather than being invisible cash in a drawer. There is no payment status, no return tracking, no outstanding balance — by design.

**Speed is the entire design goal.** If recording a walk-in takes longer than serving one, it won't get recorded.

---

## 2. User stories

| # | As the admin, I want to… | So that… |
|---|---|---|
| D1 | record a walk-in with just a name and an amount, in seconds | recording it doesn't slow down the counter |
| D2 | optionally add phone and address | I build a picture of repeat customers over time |
| D3 | optionally record what was filled | I can see volume, not just rupees |
| D4 | see today's walk-ins and today's total | I can tally the cash drawer at closing |
| D5 | search and filter past sales | I can look up an old entry |
| D6 | have a known phone number auto-fill the rest | I don't retype details for regulars |
| D7 | void a wrong entry with a reason | the daily cash tally stays auditable |

---

## 3. Screens

| Route | Screen |
|---|---|
| `/direct-sales` | List, with a **fast inline entry row at the top of the table** |
| `/direct-sales/[id]` | Detail |
| `/direct-sales/[id]/edit` | Edit |

There is no separate create page. The create form is two fields inline on the list: **name + amount + Enter**. An "Add details" expander reveals the optional fields for the rare case they're wanted.

---

## 4. Form

| Field | Required | Notes |
|---|---|---|
| Customer name | ✅ | Autocompletes from past walk-ins. One field, any script |
| Amount paid | ✅ | Greater than zero |
| Sale date | ✅ | Defaults to today |
| Phone | ✖ | Typing a known number auto-fills name and address |
| Address | ✖ | |
| Product | ✖ | For water-type reporting |
| Litres filled | ✖ | For volume reporting |
| Note | ✖ | |

---

## 5. Table

**Columns:** Code · Date · Customer · Phone · Litres · Amount · Actions

| Behaviour | Detail |
|---|---|
| **Search** | Customer name, phone |
| **Filters** | Date range · Amount range |
| **Sort** | Date · Amount · Customer |
| **Default view** | Today's sales, newest first |

**KPIs:** Today's walk-in count · Today's collection · This month's walk-in revenue · Average sale value

---

## 6. Business rules

| Rule | Reasoning |
|---|---|
| **Always fully paid, always cash** | Enforced as a database constraint rather than a nullable status column, so the invalid state is unrepresentable. If UPI is added later it's a one-line change |
| **No payment status, no outstanding** | There is nothing to track. Adding the columns "just in case" would invite half-recorded sales |
| **Same-day entries can be edited** | Mistakes at the counter are normal |
| **Older entries can only be voided, with a reason** | So a day's cash total, once tallied, cannot be quietly altered afterwards |
| **The time of sale is recorded, not just the date** | Walk-ins cluster by hour, which is useful for deciding when to staff the counter |

---

## 7. Note on the customer autocomplete

There is no customer master (decision D3 — the system is staff-level). The autocomplete works by matching against **names and phone numbers already recorded on past walk-in sales**.

That gives the convenience of not retyping a regular's details without introducing a customer entity, per-customer ledgers, or the maintenance burden that comes with them. If a real customer master is ever needed, this data is exactly what would seed it.
