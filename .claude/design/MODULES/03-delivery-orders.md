# Module 03 — Delivery Orders · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/03-delivery-orders.md](../../MODULES/03-delivery-orders.md)
>
> This is the heaviest module in the application. Four screens, three modals, two confirm dialogs, and the only place in the app where a document's total can go **down** after it is created. Build Staff (01), Products (02) and Coins (04) before this.

---

## 1. Design context (for Stitch)

Everything an AI design tool needs, restated so this file works pasted on its own.

**Product.** Internal back-office tool for the owner of a mineral-water plant in Gujarat, India. One user, many times a day, often in a hurry, sometimes on a phone in a vehicle. Dense, fast, unglamorous. Not a consumer app.

**Colour — light / dark**

| Token | Light | Dark | Use |
|---|---|---|---|
| Nova Blue (primary) | `#2563EB` | `#3B82F6` | Primary button, links, active nav, focus ring, doc codes |
| Surface (card) | `#FFFFFF` | `#1E293B` | Cards, table body, modals |
| Surface subtle | `#F3F4F6` | `#1E293B` | Table header, inset panels, row hover |
| Page background | `#F8FAFC` | `#0B1220` | Behind cards |
| Text primary | `#111827` | `#F1F5F9` | Values, headings |
| Text secondary | `#4B5563` | `#94A3B8` | Labels, captions, helper text |
| Text disabled / empty | `#D1D5DB` | `#475569` | The `—` used for zero |
| Border | `#E5E7EB` | `#334155` | Card borders, table rules |
| Input border | `#D1D5DB` | `#334155` | Field outlines |
| Success | `#22C55E` | same | Paid, Settled |
| Warning | `#F97316` | same | Partial, overpaid, rate override |
| Danger | `#EF4444` | same | Unpaid, jars out, destructive |

**Type** — Inter everywhere; **JetBrains Mono** (`tabular-nums`) for every figure; **Noto Sans Gujarati** in the fallback stack.

| Role | Size / LH / Weight | Used for |
|---|---|---|
| H2 | 28px / 1.3 / 600 | Page titles |
| H3 | 22px / 1.4 / 600 | Card and section headings |
| H4 | 18px / 1.4 / 600 | Sub-sections, modal titles |
| Body | 16px / 1.6 / 400 | Detail page content |
| Body SM | 14px / 1.5 / 400 | **Table cells, form labels, most of the app** |
| Caption | 12px / 1.4 / 500 | Metadata, badges, helper text, column headers |
| Table amount | 14px mono 500, right | Money in a column |
| Emphasised amount | 14px mono 600 `#111827`, right | Balance, outstanding |
| KPI value | 28px mono 700 | KPI cards |
| Form total | 18px mono 600 | Grand total in a form |

**Spacing** 4 · 8 · 12 · 16 · 24 · 32 only. **Radius** input 4px · button/chip 8px · badge full · card/modal 12px. **Shadow** card `0 1px 2px rgba(0,0,0,.05)` · modal `0 20px 25px rgba(0,0,0,.15)`.

**Metrics** Sidebar 240px · Topbar 64px · content max 1440px · content padding 24px (16px below `md`) · section gap 32px · card grid gap 24px. **Table header row 44px · body row 48px · line-item row 56px · toolbar 56px · quick-chip strip 44px · footer 56px · tabs 44px.** Cell padding 12px vertical / 16px horizontal. No zebra striping. Row hover `#F3F4F6`.

**Badges** — 22px tall, 8px horizontal padding, full radius, Caption 12px 500, 12px leading icon + 4px gap.

| Variant | BG | Text | Dark BG | Dark text |
|---|---|---|---|---|
| Default | `#E5E7EB` | `#374151` | `#334155` | `#E2E8F0` |
| Primary | `#DBEAFE` | `#1D4ED8` | `#1E3A8A` | `#BFDBFE` |
| Success | `#DCFCE7` | `#15803D` | `#14532D` | `#BBF7D0` |
| Warning | `#FEF3C7` | `#B45309` | `#7C2D12` | `#FED7AA` |
| Danger | `#FEE2E2` | `#B91C1C` | `#7F1D1D` | `#FECACA` |

**Status map used by this module — verbatim, numbers included**

| Domain status | Variant | Label | Icon |
|---|---|---|---|
| Unpaid | Danger | `Unpaid` | `Circle` |
| Partially paid | Warning | `₹450 due` | `CircleDashed` |
| Paid | Success | `Paid` | `CheckCircle2` |
| Overpaid | Warning | `Overpaid ₹60` | `AlertCircle` |
| Nothing returned | Danger | `40 jars out` | `PackageX` |
| Partially returned | Warning | `8 jars out` | `Package` |
| Fully returned | Success | `Settled` | `PackageCheck` |
| Not returnable | Default | `—` | none |
| Cancelled | Default | `Cancelled` + row at 60% opacity | `Ban` |

**Money** `₹` + Indian lakh grouping + always 2 decimals → `₹12,34,567.00`. Zero renders as `—` in `#D1D5DB`, never `₹0.00`. Negative in parentheses, Danger text → `(₹500.00)`. Quantities grouped, no decimals. Dates `14 Aug 2026`; today/yesterday become `Today` / `Yesterday`. Times `6:05 pm`. **Digits are always Latin 0–9 in both languages.**

**Icons** Lucide, 1.5px stroke. `ClipboardList` order · `Package` product · `PackageX` jars out · `PackageCheck` settled · `RotateCcw` return · `Banknote` payment · `Wallet` cash · `Coins` coin · `Plus` add · `Pencil` edit · `Trash2` delete · `Search` search · `SlidersHorizontal` filter · `Download` export · `MoreHorizontal` more · `AlertTriangle` / `AlertCircle` warnings.

**The five principles that override generic taste**

1. **Density over whitespace** — 25 rows on screen, not 8.
2. **Numbers are the interface** — figures get mono, right alignment and more weight than their labels.
3. **Status is scannable without reading** — red = money or jars outstanding, amber = partial, green = settled.
4. **Every number is a door** — KPI values, badge counts and totals navigate to a filtered list.
5. **Entry speed is a feature** — first field autofocused, deliberate tab order, `⌘/Ctrl + Enter` submits, nothing needs a mouse.

**Bilingual.** Every label ships in English and Gujarati. Gujarati runs **20–40% longer** and is **taller** (matras above and below). Never fix a width to English content; min-height 1.6 line-height everywhere; table headers wrap to two lines rather than truncate. Names may be in either script — `Ramesh Patel` or `રમેશ પટેલ` — in the same column.

---

## 2. Screens in this module

| Screen | Route | Archetype | Purpose |
|---|---|---|---|
| Order list | `/orders` | **A — List** | The daily working screen: what went out, what is owed, what is still out |
| Create order | `/orders/new` | **C — Form** | Record what left the plant this morning, optionally with payment |
| Edit order | `/orders/[id]/edit` | **C — Form** | Fix a mis-keyed quantity or rate, with a history warning |
| Order detail | `/orders/[id]` | **B — Detail** | The audit view: items, returns, payments, activity |
| Record Return | modal on detail, 720px | Modal form (mini table) | Split returning jars into empty / filled / lost, this order and older ones |
| Record Payment | modal on detail + inline block on create, 560px | Modal form | Cash and coins against the balance |
| Write off lost jars | dialog, 420px | Confirm | Close an order whose jars will never come back |
| Cancel order | dialog, 420px | Confirm | Blocked until payments and returns are reversed |

---

## 3. Order list — `/orders`

### 3.1 Purpose

The screen the owner opens most. It answers three questions without a click: *what went out today*, *who owes me money*, *whose jars are still out*. Every figure on it is a door into a filtered view. Rows carry **two independent badges** — an order can genuinely be `Paid` and `12 jars out` at the same time.

### 3.2 Layout

Application shell per standards §3 (sidebar 240px, topbar 64px). Content area only shown below.

```
Delivery Orders                                    [⬇ Export CSV]  [ + New Order ]
Track jars issued, returned, and money collected

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 📋 TODAY'S ORDERS│ │ 💰 TODAY'S COLL. │ │ 🔴 OUTSTANDING   │ │ 📦 JARS OUT      │
│                  │ │                  │ │                  │ │                  │
│ 14               │ │ ₹18,450.00       │ │ ₹42,180.00       │ │ 316              │
│ ▲ 3 vs yesterday │ │ ▲ 12.4% vs yest. │ │ ▲ 8.1% vs last wk│ │ across 23 orders │
│ 812 units issued │ │ Cash ₹14,200 ·   │ │ 23 orders unpaid │ │ Oldest 22 days   │
│                  │ │ Coins ₹4,250     │ │ or partial       │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search order no, staff name, phone…        ]   [⚙ Filters (2)] [⚙ Columns]  │ 56
│ ● Today   ● Money pending   ● Jars out   ● Fully settled        Clear all       │ 44
│ ─────────────────────────────────────────────────────────────────────────────── │
│ Staff: Ramesh Patel ✕   Date: 01–16 Aug 2026 ✕                                  │ 40 (only when filters set)
├─────────────────────────────────────────────────────────────────────────────────┤
│ ORDER ↕   DATE ↕     STAFF ↕        ITEMS       TOTAL ↕  COLL.   BAL ↕  STATUS ⋯│ 44
├─────────────────────────────────────────────────────────────────────────────────┤
│ ORD-000123 Today     Ramesh Patel   3 items ·  ₹1,330.00 ₹880.00 ₹450.00        │
│                      9876543210     62 units                     🟠 ₹450 due    │ 48
│                                                                  🔴 8 jars out ⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ ORD-000122 Today     સુરેશ ચૌહાણ    2 items ·  ₹2,480.00 ₹2,480.00      —       │
│                      9825011223     94 units                     🟢 Paid        │ 48
│                                                                  🟢 Settled    ⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ ORD-000121 Yesterday Dinesh Solanki 1 item ·   ₹1,400.00      —  ₹1,400.00      │
│                      9909887766     40 units                     🔴 Unpaid      │ 48
│                                                                  🔴 40 jars out⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ ORD-000118 09 Aug    Ramesh Patel   2 items ·  ₹1,120.00 ₹1,180.00 (₹60.00)     │
│                      9876543210     30 units                     🟠 Overpaid ₹60│ 48
│                                                                  🟠 9 jars out ⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ ORD-000117 08 Aug    Mahesh Vaghela 1 item ·        —         —        —        │
│  (60% opacity)       9737221100     24 units                     ⚪ Cancelled  ⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ Showing 1–25 of 312           [25 ▾]                    ‹  1  2  3  …  13  ›    │ 56
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Region-by-region spec

**Page header**

| Element | Spec | Content |
|---|---|---|
| Title | H2 28px/1.3 600 Gray 900 `#111827` | `Delivery Orders` |
| Subtitle | Body SM 14px/1.5 400 Gray 600 `#4B5563`, 4px below title | `Track jars issued, returned, and money collected` |
| Secondary action | Button MD 40px, 1px Nova Blue border `#2563EB`, Nova Blue label, transparent bg, radius 8px, 16px `Download` icon + 8px gap | `Export CSV` |
| Primary action | Button MD 40px, filled `#2563EB`, white label 15px 500, radius 8px, 16px `Plus` icon + 8px gap | `+ New Order` |
| Header bottom margin | 24px | — |

**KPI strip** — 4 columns on `xl`, 2 on `md`, 1 below. Grid gap 24px, equal heights.

| Card | Icon (16px Gray 400) | Label (Caption 12px 600 upper, `0.04em`, Gray 600) | Value (28px mono 700 Gray 900) | Trend | Breakdown (Caption Gray 600) | Navigates to |
|---|---|---|---|---|---|---|
| 1 | `ClipboardList` | `TODAY'S ORDERS` | `14` | `▲ 3 vs yesterday` green | `812 units issued` | `/orders?date=today` |
| 2 | `Banknote` | `TODAY'S COLLECTION` | `₹18,450.00` | `▲ 12.4% vs yesterday` green | `Cash ₹14,200.00 · Coins ₹4,250.00` | `/orders?date=today&payment=any` |
| 3 | `AlertCircle` | `OUTSTANDING CASH` | `₹42,180.00` | `▲ 8.1% vs last week` **red — up is bad here** | `23 orders unpaid or partial` | `/orders?payment=pending` |
| 4 | `PackageX` | `JARS OUT` | `316` | `Oldest 22 days` in Spark Red | `across 23 orders` | `/orders?returns=pending` |

Cards 3 and 4 use the **alert variant** whenever their value is non-zero: 3px `#EF4444` left border, value in `#B91C1C`. Whole card clickable; hover border `#2563EB` at 40% over 100ms; cursor pointer.

**Toolbar (56px)**

| Element | Spec | Content |
|---|---|---|
| Search | 40px input, radius 4px, 1px `#D1D5DB`, 16px `Search` icon left at 12px inset, max-width 400px, debounce 300ms, `×` clear once typed | Placeholder `Search order no, staff name, phone…` |
| Filters button | Button MD ghost with 1px border, `SlidersHorizontal` 16px, count suffix when active | `Filters` → `Filters (2)` |
| Columns button | 40×40 icon button, `Settings` 16px, aria-label `Choose columns` | — |

**Filter popover** (320px, radius 8px, `shadow-lg`, 1px border): Staff (search select) · Date range (two 180px date inputs + presets `Today` `This week` `This month` `Last 30 days`) · Payment status (checkbox list: Unpaid / Partial / Paid / Overpaid) · Return status (Nothing back / Partial / Settled / Not applicable) · Product (search select) · Amount range (two 200px money inputs, `Min` / `Max`). Footer: `[Reset]` ghost + `[Apply filters]` primary.

**Quick chips (44px strip)** — one-tap presets, 8px gaps. Inactive = Default badge, clickable, 32px tall, 12px horizontal padding. Active = Primary badge + 1px `#2563EB` border. `Clear all` in Body SM Gray 600 appears at the right once anything is active.

`Today` · `Money pending` · `Jars out` · `Fully settled`

**Applied-filter chips (40px band, only present when filters are set)** — Default badge with a 12px `×`, label pattern `Staff: Ramesh Patel`, `Date: 01–16 Aug 2026`, `Amount: ₹500.00–₹5,000.00`.

**Table**

