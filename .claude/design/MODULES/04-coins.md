# Module 04 — Coins · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/04-coins.md](../../MODULES/04-coins.md)
>
> Coins are the company's own prepaid currency. This module is a **ledger system with a UI on top**, not a CRUD screen set. Everything below assumes the ledger is the truth and the screens are windows onto it.

---

## 1. Design context (for Stitch)

**Product:** internal web app for the owner of a mineral-water plant in Gujarat, India. Data-dense, used many times a day, English + Gujarati, light + dark.

### 1.1 Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| Primary — Nova Blue | `#2563EB` | `#3B82F6` | Primary buttons, links, focus rings, refund/info |
| Surface (card) | `#FFFFFF` | `#1E293B` | Cards, table body, modals |
| Surface subtle | `#F3F4F6` | `#1E293B` | Table headers, inset panels, expanded rows |
| Page background | `#F8FAFC` | `#0B1220` | Behind cards |
| Text primary | `#111827` | `#F1F5F9` | Values, headings |
| Text secondary | `#4B5563` | `#94A3B8` | Labels, captions, helper |
| Text muted / empty | `#D1D5DB` | `#475569` | Em-dash zero values |
| Border | `#E5E7EB` | `#334155` | Card borders, table rules |
| Input border | `#D1D5DB` | `#334155` | Field outlines |
| Success | `#22C55E` | same | Settled, paid, coins in |
| Warning | `#F97316` | same | Partial, attention |
| Danger | `#EF4444` | same | Unpaid, coins out, drift |

### 1.2 Type

| Role | Spec |
|---|---|
| H2 page title | 28px / 1.3 / 600 / `#111827` |
| H3 card heading | 22px / 1.4 / 600 |
| H4 modal + section | 18px / 1.4 / 600 |
| Body | 16px / 1.6 / 400 |
| Body SM (default) | 14px / 1.5 / 400 — table cells, labels |
| Caption | 12px / 1.4 / 500 — metadata, badges, column headers |

Fonts: **Inter** for text, **JetBrains Mono** (`tabular-nums`) for every figure, **Noto Sans Gujarati** in the fallback stack.

| Figure role | Spec |
|---|---|
| Table amount | 14px mono 500, right-aligned |
| Emphasised amount (pending, balance) | 14px mono **600** `#111827`, right-aligned |
| KPI value | 28px mono 700 |
| Form/panel total | 18px mono 600 |
| Ledger running balance | 14px mono 600 in an inset column |

### 1.3 Space, radius, metrics

| Token | Value | | Element | Value |
|---|---|---|---|---|
| `space-1` | 4px | | Table header row | **44px** |
| `space-2` | 8px | | Table body row | **48px** |
| `space-3` | 12px | | Line-item row (contains inputs) | **56px** |
| `space-4` | 16px | | Sub-row inside an expanded row | **40px** |
| `space-6` | 24px | | Toolbar / pagination | 56px |
| `space-8` | 32px | | Input height | 40px (48px fast-entry) |

Radius: input 4px · button/chip 8px · badge full · card/table/modal 12px. Shadow: card `0 1px 2px rgba(0,0,0,.05)`, modal `0 20px 25px rgba(0,0,0,.15)`. Content max width 1440px, padding 24px (16px below `md`). Sidebar 240px, topbar 64px.

### 1.4 Badges — §7.1 variants, used verbatim

| Variant | Light bg / text | Dark bg / text |
|---|---|---|
| Default | `#E5E7EB` / `#374151` | `#334155` / `#E2E8F0` |
| Primary | `#DBEAFE` / `#1D4ED8` | `#1E3A8A` / `#BFDBFE` |
| Success | `#DCFCE7` / `#15803D` | `#14532D` / `#BBF7D0` |
| Warning | `#FEF3C7` / `#B45309` | `#7C2D12` / `#FED7AA` |
| Danger | `#FEE2E2` / `#B91C1C` | `#7F1D1D` / `#FECACA` |

22px tall, 8px horizontal padding, full radius, 12px/500, optional 12px leading icon + 4px gap.

**Coin issue status map (from §7.2, applied verbatim):**

| Condition | Variant · Label · Icon |
|---|---|
| Collected `= 0`, net payable `> 0` | Danger · `Unpaid` · `Circle` |
| `0 <` collected `<` net payable | Warning · `₹500 due` · `CircleDashed` |
| Collected `=` net payable `> 0` | Success · `Paid` · `CheckCircle2` |
| Net payable `= 0` (everything returned) | Success · `Settled` · `PackageCheck` |
| Collected `>` net payable | Primary · `Refund ₹1,200` · `RotateCcw` |
| Cancelled | Default · `Cancelled` · `Ban` + row at 60% opacity |
| Coin type active / inactive | Success `Active` / Default `Inactive` |

### 1.5 Numbers

`₹` + Indian lakh grouping + **always 2 decimals** → `₹12,34,567.00`. Zero → em dash `—` in `#D1D5DB`. Negative → parentheses `(₹1,200.00)`. Quantities: grouped, no decimals → `2,440`. Dates `14 Aug 2026`, today → `Today`. Time `6:05 pm`. **Digits are Latin 0–9 in both languages.**

> **Module exception (documented):** in the **Pending** column and on the issue detail, a negative pending is a *refund owed*, not a loss. It renders `(₹1,200.00)` in **Nova Blue `#2563EB` 600**, not Danger red. Parentheses still carry the sign, so colour is never the only signal.

### 1.6 Icons (Lucide, 1.5px stroke, §17 map)

`Coins` coin · `BookOpen` ledger · `RotateCcw` return/refund · `ClipboardList` delivery order · `Users` staff · `Receipt` expense · `Plus` add · `Pencil` edit · `Trash2` delete · `Search` search · `SlidersHorizontal` filter · `Download` export · `MoreHorizontal` more · `Ban` cancelled · `PackageX` stock out · `PackageCheck` settled · `AlertTriangle` error · `AlertCircle` field error · `ChevronRight` / `ChevronDown` expand.

### 1.7 The five principles

1. **Density over whitespace** — 48px rows, tight cards. The owner needs 25 issues on one screen.
2. **Numbers are the interface** — figures get mono, right alignment and more weight than their labels.
3. **Status is scannable without reading** — a red or blue row is spotted at arm's length.
4. **Every number is a door** — KPIs, badge counts and reference codes all navigate to a filtered list or a record.
5. **Entry speed is a feature** — first field autofocused, deliberate tab order, `⌘/Ctrl + Enter` submits.

---

## 2. Screens in this module

| # | Screen | Route | Archetype | Purpose |
|---|---|---|---|---|
| 3 | Coin type list | `/coins/types` | **A — List** | Stock overview: how many coins exist, in packets and in rupees |
| 4 | Coin type form | `/coins/types/new` · `/coins/types/[id]/edit` | **C — Form** | Define name, packet size, packet amount; derive per-coin value live |
| 5 | Coin type detail + **Ledger** | `/coins/types/[id]` | **B — Detail** | The register book: every movement, running balance, reconciliation |
| 6 | **Coin issue register** | `/coins/issues` | **A — List** | The centrepiece. One row = issued / returned / net / collected / pending |
| 7 | Coin issue create | `/coins/issues/new` | **C — Form** | Repeatable lines, live breakdown, payment at issue, stock guard |
| 8 | Coin issue detail | `/coins/issues/[id]` | **B — Detail** | Lines, returns, payments, net settlement, refund path |
| 9 | Modal — Record coin return | over 6 / 8 | Modal form 720px | Per line: issued / returned / returning now / remaining |
| 10 | Modal — Record coin payment or refund | over 6 / 8 | Modal form 560px | Instalments in; refunds out |
| 11 | Adjustment list | `/coins/adjustments` | **A — List** | Every manual stock correction, with its reason |
| 12 | Modal — New stock adjustment | over 5 / 11 | Modal form 560px | Direction, coins, mandatory reason **and** mandatory note |
| 13 | Shared — reconciliation drift banner | 3 · 5 · 6 | Component | Non-dismissible danger banner when cache ≠ ledger |

---

## 3. Screen — Coin type list `/coins/types`

### 3.1 Purpose

The float at a glance. How many coin types exist, how many coins sit in the store room, what they are worth, and how many are out with staff. The owner counts coins in **packets**, so stock is shown both ways on every row.

### 3.2 Layout

```
Coin Types                                        [⬇ Export CSV]  [+ New coin type]
Your prepaid tokens, their value, and what is left in stock

┌──────────────────┐┌──────────────────┐┌──────────────────┐┌──────────────────┐
│ ⛁ COIN TYPES     ││ ⛁ COINS IN STOCK ││ ₹ VALUE IN STOCK ││ ⛁ OUT WITH STAFF │
│ 4                ││ 5,240            ││ ₹68,400.00       ││ 1,150            │
│ 3 active · 1 off ││ 47 packets + 40  ││ across 4 types   ││ ₹12,600.00       │
└──────────────────┘└──────────────────┘└──────────────────┘└──────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search coin type name…]                    [⚙ Filters]      [⚙ Columns]   │
│ ● Active  ● Inactive  ● Low stock (<5 packets)                     [Clear all]│
├───────────────────────────────────────────────────────────────────────────────┤
│ NAME ↕     COINS/PKT  PACKET AMT  PER-COIN   STOCK      STOCK (PACKETS)   … │
├───────────────────────────────────────────────────────────────────────────────┤
│ ● Blue Token     100   ₹1,000.00     ₹10.00     2,440   24 packets + 40   ⋯ │
│                                                         ₹24,400.00  ●Active  │
│ ● Red Token       50   ₹1,000.00     ₹20.00     1,600   32 packets + 0    ⋯ │
│                                                         ₹32,000.00  ●Active  │
│ ● Green Token     45     ₹500.00  ₹11.111111    1,200   26 packets + 30   ⋯ │
│                                                         ₹13,333.33  ●Active  │
│ ● Old Silver     100     ₹500.00      ₹5.00         —          —          ⋯ │
│                                                              —    ●Inactive  │
├───────────────────────────────────────────────────────────────────────────────┤
│ Showing 1–4 of 4                       [25 ▾]                        ‹ 1 ›    │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Page title | H2 28px/1.3 600 `#111827` | `Coin Types` |
| Subtitle | Body SM 14px 400 `#4B5563`, 4px below | `Your prepaid tokens, their value, and what is left in stock` |
| Primary action | Button 40px, `#2563EB` bg, white 15px 500, radius 8px, `Plus` 16px + 8px gap | `+ New coin type` |
| Secondary action | Ghost 40px, `#4B5563`, `Download` 16px | `Export CSV` |
| KPI card | 20px padding, radius 12px, 1px `#E5E7EB`, `shadow-sm`; label Caption 12px 600 uppercase `0.04em` `#4B5563` with a 16px `#9CA3AF` icon; value 28px mono 700; breakdown Caption `#4B5563` | 4 cards as drawn; whole card clickable |
| Toolbar | 56px, 16px padding, 1px bottom border | Search 40px input, max 400px, `Search` 16px icon left |
| Quick chips | 44px band, chips 28px, radius 8px; inactive Default badge; active `#DBEAFE` bg + 1px `#2563EB` | `Active` `Inactive` `Low stock (<5 packets)` |
| Header row | 44px, `#F3F4F6`, Caption 12px 600 uppercase `0.04em` `#4B5563`, sticky | `NAME` `COINS/PKT` `PACKET AMOUNT` `PER-COIN VALUE` `STOCK (COINS)` `STOCK (PACKETS)` `STOCK VALUE` `STATUS` |
| Colour dot | 10px circle, coin type colour, 8px before the name | `#2563EB` Blue Token · `#EF4444` Red Token · `#22C55E` Green Token |
| Name cell | Body SM 500 `#111827`; left-aligned; 220px | `Blue Token` |
| Coins/packet | Mono 14px 500, right, 110px | `100` |
| Packet amount | Mono 14px 500, right, 130px | `₹1,000.00` |
| Per-coin value | Mono 14px 500, right, 140px, `#4B5563` | `₹10.00` · `₹11.111111` shown at full six decimals |
| Stock (coins) | Mono 14px **600** `#111827`, right, 120px | `2,440` · zero → `—` `#D1D5DB` |
| Stock (packets) | Right, 170px. Digits mono 14px 500 `#111827`, the words `packets` / `coins` Body SM `#4B5563`, `+` in `#9CA3AF` | `24 packets + 40 coins`; exact multiples read `32 packets`, never `32 packets + 0 coins` |
| Stock value | Mono 14px 500, right, 130px | `₹24,400.00` |
| Status | Badge, centred, 110px | `Active` Success · `Inactive` Default |
| Actions | 56px, `MoreHorizontal` icon button 32px with padding to a 44px target | Menu: `View ledger` · `Edit` · `New adjustment` · `Deactivate` |
| Row | 48px, 1px `#E5E7EB` bottom, hover `#F3F4F6` 100ms, cursor pointer → `/coins/types/[id]` | |

### 3.4 Content and copy

- Search placeholder: `Search coin type name…`
- KPI labels: `COIN TYPES` · `COINS IN STOCK` · `TOTAL VALUE IN STOCK` · `COINS OUT WITH STAFF`
- KPI sub-lines: `3 active · 1 inactive` · `47 packets + 40 coins` · `across 4 types` · `₹12,600.00 owed by staff`
- Empty (no data): H4 `No coin types yet` · Body SM `A coin type is one kind of token — a name, how many coins are in a packet, and what a packet costs. Add your first one to start issuing coins.` · `+ New coin type`
- Empty (no results): H4 `No coin types match your filters` · Body SM `Filters: Inactive · Low stock (<5 packets)` · `Clear filters`
- Error: H4 `Couldn't load coin types` · Body SM `The server didn't respond. Your data is safe.` · `Try again`
- Deactivate confirm: H4 `Deactivate Blue Token?` · Body SM `It stays on all past issues and ledger entries, but you won't be able to issue it or add stock. You can turn it back on later.` · `[Cancel]` `[Deactivate coin type]`
- Delete blocked toast: `Blue Token has 128 ledger entries and can't be deleted. Deactivate it instead.`

### 3.5 States

| State | Presentation |
|---|---|
| Loading (first) | Toolbar and header render normally; 8 skeleton rows, grey bars at 60% / 40% / 80% widths, 1.5s shimmer. KPI labels visible, values are shimmer bars |
| Loading (refilter) | Existing table stays at 60% opacity, pointer-events off, 2px `#2563EB` indeterminate bar under the header row. Never a skeleton |
| Empty (no data) | 320px centred block, 48px `Coins` icon `#D1D5DB`, copy above, primary CTA |
| Empty (no results) | 48px `SearchX` `#D1D5DB`, active filters listed, `Clear filters` secondary |
| Filled | As drawn |
| Error | 48px `AlertTriangle` `#EF4444`, `Try again` primary |
| Partial error | Table renders with the §13 drift banner above it when any coin type's cached balance disagrees with its ledger; the affected row's Stock (coins) cell gets a 14px `AlertTriangle` `#EF4444` before the number |
| Zero stock | `—` `#D1D5DB` in coins, packets and value. Row is **not** dimmed — zero stock is a fact, not an inactive state |
| Low stock | Stock (coins) cell text `#B45309`, plus a 12px Warning `Low` badge after the packets figure when stock < 5 packets |
| Read-only (non-owner) | Primary action and `⋯` menu hidden; rows still navigate |

### 3.6 Interactions

- Row hover `#F3F4F6` 100ms; row click → coin type detail, opening on the **Ledger** tab (the reason the owner comes here).
- Stock (coins) and Stock value cells are themselves links to the ledger filtered to that coin type; hover underlines them in `#2563EB`.
- KPI `COINS OUT WITH STAFF` → `/coins/issues?status=unpaid,partial`.
- Sortable headers: Name, Stock (coins), Stock value. `ArrowUpDown` 14px at 40% opacity; active becomes `ArrowUp`/`ArrowDown` full opacity `#2563EB`. Cycle none → asc → desc → none.
- Search debounced 300ms; `×` clear appears once typed.
- Tab order: search → chips → column headers → row 1 → its `⋯` → row 2 …
- Keyboard: `/` focuses search, `n` opens the new coin type form, `Enter` on a focused row opens it.

