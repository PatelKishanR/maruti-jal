# Module 4 — Coin Management

**The most intricate module. Coins are a private currency, so they need real accounting.**

---

## 1. The coin lifecycle, in plain English

1. You define a **coin type**: "Blue Token", 100 coins per packet, ₹1,000 per packet → each coin is worth ₹10. You enter how many you have in stock.
2. You **issue** packets to a staff member to sell. Stock drops. The staff member now owes you the full face value.
3. The staff member sells coins to customers for cash and pays you — all at once, partly, or later in instalments.
4. Customers later pay for water with those coins. When the staff member hands them in as **order payment**, stock goes back up.
5. If the staff member couldn't sell everything, he **returns** the unsold coins against that issue. That reduces what he owes — and if he'd already paid in full, **you now owe him a refund**.
6. You can also **adjust** stock directly: new coins purchased (increase), or coins lost or damaged (decrease), always with a reason.

Every one of those six events is a line in that coin type's **ledger**, so the total is always explainable:

```
Opening 3,000 + In 640 − Out 1,200 = Balance 2,440 coins (₹24,400)
```

---

## 2. User stories

| # | As the admin, I want to… | So that… |
|---|---|---|
| C1 | define a coin type with name, coins per packet and packet amount | the system values coins automatically |
| C2 | see the derived per-coin price and stock in both packets and coins | I know my float without doing arithmetic |
| C3 | issue packets to a staff member across multiple coin types at once | the handover is one record, not three |
| C4 | see an automatic amount breakdown while issuing | I know what to collect before handing them over |
| C5 | record full, partial or no payment at issue time | it matches how staff actually pay |
| C6 | record further payments against an issue later | instalments are supported |
| C7 | record returned unsold coins against a specific issue | the staff member's debt reduces correctly |
| C8 | read `issued / returned / collected / pending` in one register row | I see the whole relationship at a glance |
| C9 | be told when a return means I owe the staff member a refund, and record it | overpayments don't silently disappear |
| C10 | view a per-coin-type ledger with a running balance | I can audit where every coin went |
| C11 | make stock adjustments with a mandatory reason | the ledger matches physical reality |
| C12 | see coins received via order payments appear in the ledger automatically | the loop closes without double entry |
| C13 | be stopped from issuing more coins than I have | stock can never go negative |

---

## 3. Screens

| Route | Screen |
|---|---|
| `/coins/types` | Coin type list — the stock overview |
| `/coins/types/new` · `/coins/types/[id]/edit` | Coin type forms |
| `/coins/types/[id]` | Coin type detail + **Ledger** tab |
| `/coins/issues` | **The issue register** — the main working screen |
| `/coins/issues/new` | Create issue |
| `/coins/issues/[id]` | Issue detail — items, returns, payments, net settlement |
| `/coins/adjustments` | Adjustment list |

**Modals:** Record coin payment · Record coin return · New stock adjustment

---

## 4. Coin types

### 4.1 Form

| Field | Required | Notes |
|---|---|---|
| Name | ✅ | Unique. One field, any script |
| Coins per packet | ✅ | Greater than 0 |
| Packet amount | ✅ | Zero or more |
| **Per-coin value** | derived | Read-only, shown live: packet amount ÷ coins per packet, held to six decimal places |
| Opening stock (coins) | create only | Writes an `OPENING` ledger entry — **not** a column. The ledger is the single source of truth |
| Colour | ✖ | Badge colour in the UI |
| Active | — | Edit only |

### 4.2 Table

**Columns:** Name · Coins/Packet · Packet Amount · Per-Coin Value · Stock (coins) · Stock (packets) · Stock Value · Status

Stock in packets is displayed readably — *"30 packets + 45 coins"* — because that's how they're physically counted.

**KPIs:** Coin types · Total coins in stock · Total value in stock · Coins out with staff

---

## 5. Coin issues

### 5.1 Form

**Header:** Staff ✅ · Issue date ✅ · Note

**Lines (repeatable):** Coin type · Packets → automatically shows coins and amount

**Breakdown panel:**

```
Blue Token   3 packets × 100 = 300 coins × ₹10 = ₹3,000
Red Token    2 packets × 50  = 100 coins × ₹20 = ₹2,000
──────────────────────────────────────────────────────
Total                          400 coins          ₹5,000
```

**Payment at issue:** amount paid now — may be zero, partial or full. The balance updates live.

Stock availability is checked per coin type under a lock, so two people issuing the last packets at the same moment cannot both succeed.

### 5.2 The register

This is the register view the owner asked for. **One row tells the whole story.**