| Column | Width | Align | Sort | Rendering |
|---|---|---|---|---|
| ORDER | 120px, sticky-left below 1280px | left | ✅ | `ORD-000123` mono 13px 500 `#2563EB` |
| DATE | 110px | left | ✅ default desc | `Today` / `Yesterday` / `09 Aug 2026`, Body SM |
| STAFF | 200px flex | left | ✅ | Two lines in the 48px row: name Body SM 500 Gray 900; phone Caption 12px Gray 600 |
| ITEMS | 150px | left | ✖ | Default chip, Caption: `3 items · 62 units` |
| TOTAL | 110px | **right** | ✅ | Mono 14px 500. Struck-through original + new value when filled returns exist (see 3.5) |
| COLL. | 110px | **right** | ✖ | Mono 14px 500. Zero → `—` Gray 300. Hidden by default below 1280px |
| BAL | 110px | **right** | ✅ | Mono 14px **600** Gray 900. Negative → `(₹60.00)` in `#B91C1C` |
| STATUS | 200px | centre | ✖ | **Two badges stacked**, payment first, 4px gap. Side by side ≥1280px, stacked below |
| ⋯ | 56px fixed | centre | ✖ | 32×32 icon button with padding to a 44×44 target, `MoreHorizontal` 16px Gray 600. **Always visible** |

Header row 44px, background `#F3F4F6`, Caption 12px **600 uppercase** `0.04em` Gray 600, sticky on scroll. Body row 48px, 1px bottom border `#E5E7EB`, whole row clickable → `/orders/[id]`, cursor pointer, hover `#F3F4F6` over 100ms.

**Row actions menu** (`⋯`, 8px radius, `shadow-lg`, 200px): `View order` · `Record payment` · `Record return` · `Edit order` · divider · `Cancel order` in `#B91C1C`. Items disabled with a Caption reason when not applicable — e.g. `Record return` disabled on an order with no returnable products, tooltip `This order has no returnable products`.

**Pagination (56px)** — left `Showing 1–25 of 312` Caption Gray 600; right page-size select (10/25/50/100) then `‹ 1 2 3 … 13 ›`, current page filled `#2563EB` white, arrows at 40% opacity when disabled.

### 3.4 Content and copy

| Slot | English | Gujarati (length note) |
|---|---|---|
| Page title | `Delivery Orders` | `ડિલિવરી ઓર્ડર` (~same width, taller) |
| Subtitle | `Track jars issued, returned, and money collected` | `જારનું વિતરણ, વળતર અને વસૂલાત પર નજર રાખો` (+22%) |
| Primary button | `+ New Order` | `+ નવો ઓર્ડર` (+30% — button must size to content, min-width 140px) |
| Search placeholder | `Search order no, staff name, phone…` | `ઓર્ડર નંબર, સ્ટાફનું નામ, ફોન શોધો…` (+28% — input min-width 320px) |
| Quick chips | `Today` · `Money pending` · `Jars out` · `Fully settled` | `આજે` · `પૈસા બાકી` · `જાર બહાર` · `પૂર્ણ સેટલ` |
| Column headers | `ORDER` `DATE` `STAFF` `ITEMS` `TOTAL` `COLLECTED` `BALANCE` `STATUS` | Headers **wrap to two lines**, never truncate |
| Items chip | `3 items · 62 units` · singular `1 item · 24 units` | — |
| Empty (no data) title | `No orders yet` | — |
| Empty (no data) body | `Orders record what a staff member took out this morning — the products, the quantities and the rate. Create the first one and jar returns and payments follow from it.` | — |
| Empty (no data) CTA | `+ New Order` | — |
| Empty (no results) title | `No orders match your filters` | — |
| Empty (no results) body | `No orders for Ramesh Patel between 01 and 16 Aug 2026 with money pending. Try widening the date range or clearing the payment filter.` (echo the **actual** active filters) | — |
| Empty (no results) CTA | `Clear filters` secondary | — |
| Error title | `Couldn't load orders` | — |
| Error body | `The server didn't respond. Your data is safe — nothing has been lost.` | — |
| Error CTA | `Try again` | — |
| Partial-error banner | `Balances may be a few minutes out of date. Totals are being recalculated.` | — |
| Export toast | `Preparing 312 orders for download…` then `Export ready` + `Download` | — |

### 3.5 States

| State | Presentation |
|---|---|
| **Loading — first load** | Toolbar, chips and KPI labels render normally. KPI values become 100×28px shimmer bars. Table shows 8 skeleton rows at 48px: grey `#E5E7EB` bars at 60% / 40% / 80% / 45% / 55% / 35% / 35% / 90% width, 1.5s shimmer. Header row is real |
| **Loading — refilter / repage** | **The existing table stays on screen** at 60% opacity, `pointer-events: none`, with a 2px indeterminate `#2563EB` bar directly under the header row. KPI cards do not re-skeleton. Never replace loaded rows with a skeleton |
| **Empty — no records at all** | Centred block 320px wide inside the table card: 48px `ClipboardList` Gray 300, H4 `No orders yet`, Body SM Gray 600 copy from 3.4, primary `+ New Order`. Quick chips hidden. KPI strip still renders showing `0` / `₹0.00` in Gray 400 with the context line |
| **Empty — no results for filters** | 48px `SearchX` Gray 300, H4 `No orders match your filters`, Body SM naming the active filters verbatim, secondary `Clear filters`. Quick chips and filter chips remain visible so the user can see what they did |
| **Filled** | As wireframe. 25 rows default |
| **Error** | 48px `AlertTriangle` `#EF4444`, H4 `Couldn't load orders`, Body SM plain-language reason, primary `Try again`. No stack trace, no error code in the body — a `Ref: 7F3A` Caption sits at the bottom in Gray 400 |
| **Partial error** | Table renders normally with a Warning banner above it (full width, `#FEF3C7` bg, 1px `#F97316`, 12px radius, 16px padding, 20px `AlertTriangle`): `Balances may be a few minutes out of date. Totals are being recalculated.` Not dismissible |
| **Cancelled row** | Whole row at 60% opacity, money columns show `—`, single Default badge `Cancelled` with `Ban` icon. Row still clickable |
| **Total-reduced row** | When filled returns have reduced the order total, TOTAL shows the current figure with the original above it in 11px mono Gray 400 with a strikethrough: `₹1,400.00` struck, `₹1,330.00` live. Tooltip on hover: `2 filled jars came back unsold — ₹70.00 credited` |
| **Overdue row emphasis** | An order with a non-zero balance older than 15 days shows its DATE cell in `#B91C1C` with the ageing appended in Caption: `02 Aug 2026` / `14 days ago` |
| **Export in progress** | `Export CSV` button label becomes `Preparing…` with an inline spinner replacing the `Download` icon; button disabled |
| **Read-only user** | `+ New Order` and all row-menu write actions hidden entirely, not disabled. Nothing else changes |

### 3.6 Interactions

| Trigger | Behaviour |
|---|---|
| Hover row | Background `#F3F4F6` (`#1E293B` dark) over 100ms |
| Click row | Navigate `/orders/[id]`. Click on the `⋯` cell or a badge does **not** navigate |
| Click a badge | Navigates to the list filtered by that status — `🔴 8 jars out` → `/orders?returns=pending&staff=…` |
| Click KPI card | Navigates to the filtered list per the table in 3.3 |
| Hover `⋯` | Button background `#E5E7EB`; menu opens on click, Escape closes, arrow keys move, Enter selects |
| Sort | Click header cycles none → ascending → descending → none. Active header: `ArrowUp`/`ArrowDown` 14px full opacity `#2563EB`, label Gray 900. Inactive: `ArrowUpDown` at 40% opacity |
| Search | Debounced 300ms, `⌘K`/`Ctrl K` from anywhere focuses global search; `/` focuses this table's search |
| Quick chips | Toggle on click; multiple chips combine with AND. `Money pending` and `Fully settled` are mutually exclusive — selecting one deselects the other |
| Tab order | Search → Filters → Columns → chip 1..4 → Clear all → first sortable header → row 1 → row 1 `⋯` → row 2 … → page size → pagination |
| Keyboard | `n` opens `/orders/new`. `Escape` clears search when focused. `↑ ↓` move row focus, `Enter` opens the focused row |
| Refilter | URL updates (`?staff=…&payment=pending`) so the view is shareable and back-button-safe |

### 3.7 Responsive — below `md` (768px)

Content padding 16px. KPI strip becomes 1 per row, in the order Outstanding → Jars out → Today's collection → Today's orders — problems first on a small screen. Toolbar collapses to a full-width search plus a 40×40 `Filters` icon button opening a **bottom sheet** (radius 12px top corners, 24px padding, drag handle, `Apply filters` full-width primary pinned at the bottom). Quick chips become a horizontally scrolling row with no scrollbar.

Each table row becomes a card, 12px radius, 1px border, 16px padding, 12px gap between cards:

```
┌───────────────────────────────────────────┐
│ ORD-000123                🟠 ₹450 due     │
│                           🔴 8 jars out   │
│ Ramesh Patel · Today                      │
│ 3 items · 62 units                        │
│ Total ₹1,330.00        Balance ₹450.00    │
└───────────────────────────────────────────┘
```

Line 1: code (mono 14px `#2563EB`) left, badges stacked right. Line 2: staff and date, Body SM Gray 600. Line 3: items chip. Line 4: Total (mono 14px 500) and Balance (mono 14px 600 Gray 900) right-aligned with 24px gap, 1px top border above, 12px padding-top. Tapping the card opens the detail; the `⋯` menu moves to a 44×44 target at the top-right corner of line 1, below the badges.

### 3.8 Dark mode

Page `#0B1220`. Cards and table `#1E293B`, border `#334155`. Table header `#0F172A` so it separates from the body without a shadow. Row hover `#334155` at 50%. Doc codes and links lift to `#3B82F6`. Badges use the dedicated dark pairs from §1. The `—` for zero becomes `#475569`. KPI alert left border stays `#EF4444`; the alert value becomes `#FECACA`. Skeleton bars `#334155` with a `#475569` shimmer.

### 3.9 Stitch prompt

```text
Design a dense internal business dashboard screen called "Delivery Orders" for a
mineral water plant in India. Light theme, page background #F8FAFC, cards #FFFFFF
with 1px #E5E7EB borders and 12px radius. Inter for text, JetBrains Mono for all
numbers. Left sidebar 240px, sticky topbar 64px.

Page header: H2 28px semibold #111827 "Delivery Orders", below it 14px #4B5563
"Track jars issued, returned, and money collected". Top right: outlined button
"Export CSV" and a filled #2563EB button "+ New Order".

Below, a row of four KPI cards, 24px gap, 20px padding: "TODAY'S ORDERS" 14;
"TODAY'S COLLECTION" ₹18,450.00 with green "▲ 12.4% vs yesterday" and a small line
"Cash ₹14,200.00 · Coins ₹4,250.00"; "OUTSTANDING CASH" ₹42,180.00 with a 3px red
#EF4444 left border and the value in dark red; "JARS OUT" 316 also red-bordered.
Labels are 12px uppercase letter-spaced #4B5563; values are 28px JetBrains Mono bold.

Below, a table card. Toolbar 56px with a search field placeholder "Search order no,
staff name, phone…" and buttons "Filters (2)" and a gear. A 44px strip of pill chips:
Today, Money pending, Jars out, Fully settled — "Money pending" is active with a
#DBEAFE fill, #1D4ED8 text and a blue border.

Table header 44px, #F3F4F6, 12px uppercase grey labels: ORDER, DATE, STAFF, ITEMS,
TOTAL, COLLECTED, BALANCE, STATUS. Rows 48px, no zebra stripes, 1px bottom borders.
Row 1: ORD-000123 in blue mono, "Today", "Ramesh Patel" with 9876543210 beneath in
small grey, a grey chip "3 items · 62 units", right-aligned mono ₹1,330.00, ₹880.00,
bold ₹450.00, and TWO pills side by side — amber "₹450 due" and red "8 jars out".
Row 2: ORD-000122, "સુરેશ ચૌહાણ", ₹2,480.00, green "Paid" and green "Settled".
Row 3: ORD-000121, "Dinesh Solanki", red "Unpaid" and red "40 jars out".
Footer 56px: "Showing 1–25 of 312" left, page-size select and pagination right.
```

---

## 4. Create order — `/orders/new`

### 4.1 Purpose

The form used most, and the one that must be fastest. It captures who took what, at what rate, and — in the common case where the staff member pays on the spot — the money too, so one form replaces two. It is the canonical implementation of the repeatable line-item pattern (standards §6.3) plus a per-line **price override** indicator and a live totals panel.

### 4.2 Layout

```
‹ Orders
New Delivery Order
Record what left the plant and, if it was paid for, the money too

┌─ Order details ──────────────────────────────────────────── max 960px ─────────┐
│  Staff *                                    Order date *                        │
│  [ 🔍 Ramesh Patel · 9876543210        ▾ ]  [ 16 Aug 2026            📅 ]       │
│  47 jars already out with Ramesh · 2 open orders                                │
│                                                                                 │
│  Notes                                                                          │
│  [ Kalol route — Sharma ji rate applies                                     ]   │
│  [                                                                          ]   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Items ────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ PRODUCT              QTY     BASE      CHARGED      LINE TOTAL           │  │
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│ ┃│ [20L Jar          ▾] [  40]  ₹35.00   [₹  32.00]     ₹1,280.00      ✕   │  │ 56
│ ┃│   ⚠ Rate overridden −₹3.00/unit · −₹120.00   [ Sharma ji regular rate ]  │  │ 40
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │ [20L Jar          ▾] [  12]  ₹35.00   [₹  35.00]       ₹420.00      ✕   │  │ 56
│  ├──────────────────────────────────────────────────────────────────────────┤  │
│  │ [1L Bottle        ▾] [  24]  ₹10.00   [₹  10.00]       ₹240.00      ✕   │  │ 56
│  └──────────────────────────────────────────────────────────────────────────┘  │
│  ┌ + Add item ────────────────────────────────────────────────────────────┐    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│                                   Total quantity                    76 units    │
│                                   Subtotal                        ₹1,940.00     │
│                                   Discount              [ ₹     20.00 ]         │
│                                   ─────────────────────────────────────────     │
│                                   Order total                     ₹1,920.00     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Payment now ──────────────────────────────────── [ ● ] Collected on the spot ──┐
│  Cash                       Coins                                               │
│  [ ₹     1,500.00 ]         ┌─────────────────────────────────────────────────┐ │
│                             │ COIN TYPE        COINS   PER COIN     VALUE     │ │
│                             ├─────────────────────────────────────────────────┤ │
│                             │ [Blue Token  ▾]  [  40]   ₹10.00     ₹400.00 ✕  │ │ 56
│                             └─────────────────────────────────────────────────┘ │
│                             [ + Add coin type ]                                 │
│                                                                                 │
│                                   Order total                     ₹1,920.00     │
│                                   Paying now                      ₹1,900.00     │
│                                   ─────────────────────────────────────────     │
│                                   Balance                            ₹20.00     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                        [Cancel]   [Save & add another]  [Save order]│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Region-by-region spec

**Header card** — Card 12px radius, 1px `#E5E7EB`, 24px padding, max-width 960px. Two-column grid for the paired short fields; single column below `md`.

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, `ChevronLeft` 16px, 8px above the title | `‹ Orders` |
| Title | H2 28px/1.3 600 Gray 900 | `New Delivery Order` |
| Subtitle | Body SM Gray 600 | `Record what left the plant and, if it was paid for, the money too` |
| Section heading | H4 18px 600 Gray 900, 1px bottom divider 12px below, 32px above | `Order details` |
| Staff label | Body SM 500 Gray 900 + `*` in `#2563EB`, 6px above field | `Staff *` |
| Staff field | **48px** search select (primary field on a fast-entry form), autofocused, 1px `#D1D5DB`, radius 4px, 12px horizontal padding, `Search` icon left. Options show two lines: name Body SM 500 + `9876543210 · 47 jars out` Caption Gray 600. 8 visible before scroll | Placeholder `Type a name or phone…` |
| Staff helper | Caption Gray 600, space reserved, becomes Warning `#B45309` when jars out > 30 | `47 jars already out with Ramesh · 2 open orders` |
| Order date | 180px date input, 40px, `Calendar` icon right, format `DD MMM YYYY`, defaults to today, popover with `Today` / `Yesterday` chips | `16 Aug 2026` |
| Notes | Textarea, 3 rows, resizable vertically only, full width, any script | Placeholder `Route, customer, anything you'll want to remember` |