### 3.7 Responsive (below 768px)

Each row becomes a card, 12px radius, 1px border, 12px padding, 8px gap:

```
┌───────────────────────────────────────┐
│ ● Blue Token                  ●Active │
│ 100 / packet · ₹1,000.00 · ₹10.00 ea  │
│ 24 packets + 40 coins                 │
│ Stock 2,440            ₹24,400.00     │
└───────────────────────────────────────┘
```

KPIs become a 1-across stack (2-across at `md`). Toolbar becomes a full-width search plus a `Filters` button opening a bottom sheet. `+ New coin type` becomes a 56px circular FAB, bottom-right, `#2563EB`, `Plus` 24px white.

### 3.8 Dark mode

Page `#0B1220`; cards and table `#1E293B`; header row and expanded panels `#1E293B` with a `#334155` bottom border to keep separation; borders `#334155`; primary text `#F1F5F9`; secondary `#94A3B8`; em-dash zero `#475569`; row hover `#334155`; Nova Blue lifts to `#3B82F6` for links and focus rings; badges use the §1.4 dark pairs. Colour dots keep their raw hex.

### 3.9 Stitch prompt

```text
Design a desktop web page "Coin Types" for an internal Indian water-plant business app. Light theme. Page background #F8FAFC, cards #FFFFFF with 1px #E5E7EB border, 12px radius, subtle shadow. Fonts: Inter for text, JetBrains Mono with tabular numerals for every number.

Top: 240px left sidebar and 64px topbar. Content max 1440px, 24px padding. Page header: H2 28px semibold #111827 "Coin Types", below it 14px #4B5563 "Your prepaid tokens, their value, and what is left in stock". Right side: ghost button "Export CSV" and blue primary button "+ New coin type" in #2563EB, 40px tall, 8px radius, white text.

Below: a row of 4 KPI cards, 24px gap, 20px padding. Each has a 12px uppercase letter-spaced #4B5563 label with a small grey icon, then a 28px JetBrains Mono bold value, then a 12px #4B5563 detail line. Values: COIN TYPES 4 / "3 active · 1 inactive"; COINS IN STOCK 5,240 / "47 packets + 40 coins"; TOTAL VALUE IN STOCK ₹68,400.00 / "across 4 types"; COINS OUT WITH STAFF 1,150 / "₹12,600.00 owed by staff".

Below: a table card. 56px toolbar with a search box "Search coin type name…". 44px row of pill filter chips: Active, Inactive, Low stock (<5 packets). Table header 44px, #F3F4F6, 12px uppercase semibold #4B5563: NAME, COINS/PKT, PACKET AMOUNT, PER-COIN VALUE, STOCK (COINS), STOCK (PACKETS), STOCK VALUE, STATUS. Rows exactly 48px, 1px #E5E7EB separators, no zebra striping. Text left, all numbers right-aligned in mono. Rows: "● Blue Token" (blue dot #2563EB) 100, ₹1,000.00, ₹10.00, 2,440, "24 packets + 40 coins", ₹24,400.00, green "Active" pill; "● Red Token" (red dot) 50, ₹1,000.00, ₹20.00, 1,600, "32 packets", ₹32,000.00, "Active"; "● Green Token" (green dot) 45, ₹500.00, ₹11.111111, 1,200, "26 packets + 30 coins", ₹13,333.33, "Active"; "● Old Silver" (grey dot) 100, ₹500.00, ₹5.00, em-dash, em-dash, em-dash, grey "Inactive" pill. Footer 56px: "Showing 1–4 of 4" left, page size select and pager right.
```

---

## 4. Screen — Coin type form `/coins/types/new` · `/coins/types/[id]/edit`

### 4.1 Purpose

Define a token and let the system value it. The whole point of the form is the **derived per-coin value**, which must update as the owner types so he never does the division himself.

### 4.2 Layout

```
‹ Coin Types
New coin type
Define a token: how many coins in a packet, and what a packet costs

┌── Details ──────────────────────────────────────────────────────────┐
│  Name *                                                             │
│  [ Blue Token                                              ]        │
│  Any script. Must be unique.                                        │
│                                                                     │
│  Coins per packet *          Packet amount *                        │
│  [        100 ]              [ ₹    1,000.00 ]                      │
│  How many coins in one       What a full packet is worth            │
│  sealed packet                                                      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ PER-COIN VALUE                                    derived     │  │
│  │ ₹10.00                                                        │  │
│  │ ₹1,000.00 ÷ 100 coins. Held to 6 decimals, rows round to 2.   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Opening stock (coins)                                              │
│  [      3,000 ]   = 30 packets                                      │
│  Writes the first ledger entry. You can't change it later —         │
│  use a stock adjustment instead.                                    │
│                                                                     │
│  Badge colour                                                       │
│  ( ● ) ( ● ) ( ● ) ( ● ) ( ● ) ( ● ) ( ● ) ( ● )                     │
│                                                                     │
│  [ ● ] Active                                              (edit)   │
├─────────────────────────────────────────────────────────────────────┤
│                                    [ Cancel ]  [ Save coin type ]   │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, `ChevronLeft` 16px, 8px above title | `‹ Coin Types` |
| Title / subtitle | H2 600 `#111827` / Body SM `#4B5563` | `New coin type` · `Define a token: how many coins in a packet, and what a packet costs` — edit mode: `Edit Blue Token` · `Changing the packet amount only affects future issues. Past issues keep the value they were issued at.` |
| Card | Max 720px, 24px padding, radius 12px, 1px `#E5E7EB` | Single column, 16px field gap |
| Label | Body SM 500 `#111827`, 6px above field; required `*` in `#2563EB` | |
| Name input | Full width, 40px, 1px `#D1D5DB`, radius 4px, 12px padding, Body SM | Placeholder `e.g. Blue Token` |
| Coins per packet | **120px** quantity input, mono right-aligned, integers only, stepper arrows on hover | Placeholder `100` |
| Packet amount | **200px** money input, `₹` prefix inside in `#4B5563`, mono right-aligned | Placeholder `1,000.00` |
| Derived panel | Full width, `#F3F4F6` bg, radius 8px, 16px padding, no border; label Caption 12px 600 uppercase `#4B5563`; the word `derived` right-aligned as a Default badge; value **28px mono 700 `#111827`**; formula line Caption `#4B5563` | Recomputes on every keystroke, no animation |
| Opening stock | 120px quantity input; to its right, Body SM `#4B5563` live packet conversion | `= 30 packets` · `= 30 packets + 45 coins` |
| Colour swatches | Eight 32px circles, 8px gap, 2px `#FFFFFF` inner ring + 2px `#2563EB` outer ring when selected | `#2563EB` `#F97316` `#22C55E` `#EF4444` `#8B5CF6` `#14B8A6` `#F59E0B` `#64748B` |
| Active toggle | 44×24px track, label right, edit mode only | `Active` |
| Footer | Sticky inside the card, 1px `#E5E7EB` top, 16px/24px padding, right-aligned | `[Cancel]` ghost · `[Save coin type]` primary |

### 4.4 Content and copy

- Helper — name: `Any script. Must be unique.`
- Helper — coins per packet: `How many coins in one sealed packet`
- Helper — packet amount: `What a full packet is worth`
- Derived formula line: `₹1,000.00 ÷ 100 coins. Held to 6 decimals, rows round to 2.`
- Derived formula, uneven case: `₹500.00 ÷ 45 coins. Held to 6 decimals, rows round to 2 — returning 45 coins one at a time credits ₹499.95, five paise short.`
- Derived empty state: value shows `₹—.——` in `#D1D5DB` with `Enter a packet size and amount to see the per-coin value`
- Helper — opening stock: `Writes the first ledger entry. You can't change it later — use a stock adjustment instead.`
- Errors: `Enter a name` · `A coin type called "Blue Token" already exists` · `Coins per packet must be more than 0` · `Packet amount can't be negative` · `Opening stock can't be negative` · `Whole coins only — you can't have half a coin`
- Buttons: `Save coin type` / while saving `Saving…` / edit mode `Save changes`
- Success toast: `Blue Token created with 3,000 coins in stock`
- Edit warning banner (Warning tint `#FEF3C7`, 1px `#F97316`): `Blue Token has 128 ledger entries. Changing the packet amount changes the value of future issues only — past issues keep the ₹10.00 they were issued at.`
- Cancel confirm: H4 `Discard this coin type?` · Body SM `Nothing you've typed will be saved.` · `[Keep editing]` `[Discard]`

### 4.5 States

| State | Presentation |
|---|---|
| Loading (edit) | Card renders with labels; each field is a 40px shimmer bar; footer buttons disabled |
| Empty (new) | All fields blank, derived panel in its `₹—.——` state, colour defaults to `#2563EB`, name autofocused |
| Filled | As drawn |
| Error (field) | 1px `#EF4444` border, 16px `AlertCircle` `#EF4444` inside on the right, Caption `#EF4444` message below with a 14px `AlertCircle` and 4px gap |
| Error (form) | Danger banner above the footer: `This coin type couldn't be saved` + reason |
| Submitting | Primary shows a 16px spinner, label `Saving…`, both buttons disabled, card dims to 60% |
| Success | Navigate to `/coins/types/[id]` with a success toast |
| Disabled (opening stock, edit mode) | Field at 40% opacity, `#F3F4F6` bg, `not-allowed` cursor, helper replaced with `Opening stock is locked once the ledger has entries. Record a stock adjustment instead.` |
| Read-only (deactivated type) | All inputs borderless on `#F3F4F6`, `#4B5563` text; footer replaced with `[Reactivate coin type]` |

### 4.6 Interactions

- Autofocus `Name`. Tab order: Name → Coins per packet → Packet amount → Opening stock → colour swatches (arrow keys move within the group) → Active → Cancel → Save.
- Derived value and the `= 30 packets` conversion recompute on every keystroke; **no animation** on the number.
- Validation on blur only, never while typing. After an error, re-validate live so it clears the moment it's fixed. On submit, validate everything, scroll to and focus the first error.
- Money field accepts `1000`, `1,000`, `1000.50`; formats with lakh grouping on blur.
- `⌘/Ctrl + Enter` submits. `Esc` triggers the cancel confirm when dirty.

### 4.7 Responsive (below 768px)

Card goes full width, 16px padding. `Coins per packet` and `Packet amount` stack. Derived panel stays full width — it is the most important thing on the screen. Colour swatches wrap to two rows of four. Footer becomes fixed to the viewport bottom, full width, `[Save coin type]` 48px full width with `[Cancel]` as a text link above it.

### 4.8 Dark mode

Card `#1E293B` on `#0B1220`. Derived panel `#0F172A` with a 1px `#334155` border (subtle-on-subtle needs the border in dark). Derived value `#F1F5F9`. Input borders `#334155`, focus ring `#3B82F6`. Warning banner `#7C2D12` bg / `#FED7AA` text. Colour swatches keep raw hex; the selected ring becomes `#3B82F6` with a `#1E293B` inner ring.

### 4.9 Stitch prompt

```text
Design a desktop form page "New coin type" for an internal Indian business app. Light theme, page background #F8FAFC. Fonts Inter, and JetBrains Mono for numbers.

Above the title a small blue "‹ Coin Types" back link in #2563EB. Title 28px semibold #111827 "New coin type", subtitle 14px #4B5563 "Define a token: how many coins in a packet, and what a packet costs".

A single white card, max width 720px, 12px radius, 1px #E5E7EB border, 24px padding, fields stacked with 16px gaps. Labels are 14px medium #111827 with a blue asterisk for required. Inputs 40px tall, 1px #D1D5DB, 4px radius. Field 1: "Name *" full width, value "Blue Token", helper "Any script. Must be unique." in 12px #4B5563. Field 2 and 3 sit side by side: "Coins per packet *" a narrow 120px right-aligned mono input showing 100; "Packet amount *" a 200px money input with a grey ₹ prefix inside showing 1,000.00.

Then the hero of the page: a full-width inset panel with #F3F4F6 background, 8px radius, 16px padding. Top line: 12px uppercase letter-spaced #4B5563 "PER-COIN VALUE" on the left and a small grey pill "derived" on the right. Under it a very large 28px JetBrains Mono bold #111827 "₹10.00". Under that a 12px #4B5563 line "₹1,000.00 ÷ 100 coins. Held to 6 decimals, rows round to 2."

Then "Opening stock (coins)" — a 120px mono input showing 3,000 with grey text "= 30 packets" beside it and helper "Writes the first ledger entry. You can't change it later — use a stock adjustment instead."

Then "Badge colour": eight 32px colour circles in a row (#2563EB #F97316 #22C55E #EF4444 #8B5CF6 #14B8A6 #F59E0B #64748B) with the first one selected using a 2px blue outer ring.

Card footer: 1px top border, right-aligned ghost "Cancel" and blue primary "Save coin type".
```

---

## 5. Screen — Coin type detail + Ledger `/coins/types/[id]`

### 5.1 Purpose

**This is the register book the owner is replacing.** An append-only page of ruled money columns with a running balance down the right-hand side, a reconciliation line at the top that proves the arithmetic, and a clickable reference on every line so any figure can be traced to the document that caused it.

### 5.2 Layout

```
‹ Coin Types
● Blue Token                                              ●Active
100 coins/packet · ₹1,000.00/packet · ₹10.00 per coin · Created 01 Apr 2026
                        [⬇ Export ledger]  [New adjustment]  [Edit]  [⋯]
┌── Summary ────────────────────────────────────────────────────────────────┐
│  Stock (coins)     Stock (packets)     Stock value      Out with staff    │
│  2,440             24 packets + 40     ₹24,400.00       650               │
└───────────────────────────────────────────────────────────────────────────┘

[ Ledger 128 ]  [ Issues 14 ]  [ Adjustments 3 ]  [ Circulation ]
───────────────────────────────────────────────────────────────────────────

┌───────────────────────────────────────────────────────────────────────────┐
│ ✓  Opening 3,000  +  In 640  −  Out 1,200  =  Balance 2,440 coins         │
│    (₹24,400.00)                          Reconciled just now · 128 entries│
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search reference or note…]   [Movement ▾]  [01 Apr – 16 Aug]  [⬇ CSV] │
│ ● All  ● Issued out  ● Returned in  ● Order receipts  ● Adjustments       │
├─────┬────────┬───────────────┬────────────┬──────────┬────────┬───────────┤
│  #  │ DATE   │ MOVEMENT      │ REFERENCE  │    IN    │   OUT  │  BALANCE  │
├─────┴────────┴───────────────┴────────────┼──────────┼────────┼───────────┤
│ ░ OPENING BALANCE · 01 Apr 2026           │     —    │    —   │    3,000  │
├───────────────────────────────────────────┼──────────┼────────┼───────────┤
│ ▒ 16 AUG 2026                             │          │        │           │
│ 128  Today   ⟲ Issue return   CIS-000012  │      50  │    —   │    2,440  │
│      Ramesh Patel · unsold, counted back  │          │        │           │
│ 127  Today   ▤ Order receipt   ORD-000044 │      40  │    —   │    2,390  │
│      Coins taken as payment               │          │        │           │
│ ▒ 14 AUG 2026                             │          │        │           │
│ 126  14 Aug  ⛁ Issue          CIS-000012  │      —   │   400  │    2,350  │
│      Ramesh Patel · 4 packets             │          │        │           │
│ 125  14 Aug  ✖ Adjustment out  ADJ-000007 │      —   │    50  │    2,750  │
│      Damaged in the store room — water    │          │        │           │
├───────────────────────────────────────────┼──────────┼────────┼───────────┤
│ ═ CARRIED FORWARD                          │    640  │  1,200 │    2,440  │
└───────────────────────────────────────────┴──────────┴────────┴───────────┘
│ Showing 1–25 of 128       [25 ▾]              ‹ 1 2 3 4 5 6 ›              │
```

