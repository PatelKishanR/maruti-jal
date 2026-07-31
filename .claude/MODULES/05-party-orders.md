# Module 5 — Party / Event Orders

**Goal:** handle event bookings where the delivery is spread across multiple days with arbitrary gaps.

---

## 1. In plain English

A wedding hall books water for a three-day function. They don't want it all on day one — 50 jars on the 14th, nothing on the 15th, 80 jars on the 16th.

So a party order is really a **calendar of deliveries**. You book the party once (name, phone, delivery address, notes), then build the day-by-day schedule. Each day has its own item list and its own total.

The system adds up every scheduled day into one total payable. The party may pay an advance at booking, some cash mid-event, and settle the rest at the end — so payments are a running history, and the screen always shows total payable, total received, and what's outstanding.

---

## 2. User stories

| # | As the admin, I want to… | So that… |
|---|---|---|
| PA1 | book a party with name, phone, delivery address and notes | I have the contact and location on file |
| PA2 | add delivery days, each with its own products and quantities | I can handle irregular schedules and gaps |
| PA3 | generate a repeating schedule and then tweak individual days | I don't hand-enter fifteen near-identical days |
| PA4 | see the total payable across all days | I can quote the client one number |
| PA5 | record an advance payment at booking | deposits are tracked |
| PA6 | record multiple partial payments over the event | day-by-day collection works |
| PA7 | see payable, received, outstanding and the full payment history | I always know where the account stands |
| PA8 | mark each day as delivered, skipped or cancelled | I know what actually happened versus what was planned |
| PA9 | record actual delivered quantities where they differ from planned | billing matches reality |
| PA10 | assign a staff member to a delivery day | I know who is going where |
| PA11 | see today's party deliveries on the dashboard | nothing is forgotten on the day |
| PA12 | edit a day's items before it's delivered | last-minute changes are normal at events |

---

## 3. Screens

| Route | Screen |
|---|---|
| `/party-orders` | List + KPI strip |
| `/party-orders/new` | Booking wizard: Party details → Schedule → Advance → Review |
| `/party-orders/[id]` | Detail — schedule timeline, payment history, balances |
| `/party-orders/[id]/edit` | Edit party details and schedule |
| `/party-orders/calendar` | Calendar view of all upcoming party deliveries |

**Modals:** Record payment · Edit a single delivery day

---

## 4. Form — Party details

| Field | Type | Required | Notes |
|---|---|---|---|
| Party name | text | ✅ | One field, any script |
| Phone | text | ✅ | |
| Alternate phone | text | ✖ | |
| Delivery address | textarea | ✅ | Any script |
| Notes | textarea | ✖ | Access instructions, contact person, anything useful on the day |

---

## 5. The schedule builder

The important part of this module. Three ways to add days, all editable afterwards:

| Method | Use it when |
|---|---|
| **Add day manually** | Pick a date, add product lines. For one-offs and irregular days |
| **Repeat pattern** | Pick a start date, end date, and interval (every day / alternate days / every N days) plus a default item list. Generates the days, each individually editable afterwards |
| **Duplicate a day** | Copy an existing day's items to another date |

### 5.1 Timeline rendering

```
┌ 14 Aug 2026 · Fri ──────────────────── [Planned] ┐
│ 20L Jar  × 50  @ ₹40  = ₹2,000                  │
│ 1L Btl   × 100 @ ₹10  = ₹1,000                  │
│                          Day total: ₹3,000       │
│ Assigned: Ramesh                                 │
└────────────────────── [Edit] [Mark Delivered] ───┘

┌ 15 Aug 2026 · Sat ─────────────────── (no delivery)

┌ 16 Aug 2026 · Sun ──────────────────── [Planned] ┐
│ 20L Jar  × 80  @ ₹40  = ₹3,200                  │
│                          Day total: ₹3,200       │
└────────────────────── [Edit] [Mark Delivered] ───┘
```

### 5.2 Why one row per date, not a recurrence rule

The owner was explicit that dates may be consecutive, every other day, or arbitrarily spaced.

A recurrence rule cannot express arbitrary gaps. One row per date can express anything, is trivially editable ("cancel Tuesday"), and lets each day carry its own status, assigned staff and total. The cost — more rows — is irrelevant at this volume.

---

## 6. Day-level fields

| Field | Notes |
|---|---|
| Delivery date | Unique within the order — you cannot schedule the same date twice |
| Status | Planned · Delivered · Skipped · Cancelled |
| Assigned staff | Optional |
| Delivered at | Stamped when marked delivered |
| Notes | Optional |

**Line items per day:** Product · Quantity (planned) · Delivered quantity (optional) · Unit price · Line total

Prices default to the product base price and are overridable per line — events are always negotiated.

---

## 7. Payments

Recorded against the whole party order, not per day, because that is how clients actually pay.

| Field | Notes |
|---|---|
| Date | |
| Amount | Greater than zero |
| Mode | Cash · UPI · Bank transfer |
| Is advance | Flag, so deposits are distinguishable in the history |
| Note | |

The detail page shows **total payable · total received · outstanding** plus the full payment history as a timeline.

---

## 8. Table — Party order list

**Columns:** Code · Party · Phone · Address · Date Range · Days · Total Payable · Received · **Outstanding** · Payment badge · Progress · Actions

Progress is a fraction — `3/5 days` — so you can see at a glance how far through an event you are.

| Behaviour | Detail |
|---|---|
| **Search** | Code, party name, phone, address |
| **Filters** | Date range · Payment status · Delivery status (Upcoming / In progress / Completed / Cancelled) |
| **Sort** | Start date · Total payable · Outstanding · Party name |

**KPIs:** Active parties · Deliveries scheduled today · Party revenue this month · Total party outstanding

---

## 9. Business rules

| Rule | Detail |
|---|---|
| **Total payable** | Sum of all non-cancelled days. Each line bills the delivered quantity if entered, otherwise the planned quantity |
| **Payments are append-only** | Full history preserved; corrections are reversing entries |
| **Cancelling a day recalculates the total** | If that drops the total below what has already been paid, the order flips to `REFUND_DUE` |
| **A delivered day cannot be deleted** | Only cancelled — billing history is preserved |
| **Advance payments are allowed to exceed the current total** | A party may pay a deposit before the full schedule is built. Flagged as an advance |
| **Concurrent edits are blocked** | Version checking, same as delivery orders |

---

## 10. Relationship to delivery orders

Party orders are **independent** of the staff delivery order module. A party delivery is not a route order, does not go through the jar return flow, and does not affect a staff member's jar balance.

This is deliberate. Event jars are collected in bulk at the end of the function, not tracked customer by customer. If jar tracking for parties becomes necessary later, the return event tables already support it — the schedule day would gain the same return rows an order line has.