**Items card**

| Element | Spec |
|---|---|
| Section heading | H4 `Items` with a Caption Gray 600 count to its right: `3 lines · 76 units` |
| Line-item header | 44px, `#F3F4F6`, Caption 12px 600 uppercase Gray 600: `PRODUCT` `QTY` `BASE` `CHARGED` `LINE TOTAL` and a blank 44px cell for `✕` |
| Line row | **56px**, 1px bottom border `#E5E7EB`, 16px horizontal padding, 12px gap between controls |
| Product | Search select, 40px, flexes to fill, active products only, options `20L Jar · 20L · ₹35.00`. `+ Add new product` at the bottom opens `/products/new` in a drawer |
| Qty | 120px, 40px tall, mono, right-aligned, integers only, stepper arrows on hover |
| Base | **Read-only computed cell**: no border, `#F3F4F6` background, mono 14px 500 Gray 600, right-aligned, 120px |
| Charged | 140px money input, `₹` prefix Gray 600 inside the field, mono right-aligned. Pre-filled with base on product select |
| Line total | **Read-only computed cell**, mono 14px **600** Gray 900, right-aligned, 140px, updates live on every keystroke |
| Remove | 32×32 icon button (44×44 target), `X` 16px Gray 400 → `#EF4444` on hover. **Disabled at 40% opacity when only one row remains**, tooltip `An order needs at least one item` |
| **Override row** | Appears as a 40px second line **inside** the same line-item block when charged ≠ base. The whole block gets a **2px `#F97316` left border**. Contains: Warning chip `⚠ Rate overridden −₹3.00/unit · −₹120.00` (Caption, `#FEF3C7` bg, `#B45309` text, `AlertCircle` 12px) then a 280px 32px text input for the reason, placeholder `Why? e.g. Sharma ji regular rate` |
| Override, upward | Same treatment, label `⚠ Rate overridden +₹5.00/unit · +₹200.00` — still Warning, never Success. Any deviation from list price is worth seeing |
| Add item | Full-width ghost button, 48px, 1px **dashed** `#D1D5DB`, radius 8px, Gray 600 label with `Plus` 16px. Hover: border `#2563EB`, label `#2563EB`. Appends a row and focuses its Product field | 
| Totals block | Right-aligned, 320px wide, 8px row gap, 24px above. Label Body SM Gray 600 left, value mono right. `Total quantity` `76 units` (mono 500 Gray 700) · `Subtotal` `₹1,940.00` (mono 500) · `Discount` a 160px money input, defaults empty · 1px top border `#E5E7EB` · `Order total` label Body SM **600** Gray 900, value **18px mono 600** Gray 900 |

**Payment-now card** — collapsed by default. The card header carries a 44×24px toggle on the right labelled `Collected on the spot`. Off = the card body is hidden entirely (not disabled) and the card is 64px tall. On = body expands over 200ms ease-in-out.

| Element | Spec |
|---|---|
| Cash | 200px money input, mono right-aligned, `₹` prefix, label `Cash` |
| Coin lines | Same 56px line-item pattern. `COIN TYPE` search select (shows `Blue Token · ₹10.00/coin · 2,440 in stock`) · `COINS` 120px quantity · `PER COIN` read-only computed mono Gray 600 · `VALUE` read-only computed mono 600 · `✕` |
| Add coin type | Dashed ghost button, `+ Add coin type` |
| Totals | `Order total` `₹1,920.00` · `Paying now` `₹1,900.00` (mono 500) · rule · `Balance` **18px mono 600 Gray 900**, or in `#B91C1C` if positive and in `#B45309` with the `Overpaid ₹80.00` treatment if negative |

**Sticky footer** — inside the last card, 1px top border, 16px vertical / 24px horizontal padding, right-aligned, 12px button gap, sticks to the viewport bottom while the form is taller than the screen.

`[Cancel]` ghost Gray 600 · `[Save & add another]` secondary outlined · `[Save order]` primary filled `#2563EB`, min-width 140px.

### 4.4 Content and copy

| Slot | Literal string |
|---|---|
| Title | `New Delivery Order` |
| Subtitle | `Record what left the plant and, if it was paid for, the money too` |
| Section headings | `Order details` · `Items` · `Payment now` |
| Staff label / placeholder | `Staff *` / `Type a name or phone…` |
| Staff helper (normal) | `47 jars already out with Ramesh · 2 open orders` |
| Staff helper (heavy) | `⚠ 118 jars already out with Ramesh across 5 orders. Consider collecting returns first.` |
| Order date label | `Order date *` |
| Notes label / placeholder | `Notes` / `Route, customer, anything you'll want to remember` |
| Item column headers | `PRODUCT` `QTY` `BASE` `CHARGED` `LINE TOTAL` |
| Product placeholder | `Choose a product` |
| Qty placeholder | `0` |
| Override chip | `Rate overridden −₹3.00/unit · −₹120.00` |
| Override note placeholder | `Why? e.g. Sharma ji regular rate` |
| Add item | `+ Add item` |
| Totals labels | `Total quantity` · `Subtotal` · `Discount` · `Order total` |
| Payment toggle | `Collected on the spot` |
| Payment helper | `Leave this off if the staff member will pay later. You can record payments any time from the order page.` |
| Coin stock helper | `Blue Token · ₹10.00 per coin · 2,440 in stock` |
| Payment totals labels | `Order total` · `Paying now` · `Balance` |
| Buttons | `Cancel` · `Save & add another` · `Save order` |
| Submitting label | `Saving…` |
| Duplicate-product notice | `20L Jar is on two lines at ₹32.00 and ₹35.00. That's allowed — lines bill separately.` (Primary/info tint, Caption, dismissible) |
| Success toast | `ORD-000124 saved · ₹1,920.00 · 76 units issued to Ramesh Patel` |
| Success toast (with payment) | `ORD-000124 saved · ₹1,900.00 collected · ₹20.00 balance` |
| Error — no items | `Add at least one item before saving.` |
| Error — qty | `Enter a quantity greater than 0.` |
| Error — charged | `Enter a rate of ₹0.00 or more.` |
| Error — product missing | `Choose a product for this line.` |
| Error — staff missing | `Choose the staff member who took this order.` |
| Error — date future | `Order date can't be in the future.` |
| Error — discount too big | `Discount can't be more than the subtotal of ₹1,940.00.` |
| Error — coin stock | `Only 240 Blue Tokens are in stock; you entered 300. Adjust the quantity or add stock first.` |
| Error — overpay on create | Not an error. Warning banner: `You're recording ₹2,000.00 against a total of ₹1,920.00. The extra ₹80.00 will show as overpaid.` |
| Form-level error banner title | `This order couldn't be saved` |
| Cancel-confirm | Title `Discard this order?` · Body `You've entered 3 items worth ₹1,920.00. Nothing has been saved yet.` · `[Keep editing]` ghost + `[Discard]` destructive |

### 4.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Card outlines render; staff select, product selects and coin selects show a 40px shimmer bar in place of the control while their option lists load. Form is not interactive. Max 400ms in practice |
| **Loading (staff change)** | Selecting a staff member re-fetches their open-jar count; the helper line shows a 12px inline shimmer, not a spinner, and never blocks typing |
| **Empty — no products defined** | The Items card body is replaced by a centred 320px block: 48px `Package` Gray 300, H4 `No products to sell yet`, Body SM `Add at least one product — a 20L jar, a 1L bottle — before you can record an order.`, primary `+ Add product`. `Save order` disabled |
| **Empty — no active staff** | Staff select shows an inline empty option row: `No active staff. + Add staff member` linking to `/staff/new`. Field gets a Warning border `#F97316` |
| **Empty — one blank line** | Default state on load: one line-item row with an empty product select, `✕` disabled, totals showing `0 units` / `—` / `—` |
| **Filled** | As wireframe |
| **Rate overridden** | 2px `#F97316` left border on the block, Warning chip + note input on the second line, totals recompute live. Removing the override (typing the base price back) removes the border and chip instantly |
| **Duplicate product** | An info chip appears under the Items table, not an error. Copy in 4.4. This is deliberate and allowed |
| **Coin stock insufficient** | The coin line's COINS input gets a 1px `#EF4444` border, Caption error below the line, and the form-level Danger banner appears above the footer with the exact numbers. `Save order` stays enabled — pressing it re-validates and focuses the offending line |
| **Submitting** | Primary button shows an inline spinner replacing its icon, label becomes `Saving…`; all three buttons disable; the whole form dims to 60% opacity with `pointer-events: none`. The sticky footer stays fully opaque so the spinner is visible |
| **Success** | Navigate to `/orders/[id]` with a success toast (bottom-right, 380px, 4px `#22C55E` left border, 4s). `Save & add another` instead resets the form, keeps the staff and date, focuses the first product field, and shows the same toast |
| **Error — validation** | Danger banner above the footer, `#FEE2E2` bg, 1px `#EF4444`, 12px radius, 16px padding, 20px `AlertTriangle`; H4-weight title 14px 600 `#B91C1C` + Body SM body. Page scrolls to and focuses the first invalid field |
| **Error — server** | Same banner, title `This order couldn't be saved`, body the plain-language reason, and a `Try again` link in the banner. **Form contents are preserved** — never clear a form on a failed save |
| **Partial error** | Product prices loaded but coin stock unavailable: the Payment card shows a Warning banner `Coin stock couldn't be checked. You can still record coins; stock will reconcile when the connection returns.` |
| **Disabled** | `Save order` disabled at 40% opacity only when zero valid line items exist. Never disabled merely because a field is untouched — disabled buttons with no explanation are a dead end |
| **Read-only** | Not applicable on create |

### 4.6 Interactions

| Trigger | Behaviour |
|---|---|
| Page load | Staff select autofocused; order date pre-set to today |
| Select product | Base price fills, Charged pre-fills with base, focus jumps to QTY |
| Type in QTY | Line total updates on every keystroke; subtotal, order total and balance follow |
| Change CHARGED | On blur, if ≠ base, the override row animates in over 100ms and the left border appears. Value formats with lakh grouping on blur (`1250` → `₹1,250.00`) |
| `Enter` on the last field of the last row | Appends a new line item and focuses its Product select |
| `Enter` anywhere else | Moves to the next field, does **not** submit — a stray Enter must not save a half-typed order |
| `⌘/Ctrl + Enter` | Submits from anywhere in the form |
| `⌘/Ctrl + Backspace` on a line | Removes that line (unless it is the only one) |
| Tab order | Staff → Order date → Notes → line 1 Product → Qty → Charged → (override note if visible) → `✕` → line 2 … → `+ Add item` → Discount → payment toggle → Cash → coin line fields → `+ Add coin type` → Cancel → Save & add another → Save order |
| Validation timing | Never while typing. On blur for a touched field. Everything on submit, scrolling to and focusing the first error. Once a field has errored, re-validate live so the error clears the instant it's fixed |
| Toggle `Collected on the spot` | Expands the card over 200ms and focuses the Cash field |
| Cancel | With any dirty field, opens the discard confirm dialog. Clean form navigates straight back to `/orders` |
| Browser back / refresh with dirty form | Native `beforeunload` prompt |
| Success | `/orders/[id]` with toast. Focus lands on the detail page H1 for screen readers |

### 4.7 Responsive — below `md` (768px)

Content padding 16px. Header card fields stack to one column; date input goes full width. The line-item table becomes **one card per line**, 12px radius, 1px border, 16px padding, 12px gap:

```
┌───────────────────────────────────────────┐
│ Item 1                              [✕]   │
│ Product                                   │
│ [ 20L Jar                            ▾ ]  │
│ Quantity            Charged               │
│ [        40 ]       [ ₹     32.00 ]       │
│ Base ₹35.00              Total ₹1,280.00  │
│ ┃ ⚠ Rate overridden −₹3.00/unit           │
│ [ Sharma ji regular rate               ]  │
└───────────────────────────────────────────┘
```

Card header `Item 1` Caption 12px 600 uppercase Gray 600 with the `✕` at a 44×44 target on the right. Quantity and Charged sit side by side (they are short); Base and Line total render as a Caption/mono pair on one line. The override strip keeps the 2px `#F97316` left border on the whole card. `+ Add item` is a full-width dashed button. The totals block goes full width with labels left and values right. The footer becomes a fixed bottom bar, 72px, 1px top border, surface background, with `Save order` full-width primary and `Cancel` as a text link above it; `Save & add another` moves into a `⋯` menu.

### 4.8 Dark mode

Cards `#1E293B` on `#0B1220`. Line-item header `#0F172A`. Read-only computed cells use `#0F172A` background with `#94A3B8` text — the "no border, subtle background" treatment still has to read as inert. Input borders `#334155`, focus `#3B82F6`. The override left border stays `#F97316` (it holds contrast on dark); the override chip switches to `#7C2D12` bg / `#FED7AA` text. The dashed `+ Add item` border is `#334155`, hover `#3B82F6`. Danger banner `#7F1D1D` bg with `#FECACA` text.

### 4.9 Stitch prompt