### 5.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Title | H2 600 with a 12px colour dot before it, badges inline at 12px gap | `Blue Token` + `Active` |
| Meta line | Body SM `#4B5563`, `·` separated | `100 coins/packet · ₹1,000.00/packet · ₹10.00 per coin · Created 01 Apr 2026` |
| Actions | `Export ledger` ghost + `Download` · `New adjustment` secondary (1px `#2563EB`, `#2563EB` text) · `Edit` secondary · `⋯` icon | `⋯`: `Deactivate` · `Recalculate balance from ledger` |
| Summary card | `#F3F4F6` bg, radius 12px, 20px padding, 4 columns on `lg` / 2 on `md`; label Caption `#4B5563` above, value **20px mono 600** below; the critical figure (Stock coins) is `#111827`, others `#374151` | `Stock (coins) 2,440` · `Stock (packets) 24 packets + 40` · `Stock value ₹24,400.00` · `Out with staff 650` |
| Tabs | 44px, active gets a 2px `#2563EB` bottom indicator and `#111827` 600; inactive `#4B5563`; **counts in the label** | `Ledger 128` · `Issues 14` · `Adjustments 3` · `Circulation` |
| **Reconciliation band** | Full width, `#F0FDF4` bg, 1px `#BBF7D0`, radius 12px, 16px padding, 20px `CheckCircle2` `#15803D` left. Formula in **mono 16px 600 `#111827`**, operators `+ − =` in `#4B5563` with 8px padding either side, the balance figure in `#15803D` 700. Second line Caption `#4B5563` right-aligned. **Sticky** below the tabs while the ledger scrolls | See §5.4 |
| Ledger toolbar | 56px; search 40px max 360px; `Movement` multi-select popover; date-range control 220px; `Export CSV` ghost | |
| Movement chips | 44px band; `All` · `Issued out` · `Returned in` · `Order receipts` · `Adjustments` | |
| Ledger header | 44px, `#F3F4F6`, Caption 12px 600 uppercase, sticky under the reconciliation band | `#` 56px · `DATE` 110px · `MOVEMENT` 180px · `REFERENCE` 130px · `NOTE` flex · `IN` 110px · `OUT` 110px · `BALANCE` 130px |
| **Money block rules** | The `IN`, `OUT`, `BALANCE` columns are separated by 1px `#E5E7EB` **vertical hairlines** running through header, body and foot — the ruled money columns of a physical ledger. No other vertical rules exist in the app | |
| Balance column | `#F8FAFC` inset background full height, mono 14px **600** `#111827`, right-aligned | `2,440` |
| In column | Mono 14px 500 `#15803D`, right; zero → `—` `#D1D5DB` | `50` |
| Out column | Mono 14px 500 `#B91C1C`, right; zero → `—` `#D1D5DB` | `400` |
| Entry number | Mono 12px `#9CA3AF`, left | `128` |
| Movement cell | Badge per §5.4, 12px leading icon | |
| Reference | Mono 13px `#2563EB` 500, underline on hover | `CIS-000012` · `ORD-000044` · `ADJ-000007` · non-referenced → `—` |
| Note | Body SM `#4B5563`, second line of the row, truncated at the column width with the full text in a tooltip | `Ramesh Patel · unsold, counted back` |
| Date band row | 32px, `#F3F4F6`, Caption 12px 600 uppercase `0.04em` `#4B5563`, spans the text columns only — the money columns stay empty and ruled | `14 AUG 2026` |
| Opening balance row | 48px, `#F3F4F6`, Body SM 500 `#374151`, italic label, In/Out `—`, balance filled. **Pinned to the top of page 1 and never paginated away** | `OPENING BALANCE · 01 Apr 2026` |
| Carried/brought forward | 48px foot row, `#F3F4F6`, 1px `#111827` top border and a second 1px `#111827` line 2px below it — the accountant's double underline. Totals in mono 600 | `CARRIED FORWARD` on pages 1..n−1, `BROUGHT FORWARD` as the first row of pages 2..n, `CLOSING BALANCE` on the last page |
| Row | 48px, 1px `#E5E7EB` bottom, hover `#F3F4F6`. **No row click** — the ledger is read-only; only the reference is a link | |

### 5.4 Content and copy

**Movement type colour coding — all seven:**

| Movement | Badge | Label | Icon | Direction | Amount colour |
|---|---|---|---|---|---|
| `OPENING` | Default `#E5E7EB`/`#374151` | `Opening` | `BookOpen` | + | `#15803D` |
| `ISSUE` | Danger `#FEE2E2`/`#B91C1C` | `Issue` | `Coins` | − | `#B91C1C` |
| `ISSUE_RETURN` | Success `#DCFCE7`/`#15803D` | `Issue return` | `RotateCcw` | + | `#15803D` |
| `ORDER_RECEIPT` | Primary `#DBEAFE`/`#1D4ED8` | `Order receipt` | `ClipboardList` | + | `#15803D` |
| `ADJUSTMENT_IN` | Success `#DCFCE7`/`#15803D` | `Adjustment in` | `Plus` | + | `#15803D` |
| `ADJUSTMENT_OUT` | Danger `#FEE2E2`/`#B91C1C` | `Adjustment out` | `PackageX` | − | `#B91C1C` |
| `ISSUE_CANCELLED` | Warning `#FEF3C7`/`#B45309` | `Issue cancelled` | `Ban` | + | `#15803D` |

> Two signals, never one: the **badge** says which movement, the **column** (In vs Out) says which direction. A colour-blind reader still reads it correctly.

- Reconciliation band, reconciled: `Opening 3,000 + In 640 − Out 1,200 = Balance 2,440 coins (₹24,400.00)` · right: `Reconciled just now · 128 entries`
- Reconciliation band, filtered: adds `Showing 42 of 128 entries — the balance below is the full-ledger balance, not the filtered one.` in Caption `#B45309`
- Search placeholder: `Search reference or note…`
- Date range default: `01 Apr 2026 – 16 Aug 2026` with quick chips `This month` `Last 3 months` `This year` `All time`
- Empty (no data): H4 `This ledger is empty` · Body SM `Nothing has moved yet. Issue coins to staff, or record a stock adjustment, and every movement will appear here with a running balance.` · `[New adjustment]`
- Empty (no results): H4 `No movements match your filters` · Body SM `Filters: Adjustments · 01 Jul – 31 Jul 2026` · `Clear filters`
- Error: H4 `Couldn't load the ledger` · Body SM `The balance shown above may be out of date. Nothing has been changed.` · `Try again`
- Append-only notice, shown once as a dismissible Info banner on first visit: `This ledger can't be edited. Mistakes are corrected by adding a reversing entry, so the history stays honest.`
- `⋯` per row: `Open CIS-000012` · `Copy reference` · `Reverse this entry` (adjustments only) — reversal copy: `Reverse ADJ-000007? A new opposite entry of 50 coins in will be added. The original stays in the ledger.`
- Circulation tab body: `Coins in circulation` H3, then `Issued 4,200 − Returned by staff 640 − Redeemed via orders 1,180 = 2,380 coins with customers (₹23,800.00)` and Body SM `These are coins customers are holding. If a physical count disagrees with this figure, the gap is real — record it as an adjustment with a reason rather than leaving it to hide inside a total.`

### 5.5 States

| State | Presentation |
|---|---|
| Loading (first) | Summary card and tabs render; reconciliation band is a full-width shimmer at 56px; 8 skeleton ledger rows with the money-column hairlines already drawn, so the register shape is visible immediately |
| Loading (refilter) | Ledger dims to 60%, 2px `#2563EB` bar under the header, reconciliation band stays fully lit — it never depends on the filter |
| Empty (no data) | Reconciliation band shows `Opening — + In — − Out — = Balance 0 coins (—)` in `#D1D5DB`, then the centred empty block |
| Empty (no results) | Band stays at full-ledger values with the amber caveat line; centred `SearchX` block below |
| Filled | As drawn |
| Error | Band replaced by a neutral `#F3F4F6` strip reading `Balance unavailable`; table shows the error block |
| **Drift detected** | The Success band is replaced by the §13 non-dismissible Danger banner. Summary card `Stock (coins)` value turns `#B91C1C` with a 16px `AlertTriangle` before it. Nothing else is blocked — the owner can still read the ledger, which is exactly what he needs to do |
| Read-only | Always. There is no edit affordance anywhere in the ledger table by design |
| Export running | `Export ledger` button shows a spinner, label `Preparing…`; on completion an Info toast `Ledger export ready` + `Download` |

### 5.6 Interactions

- Tabs switch without a page load; the ledger's filter state persists per tab visit within the session.
- Reconciliation band is sticky at the top of the scroll region beneath the tabs, 8px below the tab underline, with a 1px `#E5E7EB` shadow line once content scrolls under it.
- Reference click → `/coins/issues/[id]` for `CIS-`, `/orders/[id]` for `ORD-`, `/coins/adjustments?id=` for `ADJ-`. `⌘/Ctrl + click` opens in a new tab.
- Movement chips are multi-select; each adds a removable filter chip below the toolbar.
- Row hover `#F3F4F6`; the balance column keeps its inset tint on hover (it darkens to `#EEF2F7`) so the money block stays visually separate.
- Sortable: `#` and `DATE` only. **`BALANCE` is deliberately not sortable** — a running balance sorted out of order is meaningless; hovering its header shows a tooltip `Running balance always follows entry order`.
- Keyboard: `↑ ↓` move a focus ring between rows, `Enter` follows the row's reference, `e` opens export.
- Tab order: tabs → search → movement filter → date range → export → chips → rows.

### 5.7 Responsive (below 768px)

The register cannot become cards without losing the running balance, so instead: the money block (`IN`, `OUT`, `BALANCE`) is **frozen** and the text columns scroll horizontally beneath it, with a 1px `#E5E7EB` divider and a soft shadow marking the freeze line. Row height grows to 64px for the two-line note. The `#` column is hidden. The reconciliation band stacks to three lines:

```
Opening 3,000
+ In 640   − Out 1,200
= 2,440 coins (₹24,400.00)
```

Summary card becomes 2×2. Tabs become a horizontally scrollable strip. Toolbar becomes search + a `Filters` button opening a bottom sheet.

### 5.8 Dark mode

Reconciliation band: `#14532D` bg, `#166534` border, `#BBF7D0` text, balance figure `#4ADE80`. Money-column hairlines `#334155`. Balance column inset becomes `#0F172A` against the `#1E293B` table — inset reads as *darker* in dark mode, the reverse of light. Date band rows `#0F172A`. Double-underline foot rules become `#F1F5F9`. In `#4ADE80`, Out `#F87171` — the light-mode `#15803D` / `#B91C1C` fail contrast on dark. References `#3B82F6`.

### 5.9 Stitch prompt

```text
Design a desktop "coin ledger" page that should feel like a physical accounting register book, for an internal Indian water-plant app. Light theme, page background #F8FAFC, white cards, Inter for text, JetBrains Mono with tabular numerals for all figures.

Header: small blue "‹ Coin Types" link, then a 28px semibold #111827 title "● Blue Token" with a blue dot and a small green "Active" pill. Grey 14px meta line "100 coins/packet · ₹1,000.00/packet · ₹10.00 per coin · Created 01 Apr 2026". Right side buttons: ghost "Export ledger", outlined blue "New adjustment", outlined "Edit".

A #F3F4F6 summary strip with four columns, each a small uppercase grey label above a 20px mono semibold value: Stock (coins) 2,440; Stock (packets) 24 packets + 40; Stock value ₹24,400.00; Out with staff 650.

A tab row 44px: "Ledger 128", "Issues 14", "Adjustments 3", "Circulation" — first tab active with a 2px blue underline.

Then a full-width green reconciliation banner, background #F0FDF4, 1px #BBF7D0 border, 12px radius, green check icon, containing one 16px mono semibold line: "Opening 3,000 + In 640 − Out 1,200 = Balance 2,440 coins (₹24,400.00)" with the operators in grey. Right-aligned small grey text "Reconciled just now · 128 entries".

Then the register table. Header 44px #F3F4F6, 12px uppercase letter-spaced grey: #, DATE, MOVEMENT, REFERENCE, NOTE, IN, OUT, BALANCE. The three right columns IN/OUT/BALANCE are separated by thin vertical 1px #E5E7EB rules running the full height, like ruled money columns; the BALANCE column has a faint #F8FAFC background tint and mono semibold numbers.

First row is a grey "OPENING BALANCE · 01 Apr 2026" row with balance 3,000. Then grey 32px date-band rows "16 AUG 2026" and "14 AUG 2026" grouping entries. Rows are 48px with small coloured pills in the MOVEMENT column: red "Issue", green "Issue return", blue "Order receipt", red "Adjustment out". REFERENCE values are blue mono links CIS-000012, ORD-000044, ADJ-000007. IN numbers green, OUT numbers red, zeros as grey em-dashes. Sample balances descending 2,440 / 2,390 / 2,350 / 2,750. Final row "CARRIED FORWARD" with totals 640 and 1,200 and 2,440, with a double horizontal rule above it like an accounting total.
```

---

## 6. Screen — Coin issue register `/coins/issues`

### 6.1 Purpose

**The centrepiece of the module.** One row tells the whole story of a handover: what went out, what came back, what is owed, what has been collected, and what is still pending — including when pending is *negative* and the company owes the staff member money. Expanding a row reveals the per-coin-type breakdown without leaving the page.

### 6.2 Layout