| Code | Date | Staff | Issued | Returned | Net Payable | Collected | **Pending** | Status |
|---|---|---|---|---|---|---|---|---|
| CIS-000012 | 14 Aug | Ramesh | 400 / ₹5,000 | 50 / ₹500 | ₹4,500 | ₹4,000 | **₹500** | 🟠 Partial |
| CIS-000011 | 12 Aug | Suresh | 200 / ₹2,000 | 0 | ₹2,000 | ₹2,500 | **−₹500** | 🔵 Refund due |
| CIS-000010 | 09 Aug | Ramesh | 300 / ₹3,000 | 300 / ₹3,000 | ₹0 | ₹0 | ₹0 | 🟢 Settled |

| Behaviour | Detail |
|---|---|
| **Search** | Issue code, staff name, staff phone |
| **Filters** | Staff · Date range · Coin type · Status (Pending / Partial / Settled / Refund due) |
| **Sort** | Date · Net payable · Pending amount · Staff |
| **Expandable row** | Reveals the per-coin-type breakdown inline, without leaving the page |

**KPIs:** Open issues · Total coins out with staff · Total pending collection · Refunds due

---

## 6. Modal — Record Coin Return

Per issue line: coin type · issued · already returned · **returning now** · remaining.

On save:
- Stock **increases** via a ledger entry
- Net payable **decreases**
- Status recalculates — and flips to **`REFUND_DUE`** if collections now exceed the net payable

Returning more than was issued (net of prior returns) is blocked by a database constraint.

### 6.1 The refund path

If a staff member paid ₹5,000 up front and later returns ₹1,200 of unsold coins, the pending amount becomes **−₹1,200** and the row turns blue with a `Refund due` badge.

The refund is then recorded as an **outbound payment**, which brings pending back to zero. What was already paid is never edited — the history shows the ₹5,000 in and the ₹1,200 out, which is what actually happened.

---

## 7. The coin ledger

**Append-only.** Nothing is ever edited or deleted; corrections are reversing entries.

| Movement | Direction | Triggered by |
|---|---|---|
| `OPENING` | + | Coin type created with opening stock |
| `ISSUE` | − | Coins issued to a staff member |
| `ISSUE_RETURN` | + | Unsold coins returned against an issue |
| `ORDER_RECEIPT` | + | Customer coins handed in as delivery-order payment |
| `ADJUSTMENT_IN` | + | New coins purchased or found |
| `ADJUSTMENT_OUT` | − | Lost, damaged or written off |
| `ISSUE_CANCELLED` | + | An issue was cancelled |

### 7.1 Ledger view

Per coin type: Date · Movement · Reference · In · Out · **Running balance** · Note

The reference is clickable — `CIS-000012` opens the issue, `ORD-000044` opens the order. Filterable by movement type and date range, and exportable.

A **reconciliation banner** sits at the top:

```
Opening 3,000 + In 640 − Out 1,200 = Balance 2,440 coins (₹24,400)
```

### 7.2 Adjustments

| Field | Required | Notes |
|---|---|---|
| Coin type | ✅ | |
| Date | ✅ | |
| Direction | ✅ | In (new stock) / Out (loss) |
| Coins | ✅ | Greater than 0 |
| Reason | ✅ | New stock · Purchased · Lost · Damaged · Stolen · Reconciliation |
| Note | ✅ | **Mandatory.** A stock adjustment with no explanation is how theft hides |

---

## 8. Business rules

| Rule | Reasoning |
|---|---|
| Per-coin value is **derived**, never editable | It is always packet amount ÷ coins per packet, so it cannot be wrong |
| Every issue line **snapshots** the per-coin value | Changing a coin type's packet price later cannot rewrite old issues |
| Stock can never go negative | The balance is checked under a lock inside the same transaction as the ledger entry; the transaction refuses to commit otherwise |
| Only the ledger may change stock | The cached balance on the coin type is updated inside the same transaction as every ledger insert. Nothing else touches it |
| **Coins received as order payment never touch a staff member's issue balance** | A coin sold to a customer stays on that staff member's liability until physically returned. Conflating the two would double-count |
| A coin type with any ledger movement cannot be deleted | Only deactivated |

### 8.1 Coins in circulation

A dedicated view computes `issued − returned by staff − redeemed via orders`. That figure is the coins genuinely out in customers' hands. Any unexplained gap between it and physical reality surfaces here rather than hiding inside a total.

### 8.2 Rounding

Where a packet doesn't divide evenly — ₹500 across 45 coins is ₹11.111111 each — the per-coin value is held to six decimal places, but every row-level amount is rounded and stored to two.

The consequence, stated plainly: returning 45 coins one at a time credits ₹499.95, not ₹500. A five-paise gap.

The register exposes a **"settle difference"** write-off so issues can close cleanly rather than sitting open over five paise forever.

---

## 9. Why this module is built before Delivery Orders

Order payments can be made in coins, and every such payment writes a coin ledger entry. Orders therefore depend on coins, not the reverse.

Building coins first means the ledger is proven — including its behaviour under two people acting at once — before anything else relies on it. The exit criterion for this phase is a test that fires two simultaneous issues of the last ten coins and proves exactly one succeeds.