```text
Design a dense data-entry form screen titled "New Delivery Order" for an internal
Indian water-plant app. Light theme: page #F8FAFC, cards #FFFFFF, 1px #E5E7EB
borders, 12px radius, 24px padding, max width 960px. Inter for text, JetBrains Mono
for every number. Blue #2563EB for primary actions.

Card 1 "Order details": a wide 48px search-select labelled "Staff *" showing
"Ramesh Patel · 9876543210" with small grey helper text "47 jars already out with
Ramesh · 2 open orders", a 180px date field "Order date *" showing "16 Aug 2026"
with a calendar icon, and a 3-row notes textarea.

Card 2 "Items": a mini table with a 44px grey header row reading PRODUCT, QTY, BASE,
CHARGED, LINE TOTAL. Three 56px rows containing real inputs. Row 1: dropdown "20L
Jar", number input "40", greyed read-only "₹35.00", money input "₹32.00", bold mono
"₹1,280.00", and an ✕ button. Row 1 has a 2px ORANGE #F97316 left border and a
second line below it holding an amber pill "⚠ Rate overridden −₹3.00/unit ·
−₹120.00" and a small text input "Sharma ji regular rate". Row 2: "20L Jar", 12,
₹35.00, ₹35.00, ₹420.00. Row 3: "1L Bottle", 24, ₹10.00, ₹10.00, ₹240.00. Below,
a full-width dashed ghost button "+ Add item". Right-aligned totals block:
Total quantity 76 units, Subtotal ₹1,940.00, a small Discount input ₹20.00, a thin
rule, then "Order total ₹1,920.00" in 18px bold mono.

Card 3 "Payment now" with a toggle switch "Collected on the spot" turned on: a Cash
money field ₹1,500.00, and a coin mini-table row "Blue Token / 40 / ₹10.00 /
₹400.00". Right-aligned: Order total ₹1,920.00, Paying now ₹1,900.00, Balance ₹20.00.

Sticky bottom bar, right aligned: ghost "Cancel", outlined "Save & add another",
filled blue "Save order".
```

---

## 5. Edit order — `/orders/[id]/edit`

### 5.1 Purpose

Identical to Create in structure, so nothing new has to be learned. Everything specified here is a **delta**. The reason this screen exists separately is the warning surface: an order with payments or returns against it can still be edited, but the consequence must be stated before and after, and reducing a quantity below what has already come back is refused outright.

### 5.2 Layout

Same three cards as §4, minus the `Payment now` card (payments are append-only and are never edited here), plus a persistent banner stack at the top and a revision meta line.

```
‹ ORD-000123
Edit ORD-000123
Created 14 Aug 2026 · Edited 2 times · v3

┌─────────────────────────────────────────────────────────────────────────────────┐
│ ⚠  This order already has 2 payments and 1 return recorded                      │
│    Changing quantities or rates will recalculate the balance and both statuses. │
│    The change is saved as a new revision — nothing is overwritten.              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Order details ───────────────────────────────────────────────────────────────┐
│  Staff *                                    Order date *                       │
│  [ Ramesh Patel · 9876543210           ▾ ]  [ 14 Aug 2026            📅 ]      │
│  Staff can't be changed — 1 return is already recorded against this order.      │
└────────────────────────────────────────────────────────────────────────────────┘

┌─ Items ───────────────────────────────────────────────────────────────────────┐
│  │ [20L Jar        ▾] [  40]  ₹35.00  [₹ 32.00]   ₹1,280.00   ✕(disabled)     │
│  │   22 already returned · quantity can't go below 22                          │
│  │ [1L Bottle      ▾] [  24]  ₹10.00  [₹ 10.00]     ₹240.00   ✕               │
└────────────────────────────────────────────────────────────────────────────────┘
                                          [Cancel]   [Save changes]
```

### 5.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB` | `‹ ORD-000123` |
| Title | H2, doc code in mono | `Edit ORD-000123` |
| Meta line | Body SM Gray 600, `·` separated, `Edited 2 times` is a link opening the revision diff drawer | `Created 14 Aug 2026 · Edited 2 times · v3` |
| History warning banner | Full width, `#FEF3C7` bg, 1px `#F97316`, 12px radius, 16px padding, 20px `AlertTriangle` `#B45309`. Title Body SM 600 `#B45309`, body Body SM `#78350F`. **Not dismissible.** Present whenever payments > 0 or returns > 0 | See 5.4 |
| Staff field | **Read-only** once any return exists: no border, `#F3F4F6` background, Gray 600 text. Helper explains why | `Staff can't be changed — 1 return is already recorded against this order.` |
| Line with returns | Qty input has `min` set to the already-returned quantity. Helper Caption Gray 600 below the row: `22 already returned · quantity can't go below 22`. `✕` disabled with tooltip `This line has returns against it and can't be removed. Reduce the quantity instead.` |
| Totals block | Adds a row **above** Order total when filled returns exist: `Filled returns credited` `−₹70.00` in mono 500 `#15803D`, with a 12px `RotateCcw` icon |
| Footer | `[Cancel]` ghost · `[Save changes]` primary. No `Save & add another` | — |

### 5.4 Content and copy

| Slot | Literal string |
|---|---|
| Title | `Edit ORD-000123` |
| Subtitle/meta | `Created 14 Aug 2026 · Edited 2 times · v3` |
| History banner (payments only) | Title `This order already has 2 payments recorded` · Body `Changing quantities or rates will recalculate the balance. The change is saved as a new revision — nothing is overwritten.` |
| History banner (returns only) | Title `This order already has 1 return recorded` · Body `You can't reduce a quantity below what has already come back. The change is saved as a new revision.` |
| History banner (both) | Title `This order already has 2 payments and 1 return recorded` · Body `Changing quantities or rates will recalculate the balance and both statuses. The change is saved as a new revision — nothing is overwritten.` |
| Staff locked helper | `Staff can't be changed — 1 return is already recorded against this order. Cancel this order and create a new one instead.` |
| Line min helper | `22 already returned · quantity can't go below 22` |
| Error — below returned | `40 jars were issued on this line and 22 have already come back. The quantity can't go below 22.` |
| Error — line removal | `This line has returns against it and can't be removed. Reduce the quantity instead.` |
| Conflict banner | Title `This order was changed while you were editing` · Body `Ramesh Patel's order was updated 30 seconds ago by Admin. Reload to see the current version — your changes here haven't been saved.` · Actions `[Reload order]` primary + `[Copy my changes]` ghost |
| Success toast | `ORD-000123 updated · new total ₹1,920.00 · balance ₹470.00` |
| Balance-changed toast (secondary) | `Balance changed from ₹450.00 to ₹470.00` — Info variant, 5s, stacked below the success toast |
| Cancel-confirm | Title `Discard your changes?` · Body `You've changed 2 quantities and 1 rate. The order will stay as it was.` |

### 5.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Card outlines with 40px shimmer bars in every field position. Banner area reserved at 88px so nothing jumps when the warning loads |
| **Loading (refetch after conflict)** | Form dims to 60%, 2px indeterminate `#2563EB` bar under the page header |
| **Empty** | Not applicable — an order always has at least one line |
| **Empty (no results)** | Not applicable |
| **Filled — clean order** | No banner. Everything editable. Identical to Create minus the payment card |
| **Filled — with history** | Warning banner, locked staff field, per-line minimums, `Filled returns credited` row in totals |
| **Error — quantity below returned** | Field 1px `#EF4444`, Caption error below, form-level Danger banner. Blocked; save cannot proceed |
| **Error — concurrent edit** | Save fails; a Danger banner replaces the Warning banner at the top with the copy above. Form stays populated and editable so the user can copy their numbers out |
| **Partial error** | Revision history unavailable: meta line shows `Edited — times` in Gray 400 with a Caption `Revision history unavailable`; the rest of the form works |
| **Submitting** | `Saving…` with spinner, form dims to 60%, both buttons disabled |
| **Success** | Navigate to `/orders/[id]`, success toast, and — if the balance moved — a second Info toast naming the old and new balance |
| **Disabled** | `Save changes` disabled at 40% until at least one field differs from the loaded values, with a Caption to its left: `No changes yet` |
| **Read-only — cancelled order** | The entire route redirects to `/orders/[id]` with an error toast `ORD-000117 is cancelled and can't be edited.` |

### 5.6 Interactions

As §4.6, plus:

| Trigger | Behaviour |
|---|---|
| Reduce a qty below the returned count | On blur, immediate inline error. The stepper's down-arrow disables at the minimum |
| Click `Edited 2 times` | Opens a 400px right drawer: side-by-side revision diff, newest first, changed values highlighted — removed in `#FEE2E2`, added in `#DCFCE7`, with `v2 → v3 · 15 Aug 2026, 9:12 am · Admin` headers |
| Save with a changed total | A confirm dialog first: title `Save and recalculate the balance?`, body `Order total goes from ₹1,940.00 to ₹1,920.00. Balance goes from ₹450.00 to ₹430.00. 2 payments stay exactly as recorded.`, actions `[Keep editing]` ghost + `[Save changes]` primary |
| Conflict on save | Banner swaps to Danger, no data is lost, `Reload order` refetches and re-renders the form with the server's values |

### 5.7 Responsive

As §4.7. The warning banner stacks above the first card at full width with 16px padding and wraps to three or four lines — reserve for it, don't truncate. The revision drawer becomes a full-height bottom sheet at 90vh.

### 5.8 Dark mode

As §4.8. Warning banner `#7C2D12` bg, 1px `#F97316`, `#FED7AA` text. Locked read-only staff field `#0F172A` bg, `#94A3B8` text. Diff drawer: removed `#7F1D1D`, added `#14532D`.

### 5.9 Stitch prompt

```text
Design an "Edit ORD-000123" form screen for an internal Indian water-plant app.
Light theme, page #F8FAFC, white cards with 1px #E5E7EB borders and 12px radius,
max width 960px. Inter text, JetBrains Mono numbers, blue #2563EB primary.

Top: a small blue back link "‹ ORD-000123", then H2 28px "Edit ORD-000123" in
JetBrains Mono, then grey 14px meta "Created 14 Aug 2026 · Edited 2 times · v3"
where "Edited 2 times" is an underlined link.

Directly below, a full-width AMBER warning banner: background #FEF3C7, 1px #F97316
border, 12px radius, 16px padding, a warning triangle icon, bold amber heading
"This order already has 2 payments and 1 return recorded" and body text "Changing
quantities or rates will recalculate the balance and both statuses. The change is
saved as a new revision — nothing is overwritten."

Card "Order details": a DISABLED-looking staff field with no border and a light grey
#F3F4F6 fill showing "Ramesh Patel · 9876543210" in grey, with helper text below
"Staff can't be changed — 1 return is already recorded against this order." Beside
it an editable 180px date field "14 Aug 2026".

Card "Items": a mini table, 44px grey header PRODUCT / QTY / BASE / CHARGED / LINE
TOTAL, two 56px rows with real inputs. Row 1 "20L Jar", quantity 40, ₹35.00,
₹32.00, ₹1,280.00, with a greyed-out disabled ✕ and small grey helper beneath:
"22 already returned · quantity can't go below 22". Row 2 "1L Bottle", 24, ₹10.00,
₹10.00, ₹240.00. Right-aligned totals: Subtotal ₹1,940.00, "Filled returns
credited −₹70.00" in green, a rule, "Order total ₹1,870.00" in 18px bold mono.

Bottom right: ghost "Cancel" and filled blue "Save changes".
```

---

## 6. Order detail — `/orders/[id]`

### 6.1 Purpose

The audit view and the launchpad for the two recording modals. It has to answer, in one glance: what went out, what's still out, what's owed. Then, below the fold, it has to prove every one of those numbers with a dated, attributed history. This is also where the counter-intuitive **total-went-down** behaviour is explained, because this is where it becomes visible.

### 6.2 Layout