```
Coin Issues                                          [⬇ Export CSV]  [+ Issue coins]
Coins handed to staff, what came back, and what is still owed

┌──────────────────┐┌──────────────────┐┌──────────────────┐┌──────────────────┐
│ ⛁ OPEN ISSUES    ││ ⛁ COINS OUT      ││ ₹ PENDING        ││ ⟲ REFUNDS DUE    │
│ 7                ││ 1,150            ││ ₹8,450.00        ││ ₹1,700.00        │
│ of 42 this month ││ with 4 staff     ││ ▲ ₹1,200 vs last ││ 2 staff members  │
└──────────────────┘└──────────────────┘└──────────────────┘└──────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search issue no, staff name, phone…]        [Filters (1) ▾]   [⚙ Columns]  │
│ ● Pending  ● Partial  ● Settled  ● Refund due  ● This month       [Clear all]  │
│ Staff: Ramesh Patel ✕                                                          │
├──┬──────────┬────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│  │ ISSUE ↕  │ DATE ↕ │ STAFF ↕  │  ISSUED  │ RETURNED │NET PAYBL │ COLLECTED   │
├──┴──────────┴────────┴──────────┴──────────┴──────────┴──────────┴─────────────┤
│ ▸ CIS-000012  14 Aug  Ramesh Patel  ₹5,000.00  ₹500.00 ₹4,500.00  ₹4,000.00 …  │
│               9876543210            400 coins  50 coins                        │
│                                             PENDING ₹500.00   🟠 ₹500 due   ⋯  │
├────────────────────────────────────────────────────────────────────────────────┤
│ ▾ CIS-000011  12 Aug  Suresh Chauhan ₹2,000.00      —  ₹2,000.00  ₹2,500.00 …  │
│               9825012345            200 coins                                  │
│                                          PENDING (₹500.00)  🔵 Refund ₹500  ⋯  │
│ ┌────────────────────────────────────────────────────────────────────────────┐ │
│ │ COIN TYPE      PACKETS   COINS   RATE     ISSUED VALUE  RETURNED   NET     │ │
│ │ ● Red Token          4     200   ₹20.00      ₹2,000.00     0 / —  ₹2,000.00│ │
│ │ ─────────────────────────────────────────────────────────────────────────  │ │
│ │ Total                4     200               ₹2,000.00     0 / —  ₹2,000.00│ │
│ │ Paid 12 Aug ₹2,500.00 (cash) · Refund owed ₹500.00                         │ │
│ │            [Record return]  [Record refund ₹500.00]  [Open issue ›]        │ │
│ └────────────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────┤
│ ▸ CIS-000010  09 Aug  Ramesh Patel  ₹3,000.00 ₹3,000.00        —         —  …  │
│               9876543210            300 coins 300 coins                        │
│                                              PENDING    —    🟢 Settled     ⋯  │
├────────────────────────────────────────────────────────────────────────────────┤
│ Showing 1–25 of 42          [25 ▾]                    ‹ 1 2 ›                  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Title / subtitle | H2 600 / Body SM `#4B5563` | `Coin Issues` · `Coins handed to staff, what came back, and what is still owed` |
| Primary action | 40px `#2563EB`, `Coins` 16px + 8px gap | `+ Issue coins` |
| KPI cards | Per §1.3. `PENDING` uses the **alert variant** when > ₹5,000: 3px `#EF4444` left border and the value in `#B91C1C`. `REFUNDS DUE` value renders in `#2563EB` | Four cards as drawn |
| Expand column | 40px, fixed, leftmost. `ChevronRight` 16px `#9CA3AF` in a 32px button padded to a 44px target; rotates to `ChevronDown` and turns `#2563EB` when open | |
| Issue code | Mono 13px `#2563EB` 500, 120px | `CIS-000012` |
| Date | Body SM, 100px; today → `Today`, yesterday → `Yesterday` | `14 Aug 2026` |
| Staff | Two lines inside 48px: name Body SM 500 `#111827`, phone Caption `#4B5563`. Min 180px, flexible | `Ramesh Patel` / `9876543210` |
| Issued | 120px right. Line 1 money mono 14px 500; line 2 Caption `#4B5563` `400 coins` | `₹5,000.00` / `400 coins` |
| Returned | 120px right, same two-line pattern; zero → `—` `#D1D5DB` with no second line | `₹500.00` / `50 coins` |
| Net payable | 120px right, mono 14px 500 | `₹4,500.00` |
| Collected | 120px right, mono 14px 500 | `₹4,000.00` |
| **Pending** | 130px right, mono 14px **600**. Positive `#111827`. **Negative `(₹500.00)` in `#2563EB` 600.** Zero `—` `#D1D5DB`. The header cell reads `PENDING` in `#111827` 600 — the only header that is not grey, because it is the column the owner scans | `₹500.00` · `(₹500.00)` |
| Status | 140px centred, badge per §1.4 | `₹500 due` / `Refund ₹500` / `Settled` |
| Actions | 56px, `⋯` menu: `Record payment` · `Record return` · `Record refund` (refund-due only) · `Settle difference` (when \|pending\| < ₹1.00) · `Open issue` · `Cancel issue` | |
| Row | 48px, hover `#F3F4F6`, click → detail. **Clicking the chevron does not navigate.** Refund-due rows get a 2px `#2563EB` left border; unpaid rows a 2px `#EF4444` left border; partial 2px `#F97316` | |
| **Expanded panel** | Inset, `#F3F4F6` bg, 3px `#2563EB` left border, 16px padding, 12px radius on the inner card, spans the full row width. Sub-table header 36px Caption 12px 600 uppercase `#4B5563`; **sub-rows 40px** (denser than a table row, because they are a detail of one) with 1px `#E5E7EB` separators | |
| Sub-table columns | `COIN TYPE` (dot + name, flexible) · `PACKETS` 90px · `COINS` 90px · `RATE` 100px · `ISSUED VALUE` 130px · `RETURNED` 110px · `NET` 130px — all figures mono right-aligned | |
| Sub-total row | 40px, 1px `#111827` top border, mono 600 | `Total 4 200 ₹2,000.00 0 / — ₹2,000.00` |
| Payment line | Body SM `#4B5563` below the sub-total, `·` separated, money in mono | `Paid 12 Aug ₹2,500.00 (cash) · Refund owed ₹500.00` |
| Panel actions | Right-aligned, 32px small buttons, 8px gap | `[Record return]` secondary · `[Record refund ₹500.00]` primary · `[Open issue ›]` ghost |

### 6.4 Content and copy

- Search placeholder: `Search issue no, staff name, phone…`
- Filters popover: `Staff` (search select) · `Date range` · `Coin type` (multi) · `Status` (Pending / Partial / Settled / Refund due) · `Pending amount` (min–max)
- Quick chips: `Pending` `Partial` `Settled` `Refund due` `This month`
- Column headers: `ISSUE` `DATE` `STAFF` `ISSUED` `RETURNED` `NET PAYABLE` `COLLECTED` `PENDING` `STATUS`
- Sub-table headers: `COIN TYPE` `PACKETS` `COINS` `RATE` `ISSUED VALUE` `RETURNED` `NET`
- Empty (no data): H4 `No coin issues yet` · Body SM `When you hand packets of coins to a staff member to sell, record it here. You'll see what's owed, what came back, and what's still pending.` · `+ Issue coins`
- Empty (no results): H4 `No issues match your filters` · Body SM `Filters: Staff Ramesh Patel · Refund due · This month` · `Clear filters`
- Error: H4 `Couldn't load coin issues` · Body SM `The server didn't respond. Nothing has been changed.` · `Try again`
- Partial error banner (Danger tint): `Some figures may be out of date. Two coin types failed to reconcile — open the ledger to check.` + `Open ledger`
- Refund-due tooltip on the blue pending figure: `Suresh Chauhan paid ₹2,500.00 against ₹2,000.00 payable. You owe him ₹500.00.`
- Settle difference confirm: H4 `Write off ₹0.05 on CIS-000009?` · Body SM `Rounding left five paise outstanding. Writing it off closes the issue and records a ₹0.05 write-off against it. This can't be undone.` · `[Cancel]` `[Write off ₹0.05]`
- Cancel issue confirm: H4 `Cancel issue CIS-000012?` · Body SM `400 coins go back into Blue Token stock and Ramesh Patel stops owing ₹4,500.00. The ₹4,000.00 he already paid is not touched — record a refund separately. This can't be undone.` · `[Keep issue]` `[Cancel issue]`

### 6.5 States

| State | Presentation |
|---|---|
| Loading (first) | 8 skeleton rows including the 40px chevron column; KPI values shimmer |
| Loading (refilter) | Table at 60% opacity, 2px `#2563EB` bar under the header; **open rows stay open** |
| Empty (no data) | 48px `Coins` `#D1D5DB` + copy + primary CTA |
| Empty (no results) | 48px `SearchX` + active filter list + `Clear filters` |
| Filled | As drawn |
| Error / partial error | Per §5.6 of the standards, copy above |
| **Refund due** | Blue 2px left border, `(₹500.00)` in `#2563EB` 600, Primary `Refund ₹500` badge with `RotateCcw`. The KPI `REFUNDS DUE` counts it |
| **Unpaid** | Red 2px left border, Danger `Unpaid` badge, pending in `#111827` 600 |
| **Settled** | No left border, Success `Settled` badge, all trailing figures `—`. Row text stays full strength — settled is a good outcome, not a dimmed one |
| **Cancelled** | Entire row at 60% opacity, Default `Cancelled` badge with `Ban`, figures struck through in `#9CA3AF` |
| Row expanding | Sub-table shows 3 skeleton sub-rows for up to 200ms if the breakdown is not already cached |
| Expanded, sub-fetch failed | Panel shows a single 40px line: 14px `AlertTriangle` `#EF4444` + `Couldn't load the breakdown` + `Retry` link |
| Rounding stub | Pending between −₹1.00 and ₹1.00 and non-zero: value shown normally plus a Default badge `Rounding` and the `Settle difference` action promoted into the row's `⋯` menu top slot |
| Read-only | `⋯` menu shows only `Open issue`; panel actions hidden |

### 6.6 Interactions

- **Expand/collapse.** Click the chevron, or press `Enter`/`Space` on it, or press `→` with the row focused. The chevron rotates 90° over 100ms; **the panel itself appears instantly with no height animation** — per §16 data should feel instant, and an animated 200px reveal on a 25-row list reads as slowness. `←` collapses. Multiple rows may be open at once. Open state persists across refilter, repage and back-navigation within the session. `⌥/Alt + click` expands every row on the page; the header gets an `Expand all` / `Collapse all` text button once any row is open.
- Row click anywhere except the chevron column, the `⋯` button and panel content → `/coins/issues/[id]`.
- Panel buttons open the return modal (§9), the payment/refund modal (§10), or navigate.
- Sortable: `ISSUE`, `DATE`, `STAFF`, `NET PAYABLE`, `PENDING`. Sorting by `PENDING` ascending puts refunds due at the top — the intended way to find money owed out.
- KPI `REFUNDS DUE` → this list filtered to `status=refund_due`, chip pre-activated.
- Tab order: search → filters → chips → `Expand all` → row 1 chevron → row 1 `⋯` → (if open) panel buttons → row 2 chevron …
- Focus: the expanded panel is inserted directly after its row in the DOM so tabbing enters it naturally; `aria-expanded` on the chevron, `aria-controls` pointing at the panel.

### 6.7 Responsive (below 768px)

Row becomes a card with the breakdown as an in-card disclosure:

```
┌────────────────────────────────────────┐
│ CIS-000011              🔵 Refund ₹500 │
│ Suresh Chauhan · 12 Aug 2026           │
│ Issued 200 coins · ₹2,000.00           │
│ Returned —                             │
│ Collected ₹2,500.00                    │
│ Pending            (₹500.00)           │
│ ▸ 1 coin type                          │
└────────────────────────────────────────┘
```

`Pending` is the last line, right-aligned, 16px mono 600 — the biggest figure on the card. The `▸ 1 coin type` row is a 44px tap target; expanding stacks each coin type as a labelled mini-block rather than a sub-table. Panel actions become full-width 44px buttons stacked with 8px gaps. KPIs go 1-across, `REFUNDS DUE` first when non-zero.

### 6.8 Dark mode

Expanded panel `#0F172A` (darker than the `#1E293B` table) with a 3px `#3B82F6` left border — inset means darker on dark. Sub-row separators `#334155`. Negative pending `#60A5FA` for contrast on `#1E293B`. Left status borders keep their raw hex. Alert-variant KPI border `#EF4444`, value `#FECACA`. Row hover `#334155`.

### 6.9 Stitch prompt

```text
Design a dense desktop register table page "Coin Issues" for an internal Indian water-plant business app. Light theme, page background #F8FAFC, white cards with 1px #E5E7EB borders and 12px radius. Inter for text, JetBrains Mono with tabular numerals for every figure.

Page header: 28px semibold #111827 "Coin Issues", 14px #4B5563 subtitle "Coins handed to staff, what came back, and what is still owed". Right: ghost "Export CSV" and blue #2563EB primary "+ Issue coins".

Four KPI cards, 24px gap: OPEN ISSUES 7 / "of 42 this month"; COINS OUT 1,150 / "with 4 staff"; PENDING ₹8,450.00 with a 3px red left border and red value / "▲ ₹1,200 vs last month"; REFUNDS DUE ₹1,700.00 in blue / "2 staff members". Labels 12px uppercase grey, values 28px mono bold.

Table card: 56px toolbar with search "Search issue no, staff name, phone…" and a "Filters (1)" button; a 44px row of pill chips Pending, Partial, Settled, Refund due, This month. Header row 44px #F3F4F6, 12px uppercase grey: a narrow empty chevron column, ISSUE, DATE, STAFF, ISSUED, RETURNED, NET PAYABLE, COLLECTED, PENDING, STATUS. The PENDING header is darker #111827.

Rows are 48px, no zebra. Row 1: chevron ▸, blue mono "CIS-000012", "14 Aug 2026", two-line staff "Ramesh Patel" over grey "9876543210", ₹5,000.00 over grey "400 coins", ₹500.00 over "50 coins", ₹4,500.00, ₹4,000.00, bold ₹500.00, and an amber pill "₹500 due". A 2px orange left border on the row.

Row 2 is expanded: chevron ▾, "CIS-000011", "12 Aug 2026", "Suresh Chauhan / 9825012345", ₹2,000.00 over "200 coins", em-dash, ₹2,000.00, ₹2,500.00, and pending shown in blue as "(₹500.00)" with a blue pill "Refund ₹500" and a 2px blue left border. Directly under it a full-width inset panel with #F3F4F6 background and a 3px blue left border containing a small sub-table with 36px header COIN TYPE, PACKETS, COINS, RATE, ISSUED VALUE, RETURNED, NET and one 40px row "● Red Token 4 200 ₹20.00 ₹2,000.00 0 / — ₹2,000.00", a total row, a grey line "Paid 12 Aug ₹2,500.00 (cash) · Refund owed ₹500.00", and right-aligned small buttons "Record return", blue "Record refund ₹500.00", ghost "Open issue ›".

Row 3: "CIS-000010", "09 Aug 2026", "Ramesh Patel", ₹3,000.00 / 300 coins, ₹3,000.00 / 300 coins, em-dashes, and a green "Settled" pill.
```

---

## 7. Screen — Coin issue create `/coins/issues/new`

### 7.1 Purpose

Hand packets to a staff member and record it in one pass. The form must show the arithmetic as it happens — the owner should never wonder what he is about to be owed — and must make it impossible to issue coins that do not exist.

### 7.2 Layout

```
‹ Coin Issues
Issue coins
Hand packets to a staff member and record what they now owe

┌── Issue details ────────────────────────────────────────────────────────────┐
│  Staff *                                    Issue date *                    │
│  [ Ramesh Patel · 9876543210        ▾ ]     [ 16 Aug 2026        📅 ]       │
│  Ramesh currently owes ₹4,500.00 on 1 open issue                            │
│                                                                             │
│  Note                                                                       │
│  [ Evening route, Sector 7                                          ]       │
└─────────────────────────────────────────────────────────────────────────────┘

┌── Coins ────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ COIN TYPE          PACKETS   COINS   PER-COIN     AMOUNT   IN STOCK    │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ [● Blue Token ▾]      [ 3]     300     ₹10.00   ₹3,000.00  2,440   ✕  │  │
│  │ [● Red Token  ▾]      [ 2]     100     ₹20.00   ₹2,000.00  1,600   ✕  │  │
│  │ [● Green Token▾]      [ 6]     270     ₹11.11     ₹500.00    240   ✕  │  │
│  │ ⚠ Only 240 Green Tokens are in stock (5 packets + 15).                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  [ + Add coin type ]                                                        │
│                                                                             │
│  ┌── Breakdown ────────────────────────────────────────────────────────┐    │
│  │ Blue Token    3 packets × 100 = 300 coins × ₹10.00 =    ₹3,000.00   │    │
│  │ Red Token     2 packets ×  50 = 100 coins × ₹20.00 =    ₹2,000.00   │    │
│  │ ───────────────────────────────────────────────────────────────────  │    │
│  │ Total                           400 coins               ₹5,000.00   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

┌── Payment at issue ─────────────────────────────────────────────────────────┐
│  Amount paid now              Payment mode                                  │
│  [ ₹    4,000.00 ]            [ Cash ▾ ]      [Full ₹5,000.00] [Nothing now]│
│                                                                             │
│  Total payable ₹5,000.00 · Paid now ₹4,000.00 · Balance ₹1,000.00           │
│  Ramesh Patel will owe ₹1,000.00 after this issue.        🟠 ₹1,000 due     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠  This issue couldn't be saved                                             │
│    Only 240 Green Tokens are in stock; you asked for 270. Reduce the        │
│    quantity to 5 packets or add stock first.                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                          [ Cancel ]      [ Issue coins ]
```

