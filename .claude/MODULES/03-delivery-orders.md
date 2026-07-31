# Module 3 — Delivery Orders

**Jar issue, returns, and cash/coin collection. The heart of the system.**

---

## 1. In plain English

Each morning a staff member loads jars onto their vehicle. You record that as an **order**: who took it, on what date, which products, how many, and at what price — the product's base price by default, overridden if a rate was negotiated.

Later the staff member comes back. Some jars come back **empty** — the customer kept the water and returned the jar. Some come back **filled** because they didn't sell. Some are **still out** with customers who haven't returned the jar yet. You record that as a **return** against the order, and you can record returns more than once, because jars trickle back over days.

The staff member also hands over money. That might be **cash**, or **coins** that customers paid with. It might be the full amount, or part of it, or nothing today and something tomorrow. Each one is a separate payment recorded against the order.

At any moment the order screen shows two independent things: **how much money is still to collect**, and **how many jars are still out**. Both appear as coloured badges in the list, and both have one-click filters.

---

## 2. User stories

| # | As the admin, I want to… | So that… |
|---|---|---|
| O1 | create an order against a staff member with multiple line items | I have a record of exactly what left the plant |
| O2 | override the price on any line when a rate was bargained | the total reflects what was actually charged, not the list price |
| O3 | add the same product twice at two different rates | one route legitimately serves two customers at two prices |
| O4 | record a payment while creating the order | the common case — paid on the spot — is one form, not two |
| O5 | record payments later, in parts, in cash and/or coins | ₹500 cash today and 30 coins tomorrow, against the same order |
| O6 | edit an order after creating it | I can fix a mis-keyed quantity, with the change recorded in history |
| O7 | record a return split into empty / filled / lost | I know exactly where my jars are |
| O8 | record returns multiple times against one order | jars trickling back over a week are all captured |
| O9 | attribute a jar returned today to the order it went out on last week | old orders actually close instead of sitting open forever |
| O10 | see, per order, money still to collect and jars still out | I know what's unfinished |
| O11 | filter by "money pending" and "jars out" in one click | I can work through my chase list |
| O12 | write off jars that will never come back | orders can eventually reach a closed state |
| O13 | see each staff member's running jar balance across all orders | I know the real operational number, not just per-order detail |
| O14 | be warned before editing an order that already has payments or returns | I don't silently break a reconciled record |

---

## 3. Screens

| Route | Screen |
|---|---|
| `/orders` | List + KPI strip |
| `/orders/new` | Create — line-item builder with optional payment |
| `/orders/[id]` | Detail — items, returns timeline, payments timeline, balances |
| `/orders/[id]/edit` | Edit header and items |

**Modals on the detail page:** Record Payment · Record Return

---

## 4. Form — Create / Edit Order

### 4.1 Header

| Field | Type | Required | Notes |
|---|---|---|---|
| Staff | searchable select | ✅ | Active staff only |
| Order date | date | ✅ | Defaults to today |
| Notes | textarea | ✖ | Any script |
| Discount | currency | ✖ | Header-level round-off, zero or more |

### 4.2 Line items — repeatable, at least one

| Field | Behaviour |
|---|---|
| Product | Searchable select, active products only |
| Quantity | Integer greater than 0 |
| Base price | Read-only, filled from the product, shown for reference |
| Charged price | Pre-filled with the base price, editable. If changed, the row shows a *rate overridden* chip and the difference |
| Override note | Optional free text — "Sharma ji regular rate" |
| Line total | Quantity × charged price |

**The same product may appear on multiple lines.** This is deliberate: one route order legitimately contains 20-litre jars at ₹35 for one customer and ₹30 for another. Lines are identified by their position, not by product.

### 4.3 Live totals panel

Total quantity · Subtotal · Discount · **Order total** · Amount paid now · **Balance**

### 4.4 Optional payment-on-create block

Cash amount, plus repeatable coin rows (coin type + number of coins → value computed automatically). The sum is shown against the order total so you can see immediately whether it settles.

---

## 5. Modal — Record Payment

| Field | Notes |
|---|---|
| Payment date | Defaults to today |
| Cash amount | Zero or more |
| Coin lines | Repeatable: coin type + number of coins → value computed at that type's per-coin price |
| Note | Optional |

The footer shows: order total · already collected · **this payment** · balance after this payment.

### 5.1 Rules