```
‹ Orders
ORD-000123                              🟠 ₹450 due     🔴 8 jars out
Ramesh Patel · 9876543210 · 14 Aug 2026 · Edited 2 times · v3

              [🔄 Record Return]  [💵 Record Payment]  [✏ Edit]  [⋯]

┌─ Summary ─────────────────────────────────────────────────────────────────────┐
│  ORDER TOTAL        COLLECTED         BALANCE           JARS OUT              │
│  ₹1,330.00 ⓘ        ₹880.00           ₹450.00           8 of 62               │
│  was ₹1,400.00      2 payments        due since 14 Aug  22 empty · 2 filled   │
└───────────────────────────────────────────────────────────────────────────────┘

┌ ⓘ Total reduced by ₹70.00 ────────────────────────────────────────────────── ✕ ┐
│   2 filled jars came back unsold on 16 Aug. Ramesh only owes for the 38 jars   │
│   he actually sold, so the order total went down. This is expected.            │
└────────────────────────────────────────────────────────────────────────────────┘

[ Items 3 ] [ Returns 2 ] [ Payments 2 ] [ Activity ]
────────────────────────────────────────────────────────────────────────────────

┌────────────────────────────────────────────────────────────────────────────────┐
│ PRODUCT            QTY   RETURNED   CHARGEABLE   BASE     CHARGED   LINE TOTAL │ 44
├────────────────────────────────────────────────────────────────────────────────┤
│ 20L Jar             40   22 e·2 f          38   ₹35.00   ₹32.00     ₹1,216.00  │ 48
│  ┃ Rate overridden −₹3.00/unit · Sharma ji regular rate                        │
├────────────────────────────────────────────────────────────────────────────────┤
│ 20L Jar             12   12 e              12   ₹35.00   ₹35.00       ₹420.00  │ 48
├────────────────────────────────────────────────────────────────────────────────┤
│ 1L Bottle           24   not returnable    24   ₹10.00   ₹10.00       ₹240.00  │ 48
├────────────────────────────────────────────────────────────────────────────────┤
│                                              Subtotal              ₹1,876.00   │
│                                              Discount                 ₹20.00   │
│                                              ──────────────────────────────    │
│                                              Order total           ₹1,856.00   │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Returns tab**

```
│ ● 16 Aug 2026 · 11:40 am                                  Recorded by Admin  ⋯ │
│ │  20L Jar — 8 empty · 2 filled · 0 lost                                       │
│ │  Filled jars credited −₹70.00 · order total now ₹1,330.00                    │
│ │  Note: "Sharma ji's jars came back with the evening round"                   │
│ │                                                                              │
│ ○ 14 Aug 2026 · 6:05 pm                                   Recorded by Admin  ⋯ │
│    20L Jar — 22 empty · 0 filled · 0 lost                                      │
│    20L Jar (line 2) — 12 empty                                                 │
│                                                                                │
│    Still out: 8 jars · 20L Jar (line 1)                    [🔄 Record Return]  │
```

**Payments tab**

```
│ ● 16 Aug 2026 · 11:42 am                                  Recorded by Admin  ⋯ │
│ │  ₹440.00 — Cash ₹300.00 · Coins ₹140.00                                      │
│ │  Blue Token × 10 = ₹100.00 · Red Token × 2 = ₹40.00                          │
│ │  Coins added back to stock · CLG-004411                                      │
│ │                                                                              │
│ ○ 14 Aug 2026 · 6:05 pm                                   Recorded by Admin  ⋯ │
│    ₹440.00 — Cash ₹440.00                                                      │
│                                                                                │
│    Collected ₹880.00 of ₹1,330.00                       [💵 Record Payment]    │
```

### 6.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, `ChevronLeft` 16px, 8px above title | `‹ Orders` |
| Title | H2 28px **mono** 600 Gray 900 | `ORD-000123` |
| Status badges | Inline right of the title, 12px gap between title and first badge, 8px between badges. Payment badge first | `🟠 ₹450 due` `🔴 8 jars out` |
| Meta line | Body SM Gray 600, `·` separated, 4px below title. `Ramesh Patel` links to `/staff/[id]`; phone is a `tel:` link on mobile; `Edited 2 times` opens the revision drawer | `Ramesh Patel · 9876543210 · 14 Aug 2026 · Edited 2 times · v3` |
| Actions | Right-aligned, 12px gap. `Record Return` primary filled `#2563EB` with `RotateCcw`; `Record Payment` secondary outlined with `Banknote`; `Edit` secondary outlined with `Pencil`; `⋯` 40×40 icon button | — |
| `⋯` menu | 200px, `shadow-lg`: `Write off lost jars` · `Print delivery slip` · `Duplicate as new order` · divider · `Cancel order` in `#B91C1C` | — |
| Summary card | `#F3F4F6` background, 12px radius, 1px border, 24px padding, 4 columns on `lg`, 2 on `md`, 1 below. Column gap 32px | — |
| Summary label | Caption 12px 600 uppercase `0.04em` Gray 600 | `ORDER TOTAL` `COLLECTED` `BALANCE` `JARS OUT` |
| Summary value | **20px mono 600**. Balance (the critical figure) Gray 900; others Gray 700 | `₹1,330.00` `₹880.00` `₹450.00` `8 of 62` |
| Summary sub-line | Caption Gray 600, 4px below the value | `was ₹1,400.00` (struck, Gray 400) · `2 payments` (link to tab) · `due since 14 Aug` (turns `#B45309` past 7 days, `#B91C1C` past 15) · `22 empty · 2 filled` |
| **Total-changed info icon** | 14px `Info` Gray 400 after the `ORDER TOTAL` value; hover/focus shows a 280px popover repeating the explanation copy | — |
| **Total-changed banner** | Primary/info tint `#DBEAFE`, 1px `#2563EB`, 12px radius, 16px padding, 20px `Info` icon, dismissible `✕`. Appears the first time filled returns reduce the total, and again after each such return | See 6.4 |
| Tabs | 44px tall, sitting on a 1px `#E5E7EB` bottom rule. Active: 2px `#2563EB` bottom indicator, label Body SM 600 Gray 900. Inactive Gray 600. **Counts in the label** | `Items 3` `Returns 2` `Payments 2` `Activity` |
| Items table | Standard table, 44px header, 48px rows, read-only. Columns: PRODUCT (flex) · QTY (90px right) · RETURNED (140px right) · CHARGEABLE (110px right) · BASE (100px right) · CHARGED (100px right) · LINE TOTAL (120px right, mono 600) | — |
| Overridden line | 2px `#F97316` left border on the row + a 32px Caption sub-line: `Rate overridden −₹3.00/unit · Sharma ji regular rate` in `#B45309` | — |
| Non-returnable line | RETURNED cell shows `not returnable` in Caption Gray 400 italic — not `—`, because the distinction matters | — |
| Items footer | Inside the table card, `#F3F4F6` band, right-aligned totals block: `Subtotal` · `Discount` · rule · `Order total` in 18px mono 600 | — |
| Timeline | Newest first. 8px dot, 1px connecting line `#E5E7EB` at 3.5px inset. Most recent dot **filled `#2563EB`**; older dots hollow (2px `#D1D5DB` ring, transparent fill). Entry: header line = timestamp Body SM 500 Gray 900 + `Recorded by Admin` Caption Gray 600 right + `⋯`; body lines Body SM Gray 700 with money in mono; note line in Gray 600 with quotation marks. 24px vertical gap between entries | — |
| Timeline `⋯` | `Reverse this return` / `Reverse this payment` in `#B91C1C`, plus `Copy details`. **No Edit** — these are append-only records | — |
| Timeline footer | A `#F3F4F6` band inside the tab, 56px, with a running summary on the left and the relevant action button on the right | `Still out: 8 jars · 20L Jar (line 1)` + `[Record Return]` |
| Activity tab | Same timeline, one entry per event: `Order created`, `Payment recorded ₹440.00`, `Return recorded 8 empty · 2 filled`, `Order edited v2 → v3`, each with actor and timestamp. Edit entries carry a `View diff` link | — |

### 6.4 Content and copy

| Slot | Literal string |
|---|---|
| Summary labels | `ORDER TOTAL` · `COLLECTED` · `BALANCE` · `JARS OUT` |
| Total-changed banner | Title `Total reduced by ₹70.00` · Body `2 filled jars came back unsold on 16 Aug. Ramesh only owes for the 38 jars he actually sold, so the order total went down. This is expected.` |
| Total-changed tooltip | `This order was created at ₹1,400.00. 2 unsold filled jars came back, so ₹70.00 was credited and the total is now ₹1,330.00.` |
| `was` sub-line | `was ₹1,400.00` |
| Balance sub-line | `due since 14 Aug` · at 8+ days `due 8 days` in `#B45309` · at 16+ days `overdue 16 days` in `#B91C1C` |
| Jars sub-line | `22 empty · 2 filled` · when all back `all 62 back` |
| Tab labels | `Items 3` · `Returns 2` · `Payments 2` · `Activity` |
| Items columns | `PRODUCT` `QTY` `RETURNED` `CHARGEABLE` `BASE` `CHARGED` `LINE TOTAL` |
| Returned cell patterns | `22 e · 2 f` (empty/filled) · `22 e · 2 f · 1 L` when losses exist · `not returnable` · `—` when nothing back yet |
| Returns empty | Title `No returns recorded yet` · Body `62 jars went out on 14 Aug and none have come back. Record a return as they arrive — you can record as many times as you need.` · CTA `Record Return` |
| Payments empty | Title `No payments recorded yet` · Body `₹1,330.00 is due from Ramesh Patel. Record cash, coins, or both — in parts if that's how it came in.` · CTA `Record Payment` |
| Returns settled footer | `All 62 jars accounted for · 60 empty · 2 filled · 0 lost` with a green `PackageCheck` |
| Payments settled footer | `Paid in full · ₹1,330.00 collected` with a green `CheckCircle2` |
| Overpaid footer | `Overpaid by ₹60.00 — adjust against Ramesh's next order or record a refund` + `[Record refund]` link |
| Activity entries | `Order created · 62 units · ₹1,400.00` · `Payment recorded · ₹440.00 cash` · `Return recorded · 22 empty` · `Order edited · v2 → v3` + `View diff` |
| Cancelled banner | `This order was cancelled on 09 Aug 2026 by Admin. Reason: "Vehicle broke down, nothing left the plant."` — Default tint, not dismissible |
| Not-found | Title `Order not found` · Body `ORD-000999 doesn't exist, or it was permanently removed. Check the order number.` · CTA `Back to orders` |

### 6.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Title and back link render as a 200×28px shimmer; badges as two 80×22 shimmer pills; summary card shows four label/shimmer pairs with real labels; tab bar renders with counts hidden; active tab shows 4 skeleton rows |
| **Loading (tab switch)** | Tab content area only: existing content stays at 60% opacity with a 2px `#2563EB` indeterminate bar under the tab rule. Never a full-page spinner |
| **Loading (after modal submit)** | The summary card values shimmer in place for the ~300ms refetch while the timeline entry animates in; the rest of the page is untouched |
| **Empty — Returns tab, nothing back** | Centred 320px block: 48px `RotateCcw` Gray 300, H4 `No returns recorded yet`, Body SM copy from 6.4, primary `Record Return` |
| **Empty — Payments tab, nothing paid** | 48px `Banknote` Gray 300, H4 `No payments recorded yet`, body copy, primary `Record Payment` |
| **Empty — Returns tab, non-returnable only** | Different copy again: 48px `Package` Gray 300, H4 `Nothing to return on this order`, Body SM `This order is 24 × 1L Bottle, which is sold outright and never comes back.` No CTA. Return badge shows Default `—` |
| **Empty — no results** | Not applicable on a detail page; the Activity tab's date filter, when used, shows `No activity in this period` with a `Clear` link |
| **Filled** | As wireframe |
| **Error** | Page-level: 48px `AlertTriangle` `#EF4444`, H4 `Couldn't load ORD-000123`, Body SM reason, `Try again` primary, `‹ Orders` secondary |
| **Partial error** | Summary loads but the payments timeline fails: that tab shows an inline Danger banner `Couldn't load payments. The balance above is still correct.` plus a `Retry` link; other tabs work |
| **Submitting** | Modals own their submit state. On the page, the invoking action button shows a spinner and disables while its modal is open |
| **Success** | Modal closes, toast appears, summary values update, the new timeline entry is already present and the tab count increments. **The new entry does not animate** — data should feel instant |
| **Disabled** | `Record Return` disabled at 40% with tooltip `All 62 jars are accounted for` when fully settled, or `This order has no returnable products`. `Record Payment` disabled with tooltip `This order is paid in full` when balance is zero — but `⋯ › Record refund` stays available when overpaid |
| **Read-only — cancelled** | All three action buttons hidden, `⋯` reduced to `Print delivery slip`. Cancelled banner at the top. Page content at 100% opacity — a cancelled order must still be legible for audit |
| **Total-reduced** | Info banner + `was ₹1,400.00` sub-line + `ⓘ` tooltip on the summary value, all three present together |
| **Overpaid** | Balance value renders `(₹60.00)` in `#B91C1C`, payment badge `Overpaid ₹60`, payments footer offers `Record refund` |
| **Jars written off** | Returns timeline shows a `Ban`-icon entry: `4 jars written off as lost · 20L Jar · Reason: "Customer moved away, jars gone"`, and the return badge flips to `Settled` |

### 6.6 Interactions

| Trigger | Behaviour |
|---|---|
| Click `Record Return` | Opens the 720px return modal (§7). Focus moves to the first `Empty now` input |
| Click `Record Payment` | Opens the 560px payment modal (§8). Focus moves to Cash |
| Click a tab | Content swaps over 200ms fade; URL updates to `?tab=returns` so a tab is linkable and back-button-safe |
| Keyboard on tabs | `←` / `→` move between tabs; `Home` / `End` jump to first and last; content follows focus |
| Click `2 payments` in the summary | Switches to the Payments tab |
| Click `Ramesh Patel` | Navigates to `/staff/[id]` where the running jar balance across all orders lives |
| Click the `ⓘ` on Order total | Popover, also opens on keyboard focus, dismissed by Escape or blur |
| Dismiss the total-changed banner | Persists per order per user; it returns if another filled return arrives |
| Click a timeline `⋯ › Reverse this payment` | Confirm dialog: `Reverse this ₹440.00 payment?` / `A reversing entry of −₹440.00 is added on 16 Aug 2026. The original stays visible. Balance goes from ₹450.00 to ₹890.00.` / `[Cancel]` + `[Reverse payment]` destructive |
| Click `View diff` in Activity | Opens the revision drawer at that revision |
| Keyboard shortcuts | `r` opens Record Return · `p` opens Record Payment · `e` opens Edit · `Escape` returns to `/orders` |
| Print delivery slip | Opens the A4 print view per standards §19 in a new tab |

### 6.7 Responsive — below `md` (768px)

Title wraps; badges move to their own line below the title with an 8px gap, still side by side. Meta line wraps to two lines. Action buttons become a **fixed bottom bar**, 72px, 1px top border, surface background, 16px padding, with `Record Return` and `Record Payment` sharing the width 50/50 and `Edit` + `⋯` moving into the header as icon buttons.

Summary card goes 2×2. Tabs become horizontally scrollable with the active tab scrolled into view; counts stay in the labels.

Items table becomes cards:

```
┌───────────────────────────────────────────┐
│ 20L Jar                        ₹1,216.00  │
│ 40 issued · 22 empty · 2 filled           │
│ 38 chargeable × ₹32.00                    │
│ ┃ Rate overridden −₹3.00/unit             │
└───────────────────────────────────────────┘
```

The timeline keeps its vertical rail but the `Recorded by` line moves below the timestamp, and the `⋯` becomes a 44×44 target at the row's right edge.

### 6.8 Dark mode

Page `#0B1220`, cards `#1E293B`. The summary card, which is `#F3F4F6` in light, becomes `#0F172A` — darker than the card, so it still reads as inset. Tab indicator `#3B82F6`. Timeline rail `#334155`; the active dot `#3B82F6`; hollow dots get a `#475569` ring. The total-changed info banner becomes `#1E3A8A` bg / `#BFDBFE` text with a `#3B82F6` border. Struck-through `was ₹1,400.00` in `#475569`. The overridden row's left border stays `#F97316`.

### 6.9 Stitch prompt

```text
Design a detail page for a delivery order in an internal Indian water-plant app.
Light theme, page #F8FAFC, cards #FFFFFF with 1px #E5E7EB borders, 12px radius.
Inter for text, JetBrains Mono for all figures. Blue #2563EB primary.

Header: small blue link "‹ Orders". Then a 28px monospace title "ORD-000123" with
two pills beside it — amber #FEF3C7/#B45309 "₹450 due" and red #FEE2E2/#B91C1C
"8 jars out". Below, grey 14px "Ramesh Patel · 9876543210 · 14 Aug 2026 · Edited 2
times · v3". Top right, three buttons: filled blue "Record Return", outlined
"Record Payment", outlined "Edit", and a ⋯ icon button.

Summary card with a light grey #F3F4F6 fill, 24px padding, four columns. Each has a
12px uppercase grey label and a 20px bold monospace value beneath, plus a tiny grey
sub-line: ORDER TOTAL ₹1,330.00 / "was ₹1,400.00" struck through; COLLECTED ₹880.00
/ "2 payments"; BALANCE ₹450.00 (darkest) / "due since 14 Aug"; JARS OUT "8 of 62" /
"22 empty · 2 filled".

Below it a light blue info banner (#DBEAFE fill, #2563EB border, info icon):
"Total reduced by ₹70.00 — 2 filled jars came back unsold on 16 Aug. Ramesh only
owes for the 38 jars he actually sold, so the order total went down. This is
expected."

Then a 44px tab bar with a 2px blue underline on the active tab: "Items 3",
"Returns 2", "Payments 2", "Activity". Under it a read-only table, 44px grey header
PRODUCT / QTY / RETURNED / CHARGEABLE / BASE / CHARGED / LINE TOTAL, three 48px rows.
Row 1 "20L Jar", 40, "22 e · 2 f", 38, ₹35.00, ₹32.00, ₹1,216.00 — this row has a
2px ORANGE left border and a small amber caption "Rate overridden −₹3.00/unit ·
Sharma ji regular rate". Row 3 "1L Bottle" shows "not returnable" in light grey
italic. A grey footer band shows Subtotal ₹1,876.00, Discount ₹20.00, and
"Order total ₹1,856.00" in 18px bold mono.
```