### 7.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Section headings | H4 18px 600 `#111827` with a 1px `#E5E7EB` divider below, 32px between sections | `Issue details` · `Coins` · `Payment at issue` |
| Staff select | Search select, full width of its column, 48px (primary field on a fast-entry form). Each option: name Body SM 500 + `· 9876543210` Caption `#4B5563`; 8 visible before scroll; `+ Add new staff` pinned at the bottom | Placeholder `Search staff by name or phone…` |
| Staff context line | Caption `#4B5563` under the field, space reserved | `Ramesh currently owes ₹4,500.00 on 1 open issue` → link `View` |
| Date | 180px, `Calendar` 16px right, `DD MMM YYYY`, defaults to today, popover with `Today` / `Yesterday` chips | `16 Aug 2026` |
| Note | Full width, 40px single-line input | Placeholder `e.g. Evening route, Sector 7` |
| Line-item table | Header 36px Caption uppercase `#4B5563`; **rows 56px**; 1px `#E5E7EB` separators; container radius 8px, 1px border | |
| Coin type select | Flexible width, 40px, colour dot + name. Types already chosen are disabled in the list with the suffix `· already added` | |
| Packets | **120px** quantity input, mono right, stepper on hover, integers only | |
| Coins / Per-coin / Amount | Computed cells: no border, `#F3F4F6` bg, mono right, `#4B5563` for coins and per-coin, **`#111827` 600 for amount**. Update on every keystroke | `300` · `₹10.00` · `₹3,000.00` |
| In stock | Computed, mono right, `#4B5563`. Turns `#B91C1C` 600 when requested coins exceed it | `2,440` |
| Remove | `✕` 16px `#9CA3AF` → `#EF4444` on hover, 32px button padded to 44px. Disabled at 40% opacity when one row remains | |
| **Line error state** | Row gets a 2px `#EF4444` left border; a second line inside the 56px row (row grows to 72px) shows a 14px `AlertCircle` + Caption `#B91C1C` | `Only 240 Green Tokens are in stock (5 packets + 15).` |
| Add row | Full-width ghost button, 1px **dashed** `#D1D5DB`, 40px, `#4B5563`, `Plus` 16px | `+ Add coin type` |
| **Breakdown panel** | `#F3F4F6` bg, radius 8px, 16px padding, 8px above the totals. Every line in **JetBrains Mono 14px** so the `×` and `=` columns align vertically down the block. Labels `#4B5563`, results `#111827`. 1px `#E5E7EB` rule above the total; total row mono **18px 600** | See §7.4 |
| Amount paid now | 200px money input, `₹` prefix | Placeholder `0.00` |
| Payment mode | 160px select | `Cash` · `UPI` · `Bank transfer` · `Cheque` |
| Quick amount buttons | 32px secondary buttons, 8px gap | `Full ₹5,000.00` · `Nothing now` |
| Live settlement line | Body SM `#4B5563`, money inline in mono `#111827`; the resulting badge on the right, per §1.4, updating live | `Total payable ₹5,000.00 · Paid now ₹4,000.00 · Balance ₹1,000.00` |
| Form-level error banner | `#FEE2E2` bg, 1px `#EF4444`, radius 12px, 16px padding, 20px `AlertTriangle` `#B91C1C`; H4-weight first line 14px 600 `#B91C1C`, body 14px `#7F1D1D` | |
| Footer | Sticky inside the card, right-aligned | `[Cancel]` ghost · `[Issue coins]` primary |

### 7.4 Content and copy

- Breakdown block, exact strings (mono, aligned):
  - `Blue Token    3 packets × 100 = 300 coins × ₹10.00 = ₹3,000.00`
  - `Red Token     2 packets ×  50 = 100 coins × ₹20.00 = ₹2,000.00`
  - `Total                          400 coins             ₹5,000.00`
- Breakdown empty: `Add a coin type to see the breakdown` in Caption `#4B5563`, centred, panel keeps its height so nothing jumps.
- Uneven-rate footnote, shown only when a line's per-coin value has more than 2 decimals: `Green Token is ₹11.111111 per coin. Line amounts round to 2 decimals, so totals can differ by a few paise.`
- Settlement line variants:
  - Nothing paid: `Total payable ₹5,000.00 · Paid now — · Balance ₹5,000.00` + Danger `Unpaid` badge + `Ramesh Patel will owe ₹5,000.00 after this issue.`
  - Partial: `Ramesh Patel will owe ₹1,000.00 after this issue.` + Warning `₹1,000 due`
  - Full: `Nothing left to collect on this issue.` + Success `Paid`
  - Overpaid: `Paid now is more than the total payable. ₹500.00 will show as a refund due.` + Primary `Refund ₹500`
- Field errors: `Choose a staff member` · `Choose a coin type` · `Enter how many packets` · `Packets must be more than 0` · `Whole packets only` · `Issue date can't be in the future` · `Add at least one coin type`
- Stock error, inline: `Only 240 Green Tokens are in stock (5 packets + 15).`
- Stock error, form banner: `This issue couldn't be saved` / `Only 240 Green Tokens are in stock; you asked for 270. Reduce the quantity to 5 packets or add stock first.`
- Concurrency error banner: `Someone issued these coins a moment ago` / `Blue Token stock changed while you were filling this in — 2,440 became 40. Your entry is safe. Update the packets and try again.` + `[Refresh stock]`
- Buttons: `Issue coins` / submitting `Issuing…`
- Success toast: `CIS-000013 issued — 400 coins to Ramesh Patel, ₹1,000.00 still due`
- Cancel confirm: H4 `Discard this issue?` · Body SM `Three coin lines and a ₹4,000.00 payment will be lost.` · `[Keep editing]` `[Discard]`

### 7.5 States

| State | Presentation |
|---|---|
| Loading (first) | Section cards render with headings; staff select and the first line row are 40px shimmer bars; breakdown panel shows its empty message |
| Empty (initial) | One blank line row, remove button disabled, breakdown empty, payment 0, footer enabled |
| Filled | As drawn |
| **Stock insufficient** | Offending line: 2px `#EF4444` left border, `IN STOCK` cell `#B91C1C` 600, inline message, row 72px. Form banner appears **only on submit attempt**, never while typing. `Issue coins` stays enabled — the owner is told why on submit, not blocked silently |
| Error (field) | Standard field error treatment |
| Submitting | Button spinner + `Issuing…`, both buttons disabled, all three cards dim to 60%, line inputs read-only |
| Success | Navigate to `/coins/issues/[id]` + success toast |
| Partial error | Save failed after the ledger lock: Danger banner `Nothing was saved. Stock is unchanged.` — explicit, because a half-written ledger is the owner's worst fear |
| Overpay warning | Warning banner above the footer, submission still allowed: `Paid now (₹5,500.00) is more than the total payable (₹5,000.00). Saving will create a ₹500.00 refund due to Ramesh Patel.` |
| Disabled coin type | A deactivated type does not appear in the select at all; if an autosaved draft references one, its row shows `Old Silver · inactive` in `#4B5563` with the message `Old Silver is no longer active. Remove this line or reactivate the coin type.` |
| Read-only | Not applicable — this form is create-only |

### 7.6 Interactions

- Autofocus the staff select. Tab order: Staff → Date → Note → line 1 coin type → packets → (skips computed cells) → `✕` → line 2 … → `+ Add coin type` → Amount paid now → Payment mode → quick buttons → Cancel → Issue coins.
- `Enter` on the last packets field appends a row and focuses its coin type select. `+ Add coin type` appends and focuses likewise.
- `⌘/Ctrl + Enter` submits from anywhere.
- Computed cells, the breakdown block and the settlement line recompute on every keystroke, with **no number animation**.
- Choosing a staff member fetches and shows the context line; if he has a refund due, the line reads `You owe Ramesh Patel ₹500.00 from CIS-000011` in `#2563EB`.
- Quick amount buttons write into the money field and move focus to it so the value can still be edited.
- Validation: on blur per field; on submit everything, scrolling to and focusing the first error. Stock is re-checked server-side under a lock at submit — the client check is a courtesy, not the guard.
- Removing the last remaining line is blocked; the `✕` shows a tooltip `An issue needs at least one coin type`.

### 7.7 Responsive (below 768px)

Each line becomes its own card, 12px radius, 1px `#E5E7EB`, 12px padding, with stacked labelled fields:

```
┌──────────────────────────────────────┐
│ Coin type                        ✕   │
│ [● Green Token                   ▾]  │
│ Packets            In stock          │
│ [        6 ]       240               │
│ 270 coins × ₹11.11  =  ₹3,000.00     │
│ ⚠ Only 240 Green Tokens are in stock │
└──────────────────────────────────────┘
```

The breakdown panel stays full width and remains mono, with the `×`/`=` chain wrapping to two lines per coin type if needed. Payment quick buttons go full width, stacked. Footer becomes fixed to the viewport bottom: `[Issue coins]` 48px full width, `Cancel` as a link above.

### 7.8 Dark mode

Cards `#1E293B`; computed cells and the breakdown panel `#0F172A` with 1px `#334155`; dashed add-row border `#334155` with `#94A3B8` text; error banner `#7F1D1D` bg / `#FECACA` text / `#EF4444` border; warning banner `#7C2D12` / `#FED7AA`; inline stock error `#FCA5A5`; the line's red left border stays `#EF4444`.

### 7.9 Stitch prompt

```text
Design a desktop data-entry form "Issue coins" for an internal Indian water-plant app. Light theme, page background #F8FAFC, white cards 12px radius 1px #E5E7EB, Inter for text and JetBrains Mono for all numbers.

Header: blue "‹ Coin Issues" link, 28px semibold "Issue coins", grey 14px "Hand packets to a staff member and record what they now owe".

Card 1 "Issue details": a 48px searchable select showing "Ramesh Patel · 9876543210" with grey helper "Ramesh currently owes ₹4,500.00 on 1 open issue", a 180px date field "16 Aug 2026" with a calendar icon, and a full-width "Note" input containing "Evening route, Sector 7".

Card 2 "Coins": a bordered inner table with a 36px grey uppercase header COIN TYPE, PACKETS, COINS, PER-COIN, AMOUNT, IN STOCK and three 56px rows containing real inputs. Row 1: dropdown "● Blue Token", narrow right-aligned mono input "3", then borderless grey-filled computed cells 300, ₹10.00, bold ₹3,000.00, 2,440, and an ✕ button. Row 2: "● Red Token", 2, 100, ₹20.00, ₹2,000.00, 1,600. Row 3 is in an error state: "● Green Token", 6, 270, ₹11.11, ₹3,000.00, IN STOCK 240 in red, with a 2px red left border on the row and a small red line beneath reading "⚠ Only 240 Green Tokens are in stock (5 packets + 15)." Below the table a full-width dashed-border ghost button "+ Add coin type".

Then a #F3F4F6 breakdown panel where every line is JetBrains Mono so the columns align:
"Blue Token    3 packets × 100 = 300 coins × ₹10.00 = ₹3,000.00"
"Red Token     2 packets ×  50 = 100 coins × ₹20.00 = ₹2,000.00"
a thin rule, then "Total   400 coins   ₹5,000.00" in 18px mono semibold.

Card 3 "Payment at issue": a 200px money input with a grey ₹ prefix showing 4,000.00, a "Cash" dropdown, two small outline buttons "Full ₹5,000.00" and "Nothing now", and a grey summary line "Total payable ₹5,000.00 · Paid now ₹4,000.00 · Balance ₹1,000.00" with an amber "₹1,000 due" pill on the right.

At the bottom a red-tinted #FEE2E2 error banner with a red border and warning icon: bold "This issue couldn't be saved" and "Only 240 Green Tokens are in stock; you asked for 270. Reduce the quantity to 5 packets or add stock first." Then right-aligned ghost "Cancel" and blue "Issue coins".
```

---

## 8. Screen — Coin issue detail `/coins/issues/[id]`

### 8.1 Purpose

One handover, fully explained: what went out per coin type, everything that came back, every rupee in and out, and the single figure that says whether this relationship is closed. This is also where a refund is actually paid.

### 8.2 Layout

```
‹ Coin Issues
CIS-000011                                             🔵 Refund ₹500
Suresh Chauhan · 9825012345 · Issued 12 Aug 2026 · Edited once
                 [Record Return] [Record Refund ₹500.00] [Edit] [⋯]

┌── Settlement ─────────────────────────────────────────────────────────────┐
│  Issued value    Returned value   Net payable   Collected   Pending       │
│  ₹2,000.00       —                ₹2,000.00     ₹2,500.00   (₹500.00)     │
│  200 coins       0 coins                                    Refund due    │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│ ⟲  You owe Suresh Chauhan ₹500.00                                         │
│    He paid ₹2,500.00 against ₹2,000.00 payable. Record the refund when    │
│    you hand over the cash — the ₹2,500.00 already paid is never edited.   │
│                                            [ Record refund ₹500.00 ]      │
└───────────────────────────────────────────────────────────────────────────┘

[ Coins 1 ]  [ Returns 0 ]  [ Payments 2 ]  [ Activity ]
────────────────────────────────────────────────────────────────────────────
 COIN TYPE      PACKETS  COINS   RATE      ISSUED VALUE  RETURNED   NET
 ● Red Token          4    200   ₹20.00       ₹2,000.00    0 / —  ₹2,000.00
 ─────────────────────────────────────────────────────────────────────────
 Total                4    200                ₹2,000.00    0 / —  ₹2,000.00
```

### 8.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB` | `‹ Coin Issues` |
| Title | H2 **mono** 28px 600 `#111827`, badges inline at 12px gap | `CIS-000011` + `Refund ₹500` |
| Meta line | Body SM `#4B5563`, `·` separated, staff name links to the staff record | `Suresh Chauhan · 9825012345 · Issued 12 Aug 2026 · Edited once` |
| Actions | Contextual primary first: `Record Return` secondary · `Record Refund ₹500.00` **primary** when refund due, otherwise `Record Payment` primary · `Edit` secondary · `⋯` | `⋯`: `Settle difference` · `Print handover slip` · `Cancel issue` (Danger text) |
| Summary card | `#F3F4F6`, 20px padding, 5 columns on `lg`, 3 on `md`, 2 below. Label Caption `#4B5563`, value **20px mono 600**, optional third line Caption. `Pending` is `#111827` 600 when positive, `#2563EB` 600 in parentheses when negative; all others `#374151` | As drawn |
| Refund banner | Primary tint `#DBEAFE`, 1px `#2563EB`, radius 12px, 16px padding, 20px `RotateCcw` `#1D4ED8`. Title 14px 600 `#1D4ED8`, body 14px `#1E3A8A`, action right-aligned 32px primary button. **Dismissible: no** — it disappears only when the refund is recorded | See §8.4 |
| Tabs | 44px, counts in the label | `Coins 1` · `Returns 0` · `Payments 2` · `Activity` |
| Coins tab | Table, header 44px, rows 48px, same columns as the register's expanded panel, plus a total row with a 1px `#111827` top border | |
| Returns tab | Timeline per §9 of the standards; empty state `Nothing returned yet` · `When Suresh brings back unsold coins, record them here and his balance drops.` · `[Record Return]` |
| Payments tab | Timeline, newest first. Inbound entries show `+₹2,500.00` in `#15803D`; outbound refunds show `−₹500.00` in `#2563EB` with a `RotateCcw` dot | |
| Activity tab | Timeline of created / edited / cancelled with actor and timestamp | |
| Timeline | 8px dot in the semantic colour, 1px `#E5E7EB` connector, most recent dot filled `#2563EB` | |

### 8.4 Content and copy