- **Overpayment is allowed**, flagged amber, not blocked. Cash businesses take round-number payments constantly; blocking a ₹2,000 payment against a ₹1,940 balance just pushes staff into recording false amounts
- **Coins received here are added back to that coin type's stock**, via a ledger entry. This is the return leg of the coin lifecycle and happens automatically — you never record it twice
- Each submission carries an idempotency key, so a double-tap on a poor connection cannot create two payments
- Payments are **append-only**. A mistake is corrected by a reversing entry, never by editing the original

---

## 6. Modal — Record Return

One row per returnable line item:

| Product | Issued | Already back | Empty now | Filled now | Lost now | Still pending |
|---|---|---|---|---|---|---|
| 20L Jar | 40 | 22 | `[ 8 ]` | `[ 2 ]` | `[ 0 ]` | 8 |

### 6.1 Rules

| Rule | Reasoning |
|---|---|
| **"Still pending" is calculated, never typed** — `issued − (empty + filled + lost)` | Removes a whole class of data-entry error and guarantees the three buckets always reconcile to the issued quantity |
| Over-returning is blocked **by the database**, not just the UI | A constraint enforces it, so it holds even for imports and direct database edits |
| Only **returnable** products appear | Disposable bottles are never counted |
| **Filled returns are credited back** | The line total is `(quantity − filled returns) × unit price`. The staff only owes for what he sold — decision D5 |
| Returns are **append-only events** | Jars trickle back over days; each recording keeps its own date and author. A correction is a reversing entry, and both stay visible |
| Lost jars are written off explicitly | Otherwise orders sit pending forever and the jars-out number inflates permanently |

### 6.2 Cross-order returns

A customer often returns a jar from last week's order when this week's staff member calls.

The return modal therefore lists **every open line for that staff member across all past orders**, newest first, so a returning jar can be ticked against the original line it went out on. This is what lets old orders actually close.

Alongside it, the staff detail page shows a **running jar balance** — total issued minus total returned, all-time. That is the number that matters operationally ("Ramesh has 47 jars out"); the per-order detail is what makes it auditable.

---

## 7. Table — Order list

**Columns:** Code · Date · Staff · Items · Total · Collected · **Balance** · Payment badge · Return badge · Actions

The Items column is a summary chip: *"3 items / 62 units"*.

### 7.1 Badges

| Payment | Return |
|---|---|
| 🔴 `Unpaid` | 🔴 `12 jars out` |
| 🟠 `Partial — ₹450 due` | 🟠 `Partial` |
| 🟢 `Paid` | 🟢 `Settled` |
| 🟡 `Overpaid` | ⚪ `Not applicable` |

### 7.2 Search, filter and sort

| Behaviour | Detail |
|---|---|
| **Search** | Order code, staff name, staff phone |
| **Filters** | Staff · Date range · Payment status · Return status · Product · Amount range |
| **Quick chips** | `Today` · `Money pending` · `Jars out` · `Fully settled` |
| **Sort** | Date · Order total · Balance · Jars pending · Staff name |

### 7.3 KPI cards

Today's orders · Today's collection · Total outstanding cash · Total jars currently out

---

## 8. Business rules

| Rule | Detail |
|---|---|
| **Order total** | `Σ(chargeable quantity × charged price) − discount`, where chargeable quantity excludes filled returns |
| **Status recalculation** | Payment and return status are recalculated by the database inside the same transaction as any payment, return or edit — they can never drift from the underlying records |
| **Editing with history** | Allowed, but warned. Reducing a quantity below what has already been returned is blocked |
| **Concurrent edits** | Two people editing the same order → the second save fails with *"changed by Ramesh 30 seconds ago, reload"* rather than silently overwriting |
| **Cancellation** | Requires payments and returns to be reversed first. Money is never cascade-deleted |
| **Every edit writes a revision** | The detail page shows *"Edited 3 times · v4"* with a side-by-side diff |

---

## 9. Why the order total can change after creation

This surprises people, so it is stated explicitly.

Because unsold filled jars are credited back (decision D5), recording a return **reduces** the order total. An order created at ₹1,400 for 40 jars becomes ₹1,330 once 2 unsold jars come home.

This is correct — the staff member sold 38 jars, so he owes for 38. It is also the single reason the rollup columns must be maintained by the database rather than calculated once at creation: the total is a function of returns, and returns arrive later.

If the business ever changes to billing for everything issued, that is a one-line configuration change rather than a schema migration — the flag already exists.