---

## 7. Modal — Record Return

### 7.1 Purpose

The single most information-dense surface in the app. It splits jars coming back into **empty**, **filled** and **lost** per line, computes what is still pending, and — critically — lets a jar arriving today be credited to the order it actually went out on last week. Without the cross-order section, old orders never close and the jars-out figure inflates forever.

It also has to make the counter-intuitive consequence visible *before* submission: filled jars reduce the order total.

### 7.2 Layout — 720px (it contains a table)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Record return                                                            ✕  │
│  ORD-000123 · Ramesh Patel · issued 14 Aug 2026                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Return date                                                                 │
│  [ 16 Aug 2026              📅 ]                                             │
│                                                                              │
│  THIS ORDER                                                    62 issued     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ PRODUCT        ISSUED  ALREADY  EMPTY   FILLED   LOST     STILL        │  │ 44
│  │                          BACK    NOW      NOW     NOW    PENDING       │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ 20L Jar  ₹32      40        22  [  8]   [  2]   [  0]         8        │  │ 56
│  │ 20L Jar  ₹35      12        12  [  0]   [  0]   [  0]         —  ✓     │  │ 56
│  └────────────────────────────────────────────────────────────────────────┘  │
│  1L Bottle isn't returnable, so it isn't listed.                             │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────   │
│                                                                              │
│  ▸ OTHER OPEN ORDERS FOR RAMESH PATEL          3 orders · 21 jars out        │
│    A jar coming back today may have gone out on an older order.              │
│                                                                              │
│  Note                                                                        │
│  [ Sharma ji's jars came back with the evening round                     ]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Coming back now              10 jars   ·   Still out after this    8 jars   │
│  2 filled jars credited     −₹70.00                                          │
│  Order total    ₹1,400.00 → ₹1,330.00    Balance   ₹450.00 → ₹380.00         │
│                                              [Cancel]    [Record return]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Cross-order section, expanded:**

```
│  ▾ OTHER OPEN ORDERS FOR RAMESH PATEL          3 orders · 21 jars out        │
│    A jar coming back today may have gone out on an older order.              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ORD-000118 · 09 Aug 2026 · 7 days ago                  🟠 9 jars out    │  │ 40
│  │ 20L Jar  ₹35      30        21  [  9]   [  0]   [  0]         —        │  │ 56
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ ORD-000104 · 02 Aug 2026 · 14 days ago                 🔴 10 jars out   │  │ 40
│  │ 20L Jar  ₹35      25        15  [  0]   [  0]   [  0]        10        │  │ 56
│  │ 20L Jar Cold ₹40  10         8  [  2]   [  0]   [  0]         —        │  │ 56
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ ORD-000097 · 26 Jul 2026 · 21 days ago                 🔴 2 jars out    │  │ 40
│  │ 20L Jar  ₹35      20        18  [  0]   [  0]   [  2]         —        │  │ 56
│  └────────────────────────────────────────────────────────────────────────┘  │
```

### 7.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Overlay | `rgba(15, 23, 42, 0.5)`, enter 200ms fade + scale from 0.96, exit 150ms | — |
| Modal | 720px wide, max-height `min(680px, 90vh)`, 12px radius, `shadow-xl`, surface background. Header and footer fixed; the middle scrolls | — |
| Header | 24px padding, H4 18px 600 Gray 900 title, Body SM Gray 600 subtitle 4px below, `✕` 40×40 icon button top-right | `Record return` / `ORD-000123 · Ramesh Patel · issued 14 Aug 2026` |
| Return date | 180px date input, 40px, defaults today, cannot be earlier than the order date or later than today | `16 Aug 2026` |
| Section band | 32px tall, Caption 12px 600 uppercase `0.04em` Gray 600, left; a right-aligned Caption Gray 600 summary. 8px below the previous block | `THIS ORDER` / `62 issued` |
| Mini table container | 8px radius, 1px `#E5E7EB`, `overflow: hidden` | — |
| Mini table header | 44px, `#F3F4F6`, Caption 12px 600 uppercase Gray 600. **Wraps to two lines** for `ALREADY BACK`, `EMPTY NOW`, `FILLED NOW`, `LOST NOW`, `STILL PENDING` — mandatory for Gujarati, where these run 30% longer | — |
| Row | **56px** — it contains inputs. 1px bottom border, 16px horizontal padding | — |
| PRODUCT cell | Body SM 500 Gray 900, with the charged rate in Caption mono Gray 600 beside it: `20L Jar` `₹32.00`. The rate disambiguates two lines of the same product | `20L Jar ₹32.00` |
| ISSUED | 80px, mono 14px 500 Gray 700, right | `40` |
| ALREADY BACK | 90px, mono 14px 500 Gray 600, right. Tooltip on hover lists the prior returns with dates | `22` |
| EMPTY NOW / FILLED NOW / LOST NOW | 88px each, 40px quantity inputs, mono right-aligned, integers, min 0, **max = still-pending**, stepper on hover, default empty (not `0`) so an untouched field is visually distinct | `[ 8 ]` |
| **STILL PENDING** | 90px, **read-only computed**: no border, `#F3F4F6` background, mono 14px **600** Gray 900, right. Formula `issued − already back − (empty + filled + lost)`. Recomputes on every keystroke. Zero renders as `—` in Gray 300 | `8` |
| Settled row | When still-pending is zero and nothing is being entered, the row shows a 12px `Check` `#15803D` after the `—` and the three inputs go read-only at 60% opacity with tooltip `This line is fully accounted for` | `— ✓` |
| Non-returnable note | Caption Gray 600 directly under the table, 8px gap, `Info` 12px icon | `1L Bottle isn't returnable, so it isn't listed.` |
| **Divider** | Full-width 1px `#E5E7EB`, 24px above and below. This is the visual break between *this order* and *everything else* — the two sections must never read as one continuous table | — |
| **Cross-order header** | A 56px clickable band, `#F3F4F6` background, 8px radius, 16px padding. Left: 16px `ChevronRight` (rotating to `ChevronDown` over 200ms) + Caption 12px 600 uppercase Gray 600 `OTHER OPEN ORDERS FOR RAMESH PATEL`. Right: Caption Gray 600 `3 orders · 21 jars out`. Below the label, a Caption Gray 600 explainer line | See 7.4 |
| Cross-order group header | 40px sub-header row **inside** the mini table, `#F8FAFC` background, 1px top border: doc code mono 13px `#2563EB` (opens in a new tab) · date Body SM Gray 600 · ageing Caption (`7 days ago`, turns `#B45309` past 7, `#B91C1C` past 15) · return badge right-aligned | `ORD-000118 · 09 Aug 2026 · 7 days ago` `🟠 9 jars out` |
| Cross-order rows | Identical 56px row spec to the main table, so the interaction is learned once | — |
| Note | Full-width textarea, 2 rows | Placeholder `Anything worth remembering about this return` |
| **Footer** | Fixed at the modal bottom, 1px top border, `#F3F4F6` background, 16px/24px padding. Two rows of live figures, then the action row 16px below | — |
| Footer line 1 | Body SM Gray 600 labels, mono 600 Gray 900 values, two columns | `Coming back now  10 jars` · `Still out after this  8 jars` |
| Footer line 2 (credit) | Only when filled > 0. `RotateCcw` 12px `#15803D`, Body SM `#15803D` | `2 filled jars credited  −₹70.00` |
| Footer line 3 (impact) | Body SM Gray 600 label, then old value mono Gray 400 struck, `→`, new value mono 600 Gray 900 | `Order total ₹1,400.00 → ₹1,330.00` · `Balance ₹450.00 → ₹380.00` |
| Actions | Right-aligned, 12px gap. `[Cancel]` ghost · `[Record return]` primary filled | — |

### 7.4 Content and copy

| Slot | Literal string |
|---|---|
| Title / subtitle | `Record return` / `ORD-000123 · Ramesh Patel · issued 14 Aug 2026` |
| Return date label | `Return date` |
| Section band | `THIS ORDER` (right: `62 issued`) |
| Column headers | `PRODUCT` · `ISSUED` · `ALREADY BACK` · `EMPTY NOW` · `FILLED NOW` · `LOST NOW` · `STILL PENDING` |
| Column tooltips | Empty: `Jar came back, customer kept the water` · Filled: `Came back unsold — credited back to the total` · Lost: `Written off, never coming back` · Still pending: `Calculated for you — issued minus everything returned` |
| Non-returnable note | `1L Bottle isn't returnable, so it isn't listed.` (plural: `1L Bottle and 500ml Cold Bottle aren't returnable, so they aren't listed.`) |
| Cross-order header | `OTHER OPEN ORDERS FOR RAMESH PATEL` · right `3 orders · 21 jars out` |
| Cross-order explainer | `A jar coming back today may have gone out on an older order. Tick it against the order it belongs to so that order can close.` |
| Cross-order empty | `Ramesh Patel has no other open orders. Every earlier order is fully settled.` — Caption Gray 600 inside the collapsed band, chevron removed, band not clickable |
| Note label / placeholder | `Note` / `Anything worth remembering about this return` |
| Footer labels | `Coming back now` · `Still out after this` · `Order total` · `Balance` |
| Filled credit line | `2 filled jars credited  −₹70.00` (singular `1 filled jar credited  −₹35.00`) |
| Filled explainer link | `Why did the total go down?` — Caption `#2563EB`, opens a 280px popover: `Filled jars came back unsold. Ramesh only owes for the jars he actually sold, so they're credited off the order total. This is expected, not an error.` |
| Buttons | `Cancel` · `Record return` · submitting `Recording…` |
| Success toast | `Return recorded · 10 jars back · 8 still out` |
| Success toast (with credit) | `Return recorded · 10 jars back · ₹70.00 credited · total now ₹1,330.00` |
| Success toast (cross-order) | `Return recorded across 2 orders · 19 jars back · ORD-000118 is now settled` |
| Error — nothing entered | `Enter at least one jar in Empty, Filled or Lost.` |
| Error — over-return | `Only 8 jars are still pending on this line. You entered 12. Reduce it, or check whether the extra jars belong to an older order below.` |
| Error — over-return, server refused | `The database refused this return — 8 jars are pending but 12 were sent. Nothing has been recorded. Reload and try again.` |
| Error — date | `Return date can't be before the order date of 14 Aug 2026.` |
| Error — future date | `Return date can't be in the future.` |
| Error — server | `Couldn't record the return.` + reason + `Try again` |
| Dirty-close confirm | Title `Discard this return?` · Body `You've entered 10 jars across 2 orders. Nothing has been recorded yet.` · `[Keep entering]` + `[Discard]` destructive |

### 7.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Modal opens immediately with header and footer rendered. The table area shows 2 skeleton rows at 56px; the cross-order band shows a shimmer where its count goes. Footer values show `—` until real numbers arrive |
| **Loading (expand cross-order)** | Chevron rotates, the section expands to a 120px area with 2 skeleton rows, then fills. The modal does not resize twice — it reserves the loaded height |
| **Empty — nothing returnable on this order** | The modal is never opened: `Record Return` is disabled on the detail page with tooltip `This order has no returnable products`. If reached by URL, the modal shows a centred 48px `Package` Gray 300, H4 `Nothing to return on this order`, Body SM `This order is 24 × 1L Bottle, which is sold outright and never comes back.`, single `[Close]` button |
| **Empty — everything already back on this order** | `THIS ORDER` table renders with every row showing `— ✓` and read-only inputs, plus a Success band above it: `All 62 jars on this order are accounted for.` The **cross-order section auto-expands** — the only reason to be here is an older order |
| **Empty — no other open orders** | Cross-order band renders collapsed and non-interactive, chevron removed, with the copy from 7.4 in Gray 600 |
| **Filled** | As wireframe |
| **Over-return attempted** | The offending input gets a 1px `#EF4444` border and its `STILL PENDING` cell shows `(4 over)` in `#B91C1C`. A Danger banner appears above the footer with the exact copy from 7.4. `Record return` stays enabled — pressing it focuses the field. The stepper's up-arrow disables at the maximum, and typing above it is allowed but flagged, never silently clamped |
| **Filled-return impact visible** | Footer lines 2 and 3 appear with a 100ms fade, plus the `Why did the total go down?` link. This is the only place the consequence is shown **before** commit, so it must be present the instant a filled value is typed |
| **Cross-order rows entered** | The footer's `Coming back now` splits into two lines: `Coming back now  19 jars` and, beneath in Caption Gray 600, `10 on this order · 9 on ORD-000118`. A Primary chip appears next to the cross-order band: `9 jars on 1 other order` |
| **Submitting** | `Record return` shows a spinner, label `Recording…`; both buttons disable; the modal body dims to 60% with `pointer-events: none`; the `✕` and Escape are blocked to prevent a half-committed state |
| **Success** | Modal closes over 150ms, detail page summary and timeline update, success toast (4s). If any other order became settled, the toast names it |
| **Error** | Danger banner inside the modal, directly above the footer, `#FEE2E2` / 1px `#EF4444`. Modal stays open with all values preserved |
| **Partial error** | Cross-order list unavailable: the band renders with a Warning tint and Caption `Couldn't load Ramesh's other orders. You can still record this order's return.` plus a `Retry` link. Main table fully functional |
| **Disabled** | `Record return` disabled at 40% when every input is empty or zero, with a Caption to its left: `Enter at least one jar` |
| **Read-only** | Not applicable — a cancelled order's `Record Return` action is removed entirely |

### 7.6 Interactions

| Trigger | Behaviour |
|---|---|
| Open | Focus moves to the first `EMPTY NOW` input of the first unsettled line. Focus is trapped in the modal; on close it returns to the `Record Return` button |
| Type in any of the three inputs | `STILL PENDING` for that row recomputes on every keystroke. Footer totals recompute. No validation error while typing |
| Blur an over-max input | Inline error appears; the field re-validates live as it's corrected |
| Tab order | Return date → line 1 Empty → Filled → Lost → line 2 Empty … → cross-order band (Enter/Space toggles) → cross-order line 1 Empty … → Note → Cancel → Record return. **`STILL PENDING` cells are skipped** — they're not focusable |
| `Enter` in a quantity field | Moves to the next quantity field. On the last one, moves to Note. Does **not** submit |
| `⌘/Ctrl + Enter` | Submits from anywhere |
| Click the cross-order band | Expands/collapses over 200ms. State persists for the session so a user who works across orders every day isn't re-clicking |
| Click a cross-order doc code | Opens that order's detail in a **new tab** — never navigates away from an in-progress modal |
| `Escape` / overlay click | Closes immediately when clean; opens the discard confirm when any input has a value |
| Hover a column header | Tooltip with the definitions from 7.4, after 400ms |
| Click `Why did the total go down?` | Popover, 280px, dismissed by Escape or blur |
| Submit | Idempotency key generated on modal open, so a double-tap on a poor connection cannot record two returns |

### 7.7 Responsive — below `md` (768px)

The modal becomes a **full-screen sheet**: 100vw × 100vh, no radius, header fixed at 64px with the `✕` on the left as a back chevron, footer fixed at 132px (three summary lines compress to two, then the action row full-width).

Each line becomes a card, 12px radius, 1px border, 16px padding, 12px gap:

```
┌───────────────────────────────────────────┐
│ 20L Jar  ₹32.00                           │
│ Issued 40 · Already back 22               │
│ Empty now      Filled now      Lost now   │
│ [      8 ]     [      2 ]     [      0 ]  │
│ ─────────────────────────────────────────  │
│ Still pending                          8  │
└───────────────────────────────────────────┘
```

The three inputs sit in a 3-column row at 44px tall each with Caption labels above — they are short numeric fields and must not stack, or the pattern loses its at-a-glance reconciliation. `Still pending` gets its own 40px row with a 1px top rule, label left, mono 600 value right.

Cross-order groups keep their band header as a full-width 56px sticky sub-header while scrolling through that group's cards.

The footer's three lines collapse to two: `10 jars back · 8 still out` and `Total ₹1,400.00 → ₹1,330.00`, with the credit line moving into a tappable `ⓘ`.

### 7.8 Dark mode

Overlay `rgba(2, 6, 23, 0.7)` — the standard overlay is too weak against a `#0B1220` page. Modal `#1E293B`. Mini-table header `#0F172A`. `STILL PENDING` read-only cell `#0F172A` background, `#F1F5F9` text. Cross-order band `#0F172A`; group headers `#0B1220`. The divider between sections becomes 1px `#334155` **plus** 8px extra spacing, because the background difference that separates the two sections in light mode is weaker on dark. Credit line `#22C55E`. Struck-through prior values `#475569`.

### 7.9 Stitch prompt

```text
Design a 720px-wide modal dialog called "Record return" over a dimmed page, for an
internal Indian water-plant app. White #FFFFFF modal, 12px radius, strong shadow,
overlay rgba(15,23,42,0.5). Inter text, JetBrains Mono numbers, blue #2563EB.

Header: 18px bold "Record return", grey 14px subtitle "ORD-000123 · Ramesh Patel ·
issued 14 Aug 2026", ✕ top right. Then a 180px date field "Return date" = 16 Aug 2026.

Section label in 12px uppercase grey: "THIS ORDER", with "62 issued" right-aligned.
Below it a bordered mini table. Header row 44px, #F3F4F6, 12px uppercase grey labels
wrapping to two lines: PRODUCT, ISSUED, ALREADY BACK, EMPTY NOW, FILLED NOW, LOST
NOW, STILL PENDING. Two 56px rows. Row 1: "20L Jar" with small grey mono "₹32.00",
then 40, 22, three number INPUT boxes containing 8, 2 and 0, then a borderless grey-
filled read-only cell showing bold "8". Row 2: "20L Jar ₹35.00", 12, 12, inputs 0/0/0,
and a read-only cell showing a grey em-dash with a small green tick. Small grey note
beneath: "1L Bottle isn't returnable, so it isn't listed."

A full-width horizontal rule, then a collapsed grey #F3F4F6 band with a right-pointing
chevron: "OTHER OPEN ORDERS FOR RAMESH PATEL" in 12px uppercase, right-aligned
"3 orders · 21 jars out", and a small grey line beneath: "A jar coming back today may
have gone out on an older order."

Then a 2-row note textarea.

Fixed footer with a light grey fill and a top border: "Coming back now 10 jars" and
"Still out after this 8 jars" on one line; below, in green, "2 filled jars credited
−₹70.00"; below that "Order total ₹1,400.00 → ₹1,330.00   Balance ₹450.00 → ₹380.00"
with the old values struck through in grey. Bottom right: ghost "Cancel" and filled
blue "Record return".
```

---

## 8. Modal — Record Payment

### 8.1 Purpose

Cash and coins against a balance, in one focused surface, with a live footer that always answers "does this settle it?". Overpayment is allowed and flagged, never blocked — a cash business hands over round numbers constantly, and refusing ₹2,000 against a ₹1,940 balance just teaches staff to record false amounts.

The same block appears inline on the create form (§4, `Payment now`), sharing the coin-line component exactly.

### 8.2 Layout — 560px

```
┌──────────────────────────────────────────────────────────┐
│  Record payment                                       ✕  │
│  ORD-000123 · Ramesh Patel · ₹450.00 due                 │
├──────────────────────────────────────────────────────────┤
│  Payment date                                            │
│  [ 16 Aug 2026            📅 ]                           │
│                                                          │
│  Cash                                                    │
│  [ ₹              300.00 ]        [ Pay full ₹450.00 ]   │
│                                                          │
│  Coins                                                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ COIN TYPE        COINS   PER COIN      VALUE       │  │ 44
│  ├────────────────────────────────────────────────────┤  │
│  │ [Blue Token  ▾]  [  10]   ₹10.00      ₹100.00  ✕   │  │ 56
│  │ [Red Token   ▾]  [   2]   ₹20.00       ₹40.00  ✕   │  │ 56
│  └────────────────────────────────────────────────────┘  │
│  [ + Add coin type ]                                     │
│  ⓘ These 12 coins go back into stock automatically.      │
│                                                          │
│  Note                                                    │
│  [ Balance to come Monday                            ]   │
├──────────────────────────────────────────────────────────┤
│  Order total                                ₹1,330.00    │
│  Already collected                            ₹880.00    │
│  This payment                                 ₹440.00    │
│  ──────────────────────────────────────────────────────  │
│  Balance after                                 ₹10.00    │
│                                                          │
│                        [Cancel]    [Record payment]      │
└──────────────────────────────────────────────────────────┘
```

### 8.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Modal | 560px, max-height `min(640px, 90vh)`, 12px radius, `shadow-xl`, 24px padding; header and footer fixed, middle scrolls | — |
| Header | H4 18px 600 title, Body SM Gray 600 subtitle naming the balance, `✕` 40×40 | `Record payment` / `ORD-000123 · Ramesh Patel · ₹450.00 due` |
| Payment date | 180px date input, defaults to today, cannot precede the order date | `16 Aug 2026` |
| Cash label | Body SM 500 Gray 900 with a 12px `Wallet` icon | `Cash` |
| Cash input | 200px money input, 48px tall (it is the primary field here), `₹` prefix Gray 600 inside, mono right-aligned, autofocused. Accepts `1250`, `1,250`, `1250.50`; formats to lakh grouping on blur | — |
| `Pay full` shortcut | 32px secondary button to the right of the cash field, only when balance > 0 | `Pay full ₹450.00` |
| Coins section label | Body SM 500 Gray 900 with a 12px `Coins` icon | `Coins` |
| Coin mini-table | 8px radius, 1px border. Header 44px `#F3F4F6` Caption uppercase; rows **56px** | — |
| COIN TYPE | Search select, flexes, 40px. Option rows show two lines: `Blue Token` / `₹10.00 per coin · 2,440 in stock` | Placeholder `Choose a coin type` |
| COINS | 100px quantity input, mono right, integers, stepper on hover | — |
| PER COIN | 90px **read-only computed**, no border, `#F3F4F6`, mono 14px 500 Gray 600, right | `₹10.00` |
| VALUE | 110px **read-only computed**, mono 14px **600** Gray 900, right | `₹100.00` |
| Remove | 32×32 (44×44 target), `X` 16px Gray 400 → `#EF4444` | — |
| Add coin type | Full-width 48px dashed ghost button, `Plus` 16px | `+ Add coin type` |
| Coin stock note | Caption Gray 600 with 12px `Info`, 8px below the add button | `These 12 coins go back into stock automatically.` |
| Note | Full-width textarea, 2 rows | Placeholder `e.g. Balance to come Monday` |
| Footer | Fixed, 1px top border, `#F3F4F6` background, 16px/24px padding. Four label/value rows, labels Body SM Gray 600 left, values mono right | — |
| `Order total` | mono 14px 500 Gray 700 | `₹1,330.00` |
| `Already collected` | mono 14px 500 Gray 700 | `₹880.00` |
| `This payment` | mono 14px **600** `#2563EB` — the number being entered gets the accent | `₹440.00` |
| Rule | 1px `#E5E7EB`, 8px above and below | — |
| `Balance after` | Label Body SM **600** Gray 900; value **18px mono 600**. Gray 900 when positive, `#15803D` when exactly zero (with a 14px `CheckCircle2`), `#B45309` when negative and rendered as `Overpaid ₹60.00` | `₹10.00` |
| Actions | Right-aligned, 12px gap, 16px above | `[Cancel]` ghost · `[Record payment]` primary |

### 8.4 Content and copy

| Slot | Literal string |
|---|---|
| Title / subtitle | `Record payment` / `ORD-000123 · Ramesh Patel · ₹450.00 due` |
| Subtitle when settled | `ORD-000123 · Ramesh Patel · paid in full` |
| Labels | `Payment date` · `Cash` · `Coins` · `Note` |
| Cash placeholder | `0.00` |
| Pay-full button | `Pay full ₹450.00` |
| Coin columns | `COIN TYPE` · `COINS` · `PER COIN` · `VALUE` |
| Coin type placeholder | `Choose a coin type` |
| Coin option secondary line | `₹10.00 per coin · 2,440 in stock` |
| Add coin | `+ Add coin type` |
| Coin stock note | `These 12 coins go back into stock automatically.` (singular `This coin goes back into stock automatically.`) |
| Note placeholder | `e.g. Balance to come Monday` |
| Footer labels | `Order total` · `Already collected` · `This payment` · `Balance after` |
| Balance settled | `Balance after  ₹0.00  ✓ Settles this order` in `#15803D` |
| Overpay warning | Warning band above the footer: `This settles ₹450.00 and leaves ₹60.00 overpaid. That's allowed — the extra will show as a refund due to Ramesh.` |
| Buttons | `Cancel` · `Record payment` · submitting `Recording…` |
| Success toast | `Payment of ₹440.00 recorded · ₹10.00 still due` |
| Success toast (settles) | `Payment of ₹450.00 recorded · ORD-000123 is paid in full` |
| Success toast (coins) | `Payment of ₹440.00 recorded · 12 coins back in stock` |
| Error — zero | `Enter a cash amount or add at least one coin line.` |
| Error — negative | `Enter an amount of ₹0.00 or more.` |
| Error — coin type missing | `Choose a coin type for this line.` |
| Error — coin count | `Enter a number of coins greater than 0.` |
| Error — duplicate coin type | `Blue Token is already on another line. Add the coins to that line instead.` |
| Error — date | `Payment date can't be before the order date of 14 Aug 2026.` |
| Error — server | `Couldn't record the payment. Nothing was saved — the amount is still due.` + `Try again` |
| Error — duplicate submit | `This payment was already recorded a moment ago. Showing the order as it now stands.` (Info, not Danger — this is the idempotency key doing its job) |
| Dirty-close confirm | Title `Discard this payment?` · Body `You've entered ₹440.00. Nothing has been recorded yet.` · `[Keep entering]` + `[Discard]` destructive |

### 8.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Modal opens instantly; the coin-type option list loads in the background. The Cash field is usable immediately — the common case must never wait on coins |
| **Loading (coin stock refresh)** | The `2,440 in stock` line in an option row shows a 40×12 shimmer; selection is not blocked |
| **Empty — no coin types defined** | Coins section replaced by a 96px inset panel, `#F3F4F6`, 8px radius: Caption Gray 600 `No coin types set up yet.` + a `Set up coin types` link to `/coins/types/new`. Cash still works |
| **Empty — no coin lines** | Default state: coin table renders with a single blank row, `✕` disabled |
| **Empty — no results in coin select** | `No coin type matches "gree". Check the spelling, or add it in Coin Types.` |
| **Filled** | As wireframe |
| **Overpayment** | Warning band above the footer with the copy from 8.4; `Balance after` shows `Overpaid ₹60.00` in `#B45309`. **Submission stays enabled** |
| **Exact settlement** | `Balance after` shows `₹0.00` in `#15803D` with a `CheckCircle2` and the Caption `Settles this order`. No banner |
| **Submitting** | `Record payment` spinner + label `Recording…`; both buttons disable; body dims to 60%; `✕` and Escape blocked |
| **Success** | Modal closes 150ms, detail summary and payments timeline update, success toast naming the amount |
| **Error** | Danger banner above the footer, values preserved, modal stays open |
| **Partial error** | Payment recorded but the coin ledger entry failed: Warning banner on the detail page after close — `Payment of ₹440.00 recorded. The 12 coins haven't been added back to stock yet; this will retry automatically.` Not dismissible until resolved |
| **Disabled** | `Record payment` disabled at 40% when cash is empty/zero and no coin line has a quantity, with Caption to its left `Enter an amount` |
| **Read-only** | Not applicable — the action is removed on cancelled orders |
| **Double-submit** | The idempotency key generated on open means a second submit returns the first payment. The modal closes with the Info toast from 8.4, never a duplicate row |

### 8.6 Interactions

| Trigger | Behaviour |
|---|---|
| Open | Cash field autofocused with the caret at the end. Focus trapped; returns to `Record Payment` on close |
| Click `Pay full ₹450.00` | Fills Cash with the exact balance, formats it, and moves focus to `Record payment` |
| Type in Cash | Footer `This payment` and `Balance after` recompute on every keystroke. Formatting applies on blur only, so typing isn't fought |
| Select a coin type | `PER COIN` fills, focus jumps to `COINS` |
| Type coins | `VALUE`, `This payment` and `Balance after` all recompute live |
| `Enter` on the last coin field | Adds a coin row and focuses its type select |
| `⌘/Ctrl + Enter` | Submits |
| Tab order | Payment date → Cash → Pay full → coin 1 type → coins → `✕` → coin 2 … → Add coin type → Note → Cancel → Record payment. Computed cells are skipped |
| Escape / overlay | Closes when clean; discard confirm when dirty |
| Validation timing | On blur per field; everything on submit with focus to the first error; live re-validation once errored |
| Submit | Button disables for the round trip; success closes and toasts |

### 8.7 Responsive — below `md` (768px)

Full-screen sheet: 100vw × 100vh, no radius, 64px fixed header with a back chevron, 168px fixed footer. Cash field goes full width at 48px with `Pay full ₹450.00` as a full-width secondary button directly beneath it. Coin lines become cards:

```
┌───────────────────────────────────────────┐
│ Coin 1                              [✕]   │
│ [ Blue Token                         ▾ ]  │
│ Coins                    Value            │
│ [        10 ]            ₹100.00          │
│ ₹10.00 per coin                           │
└───────────────────────────────────────────┘
```

The footer keeps all four lines — this is the information the whole modal exists for — at Body SM with 6px row gaps, with `Balance after` at 18px mono 600. `Record payment` becomes a full-width 48px primary with `Cancel` as a text link above.

### 8.8 Dark mode

Modal `#1E293B`, overlay `rgba(2, 6, 23, 0.7)`. Coin table header and read-only computed cells `#0F172A` with `#94A3B8` text. Footer band `#0F172A`. `This payment` accent lifts to `#3B82F6`. Settled `Balance after` uses `#22C55E`; overpaid uses `#FED7AA` on a `#7C2D12` band. Dashed add button border `#334155`, hover `#3B82F6`.

### 8.9 Stitch prompt

```text
Design a 560px modal dialog "Record payment" over a dimmed page, for an internal
Indian water-plant app. White modal, 12px radius, 24px padding, heavy shadow,
overlay rgba(15,23,42,0.5). Inter for text, JetBrains Mono for numbers, blue #2563EB.

Header: 18px bold "Record payment"; grey 14px subtitle "ORD-000123 · Ramesh Patel ·
₹450.00 due"; ✕ top right.

Body: a 180px date field labelled "Payment date" showing "16 Aug 2026". Then a label
"Cash" with a small wallet icon and a 200px, 48px-tall money input containing a grey
₹ prefix and right-aligned mono "300.00", with a small outlined button beside it
reading "Pay full ₹450.00".

Then a label "Coins" with a coin icon and a bordered mini table: 44px #F3F4F6 header
with 12px uppercase grey labels COIN TYPE, COINS, PER COIN, VALUE. Two 56px rows,
each with a dropdown, a small number input, a borderless grey read-only cell and a
bold mono value, plus an ✕: "Blue Token / 10 / ₹10.00 / ₹100.00" and "Red Token /
2 / ₹20.00 / ₹40.00". Below, a full-width dashed ghost button "+ Add coin type" and
a small grey line with an info icon: "These 12 coins go back into stock
automatically." Then a 2-row textarea labelled "Note".

Fixed footer with a light grey #F3F4F6 fill and a 1px top border, four rows of label
left / right-aligned mono value: "Order total ₹1,330.00", "Already collected
₹880.00", "This payment ₹440.00" with the value in blue, a thin rule, then "Balance
after" in bold with "₹10.00" at 18px bold mono. Bottom right: ghost "Cancel" and
filled blue "Record payment".
```

---

## 9. Supporting dialogs

### 9.1 Purpose

Three 420px confirm dialogs complete the module: **write off lost jars** (the only way some orders ever close), **cancel order** (blocked until money and jars are reversed), and **reverse a payment or return** (the append-only correction path). They share one anatomy so a destructive decision always looks the same.

### 9.2 Layout — 420px

```
┌────────────────────────────────────────────────┐
│  ⚠                                             │
│  Write off 8 lost jars?                        │
│                                                │
│  8 × 20L Jar from ORD-000123 will be marked    │
│  lost and the order will close as Settled.     │
│  The jars stay counted as a loss in reports.   │
│                                                │
│  Reason *                                      │
│  [ Customer moved away, jars gone           ]  │
│                                                │
│                    [Cancel]  [Write off jars]  │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  ⛔                                             │
│  ORD-000123 can't be cancelled yet             │
│                                                │
│  This order has ₹880.00 collected and 54 jars  │
│  returned. Reverse them first — money is never │
│  deleted along with an order.                  │
│                                                │
│              [Close]  [Go to payments]         │
└────────────────────────────────────────────────┘
```

### 9.3 Region-by-region spec

| Element | Spec |
|---|---|
| Dialog | 420px, 12px radius, `shadow-xl`, 24px padding, surface background |
| Icon | 24px, top-left, in the semantic colour — `AlertTriangle` `#EF4444` for destructive, `Ban` `#B91C1C` for blocked, `RotateCcw` `#2563EB` for reversal |
| Title | H4 18px 600 Gray 900, 12px below the icon. **Always names the object** |
| Body | Body SM Gray 600, 1.6 line height, 8px below the title, max 3 lines |
| Reason field | Only on write-off. Full-width 40px input, required, label Body SM 500 + blue `*` |
| Actions | 24px above, right-aligned, 12px gap. `[Cancel]` ghost Gray 600 · destructive filled `#EF4444` white label |
| **Confirm button repeats the verb** | `Write off jars`, `Cancel order`, `Reverse payment` — never `Yes`, `OK` or `Confirm` |

### 9.4 Content and copy

| Dialog | Title | Body | Buttons |
|---|---|---|---|
| Write off lost jars | `Write off 8 lost jars?` | `8 × 20L Jar from ORD-000123 will be marked lost and the order will close as Settled. The jars stay counted as a loss in reports.` | `Cancel` · `Write off jars` |
| Write off — reason empty | — | Field error `Say why these jars won't come back — this is what shows in the loss report.` | — |
| Cancel order — allowed | `Cancel order ORD-000121?` | `Nothing has been paid or returned against it, so it can be cancelled cleanly. It stays visible in the list, greyed out.` | `Keep order` · `Cancel order` |
| Cancel order — blocked | `ORD-000123 can't be cancelled yet` | `This order has ₹880.00 collected and 54 jars returned. Reverse them first — money is never deleted along with an order.` | `Close` · `Go to payments` |
| Reverse payment | `Reverse this ₹440.00 payment?` | `A reversing entry of −₹440.00 is added on 16 Aug 2026. The original stays visible. Balance goes from ₹450.00 to ₹890.00. Any coins on it come back out of stock.` | `Cancel` · `Reverse payment` |
| Reverse return | `Reverse this return of 10 jars?` | `A reversing entry is added on 16 Aug 2026. The original stays visible. Jars out goes from 8 to 18, and the ₹70.00 credited for filled jars is removed, taking the total back to ₹1,400.00.` | `Cancel` · `Reverse return` |
| Success toasts | `8 jars written off · ORD-000123 is now settled` · `ORD-000121 cancelled` + `Undo` for 8s · `Payment reversed · ₹890.00 now due` | — | — |

### 9.5 States

| State | Presentation |
|---|---|
| **Loading** | Dialogs open with content already known; no loading state. The write-off dialog's jar count comes from the page |
| **Empty / no results** | Not applicable |
| **Filled** | As above |
| **Error** | Danger banner inside the dialog above the actions, dialog stays open, values preserved |
| **Partial error** | Cancel succeeded but the coin reversal failed: dialog closes and the order page shows a non-dismissible Warning banner naming exactly what is outstanding |
| **Submitting** | Destructive button shows a spinner, label becomes `Writing off…` / `Cancelling…` / `Reversing…`; both buttons disable; Escape blocked |
| **Success** | Dialog closes, toast, page refreshes in place. Cancellation offers `Undo` for 8 seconds |
| **Disabled** | Write-off's confirm button disabled until Reason has content |
| **Read-only** | Destructive actions hidden entirely for read-only users |
| **Blocked** | The blocked-cancel variant has no destructive button at all — only `Close` and a navigation action. Never show a disabled destructive button with no route forward |

### 9.6 Interactions

Focus moves to the `Cancel` button on open (not the destructive one — a stray Enter must not destroy anything), except on the write-off dialog where it moves to the Reason field. Escape closes. Overlay click closes only when no field has been typed into. Tab cycles within the dialog. On close, focus returns to the trigger — the `⋯` menu item or timeline action that opened it.

### 9.7 Responsive

Below `md`, dialogs become bottom sheets at 100vw, 12px top radius, 24px padding, with actions stacked full-width — destructive on top, `Cancel` beneath it as a ghost button. A drag handle sits above the icon.

### 9.8 Dark mode

Dialog `#1E293B`, overlay `rgba(2, 6, 23, 0.7)`. Destructive button stays `#EF4444` with white text — it must remain the loudest thing on the screen. Warning body text `#FED7AA`; blocked-state icon `#FECACA`.

### 9.9 Stitch prompt

```text
Design two small 420px confirmation dialogs for an internal Indian water-plant app,
shown over a dimmed page. White #FFFFFF, 12px radius, 24px padding, strong shadow,
overlay rgba(15,23,42,0.5). Inter for text, JetBrains Mono for figures.

Dialog A, destructive: a 24px red #EF4444 warning-triangle icon at the top left,
then an 18px semibold near-black heading "Write off 8 lost jars?", then 14px grey
#4B5563 body text "8 × 20L Jar from ORD-000123 will be marked lost and the order
will close as Settled. The jars stay counted as a loss in reports." Below that a
label "Reason *" with the asterisk in blue #2563EB and a full-width 40px text input
containing "Customer moved away, jars gone". Bottom right, two buttons 12px apart: a
ghost grey "Cancel" and a filled red #EF4444 button with white text "Write off jars".

Dialog B, blocked: a 24px dark-red ban icon, heading "ORD-000123 can't be cancelled
yet", body "This order has ₹880.00 collected and 54 jars returned. Reverse them
first — money is never deleted along with an order." Bottom right: a ghost "Close"
and an OUTLINED blue button "Go to payments". There is deliberately no red button on
this one.

Both dialogs are compact and quiet — no illustration, no colour fills behind the
text, no rounded card inside a card. All figures use JetBrains Mono.
```

---

## Module design checklist

Every screen and modal in this module, before it is considered finished:

**Standards compliance**

- [ ] Page header on every full screen has an H2 title **and** a one-line Body SM subtitle
- [ ] Primary action top-right, named for what it does — `+ New Order`, `Record return`, `Record payment`. Never `Submit` or `OK`
- [ ] Table body rows **48px**, header rows **44px** and sticky, line-item and modal-table rows **56px**, toolbar 56px, quick chips 44px, tabs 44px
- [ ] Cell padding 12px vertical / 16px horizontal, no zebra striping, row hover `#F3F4F6`
- [ ] Money is JetBrains Mono, right-aligned, `₹` prefix, always 2 decimals, `—` in `#D1D5DB` for zero, `(₹60.00)` in Danger for negative
- [ ] Quantities mono, right-aligned, grouped, no decimals
- [ ] Dates `14 Aug 2026`, with `Today` / `Yesterday` for recent, times `6:05 pm`, digits Latin in both languages
- [ ] Status badges use the §7.2 map verbatim — `Unpaid`, `₹450 due`, `Paid`, `Overpaid ₹60`, `40 jars out`, `8 jars out`, `Settled`, `—`, `Cancelled` — **with numbers where available**
- [ ] Dual badges on order rows: payment first, return second, 4px apart, genuinely independent
- [ ] Icons only from the §17 map: `ClipboardList`, `Package`, `PackageX`, `PackageCheck`, `RotateCcw`, `Banknote`, `Wallet`, `Coins`, `Plus`, `Pencil`, `Trash2`, `Search`, `SlidersHorizontal`, `Download`, `MoreHorizontal`
- [ ] Cards do not lift on hover; only table rows change background
- [ ] Spacing uses only 4 / 8 / 12 / 16 / 24 / 32

**States**

- [ ] Loading-first uses skeletons; loading-refilter dims existing content and never re-skeletons
- [ ] Empty-no-data and empty-no-results have **distinct copy** on the list, and the Returns tab has a third variant for non-returnable-only orders
- [ ] Error copy is plain language with a recovery action; no stack traces
- [ ] Partial-error designed on the list, the detail page, the create form and both modals
- [ ] Submitting dims the form to 60%, spinner in the primary button, present-tense label
- [ ] Success always navigates or closes with a toast naming the amount or object
- [ ] Disabled states always carry an adjacent Caption or tooltip explaining why
- [ ] Read-only / cancelled order renders fully legible with write actions removed, not disabled

**Module-specific**

- [ ] **Over-return is blocked** with an inline error naming the exact pending count, and the cross-order section is offered as the likely explanation
- [ ] **`Still pending` is read-only and computed** in the return modal — never focusable, never typeable
- [ ] The **cross-order section is visually separated** by a full-width rule, its own uppercase band, its own explainer line, and per-order group headers with codes, dates, ageing and badges
- [ ] The **total-decrease** behaviour is communicated in four places: the return modal footer before commit, the success toast, the detail summary `was ₹1,400.00` sub-line with `ⓘ`, and a dismissible info banner
- [ ] **Overpayment is allowed**, flagged amber, never blocked
- [ ] **Edit-with-history warning** appears whenever payments or returns exist, is not dismissible, and states the consequence in numbers
- [ ] Quantity cannot be reduced below what has already been returned; the `✕` on such a line is disabled with a reason
- [ ] Concurrent-edit conflict names who changed it and when, and preserves the user's input
- [ ] Payments and returns are append-only — timeline menus offer `Reverse`, never `Edit`
- [ ] Rate override shows a 2px `#F97316` left border, a Warning chip with the per-unit **and** line difference, and a reason input
- [ ] Coin payments state that stock is credited automatically

**Craft**

- [ ] Every figure that could be drilled into is clickable — KPI values, badges, summary sub-lines, doc codes
- [ ] Search placeholder names what is searched: `Search order no, staff name, phone…`
- [ ] Validation never fires while typing; on blur for touched fields; on submit with focus to the first error; live re-validation once errored
- [ ] Focus rings (2px `#2563EB` at 2px offset) visible on every interactive element, including inside modals
- [ ] Modals trap focus, restore it to the trigger on close, and confirm before discarding dirty input
- [ ] Touch targets 44×44px minimum, including table `⋯` buttons and line-item `✕`
- [ ] Designed in both light and dark, with dedicated dark badge pairs and an `#0F172A` inset for what is `#F3F4F6` in light
- [ ] Checked with Gujarati at realistic length: `રમેશ પટેલ` in the staff column, two-line wrapping column headers, buttons sized to content with a min-width
- [ ] Mobile layout defined below `md` for all four screens and all three modals, with modals becoming full-screen sheets
- [ ] Idempotency on both recording modals so a double-tap cannot double-record