- Refund banner: title `You owe Suresh Chauhan ₹500.00` · body `He paid ₹2,500.00 against ₹2,000.00 payable. Record the refund when you hand over the cash — the ₹2,500.00 already paid is never edited.` · button `Record refund ₹500.00`
- Summary labels: `Issued value` `Returned value` `Net payable` `Collected` `Pending`
- Pending sub-label: `Refund due` in `#2563EB` Caption / `Still to collect` in `#B45309` / `Settled` in `#15803D`
- Payments timeline entries: `12 Aug 2026, 6:05 pm — Paid ₹2,500.00 by cash · Recorded by Admin` · `16 Aug 2026, 11:40 am — Refunded ₹500.00 by UPI · Recorded by Admin`
- Returns timeline entry: `16 Aug 2026, 11:40 am — Returned 50 Blue Token · Recorded by Admin` · `Note: "Unsold, counted back at the plant"`
- Empty returns: `Nothing returned yet` · `When Suresh brings back unsold coins, record them here and his balance drops.`
- Empty payments: `No payments recorded` · `Suresh Chauhan owes ₹2,000.00 on this issue.` · `[Record Payment]`
- Error: `Couldn't load CIS-000011` · `The issue may have been cancelled. Nothing has been changed.` · `Try again`
- Edit warning banner: `This issue already has 2 payments totalling ₹2,500.00. Editing the coin lines changes what's payable and may create a refund due.` (Warning tint, submission still allowed)
- Cancelled state banner (Default tint, non-dismissible): `Cancelled on 16 Aug 2026 by Admin. 200 Red Tokens went back into stock. The ₹2,500.00 collected was not touched.`

### 8.5 States

| State | Presentation |
|---|---|
| Loading | Title and meta render from the list's cached row; summary values are shimmer bars; tab bar visible; first tab shows 4 skeleton rows |
| Empty (sub-tab) | Per-tab copy above — no tab is ever blank |
| Filled | As drawn |
| **Refund due** | Blue banner present, primary action becomes `Record Refund ₹500.00`, pending in blue parentheses, `Refund ₹500` badge |
| Unpaid | No banner; primary is `Record Payment`; pending `#111827` 600; Danger `Unpaid` badge |
| Partially paid | Warning `₹500 due` badge; pending `#111827` 600 |
| Settled | Success `Settled` badge; `Record Return` and `Record Payment` both hidden; `⋯` keeps `Print handover slip` |
| Rounding stub | Info banner: `₹0.05 is still open on this issue because of rounding. You can write it off to close it.` + `[Write off ₹0.05]` |
| Cancelled | Whole page content at 70% opacity except the cancelled banner and the timeline; all actions except `Print handover slip` removed |
| Error | Error block replaces the page body; header keeps the back link |
| Read-only | Action buttons hidden, tabs and timelines fully readable |

### 8.6 Interactions

- `Record Return` opens §9; `Record Refund` / `Record Payment` opens §10 with the direction pre-set and the amount pre-filled.
- After either modal saves: modal closes, page data refreshes in place (no navigation), the changed summary figures are **not** animated, and a success toast names the amount. If the save flipped the issue into refund due, the blue banner appears and the page scrolls it into view.
- Tab switching is instant, no page load; the active tab is in the URL hash so the back button works.
- Every coin type name in the Coins tab links to that coin type's ledger, filtered to this issue's reference.
- `⌘/Ctrl + P` opens the handover slip print view.
- Tab order: back link → action buttons → banner button → tabs → table rows → timeline links.

### 8.7 Responsive (below 768px)

Title wraps above its badges. Action buttons collapse to a sticky bottom bar: the contextual primary full width, everything else behind a `⋯` sheet. Summary card becomes a 2-column grid with `Pending` spanning both columns as the last, largest cell (24px mono 600). The refund banner stacks its button full width beneath the text. Tabs become a scrollable strip. The Coins table becomes stacked labelled blocks per coin type.

### 8.8 Dark mode

Refund banner `#1E3A8A` bg, `#3B82F6` border, `#BFDBFE` text and button label on a `#2563EB` fill. Summary card `#0F172A` on the `#1E293B` page card. Negative pending `#60A5FA`. Timeline connectors `#334155`, active dot `#3B82F6`. Cancelled banner `#334155` / `#E2E8F0`.

### 8.9 Stitch prompt

```text
Design a desktop detail page for a coin issue record in an internal Indian business app. Light theme, #F8FAFC page, white cards 12px radius 1px #E5E7EB, Inter plus JetBrains Mono for figures.

Top: blue "‹ Coin Issues" link, then a 28px semibold JetBrains Mono title "CIS-000011" with a blue pill beside it reading "⟲ Refund ₹500". Under it a 14px grey meta line "Suresh Chauhan · 9825012345 · Issued 12 Aug 2026 · Edited once". Right-aligned buttons: outlined "Record Return", blue filled "Record Refund ₹500.00", outlined "Edit", and a "⋯" icon button.

Below, a #F3F4F6 summary card with five columns, each a 12px uppercase grey label above a 20px mono semibold value: Issued value ₹2,000.00 with grey "200 coins" beneath; Returned value em-dash with "0 coins"; Net payable ₹2,000.00; Collected ₹2,500.00; Pending "(₹500.00)" rendered in blue #2563EB with a small blue "Refund due" caption beneath.

Then a full-width blue information banner: background #DBEAFE, 1px #2563EB border, 12px radius, a circular-arrow icon, bold #1D4ED8 line "You owe Suresh Chauhan ₹500.00", then "He paid ₹2,500.00 against ₹2,000.00 payable. Record the refund when you hand over the cash — the ₹2,500.00 already paid is never edited." and a right-aligned small blue button "Record refund ₹500.00".

Then a 44px tab row: "Coins 1" (active, 2px blue underline), "Returns 0", "Payments 2", "Activity". Under it a table with a 44px #F3F4F6 uppercase header COIN TYPE, PACKETS, COINS, RATE, ISSUED VALUE, RETURNED, NET and one 48px row "● Red Token, 4, 200, ₹20.00, ₹2,000.00, 0 / —, ₹2,000.00" with a red dot, followed by a bold total row separated by a dark 1px rule. All numbers right-aligned in mono.
```

---

## 9. Modal — Record coin return

### 9.1 Purpose

The staff member brings unsold coins back. Per issue line the owner needs four numbers side by side — issued, already returned, returning now, remaining — and he needs to see, before saving, whether this return turns his creditor into his debtor.

### 9.2 Layout

```
┌── Record coin return ──────────────────────────────────────── ✕ ──┐
│ CIS-000011 · Suresh Chauhan · Issued 12 Aug 2026                  │
├───────────────────────────────────────────────────────────────────┤
│ Return date *                                                     │
│ [ 16 Aug 2026            📅 ]                                     │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ COIN TYPE     ISSUED  RETURNED  RETURNING NOW    REMAINING    │ │
│ ├───────────────────────────────────────────────────────────────┤ │
│ │ ● Red Token      200        —   [       60 ]           140    │ │
│ │                                 = ₹1,200.00                   │ │
│ │ ● Blue Token     100       40   [        0 ]            60    │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                             [ Return everything ] │
│                                                                   │
│ Note                                                              │
│ [ Unsold, counted back at the plant                        ]      │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ Returning 60 coins worth              ₹1,200.00               │ │
│ │ Net payable  ₹2,000.00  →              ₹800.00                │ │
│ │ Collected                            ₹2,500.00               │ │
│ │ New pending                          (₹1,700.00)              │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │ ⟲ After this return you will owe Suresh Chauhan ₹1,700.00.    │ │
│ │   The issue will show a blue "Refund ₹1,700" badge. Record    │ │
│ │   the refund from the issue page when you hand the cash over. │ │
│ └───────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│                                    [ Cancel ]  [ Record return ]  │
└───────────────────────────────────────────────────────────────────┘
```

### 9.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Modal | **720px** (contains a table), radius 12px, `shadow-xl`, 24px padding, overlay `rgba(15,23,42,0.5)` | |
| Header | H4 18px 600 `#111827`; subtitle Body SM `#4B5563` with the code as a mono link; `✕` 20px `#9CA3AF` top-right in a 44px target | `Record coin return` / `CIS-000011 · Suresh Chauhan · Issued 12 Aug 2026` |
| Return date | 180px date input, defaults to today, cannot precede the issue date | |
| Line table | Header 36px Caption uppercase `#4B5563`; **rows 56px**; 1px `#E5E7EB` separators; radius 8px, 1px border | |
| Coin type | Colour dot + Body SM 500, read-only, flexible width | `● Red Token` |
| Issued | 90px, mono right, `#4B5563` | `200` |
| Already returned | 110px, mono right, `#4B5563`; zero → `—` `#D1D5DB` | `40` |
| **Returning now** | 120px quantity input, mono right, 40px, autofocus on the first line. Below it inside the row, live value in Caption mono `#15803D` | `60` / `= ₹1,200.00` |
| Remaining | 110px, computed, mono right **600 `#111827`**, `#F3F4F6` cell. Reaches `0` → turns `#15803D` | `140` |
| Return everything | 32px ghost button, right-aligned above the note | `Return everything` — fills every row with its remaining figure |
| Note | Full width textarea, 3 rows, optional | Placeholder `e.g. Unsold, counted back at the plant` |
| **Live settlement panel** | `#F3F4F6`, radius 8px, 16px padding, 4 label/value rows, labels Body SM `#4B5563` left, values mono 14px right; last row `New pending` mono **18px 600**, `#111827` positive, **`#2563EB` in parentheses when negative**. The `→` transition row shows the old value struck through in `#9CA3AF` then the new value | |
| **Refund-flip banner** | Appears inside the modal, above the footer, the instant computed pending goes below zero. Primary tint `#DBEAFE`, 1px `#2563EB`, 12px radius, 12px padding, 16px `RotateCcw` `#1D4ED8`, Caption-plus 13px `#1E3A8A`. Enters with a 200ms fade only — no slide, no layout jump: the space is reserved | See §9.4 |
| Footer | 1px `#E5E7EB` top, right-aligned | `[Cancel]` ghost · `[Record return]` primary |

### 9.4 Content and copy

- Title: `Record coin return` · Subtitle: `CIS-000011 · Suresh Chauhan · Issued 12 Aug 2026`
- Column headers: `COIN TYPE` `ISSUED` `ALREADY RETURNED` `RETURNING NOW` `REMAINING`
- Settlement panel rows: `Returning 60 coins worth` · `Net payable` · `Collected` · `New pending`
- **Refund-flip banner:** `After this return you will owe Suresh Chauhan ₹1,700.00.` / `The issue will show a blue "Refund ₹1,700" badge. Record the refund from the issue page when you hand the cash over.`
- Over-return error (per line): `Only 160 Red Tokens are still out on this issue. Enter 160 or fewer.`
- Zero-return error (form): `Enter how many coins are coming back` / `Every line is 0. Enter a quantity on at least one coin type.`
- Date error: `The return date can't be before the issue date (12 Aug 2026).`
- Rounding footnote, uneven rates only: `Green Token rounds to ₹11.11 a coin, so 45 coins credit ₹499.95 rather than ₹500.00. You can write off the difference from the issue page.`
- Buttons: `Record return` / submitting `Recording…`
- Success toast: `60 Red Tokens returned — you now owe Suresh Chauhan ₹1,700.00` (refund case) · `60 Red Tokens returned — ₹800.00 still due from Suresh Chauhan` (normal case)
- Close-while-dirty confirm: H4 `Discard this return?` · Body SM `60 Red Tokens haven't been recorded yet.` · `[Keep editing]` `[Discard]`
- Failure toast: `Couldn't record the return` + reason + `Retry`

### 9.5 States

| State | Presentation |
|---|---|
| Loading | Modal opens immediately with the header filled from the row; the line table shows 2 skeleton 56px rows; footer disabled |
| Empty (nothing left to return) | Table replaced by a centred 200px block: 40px `PackageCheck` `#22C55E`, H4 `Everything has been returned`, Body SM `All 300 coins on CIS-000010 are back in stock.`, single `[Close]` button |
| Filled | As drawn |
| **Over-return blocked** | Offending row: 2px `#EF4444` left border, input 1px `#EF4444` with a 16px `AlertCircle` inside, `REMAINING` shows `(20)` in `#B91C1C`, Caption error below. `Record return` is **disabled at 40% opacity** with tooltip `Fix the highlighted quantity first` — the one place a disabled primary is correct, because the database will refuse anyway |
| **Refund due (flip)** | Blue banner appears, `New pending` renders `(₹1,700.00)` in `#2563EB` 600, and the primary button label becomes `Record return` still — the refund is a separate, later act, never bundled |
| Submitting | Button spinner + `Recording…`, all inputs read-only, modal content at 60% |
| Success | Modal closes, parent refreshes in place, toast fires |
| Error | Danger banner inside the modal above the footer: `Couldn't record the return` + reason; entered quantities are preserved |
| Read-only (cancelled issue) | Modal cannot be opened; the action is absent from the menu |

### 9.6 Interactions

- Opens focused on the first `Returning now` input, with its value selected so typing replaces it.
- Every keystroke recomputes `Remaining`, the line's value line, the settlement panel and the banner's presence — no number animation, banner fades in over 200ms into pre-reserved space so nothing jumps.
- `Return everything` fills all rows and moves focus to the note.
- `Tab` moves down the `Returning now` column, skipping read-only cells. `↑ ↓` also move between them. `⌘/Ctrl + Enter` submits.
- `Esc` and overlay click close; if any quantity or the note is dirty, the discard confirm appears first.
- Focus is trapped inside the modal; on close it returns to the trigger (`Record Return` button or the row's `⋯` item).
- Validation is on blur per field, but over-return is checked **live** — it is a hard constraint, and letting someone type 300 then telling them on submit wastes the entry.

### 9.7 Responsive (below 768px)

Full-screen sheet, 16px padding, header sticky at the top and footer sticky at the bottom (`Record return` 48px full width, `Cancel` as a link above). Each line becomes a card:

```
┌──────────────────────────────────────┐
│ ● Red Token                          │
│ Issued 200 · Already returned —      │
│ Returning now      [        60 ]     │
│ = ₹1,200.00        Remaining  140    │
└──────────────────────────────────────┘
```

The settlement panel stays pinned directly above the footer so `New pending` is always visible while typing. The refund banner sits between them.

### 9.8 Dark mode

Modal `#1E293B`, overlay `rgba(2,6,23,0.7)`. Computed cells and the settlement panel `#0F172A` with 1px `#334155`. Refund banner `#1E3A8A` / `#3B82F6` border / `#BFDBFE` text. Negative pending `#60A5FA`. Error border `#EF4444`, error text `#FCA5A5`. Value lines `#4ADE80`.

### 9.9 Stitch prompt

```text
Design a 720px modal dialog "Record coin return" over a dimmed page, for an internal Indian business app. Light theme. Modal #FFFFFF, 12px radius, strong shadow, 24px padding, overlay rgba(15,23,42,0.5). Inter for text, JetBrains Mono for numbers.

Header: 18px semibold "Record coin return", below it 14px grey "CIS-000011 · Suresh Chauhan · Issued 12 Aug 2026", and an ✕ close button top right.

Body: a 180px date field "16 Aug 2026" labelled "Return date *" with a blue asterisk. Then a bordered table with a 36px grey uppercase header COIN TYPE, ISSUED, ALREADY RETURNED, RETURNING NOW, REMAINING. Two 56px rows. Row 1: "● Red Token" with a red dot, 200, an em-dash, a 120px right-aligned mono input containing 60 with small green text "= ₹1,200.00" beneath it inside the row, and REMAINING 140 in bold mono on a light grey cell. Row 2: "● Blue Token", 100, 40, input showing 0, remaining 60. A small right-aligned ghost button "Return everything" under the table. Then a "Note" textarea containing "Unsold, counted back at the plant".

Then a #F3F4F6 summary panel, 8px radius, four label/value rows with grey labels left and right-aligned mono values: "Returning 60 coins worth ₹1,200.00", "Net payable ₹2,000.00 → ₹800.00" with the old figure struck through in grey, "Collected ₹2,500.00", and finally "New pending" with a large 18px mono semibold value "(₹1,700.00)" coloured blue #2563EB.

Below that a blue banner, background #DBEAFE, 1px #2563EB border, 12px radius, circular-arrow icon, reading in #1E3A8A: "After this return you will owe Suresh Chauhan ₹1,700.00. The issue will show a blue Refund ₹1,700 badge. Record the refund from the issue page when you hand the cash over."

Footer: 1px top border, right-aligned ghost "Cancel" and blue primary "Record return".
```

---

## 10. Modal — Record coin payment / refund

### 10.1 Purpose

Money moving in either direction against one issue. Instalments in; refunds out. The two share one modal with the direction fixed by how it was opened, because mixing them up is the single most costly mistake available on this screen.

### 10.2 Layout

```
┌── Record refund ───────────────────────────────────────── ✕ ──┐
│ CIS-000011 · Suresh Chauhan · You owe ₹500.00                 │
├───────────────────────────────────────────────────────────────┤
│  ⟲  Money going OUT to Suresh Chauhan                         │
│                                                               │
│  Amount *                     Payment mode *                  │
│  [ ₹      500.00 ]            [ Cash ▾ ]                      │
│  Full refund is ₹500.00                                       │
│                                                               │
│  Date *                       Reference                       │
│  [ 16 Aug 2026     📅 ]       [ UPI ref / cheque no.      ]   │
│                                                               │
│  Note                                                         │
│  [                                                       ]    │
│                                                               │
│  Pending  (₹500.00)  →  —      Issue will show 🟢 Settled     │
├───────────────────────────────────────────────────────────────┤
│                             [ Cancel ]  [ Record refund ]     │
└───────────────────────────────────────────────────────────────┘
```

### 10.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Modal | **560px**, radius 12px, `shadow-xl`, 24px padding | |
| Direction strip | Full width, 40px, radius 8px, 12px padding. **In:** `#DCFCE7` bg, `#15803D` text, 16px `Banknote`. **Out:** `#DBEAFE` bg, `#1D4ED8` text, 16px `RotateCcw`. Always present, never a toggle | `Money coming IN from Suresh Chauhan` / `Money going OUT to Suresh Chauhan` |
| Amount | 200px money input, `₹` prefix, autofocused, pre-filled with the full outstanding or full refund figure, text selected | |
| Amount helper | Caption `#4B5563`, space reserved | `Full refund is ₹500.00` / `₹500.00 still due` |
| Payment mode | 160px select | `Cash` · `UPI` · `Bank transfer` · `Cheque` |
| Date | 180px, defaults to today | |
| Reference | Flexible, optional | Placeholder `UPI ref / cheque no.` |
| Note | Full width, single line, optional | Placeholder `Optional` |
| Live result line | Body SM `#4B5563`; old pending struck through `#9CA3AF`, `→`, new pending mono 600 (blue in parentheses if still a refund); resulting badge on the right per §1.4 | `Pending (₹500.00) → —` + `Settled` |
| Footer | Right-aligned | `[Cancel]` · `[Record refund]` / `[Record payment]` |

### 10.4 Content and copy

- Titles: `Record payment` / `Record refund`
- Subtitles: `CIS-000012 · Ramesh Patel · ₹500.00 still due` / `CIS-000011 · Suresh Chauhan · You owe ₹500.00`
- Errors: `Enter an amount` · `Amount must be more than ₹0.00` · `The date can't be in the future` · `You can only refund up to ₹500.00 on this issue.`
- Overpayment warning (Warning banner, submission allowed): `₹800.00 is more than the ₹500.00 due. The extra ₹300.00 will show as a refund owed to Ramesh Patel.`
- Success toasts: `Payment of ₹500.00 recorded — CIS-000012 is now settled` · `Refund of ₹500.00 recorded — CIS-000011 is now settled`
- Failure toast: `Couldn't record the payment` + reason + `Retry`
- Empty (nothing outstanding): title stays, body replaced by 40px `CheckCircle2` `#22C55E`, H4 `Nothing outstanding`, Body SM `CIS-000010 is fully settled. There's nothing to collect or refund.`, `[Close]`

### 10.5 States

| State | Presentation |
|---|---|
| Loading | Header from cache; two 40px shimmer fields; footer disabled |
| Empty | Settled block above |
| Filled | As drawn |
| Error (field) | Standard red border + `AlertCircle` + Caption message |
| Overpay warning | Amber banner above the footer; `Record payment` stays enabled |
| Submitting | Spinner + `Recording…`, fields read-only, content at 60% |
| Success | Modal closes, parent refreshes in place, toast fires |
| Error (save) | Danger banner inside the modal; values preserved |
| Disabled | `Record refund` is unavailable and the menu item hidden when pending ≥ 0 |
| Read-only | Modal not reachable |

### 10.6 Interactions

- Opens focused on `Amount` with the pre-filled figure selected — one keystroke replaces it, `Enter` accepts it.
- Result line and badge recompute per keystroke, no animation.
- `Tab`: Amount → Mode → Date → Reference → Note → Cancel → primary. `⌘/Ctrl + Enter` submits. `Esc` closes with a dirty-check.
- Refund direction can never be switched inside the modal; the owner must close and choose the other action. This is deliberate friction.

### 10.7 Responsive (below 768px)

Bottom sheet, full width, 16px padding, rounded top corners only. Amount input becomes 48px with a 20px mono value. Amount and mode stack; date and reference stack. Footer sticky, primary 48px full width.

### 10.8 Dark mode

Modal `#1E293B`. Direction strip in: `#14532D` / `#BBF7D0`; out: `#1E3A8A` / `#BFDBFE`. Inputs `#0F172A` with `#334155` borders. Negative pending `#60A5FA`. Warning banner `#7C2D12` / `#FED7AA`.

### 10.9 Stitch prompt

```text
Design a 560px modal dialog "Record refund" for an internal Indian business app, over a dimmed page. Light theme, white modal, 12px radius, 24px padding, strong shadow. Inter for text, JetBrains Mono for figures.

Header: 18px semibold "Record refund", 14px grey subtitle "CIS-000011 · Suresh Chauhan · You owe ₹500.00", ✕ button top right.

Directly under the header, a full-width 40px blue strip with #DBEAFE background, 8px radius, a circular-arrow icon and #1D4ED8 14px medium text "Money going OUT to Suresh Chauhan".

Form: two fields side by side — "Amount *" a 200px money input with a grey ₹ prefix showing 500.00 in right-aligned mono, with 12px grey helper "Full refund is ₹500.00"; and "Payment mode *" a 160px select showing "Cash". Below, another pair — "Date *" a 180px date field showing "16 Aug 2026" with a calendar icon, and "Reference" a text input with placeholder "UPI ref / cheque no.". Then a full-width "Note" input. Labels are 14px medium #111827 with blue asterisks for required fields; inputs are 40px, 1px #D1D5DB, 4px radius.

Below the fields, a single grey 14px result line: "Pending (₹500.00) → —" where the "(₹500.00)" is struck through in grey and the em-dash is bold, with a green "Settled" pill right-aligned on the same line.

Footer: 1px #E5E7EB top border, right-aligned ghost "Cancel" and blue #2563EB primary "Record refund".
```

---

## 11. Screen — Adjustment list `/coins/adjustments`

### 11.1 Purpose

Every manual correction to stock, with the reason visible in the row. This screen exists so that a stock change without an explanation is impossible to hide.

### 11.2 Layout

```
Stock Adjustments                                    [⬇ Export CSV]  [+ New adjustment]
Manual corrections to coin stock, and why each one was made

┌────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search reason, note, adjustment no…]     [Filters ▾]        [⚙ Columns]    │
│ ● Increases  ● Decreases  ● This month  ● Reconciliation           [Clear all] │
├──────────────┬──────────┬──────────────┬───────────────┬──────────┬────────────┤
│ ADJUSTMENT ↕ │ DATE ↕   │ COIN TYPE    │ REASON        │    COINS │ VALUE      │
├──────────────┼──────────┼──────────────┼───────────────┼──────────┼────────────┤
│ ADJ-000007   │ 14 Aug   │ ● Blue Token │ 🔴 Damaged    │      −50 │  ₹500.00   │
│              │          │  Damaged in the store room — water leak on the shelf │
│ ADJ-000006   │ 09 Aug   │ ● Red Token  │ 🟢 New stock  │   +1,000 │₹20,000.00  │
│              │          │  Printed 20 new packets, invoice PR-4471            │
│ ADJ-000005   │ 02 Aug   │ ● Blue Token │ 🟠 Reconcile  │      −12 │  ₹120.00   │
│              │          │  Month-end count came up 12 short                   │
├──────────────┴──────────┴──────────────┴───────────────┴──────────┴────────────┤
│ Showing 1–3 of 3        [25 ▾]                                     ‹ 1 ›       │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Title / subtitle | H2 600 / Body SM `#4B5563` | `Stock Adjustments` · `Manual corrections to coin stock, and why each one was made` |
| Primary action | 40px `#2563EB`, `Plus` icon | `+ New adjustment` |
| Code | Mono 13px `#2563EB` 500, 130px | `ADJ-000007` |
| Date | 100px Body SM | `14 Aug 2026` |
| Coin type | Dot + Body SM 500, 160px, links to the ledger | `● Blue Token` |
| Reason | 150px, badge: `New stock` / `Purchased` Success · `Lost` / `Damaged` / `Stolen` Danger · `Reconciliation` Warning | |
| Coins | 110px right, mono 14px 600. **In** `+1,000` in `#15803D`; **Out** `−50` in `#B91C1C`. The sign is always shown — this is the one column in the app where an explicit `+` is required, because direction is the point | |
| Value | 130px right, mono 14px 500, unsigned | `₹500.00` |
| **Note** | Second line of the row, spanning from the Coin type column to Value, Body SM `#4B5563`, italic-free, truncated with a tooltip. **Row height 64px** — the note is not optional and must not be hidden | `Damaged in the store room — water leak on the shelf` |
| Recorded by | Optional column (off by default): Caption `#4B5563` | `Admin · 6:05 pm` |
| Actions | 56px `⋯`: `Open ledger entry` · `Reverse adjustment` | |
| Row | 64px, hover `#F3F4F6`, click opens the coin type ledger scrolled to that entry | |

### 11.4 Content and copy

- Search placeholder: `Search reason, note, adjustment no…`
- Quick chips: `Increases` `Decreases` `This month` `Reconciliation`
- Filters: `Coin type` · `Direction` · `Reason` · `Date range` · `Recorded by`
- Empty (no data): H4 `No stock adjustments yet` · Body SM `Adjustments are for coins that arrive or disappear outside the normal flow — new printing, damage, or a count that didn't match. Every one needs a reason.` · `+ New adjustment`
- Empty (no results): H4 `No adjustments match your filters` · Body SM `Filters: Decreases · This month` · `Clear filters`
- Error: H4 `Couldn't load adjustments` · Body SM `The server didn't respond. Nothing has been changed.` · `Try again`
- Reverse confirm: H4 `Reverse ADJ-000007?` · Body SM `A new entry adding 50 Blue Tokens back will be created. ADJ-000007 stays in the ledger — nothing is deleted.` · `[Cancel]` `[Reverse adjustment]`

### 11.5 States

| State | Presentation |
|---|---|
| Loading (first) | 8 skeleton rows at 64px with a shorter second bar for the note |
| Loading (refilter) | Table at 60%, 2px `#2563EB` bar |
| Empty (no data) | 48px `Coins` `#D1D5DB` + copy + CTA |
| Empty (no results) | 48px `SearchX` + filter list + `Clear filters` |
| Filled | As drawn |
| Error | 48px `AlertTriangle` `#EF4444` + `Try again` |
| Reversed entry | Row keeps full opacity with a Default `Reversed` badge after the code and the note prefixed `Reversed by ADJ-000009 —`. Never hidden |
| Read-only | `+ New adjustment` and `⋯` hidden |

### 11.6 Interactions

- Row click → `/coins/types/[id]?tab=ledger&entry=ADJ-000007`, with that ledger row briefly outlined 2px `#2563EB` (400ms, then fades) so the eye lands on it.
- Sortable: Adjustment, Date, Coins.
- `+ New adjustment` opens §12 with no coin type pre-set; opening the same modal from a coin type detail pre-sets and locks it.
- Tab order: search → filters → chips → headers → rows → `⋯`.

### 11.7 Responsive (below 768px)

Card per row, with the reason badge on line 1 beside the code, the signed coins figure as the largest element, and the note always shown in full (never truncated on mobile — it is the reason the screen exists):

```
┌────────────────────────────────────────┐
│ ADJ-000007                  🔴 Damaged │
│ ● Blue Token · 14 Aug 2026             │
│ Damaged in the store room — water leak │
│ on the shelf                           │
│ −50 coins                    ₹500.00   │
└────────────────────────────────────────┘
```

### 11.8 Dark mode

Table `#1E293B`, header `#0F172A`, borders `#334155`. In `#4ADE80`, Out `#F87171`. Reason badges use the §1.4 dark pairs. Note text `#94A3B8`.

### 11.9 Stitch prompt

```text
Design a desktop table page "Stock Adjustments" for an internal Indian water-plant app. Light theme, #F8FAFC page, white table card 12px radius 1px #E5E7EB. Inter, plus JetBrains Mono for numbers.

Header: 28px semibold "Stock Adjustments", 14px grey "Manual corrections to coin stock, and why each one was made". Right: ghost "Export CSV" and blue "+ New adjustment".

Table card with a 56px toolbar containing a search box "Search reason, note, adjustment no…" and a "Filters" button, then a 44px row of pill chips: Increases, Decreases, This month, Reconciliation.

Table header 44px, #F3F4F6, 12px uppercase letter-spaced grey: ADJUSTMENT, DATE, COIN TYPE, REASON, COINS, VALUE. Rows are 64px tall and hold two lines each: the data line, then a grey 14px note line spanning the middle of the row.

Row 1: blue mono "ADJ-000007", "14 Aug 2026", "● Blue Token" with a blue dot, a red pill "Damaged", COINS "−50" in red bold mono, VALUE "₹500.00"; note line "Damaged in the store room — water leak on the shelf".
Row 2: "ADJ-000006", "09 Aug 2026", "● Red Token" with a red dot, a green pill "New stock", COINS "+1,000" in green bold mono, VALUE "₹20,000.00"; note "Printed 20 new packets, invoice PR-4471".
Row 3: "ADJ-000005", "02 Aug 2026", "● Blue Token", an amber pill "Reconciliation", COINS "−12" in red, VALUE "₹120.00"; note "Month-end count came up 12 short".

All numbers right-aligned in mono with visible + and − signs. Footer 56px: "Showing 1–3 of 3" on the left, page-size select and pager on the right. No zebra striping; 1px #E5E7EB separators only.
```

---

## 12. Modal — New stock adjustment

### 12.1 Purpose

Change stock by hand, and be forced to say why. The mandatory reason **and** mandatory note are the whole design problem: the requirement must be visible before the owner starts typing, not discovered when he tries to save.

### 12.2 Layout

```
┌── New stock adjustment ─────────────────────────────── ✕ ──┐
│ Corrects stock outside the normal issue-and-return flow    │
├────────────────────────────────────────────────────────────┤
│  ⚠ This writes a permanent ledger entry. It can't be       │
│    edited or deleted later — only reversed.                │
│                                                            │
│  Coin type *                     Date *                    │
│  [ ● Blue Token          ▾ ]     [ 16 Aug 2026     📅 ]    │
│  2,440 coins in stock (24 packets + 40)                    │
│                                                            │
│  Direction *                                               │
│  ( ● ) In — new coins       ( ○ ) Out — lost or damaged    │
│                                                            │
│  Coins *                                                   │
│  [        50 ]   = ₹500.00 · new balance 2,390             │
│                                                            │
│  Reason *                                                  │
│  [ Damaged                                            ▾ ]  │
│                                                            │
│  What happened? *                                          │
│  [ Damaged in the store room — water leak on the      ]    │
│  [ shelf                                              ]    │
│  Required. A stock change with no explanation can't be     │
│  audited later.                                            │
├────────────────────────────────────────────────────────────┤
│                     [ Cancel ]  [ Record adjustment ]      │
└────────────────────────────────────────────────────────────┘
```

### 12.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Modal | **560px**, radius 12px, `shadow-xl`, 24px padding | |
| Header | H4 `New stock adjustment`, subtitle Body SM `#4B5563` | `Corrects stock outside the normal issue-and-return flow` |
| **Permanence notice** | Full width, `#FEF3C7` bg, 1px `#F97316`, radius 8px, 12px padding, 16px `AlertTriangle` `#B45309`, 13px `#7C2D12`. Non-dismissible. Sits above the first field, so the consequence is read before anything is typed | `This writes a permanent ledger entry. It can't be edited or deleted later — only reversed.` |
| Coin type | Search select, flexible; locked and read-only when opened from a coin type detail (borderless, `#F3F4F6`, `#4B5563`) | |
| Stock context | Caption `#4B5563` under the select, updates on selection | `2,440 coins in stock (24 packets + 40)` |
| Date | 180px, defaults to today, cannot be in the future | |
| Direction | Two radio cards, 8px gap, each 40px, radius 8px, 1px `#D1D5DB`; selected gets 2px `#2563EB` and `#DBEAFE` bg. Icons: `Plus` for In, `PackageX` for Out | `In — new coins` · `Out — lost or damaged` |
| Coins | 120px quantity input, mono right | |
| Live result | Body SM `#4B5563` beside the input, mono figures `#111827` | `= ₹500.00 · new balance 2,390` |
| Reason | Full width select, options change with direction | See §12.4 |
| **What happened?** | Full-width textarea, 3 rows, resizable vertically. Label carries the blue `*` **and** the question form — `What happened?` prompts a sentence in a way `Note` never does | |
| Note helper | Caption `#4B5563`, **always present**, not only on error — the space is reserved and the sentence is the requirement's explanation | `Required. A stock change with no explanation can't be audited later.` |
| Footer | Right-aligned | `[Cancel]` ghost · `[Record adjustment]` primary |

### 12.4 Content and copy

- Reason options, direction **In**: `New stock` · `Purchased` · `Found` · `Reconciliation`
- Reason options, direction **Out**: `Lost` · `Damaged` · `Stolen` · `Reconciliation`
- Placeholder for the note: `e.g. Damaged in the store room — water leak on the shelf`
- Helper: `Required. A stock change with no explanation can't be audited later.`
- Errors: `Choose a coin type` · `Choose a direction` · `Enter how many coins` · `Coins must be more than 0` · `Whole coins only` · `Choose a reason` · **`Explain why the stock changed — for example "Counted 12 short at the month-end check".`**
- Insufficient-stock error (direction Out): `Only 2,440 Blue Tokens are in stock. You can't remove 3,000.`
- Future date error: `The adjustment date can't be in the future.`
- Buttons: `Record adjustment` / submitting `Recording…`
- Success toast: `50 Blue Tokens removed — new balance 2,390 coins`
- Discard confirm: H4 `Discard this adjustment?` · Body SM `Nothing will be recorded.` · `[Keep editing]` `[Discard]`

> **How the mandatory note is communicated — four layers, deliberately redundant:**
> 1. The **amber permanence banner** at the top, before any field.
> 2. The label is a **question** — `What happened? *` — not a noun.
> 3. **Always-visible helper text** stating the requirement and its reason.
> 4. On submit, a **specific error with an example sentence**, focus moved into the textarea.
> The primary button is **never disabled**. A disabled button that won't say why is how people conclude the software is broken.

### 12.5 States

| State | Presentation |
|---|---|
| Loading | Coin type select is a 40px shimmer; everything else renders |
| Empty (initial) | Coin type autofocused (or Coins, when the type is locked), direction defaults to `Out` — the more common and more dangerous case, so it is never silently `In` |
| Filled | As drawn |
| Error (field) | 1px `#EF4444`, `AlertCircle` inside right, Caption `#EF4444` below; the note's error **replaces** the helper line in the same reserved space, so nothing shifts |
| Error (stock) | Coins field error + a Danger banner above the footer with the insufficient-stock copy |
| Submitting | Spinner + `Recording…`, fields read-only, content 60% |
| Success | Modal closes, ledger or adjustment list refreshes in place, the new row briefly outlined 2px `#2563EB`, toast fires |
| Error (save) | Danger banner inside the modal; all entered values preserved |
| Disabled (coin type locked) | Borderless `#F3F4F6` field showing `● Blue Token` with a 14px `Lock` note `Set from the coin type you opened this from` |
| Read-only | Modal not reachable |

### 12.6 Interactions

- Changing direction rewrites the reason options and clears any chosen reason, with the select showing its placeholder again — a `Damaged` reason on an `In` adjustment must be impossible.
- `Coins` recomputes the value and the new balance per keystroke. If the direction is `Out` and the entry exceeds stock, the new balance renders `(560)` in `#B91C1C` immediately, before submit.
- Validation on blur; note validated on submit (it is a paragraph — blur-validating a textarea someone stepped away from is hostile).
- Tab order: Coin type → Date → Direction (arrows move within) → Coins → Reason → What happened? → Cancel → Record adjustment. `⌘/Ctrl + Enter` submits.
- `Esc` / overlay click closes with a dirty-check.

### 12.7 Responsive (below 768px)

Bottom sheet, full width, rounded top. Permanence banner stays at the top and is never collapsed. Coin type and date stack; direction radio cards stack full width at 48px each; the textarea grows to 4 rows. Footer sticky with `Record adjustment` 48px full width.

### 12.8 Dark mode

Modal `#1E293B`. Permanence banner `#7C2D12` bg, `#F97316` border, `#FED7AA` text. Selected direction card `#1E3A8A` bg with a `#3B82F6` border. Textarea `#0F172A` with `#334155` border. Helper `#94A3B8`, error `#FCA5A5`.

### 12.9 Stitch prompt

```text
Design a 560px modal dialog "New stock adjustment" for an internal Indian business app, over a dimmed page. Light theme, white modal, 12px radius, 24px padding, strong shadow. Inter for text, JetBrains Mono for numbers.

Header: 18px semibold "New stock adjustment" with 14px grey subtitle "Corrects stock outside the normal issue-and-return flow" and an ✕ close button.

Immediately below the header, a full-width amber warning banner: #FEF3C7 background, 1px #F97316 border, 8px radius, 12px padding, warning triangle icon, 13px #7C2D12 text "This writes a permanent ledger entry. It can't be edited or deleted later — only reversed."

Fields, all labels 14px medium #111827 with blue asterisks: "Coin type *" a select showing "● Blue Token" with a blue dot, with 12px grey helper "2,440 coins in stock (24 packets + 40)"; beside it "Date *" a 180px date field "16 Aug 2026". Then "Direction *" as two selectable cards side by side, each 40px with 8px radius — "In — new coins" with a plus icon, and "Out — lost or damaged" with a box-x icon, the second one selected with a 2px #2563EB border and #DBEAFE fill. Then "Coins *", a narrow 120px right-aligned mono input showing 50, with grey text beside it "= ₹500.00 · new balance 2,390". Then "Reason *", a full-width select showing "Damaged".

Then the key field: a label reading "What happened? *" above a 3-row textarea containing "Damaged in the store room — water leak on the shelf", and beneath it permanent 12px grey helper text "Required. A stock change with no explanation can't be audited later."

Footer: 1px #E5E7EB top border, right-aligned ghost "Cancel" and blue #2563EB primary "Record adjustment". The primary button is enabled, not greyed out.
```

---

## 13. Shared component — Coin reconciliation drift banner

### 13.1 Purpose

The cached balance on a coin type and the sum of its ledger entries must always agree. When they don't, something is seriously wrong and the owner must know before he acts on any figure on the screen. This banner is **never dismissible** (§11.2).

### 13.2 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚠  Coin balance mismatch — Blue Token                                   │
│    The stored balance says 2,440 coins but the ledger adds up to 2,390. │
│    A difference of 50 coins (₹500.00).                                  │
│    Nothing has been changed. Recheck the ledger before issuing more.    │
│                              [ Open ledger ]  [ Recalculate from ledger ]│
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Container | Full width of the content area, `#FEE2E2` bg, 1px `#EF4444`, radius 12px, 16px padding, 20px `AlertTriangle` `#B91C1C` left with 12px gap. **No `✕`** | |
| Title | 14px 600 `#B91C1C` | `Coin balance mismatch — Blue Token` |
| Body | 14px/1.6 `#7F1D1D`; every figure in mono | Three sentences, exactly as drawn |
| Actions | Right-aligned, 32px. `Open ledger` secondary (1px `#B91C1C`, `#B91C1C` text, transparent). `Recalculate from ledger` primary in `#B91C1C` with white text | |
| Placement | Directly under the page header, above KPIs, on: coin type list (§3), coin type detail (§5, replacing the green band), issue register (§6). Sticky under the topbar on §5 | |
| Multiple types affected | Title becomes `Coin balance mismatch — 2 coin types`, body lists each on its own line: `Blue Token: stored 2,440, ledger 2,390 (50 coins, ₹500.00)` | |

### 13.4 Content and copy

- Title: `Coin balance mismatch — Blue Token`
- Body: `The stored balance says 2,440 coins but the ledger adds up to 2,390. A difference of 50 coins (₹500.00).` / `Nothing has been changed. Recheck the ledger before issuing more.`
- Buttons: `Open ledger` · `Recalculate from ledger`
- Recalculate confirm: H4 `Recalculate Blue Token from the ledger?` · Body SM `The stored balance will be replaced with 2,390 coins, the ledger total. No ledger entries are added, changed or removed. If the ledger itself is wrong, record an adjustment instead.` · `[Cancel]` `[Recalculate]`
- Recalculate success toast: `Blue Token balance recalculated — 2,390 coins`
- Recalculate failure toast: `Couldn't recalculate. The balance is unchanged.` + `Retry`
- Screen reader: the banner is an `aria-live="assertive"` region announced on load.

### 13.5 States

| State | Presentation |
|---|---|
| Hidden | No drift — nothing renders. On §5 the green reconciliation band takes its place |
| Loading (check pending) | Nothing renders; never flash a drift warning that might be wrong |
| Drift, single type | As drawn |
| Drift, multiple types | Listed body, title counts the types |
| Recalculating | Primary shows a spinner and `Recalculating…`, both buttons disabled, banner stays red |
| Resolved | Banner is replaced by a Success banner for 6 seconds — `Blue Token now reconciles: Opening 3,000 + In 640 − Out 1,250 = Balance 2,390 coins` — which then removes itself and restores the green band |
| Read-only | `Recalculate from ledger` hidden; `Open ledger` remains |

### 13.6 Interactions

- Cannot be dismissed, collapsed or scrolled past on §5 — it is sticky beneath the topbar.
- `Open ledger` navigates to the affected coin type's ledger, unfiltered, on page 1.
- `Recalculate from ledger` opens the confirm dialog first. The confirm's primary is `Recalculate` — the verb repeated, never `Yes`.
- Focus: on first render the banner receives focus so keyboard and screen reader users meet it before the table.
- The `+ Issue coins` primary action stays enabled while drift exists — blocking work over a display mismatch would push the owner back to the notebook, which is the failure this app exists to prevent. The server lock is the real guard.

### 13.7 Responsive (below 768px)

Full-bleed to the 16px content padding. Icon moves above the title. Figures wrap onto their own lines. Both buttons become full width and stack, `Recalculate from ledger` first, 44px each.

### 13.8 Dark mode

`#7F1D1D` bg, `#EF4444` border, `#FECACA` title and body. `Open ledger` becomes a 1px `#FECACA` outline with `#FECACA` text; `Recalculate from ledger` becomes `#EF4444` fill with `#7F1D1D` text. The success replacement uses `#14532D` / `#166534` / `#BBF7D0`.

### 13.9 Stitch prompt

```text
Design a non-dismissible full-width alert banner for a data-heavy internal business app, placed directly under a page header and above a row of KPI cards. Light theme.

The banner is 12px radius, background #FEE2E2, 1px #EF4444 border, 16px padding, with a 20px dark-red warning triangle icon on the left and a 12px gap. There is deliberately NO close button.

Content, left aligned: a 14px semibold #B91C1C title "Coin balance mismatch — Blue Token". Below it, 14px #7F1D1D body text over two lines: "The stored balance says 2,440 coins but the ledger adds up to 2,390. A difference of 50 coins (₹500.00)." and "Nothing has been changed. Recheck the ledger before issuing more." All numbers are rendered in JetBrains Mono so they stand out from the sentence.

On the right, two 32px buttons with 8px gap: an outlined button "Open ledger" with a #B91C1C border and #B91C1C text on a transparent background, and a filled button "Recalculate from ledger" with a #B91C1C background and white text, both 8px radius.

Show the banner in context: above it a 28px semibold page title "Coin Types" with a grey subtitle, and below it four KPI cards on a #F8FAFC page background. Use Inter for text and JetBrains Mono for every figure. The banner should read as urgent but calm — no full-red fill, no icons other than the single triangle.
```

---

## Module design checklist

- [ ] Every page header has an H2 title **and** a one-line subtitle
- [ ] Primary action top-right, named for what it does — `+ Issue coins`, `Record return`, `Record adjustment`, never `Submit`
- [ ] Table rows 48px (64px only where a mandatory note occupies a second line), headers 44px and sticky, line-item rows 56px, expanded sub-rows 40px
- [ ] No zebra striping anywhere; separation is 1px `#E5E7EB` borders plus, in the ledger only, vertical hairlines around the money block
- [ ] All money: JetBrains Mono, right-aligned, `₹` prefix, 2 decimals, `—` for zero, parentheses for negative
- [ ] Negative **pending** renders blue `(₹500.00)`, not red — refund owed is not a loss (documented exception to §13)
- [ ] Coin issue status badges follow the §7.2 map exactly: `Unpaid` / `₹500 due` / `Paid` / `Settled` / `Refund ₹500` / `Cancelled`
- [ ] All seven ledger movement types have a badge, an icon and a direction column — colour is never the only signal
- [ ] Stock is shown in coins **and** in packets everywhere it appears
- [ ] Per-coin value is displayed live while typing, at six decimals, and never editable
- [ ] Every reference code (`CIS-000012`, `ORD-000044`, `ADJ-000007`) is a link
- [ ] Every figure that could be drilled into is clickable, including KPI cards
- [ ] Expand/collapse: chevron rotates in 100ms, panel appears instantly, state persists across refilter and repage, `aria-expanded` set
- [ ] Five core states designed per screen: loading (first), loading (refilter), empty (no data), empty (no results), filled, error — plus partial error, submitting, success, disabled, read-only
- [ ] Empty-no-data and empty-no-results have **different** copy and different CTAs
- [ ] Module-specific states designed: stock insufficient, refund due, over-return blocked, ledger drift, rounding stub, cancelled
- [ ] Validation on blur, never while typing — except over-return, which is a hard constraint checked live
- [ ] Error messages are specific and actionable, naming the coin type and the number
- [ ] The adjustment note requirement is communicated four ways; the primary button is never disabled for it
- [ ] The reconciliation drift banner is non-dismissible and takes focus on render
- [ ] The ledger is read-only everywhere; corrections are reversing entries
- [ ] Focus rings visible on every interactive element, 2px `#2563EB` at 2px offset
- [ ] Icons only from the §17 map, 1.5px stroke
- [ ] Designed in both light and dark, with dark badge pairs and inset panels going *darker* rather than lighter
- [ ] Checked with Gujarati at realistic length: `કોઇન ઇશ્યૂ કરો` on the primary button (min-width 160px, sizes to content), `ચૂકવવાપાત્ર રકમ` wrapping the `NET PAYABLE` header to two lines with the header row growing 44px → 56px, `રમેશ પટેલ` in the staff cell at line-height 1.6, and the mono figure columns identical in both languages
- [ ] Mobile layout defined below 768px for every screen, including the ledger's frozen money block
- [ ] `⌘/Ctrl + Enter` submits every form and modal; `Esc` closes with a dirty-check
