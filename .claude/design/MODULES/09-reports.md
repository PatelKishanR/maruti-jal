# Module 09 — Reports & Exports · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/09-reports.md](../../MODULES/09-reports.md)

---

## 1. Design context (for Stitch)

**Product.** Maruti Jal — an internal admin web app for a mineral-water plant in Gujarat, India. One user: the owner. This module produces the documents that get **printed, handed to a staff member during a settlement conversation, or checked line by line against a paper register**. Three of the seven reports leave the building on paper.

**Colour — light / dark**

| Token | Light | Dark |
|---|---|---|
| Primary — Nova Blue | `#2563EB` | `#3B82F6` |
| Surface (card) | `#FFFFFF` | `#1E293B` |
| Page background | `#F8FAFC` | `#0B1220` |
| Surface subtle (table header, summary band, group row) | `#F3F4F6` | `#1E293B` |
| Text primary | `#111827` | `#F1F5F9` |
| Text secondary | `#4B5563` | `#94A3B8` |
| Border | `#E5E7EB` | `#334155` |
| Success | `#22C55E` | `#34D399` |
| Warning | `#F97316` | `#FB923C` |
| Danger | `#EF4444` | `#F87171` |

Badges (bg / text): Default `#E5E7EB`/`#374151` · Primary `#DBEAFE`/`#1D4ED8` · Success `#DCFCE7`/`#15803D` · Warning `#FEF3C7`/`#B45309` · Danger `#FEE2E2`/`#B91C1C`. Dark: `#334155`/`#E2E8F0` · `#1E3A8A`/`#BFDBFE` · `#14532D`/`#BBF7D0` · `#7C2D12`/`#FED7AA` · `#7F1D1D`/`#FECACA`.

**Type.** Inter for text, JetBrains Mono `tabular-nums` for every figure, Noto Sans Gujarati in the fallback stack. H2 28/1.3/600 page title · H3 22/1.4/600 card heading · H4 18/1.4/600 section · Body 16/1.6/400 · Body SM 14/1.5/400 (table cells, labels — most of this module) · Caption 12/1.4/500 (column headers, metadata).

**Spacing.** 4 · 8 · 12 · 16 · 24 (card padding) · 32 (section gap).

**Radius / elevation.** Input 4px · button 8px · card and table container 12px + 1px border + `shadow-sm` · modal 12px + `shadow-xl`. Cards never lift on hover.

**Layout.** Sidebar 240px · topbar 64px sticky · content max-width 1440px · content padding 24px (16px below `md`). Breakpoints sm 640 · md 768 · lg 1024 · xl 1280.

**Tables.** Container card, `overflow: hidden`. Header 44px, `#F3F4F6` background, Caption 12/600 uppercase `0.04em` Gray 600, **sticky** on scroll. Body rows 48px, 1px bottom border, Body SM. Cell padding 12px vertical / 16px horizontal. Hover `#F3F4F6`. No zebra striping. Text left · numbers and money **right** · badges centre.

**Money and dates — non-negotiable.** `₹` + Indian lakh grouping + 2 decimals: `₹12,34,567.00`. Zero renders as an em dash `—` in Gray 300, never `₹0.00`. Negative in parentheses with Danger text: `(₹500.00)`. Quantities grouped, no decimals: `1,247`. Litres up to 3 decimals with trailing zeros trimmed: `20L`, `0.5L`. Dates `14 Aug 2026`, ranges collapse shared parts: `14–16 Aug 2026`. Time `6:05 pm`. Timestamps `14 Aug 2026, 6:05 pm`. Ageing in plain days — `22 days` — Spark Orange past 7, Spark Red past 15. **Digits are always Latin 0–9, in both languages,** because these documents get checked against bank statements, UPI apps and registers.

**Print.** A4 portrait, 20mm margins → a 170 × 257mm live area. Inter 10pt body, 8pt caption, figures stay JetBrains Mono. **Black on white — status is printed as a word, never as a colour,** since a badge tint is invisible in mono. Header carries business name, document title, period and generation timestamp. Footer carries `Page n of m` and the document code. Gujarati font embedded and verified for conjunct and matra shaping.

**Icons.** Lucide, 1.5px stroke. Report `FileBarChart` · Export `Download` · Print `Printer` · Filter `SlidersHorizontal` · Cash `Wallet` · Payment `Banknote` · Coin `Coins` · Coin ledger `BookOpen` · Party `PartyPopper` · Direct sale `Droplet` · Product `Package` · Jars out `PackageX` · Return `RotateCcw` · Expense `Receipt` · Staff `Users`.

**The five principles.** ① Density over whitespace. ② Numbers are the interface. ③ Status is scannable without reading. ④ Every number is a door. ⑤ Entry speed is a feature. To which this module adds a sixth: **a report never writes.** Nothing on these screens changes a record; every row links out to the record that owns it.

---

## 2. Screens in this module

| Screen | Route | Archetype | Purpose |
|---|---|---|---|
| Report index | `/reports` | **A — List** (card grid variant) | Launcher: pick a report, see what it answers |
| Report screen archetype | — | **E — Report** | The shared shell every report below inherits |
| Daily collection sheet | `/reports/daily-collection` | E | What came in today, from whom, in what form. **Printed** |
| Staff outstanding statement | `/reports/staff-outstanding` | E | Everything one staff member owes. **Printed** |
| Coin reconciliation | `/reports/coin-reconciliation` | E | Per coin type: opening → closing, and whether it ties |
| Party order statement | `/reports/party-statement` | E | Client-facing schedule, payments, balance. **Printed** |
| Product movement | `/reports/product-movement` | E | Units and litres per product, per channel |
| Profit & loss summary | `/reports/profit-loss` | E | Income by channel minus expenses by category |
| Jar reconciliation | `/reports/jar-reconciliation` | E | Issued, returned, lost, still out |
| Print / PDF layout | `/reports/…/print` | **Print** | A4 document design for the three printed reports |
| Export bar | component | — | CSV and PDF actions with their full state set |

---

## 3. Report index — `/reports`

### 3.1 Purpose

Seven fixed reports, not a builder. The index exists so the owner picks by **question** rather than by name — a card that says "Everything one staff member owes" is found faster than one that says "Statement".

### 3.2 Layout

```
Reports                                          [⚙ Export settings]
Seven fixed reports covering the questions that come up daily

┌─────────────────────────────┐┌─────────────────────────────┐
│ 💰                    PDF   ││ 👥                    PDF   │
│ Daily collection sheet      ││ Staff outstanding statement │
│ What came in today, from    ││ Everything one staff member │
│ whom, and in what form      ││ owes — orders, coins, jars  │
│ Date                        ││ Staff · Date range          │
│ Last run Today, 6:05 pm   › ││ Last run 12 Aug 2026      › │
└─────────────────────────────┘└─────────────────────────────┘
┌─────────────────────────────┐┌─────────────────────────────┐
│ 🪙                          ││ 🎉                    PDF   │
│ Coin reconciliation         ││ Party order statement       │
│ Opening, issued, returned,  ││ A client-facing statement   │
│ received, adjusted, closing ││ of deliveries and payments  │
│ Coin type · Date range      ││ Party order                 │
│ ⚠ 1 type doesn't tie      › ││ Last run 09 Aug 2026      › │
└─────────────────────────────┘└─────────────────────────────┘
┌─────────────────────────────┐┌─────────────────────────────┐
│ 📦                          ││ 📈                          │
│ Product movement            ││ Profit & loss summary       │
│ Units and litres sold per   ││ Income by channel minus     │
│ product, per channel        ││ expenses by category        │
│ Date range · Product        ││ Date range                  │
│ Last run 01 Aug 2026      › ││ Last run 01 Aug 2026      › │
└─────────────────────────────┘└─────────────────────────────┘
┌─────────────────────────────┐
│ 🚫📦                        │
│ Jar reconciliation          │
│ Issued, returned empty and  │
│ filled, lost, still out     │
│ Date range · Staff · Product│
│ 312 jars out 7+ days      › │
└─────────────────────────────┘
```

### 3.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Page title | H2 28px 600 Gray 900 | `Reports` |
| Subtitle | Body SM Gray 600, always present | `Seven fixed reports covering the questions that come up daily` |
| Grid | 3 columns on `xl`, 2 on `lg` and `md`, 1 below. 24px gap, equal heights | |
| Card | 12px radius, 1px `#E5E7EB` border, `shadow-sm`, 24px padding, 180px min-height, clickable, cursor pointer. Hover: border fades to Nova Blue at 40%, 100ms. **No lift** | |
| Icon | 24px Lucide, Nova Blue, top-left | `Wallet` `Users` `Coins` `PartyPopper` `Package` `TrendingUp` `PackageX` |
| PDF marker | Top-right, Primary badge 22px, Caption 12/500 | `PDF` on the three printed reports only |
| Title | H4 18px 600 Gray 900, 12px below the icon | |
| Description | Body SM Gray 600, max 2 lines, 1.5 line height | |
| Filter hint | Caption Gray 600, 12px above the footer, `·` separated. Tells the owner what they will be asked for **before** they click | `Staff · Date range` |
| Footer line | Caption Gray 600 left, 16px `ChevronRight` Gray 400 right, 1px top border 12px above | `Last run Today, 6:05 pm` |
| Alert footer | Where a report has an outstanding condition, the footer replaces "Last run" with a Danger-coloured line and a 12px `AlertTriangle` | `⚠ 1 coin type doesn't tie` · `312 jars out 7+ days` |
| Export settings | Secondary 40px button, top-right of the page header | `⚙ Export settings` |

The alert footer is what stops this screen being a menu. Coin reconciliation and jar reconciliation surface their own bad news on the card, so the owner opens the report because it told him to, not because he remembered to.

### 3.4 Content and copy

| Card | Title | Description | Filter hint |
|---|---|---|---|
| 1 | `Daily collection sheet` | `What came in today, from whom, and in what form` | `Date` |
| 2 | `Staff outstanding statement` | `Everything one staff member owes — order balances, coin dues, jars still out` | `Staff · Date range` |
| 3 | `Coin reconciliation` | `Opening, issued, returned, received, adjusted, closing — per coin type` | `Coin type · Date range` |
| 4 | `Party order statement` | `A client-facing statement of scheduled deliveries and payments received` | `Party order` |
| 5 | `Product movement` | `Units and litres sold per product, per channel` | `Date range · Product` |
| 6 | `Profit & loss summary` | `Income by channel minus expenses by category` | `Date range` |
| 7 | `Jar reconciliation` | `Issued, returned empty and filled, lost, still out` | `Date range · Staff · Product` |

Export settings popover: `Date format` · `Number format` · `Include the business header on CSV exports` · `Default PDF language  [EN | ગુ]`.

Gujarati titles run 25–40% longer — `સ્ટાફ બાકી નિવેદન`, `સિક્કા સમાધાન` — so card titles wrap to two lines and the card min-height is set by the tallest card in the row, never fixed per card.

### 3.5 States

Loading: seven cards render with their icons and titles; the footer line is a 12×140px shimmer. Empty: never — the seven cards are fixed and always render, and a report with no data says so on its own screen. Error (last-run timestamps failed): cards render without footers, no error banner — a missing timestamp is not worth an alarm. Alert: as §3.3.

### 3.6 Interactions

Card click → the report screen with its last-used filters restored from the URL history, or with sensible defaults on a first visit (`Today` for daily collection, `This month` for everything with a range). Keyboard: `Tab` through the cards, Enter opens, visible 2px Nova Blue focus ring at 2px offset. Alert footers are not separate links — the whole card goes to the same place.

### 3.7 Responsive

Below `md`: single column, 16px page padding, 16px card gap, card min-height drops to 148px, description clamps to 2 lines. The PDF badge stays. `⚙ Export settings` moves into the topbar overflow `⋯` menu.

### 3.8 Dark mode

Cards `#1E293B` on `#0B1220`, 1px `#334155` border. Icon `#3B82F6`. Title `#F1F5F9`, description and hints `#94A3B8`. PDF badge `#1E3A8A` / `#BFDBFE`. Alert footer `#F87171`. Hover border `#3B82F6` at 40%.

### 3.9 Stitch prompt

```text
Design a report launcher page for an internal business web app called Maruti Jal,
light mode, Inter font. Page background #F8FAFC, 240px left sidebar, content
padded 24px.

Header: "Reports" in 28px Inter Semibold #111827 with the grey 14px subtitle
"Seven fixed reports covering the questions that come up daily". Right-aligned
outlined button "⚙ Export settings".

Below, a three-column grid of seven white cards, 24px gap, equal heights, each
12px corner radius, 1px #E5E7EB border, very subtle shadow, 24px padding, at
least 180px tall. Each card: a 24px blue outline icon top-left; on three of them
a small blue pill badge reading "PDF" in the top-right corner. Then an 18px Inter
Semibold title, a two-line 14px #4B5563 description, and near the bottom a 12px
grey line naming the filters. A 1px top divider, then a footer row with a 12px
grey line on the left and a small grey chevron-right on the right.

Cards, in order: "Daily collection sheet" (wallet icon, PDF badge, "What came in
today, from whom, and in what form", filters "Date", footer "Last run Today, 6:05
pm"); "Staff outstanding statement" (users icon, PDF badge, "Everything one staff
member owes — order balances, coin dues, jars still out", filters "Staff · Date
range"); "Coin reconciliation" (coins icon, no badge, filters "Coin type · Date
range", footer in red with a small warning triangle reading "1 type doesn't
tie"); "Party order statement" (party icon, PDF badge, filters "Party order");
"Product movement" (package icon, filters "Date range · Product"); "Profit & loss
summary" (trending-up icon, filters "Date range"); "Jar reconciliation" (package-x
icon, filters "Date range · Staff · Product", footer in red "312 jars out 7+
days"). Utilitarian and dense — no illustrations, no gradients, no hover lift.
```

---

## 4. The shared report screen archetype — Archetype E

### 4.1 Purpose

One shell for all seven reports: **filter panel → summary band → report table → export bar**. Sections 5–11 specify only what differs. Getting this right once means a new eighth report is a table definition, not a design exercise.

### 4.2 Layout

```
‹ Reports
Staff outstanding statement                            [🖨 Print] [⋯]
Everything Ramesh Patel owes as at 14 Aug 2026

┌──────────────────────────────────────────────────────────────────┐
│ Staff *            From                To                        │
│ [Ramesh Patel  ▾]  [01 Jul 2026 📅]    [14 Aug 2026 📅]           │
│ ● This month  ● Last month  ● Last 90 days       [Run report]    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  TOTAL OWED      ORDER BALANCES   COIN DUES     JARS OUT         │
│  ₹61,000.00      ₹48,600.00       ₹12,400.00    412              │
│  8 open records  6 orders         3 issues      🔴 118 · 18 days  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ORDER ↕      DATE ↕      ITEMS       TOTAL ↕   PAID ↕  BALANCE ↕ │
├──────────────────────────────────────────────────────────────────┤
│ Open delivery orders                          6 orders  ₹48,600  │
│ ORD-000098   22 Jul 2026  3 items · 62 u  ₹2,480.00 ₹2,030.00 …  │
│ ORD-000104   28 Jul 2026  2 items · 40 u  ₹1,400.00      —   …   │
│ …                                                                │
│                              Subtotal   ₹52,180.00  ₹3,580.00 …  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Generated 14 Aug 2026, 6:05 pm · 8 rows   [Export CSV] [Export PDF]│
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Region-by-region spec

**Page header**

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM Nova Blue with a leading `‹`, 8px above the title | `‹ Reports` |
| Title | H2 28px 600 Gray 900 | `Staff outstanding statement` |
| Subtitle | Body SM Gray 600, **restates the applied filters in prose** so a screenshot is self-explanatory | `Everything Ramesh Patel owes as at 14 Aug 2026` |
| Actions | `🖨 Print` secondary 40px on the three printed reports only; `⋯` menu with `Copy link`, `Reset filters` | |

**Filter panel**

| Element | Spec |
|---|---|
| Container | Card, 12px radius, 1px border, `shadow-sm`, 16px/24px padding, 24px bottom margin |
| Layout | Horizontal row of fields on `lg`, wrapping on `md`, stacked below. Field gap 16px |
| Labels | Body SM 500 Gray 900, 6px above the field. Required fields carry a Nova Blue `*` |
| Field widths | Date 180px · select 240px · search-select 280px · number 120px. **Never full width** — a full-width box for a date invites errors |
| Date fields | `DD MMM YYYY`, calendar icon right, calendar popover with `Today` / `Yesterday` chips inside |
| Search select | Type to filter, keyboard navigable, secondary detail per option: `Ramesh Patel · 9876543210`, 8 visible before scroll |
| Quick chips | Below the fields, 8px gap. Inactive Default badge, active Primary badge + 1px Nova Blue border. `This month` `Last month` `Last 90 days` |
| Run | Primary 40px button, right-aligned, named for the action | `Run report` |
| Auto-run | Reports whose filters all have defaults run on arrival. Reports with a required unset filter (staff, party order) show the empty prompt instead and disable `Run report` until it is set |
| URL | Every filter is a URL parameter: `?staff=12&from=2026-07-01&to=2026-08-14`. The view is shareable and back works |

**Summary band**

| Element | Spec |
|---|---|
| Container | Full width, `#F3F4F6` background, 12px radius, 1px border, 20px padding, 24px bottom margin |
| Columns | 4 on `lg`, 2 on `md`, 1 below. Equal width |
| Label | Caption 12/600 uppercase `0.04em` Gray 600 |
| Value | **20px JetBrains Mono 600** — smaller than a KPI card's 28px, because this is a band inside a report, not the home screen. The single critical figure per report is Gray 900; the rest Gray 700 |
| Context line | Caption Gray 600 below the value, `·` separated |
| Alert | Where the figure represents risk, the value takes Spark Red and its context line carries a Danger badge with the ageing sub-count |
| Clickable | Yes, where a destination exists — same rule as a KPI card. Hover fades the cell background to `#E5E7EB` |
| Zero | `—` in Gray 300 with a Caption context line, never a blank cell |

**Report table**

| Element | Spec |
|---|---|
| Container | Card, `overflow: hidden`. Multiple tables in one report each get their own card, 24px apart |
| Header | 44px, `#F3F4F6`, Caption 12/600 uppercase, Gray 600, sticky under the topbar at 64px offset |
| Group row | 40px, `#F3F4F6` background, Body SM **600** Gray 900 left, and the group's own totals right-aligned in the matching money columns. A group row is a heading **and** a subtotal — reading it alone answers the question |
| Body row | 48px, 1px bottom border, Body SM |
| Subtotal row | 44px, 1px top border in Gray 400, Body SM 600, label `Subtotal` in Gray 600, figures Gray 900 mono 600 |
| Grand total row | 52px, `#F3F4F6` background, 2px top border Gray 900, Body SM 600 Gray 900, figures 16px mono 700 |
| Sort | Header click cycles none → asc → desc → none. Sorting applies **within groups**; group order never changes |
| Row link | Where a row owns a record, the whole row navigates to it. Where it does not (a P&L category line), the row is not clickable and the cursor stays default |
| Density | No zebra striping, no row spacing, 12/16px cell padding |
| Column pinning | The first column pins left on horizontal scroll, with a 1px right border and a 4px right-side shadow once scrolled |

**Export bar** — see §13.

### 4.4 Content and copy

- Subtitle pattern: `<what> <for whom> <over what period>` — `Everything Ramesh Patel owes as at 14 Aug 2026` · `Collections on 14 Aug 2026` · `Product movement, 01 Aug – 14 Aug 2026`
- Run button: `Run report`. Re-running: `Updating…`
- Group rows: `Open delivery orders` · `Open coin issues` · `Jars still out`
- Subtotal label: `Subtotal`. Grand total: `Total`
- Required-filter prompt: H4 `Choose a staff member`, Body SM Gray 600 `Pick who the statement is for, then run the report.`
- Empty for period: H4 `No records in this period`, Body SM `Nothing was recorded between 01 Jul and 14 Aug 2026. Try widening the date range.`, secondary `Clear filters`
- Error: H4 `Couldn't run this report`, Body SM `The server didn't respond. Nothing was changed — reports only read.`, primary `Try again`
- Generated line: `Generated 14 Aug 2026, 6:05 pm · 8 rows`

### 4.5 States

| State | Presentation |
|---|---|
| **Prompt** | Required filter unset. Filter panel active, summary band and table replaced by a centred 320px block: 48px Gray 300 `Users`, H4, Body SM. `Run report` disabled at 40% |
| **Loading (first run)** | Filter panel stays live. Summary band renders its labels with 24×120px shimmer bars. Table renders header plus 8 skeleton rows at 60%/40%/80% widths, 1.5s shimmer |
| **Loading (re-run)** | The existing report **stays on screen** at 60% opacity, pointer events off, 2px indeterminate Nova Blue bar under the filter panel. Never replace loaded figures with a skeleton |
| **Empty (no data)** | Summary band renders with `—` values and Caption context lines. Table area shows 48px `SearchX` Gray 300, H4, Body SM naming the active filters, `Clear filters` secondary |
| **Partial** | Table renders with a Danger banner above it: `Some figures may be out of date. Coin totals last refreshed at 5:40 pm.` |
| **Filled** | As specified |
| **Error** | Filter panel stays; summary band and table replaced by the error block |
| **Stale / cached** | The generated line in the export bar appends a Warning chip `⏱ from cache, 12 min ago` with a `Refresh` link |
| **Exporting** | See §13.5 |
| **Export failed** | See §13.5 |

### 4.6 Interactions

Changing a filter does **not** auto-run unless every filter has a default; otherwise `Run report` becomes primary-emphasised and a Caption Gray 600 line reads `Filters changed — run the report to update`. This prevents a heavy query firing on every keystroke of a date field. Applying pushes a history entry. Quick chips apply immediately, because a preset is a single unambiguous intent. `⌘/Ctrl + P` opens the print view on the three printed reports. Row click opens the underlying record in the same tab; `⌘/Ctrl + click` opens a new one. Sticky headers keep column identity while scrolling a 200-row statement. **Nothing on any report screen writes** — there are no inline edits, no status toggles, no delete actions.

### 4.7 Responsive — below `md`

Filter panel fields stack full-width at 44px tall, quick chips wrap into a horizontally scrolling row, `Run report` becomes a full-width 48px button. Summary band becomes a 2-column grid, value 18px mono 600. The table keeps its table form and scrolls horizontally inside its card with the first column pinned — **report tables do not become cards on mobile**, unlike list tables, because a statement's value is the column alignment down the page. A Caption hint sits above: `Swipe the table sideways to see all columns ›`. Group and subtotal rows stay pinned to the left edge with their totals visible without scrolling. The export bar becomes sticky to the bottom of the viewport with two 44px full-width buttons side by side.

### 4.8 Dark mode

Page `#0B1220`, cards `#1E293B`, borders `#334155`. Filter panel and summary band `#1E293B` (the band's `#F3F4F6` has no dark analogue that separates from the card — use a 1px `#334155` border and `#0F172A` fill instead). Table header `#0F172A` with `#94A3B8` text. Group rows `#0F172A`. Grand total row `#0F172A` with a 2px `#94A3B8` top border. Row hover `#1E293B` lightened to `#263449`. Emphasised figures `#F1F5F9`; negative and risk figures `#F87171`.

### 4.9 Stitch prompt

```text
Design the shared layout for a business report screen in an internal web app,
light mode, Inter with JetBrains Mono for all numbers. Page background #F8FAFC,
240px sidebar, 24px content padding.

Top: a small blue "‹ Reports" back link, the title "Staff outstanding statement"
in 28px Inter Semibold, and the grey 14px subtitle "Everything Ramesh Patel owes
as at 14 Aug 2026". Right-aligned outlined "🖨 Print" and a "⋯" icon button.

Filter panel: a white card, 12px radius, 1px #E5E7EB border, 24px padding, with
one row of fields under 14px labels — a 280px search-select "Ramesh Patel" and
two 180px date fields "01 Jul 2026" and "14 Aug 2026" with calendar icons. Below
them small pill chips "This month / Last month / Last 90 days", the first active
in #DBEAFE with a blue border. Right-aligned solid #2563EB "Run report" button.

Summary band: a full-width #F3F4F6 block, 12px radius, 1px border, 20px padding,
four equal columns, each a 12px uppercase grey label over a 20px JetBrains Mono
Semibold value over a small grey context line — TOTAL OWED ₹61,000.00 / "8 open
records"; ORDER BALANCES ₹48,600.00 / "6 orders"; COIN DUES ₹12,400.00 / "3
issues"; JARS OUT 412 in red with a small red pill "118 out 18 days".

Report table: a white card with a 44px #F3F4F6 header of 12px uppercase grey
labels — ORDER, DATE, ITEMS, TOTAL, PAID, BALANCE — the last three right-aligned.
Below it a 40px grey group row "Open delivery orders" in semibold with "6 orders"
and "₹48,600.00" pushed right, then 48px data rows: "ORD-000098" in blue mono,
"22 Jul 2026", "3 items · 62 units", ₹2,480.00, ₹2,030.00, and ₹450.00 in
semibold. Close with a subtotal row above a 1px dark rule. No zebra striping.

Bottom: a white bar with "Generated 14 Aug 2026, 6:05 pm · 8 rows" in 12px grey
on the left and outlined "Export CSV" and "Export PDF" buttons on the right.
```

---

## 5. Daily collection sheet — `/reports/daily-collection`

### 5.1 Purpose

The end-of-day tally. What came in, from whom, in what form — and **the figure that should physically be in the drawer**. When the cash count disagrees, this sheet shows exactly which line to look at. Printed and kept.

### 5.2 Layout

```
Filters:  [ 14 Aug 2026 📅 ]   ● Today  ● Yesterday       [Run report]

┌──────────────────────────────────────────────────────────────────┐
│  TOTAL COLLECTED   CASH           COINS          EXPECTED IN     │
│  ₹28,740.00        ₹22,490.00     ₹6,250.00      DRAWER          │
│  31 receipts       24 receipts    625 coins      ₹22,490.00      │
└──────────────────────────────────────────────────────────────────┘

TIME    SOURCE                REFERENCE     FROM             MODE    AMOUNT
─ Delivery order collections                          14 receipts  ₹16,980.00
09:20am Delivery order        ORD-000131    Ramesh Patel     Cash   ₹2,480.00
11:05am Delivery order        ORD-000132    Suresh Chauhan   Coins  ₹1,200.00
…
                                                    Subtotal        ₹16,980.00
─ Party payments                                        3 receipts  ₹8,200.00
02:15pm Party order           PTY-000012    Shreeji Wedding  Cash   ₹5,000.00
…                                                   Subtotal         ₹8,200.00
─ Walk-in sales                                        11 receipts  ₹2,530.00
06:40pm Direct sale           DWS-000876    Kirit bhai       Cash     ₹120.00
…                                                   Subtotal         ₹2,530.00
─ Coin issue payments                                   3 receipts  ₹1,030.00
…                                                   Subtotal         ₹1,030.00
══════════════════════════════════════════════════════════════════════════
  TOTAL COLLECTED                                    31 receipts  ₹28,740.00

┌── Coins received, by type ───────────────────────────────────────┐
│ COIN TYPE      PER COIN    COINS RECEIVED           VALUE        │
│ Blue Token       ₹10.00               480      ₹4,800.00        │
│ Green Token      ₹20.00                60      ₹1,200.00        │
│ Red Token         ₹5.00                50        ₹250.00        │
│                          Total        590      ₹6,250.00        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Cash ₹22,490.00 + UPI ₹0.00 = expected in drawer ₹22,490.00     │
│  Coins are tokens returning to stock — not cash. Counted above.  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Region-by-region spec

| Region | Spec |
|---|---|
| Filters | Single date field, 180px, defaults to today. Chips `Today` `Yesterday`. Auto-runs on arrival |
| Summary band | 4 columns: `TOTAL COLLECTED` (Gray 900 — the critical figure) · `CASH` · `COINS` (context line shows the coin count, not just the value) · `EXPECTED IN DRAWER` |
| Groups | Four, in fixed order: `Delivery order collections` · `Party payments` · `Walk-in sales` · `Coin issue payments`. A group with no receipts still renders its row with `— no receipts` in Gray 300 — its absence is information |
| Columns | `TIME` 80px mono 13px · `SOURCE` · `REFERENCE` mono 13px Nova Blue · `FROM` (staff or party or walk-in name; Gujarati names render at full row height) · `MODE` Default badge `Cash` / `Coins` / `UPI` / `Bank` · `AMOUNT` right, mono, 2 decimals |
| Coins sub-table | Its own card below the main table. Columns `COIN TYPE` · `PER COIN` right · `COINS RECEIVED` right · `VALUE` right. Total row |
| Reconciliation footer | A `#F3F4F6` card, 20px padding: the arithmetic written out as a sentence in Body SM with mono figures, plus a Caption Gray 600 note explaining why coins are excluded from the drawer figure |
| Row link | To the owning record — `/orders/131`, `/party-orders/12`, `/direct-sales/876`, `/coins/issues/45` |

### 5.4 Content and copy

Title `Daily collection sheet` · subtitle `Collections on 14 Aug 2026` · summary labels `TOTAL COLLECTED` `CASH` `COINS` `EXPECTED IN DRAWER` · group labels as above · empty group `— no receipts` · reconciliation line `Cash ₹22,490.00 + UPI ₹0.00 = expected in drawer ₹22,490.00` · note `Coins are tokens returning to stock — not cash. Counted separately above.` · empty state `Nothing was collected on 14 Aug 2026. Pick another date.` · export labels `Export CSV` `Export PDF` `Print`.

### 5.5 States

Per §4.5. Additions: a **future date** disables `Run report` with the Caption `That date hasn't happened yet.` A date with orders but no payments shows the table empty and the summary band at `—`, with the Caption `14 orders were raised but nothing was collected.` — a materially different fact from "no activity", and worth saying.

### 5.6 Interactions

Date chips apply immediately. `‹` `›` arrow buttons flank the date field for day-stepping — the single most common action on this screen. Clicking the `CASH` summary cell filters the table to cash receipts in place with a removable chip; clicking `COINS` filters to coin receipts and scrolls to the coins sub-table. Group headers collapse on click, persisted per user.

### 5.7 Responsive

Below `md`: date field full width with the `‹` `›` steppers at 44px each. Summary band 2×2. Main table scrolls horizontally with `TIME` pinned; `SOURCE` is dropped on narrow viewports since `REFERENCE` already identifies the record. Coins sub-table fits without scrolling.

### 5.8 Dark mode

Per §4.8. Mode badges take the dark badge pairs. The reconciliation footer card uses `#0F172A` with a 1px `#334155` border and `#F1F5F9` figures.

### 5.9 Stitch prompt

```text
Design a "Daily collection sheet" report screen for an internal Indian business
web app, light mode, Inter with JetBrains Mono for figures. Title "Daily
collection sheet" in 28px semibold, grey subtitle "Collections on 14 Aug 2026",
right-aligned outlined "🖨 Print" button.

Filter card: a 180px date field reading "14 Aug 2026" with small ‹ and › stepper
buttons either side, plus pill chips "Today" and "Yesterday", and a solid blue
"Run report" button.

Grey summary band, four columns, each a 12px uppercase label over a 20px
JetBrains Mono Semibold value with a small grey line beneath: TOTAL COLLECTED
₹28,740.00 / "31 receipts"; CASH ₹22,490.00 / "24 receipts"; COINS ₹6,250.00 /
"625 coins"; EXPECTED IN DRAWER ₹22,490.00.

Main table card: 44px grey header row with uppercase 12px labels TIME, SOURCE,
REFERENCE, FROM, MODE, AMOUNT (amount right-aligned). The body is grouped: a 40px
light-grey group row "Delivery order collections" in semibold with "14 receipts"
and "₹16,980.00" pushed right, then 48px data rows — "09:20 am", "Delivery
order", "ORD-000131" in blue mono, "Ramesh Patel", a small grey "Cash" pill,
"₹2,480.00" right-aligned in mono. Repeat groups for "Party payments", "Walk-in
sales" and "Coin issue payments", each closing with a thin-ruled subtotal row.
Finish with a heavier total row: "TOTAL COLLECTED · 31 receipts · ₹28,740.00".

Below, a smaller card "Coins received, by type" with columns COIN TYPE, PER COIN,
COINS RECEIVED, VALUE and rows Blue Token ₹10.00 / 480 / ₹4,800.00; Green Token
₹20.00 / 60 / ₹1,200.00; Red Token ₹5.00 / 50 / ₹250.00, then a total row.

Last, a light grey card containing the sentence "Cash ₹22,490.00 + UPI ₹0.00 =
expected in drawer ₹22,490.00" with a small grey note under it. Dense rows, no
zebra stripes, borders only.
```

---

## 6. Staff outstanding statement — `/reports/staff-outstanding`

### 6.1 Purpose

Everything one staff member owes, in one document, handed over during a settlement conversation. It has to survive being read across a table by someone who did not open it.

### 6.2 Layout

```
Filters: [Ramesh Patel ▾] [01 Jul 2026 📅] [14 Aug 2026 📅]  [Run report]

SUMMARY:  TOTAL OWED ₹61,000.00 · ORDER BALANCES ₹48,600.00
          COIN DUES ₹12,400.00 · JARS OUT 412  🔴 118 · 18 days

┌── Section A · Open delivery orders ──────────────── 6 · ₹48,600 ─┐
│ ORDER       DATE          TOTAL      PAID      BALANCE   AGE     │
│ ORD-000098  22 Jul 2026  ₹2,480.00  ₹2,030.00   ₹450.00  22 days │
│ ORD-000104  28 Jul 2026  ₹1,400.00       —    ₹1,400.00  16 days │
│                Subtotal ₹52,180.00 ₹3,580.00 ₹48,600.00          │
└──────────────────────────────────────────────────────────────────┘
┌── Section B · Open coin issues ───────────────────── 3 · ₹12,400 ┐
│ ISSUE       DATE      ISSUED       RETURNED    PAID      PENDING │
│ CIS-000045  29 Jul   400 / ₹5,000  50 / ₹500  ₹1,000   ₹3,500    │
│                                     Subtotal          ₹12,400.00 │
└──────────────────────────────────────────────────────────────────┘
┌── Section C · Jars still out ────────────────────── 412 jars ────┐
│ PRODUCT       FROM ORDER   DATE OUT      QTY OUT   DAYS OUT      │
│ 20L Jar       ORD-000098   22 Jul 2026        18   22 days 🔴    │
│ 20L Jar Cold  ORD-000112   05 Aug 2026        44    9 days 🟠    │
│                              Total           412                 │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Region-by-region spec

| Region | Spec |
|---|---|
| Filters | `Staff *` search-select 280px showing `Ramesh Patel · 9876543210`; date range 180px each; chips `This month` `Last month` `Last 90 days`. Staff is required — until set, the screen shows the prompt state |
| Summary band | `TOTAL OWED` Gray 900, Spark Red when non-zero, the critical figure · `ORDER BALANCES` · `COIN DUES` · `JARS OUT` with a Danger sub-badge for the 7+ day count |
| Three tables | Each in its own card, 24px apart, with a heading row: H4 left, and right-aligned Caption `6 orders · ₹48,600.00` |
| Section A columns | `ORDER` mono Nova Blue · `DATE` · `TOTAL` · `PAID` · `BALANCE` mono **600** Gray 900 · `AGE` in plain days, Spark Orange past 7, Spark Red past 15 |
| Section B columns | `ISSUE` mono Nova Blue · `DATE` · `ISSUED` as `400 / ₹5,000.00` · `RETURNED` as `50 / ₹500.00` · `PAID` · `PENDING` mono 600. A refund-due row shows `(₹500.00)` in Danger with a Primary badge `Refund ₹500` |
| Section C columns | `PRODUCT` · `FROM ORDER` mono Nova Blue · `DATE OUT` · `QTY OUT` mono right · `DAYS OUT` with the ageing colour and a 6px dot |
| Section C grouping | By product, then by order, newest first. Product group rows carry the product's own jar total |
| Empty section | The card still renders with `No open delivery orders` in Body SM Gray 600 centred at 88px height. All three sections always appear — a settlement conversation needs to see that a category is clear, not have it silently absent |
| Date range note | Sections A and B respect the range. Section C does **not** — a jar out since June is still out today, and hiding it because the range starts in July would be a lie. A Caption Gray 600 sits on Section C: `All jars currently out, regardless of the date range` |

### 6.4 Content and copy

Title `Staff outstanding statement` · subtitle `Everything Ramesh Patel owes as at 14 Aug 2026` · section headings `Section A · Open delivery orders`, `Section B · Open coin issues`, `Section C · Jars still out` · prompt `Choose a staff member` / `Pick who the statement is for, then run the report.` · empty sections `No open delivery orders` · `No open coin issues` · `No jars out` · all-clear state H4 `Ramesh Patel owes nothing` with Body SM `No order balances, no coin dues, no jars out. Settled as at 14 Aug 2026.` and a 48px Spark Green `CheckCircle2` · Gujarati name rendering: `રમેશ પટેલ` appears in the filter, the subtitle and the printed header exactly as typed, in one field, any script.

### 6.5 States

Per §4.5, plus: **prompt** (no staff chosen) is the arrival state · **all clear** (nothing owed) replaces the three tables with the single green block above, keeping the summary band at `—` values · **inactive staff** shows a Warning banner above the summary: `Ramesh Patel is marked inactive. This statement still shows what is owed.`

### 6.6 Interactions

Changing the staff member re-runs immediately, since it is the report's subject rather than a refinement. Every row navigates to its record. The summary band's `JARS OUT` cell links to `/orders?staff=12&return_status=NOT_RETURNED,PARTIAL`. `🖨 Print` and `Export PDF` both produce the A4 document in §12.2. A `Record payment` shortcut appears in the `⋯` menu, and it **navigates to the order** rather than opening a modal — reports never write.

### 6.7 Responsive

Below `md`: staff select full width, dates side by side at 50%. Summary band 2×2. Each section scrolls horizontally with its first column pinned. Section C drops `FROM ORDER` into a second line under the product name.

### 6.8 Dark mode

Per §4.8. Ageing colours `#FB923C` / `#F87171`. Balance figures `#F1F5F9` 600. The all-clear block uses a `#14532D` icon tint with `#BBF7D0` text.

### 6.9 Stitch prompt

```text
Design a "Staff outstanding statement" report screen, light mode, Inter with
JetBrains Mono numbers, for an internal Indian water-plant admin app. Title in
28px semibold, grey subtitle "Everything Ramesh Patel owes as at 14 Aug 2026".

Filter card: a 280px search-select showing "Ramesh Patel" with "9876543210" in
small grey beneath, two 180px date fields "01 Jul 2026" and "14 Aug 2026", pill
chips "This month / Last month / Last 90 days", and a solid #2563EB "Run report".

Grey summary band with four columns: TOTAL OWED ₹61,000.00 (in #EF4444) / "8 open
records"; ORDER BALANCES ₹48,600.00 / "6 orders"; COIN DUES ₹12,400.00 / "3
issues"; JARS OUT 412 with a small red pill "118 out 18 days". Values 20px
JetBrains Mono Semibold, labels 12px uppercase grey.

Then three separate white table cards stacked 24px apart, each with an 18px
semibold heading on the left and a small grey count on the right:
"Section A · Open delivery orders" — "6 orders · ₹48,600.00" — columns ORDER,
DATE, TOTAL, PAID, BALANCE, AGE. Rows like "ORD-000098" in blue mono, "22 Jul
2026", ₹2,480.00, ₹2,030.00, ₹450.00 in semibold, "22 days" in red. A subtotal
row ruled off at the bottom.
"Section B · Open coin issues" — "3 issues · ₹12,400.00" — columns ISSUE, DATE,
ISSUED, RETURNED, PAID, PENDING, with values like "400 / ₹5,000.00".
"Section C · Jars still out" — "412 jars" — columns PRODUCT, FROM ORDER, DATE
OUT, QTY OUT, DAYS OUT, with small red or amber dots beside the day counts, and a
12px grey note under the heading: "All jars currently out, regardless of the date
range".

48px rows, 44px grey uppercase headers, money right-aligned in mono, no zebra
striping. Bottom bar: "Generated 14 Aug 2026, 6:05 pm · 8 rows" with outlined
"Export CSV" and "Export PDF" buttons.
```

---

## 7. Coin reconciliation — `/reports/coin-reconciliation`

### 7.1 Purpose

Prove that every coin is accounted for: opening + in − out = closing, per coin type, and whether the computed closing matches the cached balance. This is the report the dashboard's danger banner sends the owner to.

### 7.2 Layout

```
Filters: [All coin types ▾] [01 Aug 2026 📅] [14 Aug 2026 📅] [Run report]

SUMMARY: COINS IN STOCK 4,240 · VALUE ₹51,100.00 · OUT WITH STAFF 1,190
         RECONCILES  ⚠ 1 of 3 types don't tie

COIN TYPE    OPENING  ISSUED  RETURNED  RECEIVED  ADJUSTED  CLOSING  ✓
Blue Token     3,000  −1,200      +300      +480       −140    2,440  ⚠ −50
  ₹10.00/coin                                                ₹24,400
Green Token    1,000    −400      +240      +340          0    1,180  ✓
  ₹20.00/coin                                                ₹23,600
Red Token        700    −180       +40       +60          0      620  ✓
  ₹5.00/coin                                                  ₹3,100
──────────────────────────────────────────────────────────────────────
Total          4,700  −1,780      +580      +880       −140    4,240
                                                            ₹51,100.00
```

### 7.3 Region-by-region spec

| Region | Spec |
|---|---|
| Filters | Coin type select 240px, default `All coin types`; date range 180px each; chips `This month` `Last month` `This year`. Auto-runs |
| Summary band | `COINS IN STOCK` · `VALUE IN STOCK` · `OUT WITH STAFF` · `RECONCILES` — the fourth cell is a status, not a figure: Success `All 3 types tie` with `CheckCircle2`, or Danger `1 of 3 types don't tie` with `AlertTriangle` at 20px mono weight |
| Columns | `COIN TYPE` (name Gray 900 500, Caption below `₹10.00 per coin · 100 per packet`) · `OPENING` · `ISSUED` · `RETURNED` · `RECEIVED` · `ADJUSTED` · `CLOSING` mono 600 · `✓` 56px |
| Signed movement | Outflows carry a leading `−` in Spark Red, inflows a leading `+` in Spark Green. This is the one place in the app where a signed figure is coloured, because the direction *is* the content |
| Second line | Each coin row's `CLOSING` cell carries the rupee value below the count in Caption mono Gray 600: `₹24,400.00` |
| Check column | `✓` in Spark Green when computed closing equals the cached balance; `⚠ −50` in Spark Red with the signed difference when it does not. The whole row takes a 3px Spark Red left border |
| Divergent row | Expands on click into an inline panel showing the last 10 ledger entries with a running balance, the first divergent row tinted `#FEF3C7`, and a link `Open full ledger ›` |
| Total row | 52px, `#F3F4F6`, 2px top border, 16px mono 700 |
| Adjustments note | Caption Gray 600 under the table: `Adjustments always carry a reason. 2 adjustments in this period — view them in the ledger.` |
| Row link | `/coins/types/[id]` → Ledger tab, date-filtered to the report's range |

### 7.4 Content and copy

Title `Coin reconciliation` · subtitle `Coin movement, 01 Aug – 14 Aug 2026` · column headers `OPENING` `ISSUED` `RETURNED` `RECEIVED` `ADJUSTED` `CLOSING` · check tooltip `Computed closing 2,440 · Cached balance 2,390 · Difference 50 coins (₹500.00)` · reconcile-good `All 3 types tie` · reconcile-bad `1 of 3 types don't tie` · empty `No coin movement between 01 Aug and 14 Aug 2026.` · output note under the export bar: `PDF isn't offered for this report — it's a working document, not one that gets handed over.`

### 7.5 States

Per §4.5. Additions: **reconciles** — every check green, summary cell Success · **doesn't reconcile** — Danger summary cell, affected rows bordered, and a non-dismissible Danger banner above the table repeating the dashboard's wording · **no movement, stock held** — table renders with zeros in the movement columns and opening equal to closing, which is a valid and useful answer, not an empty state.

### 7.6 Interactions

Clicking `RECONCILES` when it is bad scrolls to and expands the first failing row. Clicking a movement figure opens the ledger filtered to that movement type and period — `/coins/types/3/ledger?type=ISSUE&from=…&to=…`. Row expansion is inline and animated at 200ms; the rest of the table does not move above it. CSV only; no PDF.

### 7.7 Responsive

Below `md`: eight columns will not fit, so the table scrolls horizontally with `COIN TYPE` pinned. The `✓` column pins **right**, since the check result is the reason the owner opened the report. Summary band 2×2 with `RECONCILES` full width on the second row.

### 7.8 Dark mode

Per §4.8. Signed inflow `#34D399`, outflow `#F87171`. The divergent row's expanded panel uses `#0F172A` with the first bad ledger row tinted `#7C2D12`.

### 7.9 Stitch prompt

```text
Design a "Coin reconciliation" report table screen, light mode, Inter with
JetBrains Mono figures, for an internal Indian business app. Subtitle "Coin
movement, 01 Aug – 14 Aug 2026". Filter card with a 240px select "All coin
types", two 180px date fields, chips "This month / Last month / This year", and a
blue "Run report" button.

Grey summary band, four columns: COINS IN STOCK 4,240; VALUE IN STOCK ₹51,100.00;
OUT WITH STAFF 1,190; and a fourth cell labelled RECONCILES containing a red
warning triangle and the words "1 of 3 types don't tie" at 20px semibold in
#EF4444.

Table card: 44px grey header, 12px uppercase labels COIN TYPE, OPENING, ISSUED,
RETURNED, RECEIVED, ADJUSTED, CLOSING and a narrow final check column. All number
columns right-aligned in JetBrains Mono. Rows are 56px tall with two lines: the
coin name in medium weight with "₹10.00 per coin · 100 per packet" in small grey
beneath, and in the CLOSING column the count with its rupee value in small grey
underneath. Outflow numbers show a leading minus in #EF4444, inflows a leading
plus in #22C55E.

Row 1 "Blue Token": 3,000, −1,200, +300, +480, −140, 2,440 / ₹24,400.00, and in
the check column a red warning triangle with "−50". This row carries a 3px
#EF4444 left border. Row 2 "Green Token": 1,000, −400, +240, +340, 0, 1,180 /
₹23,600.00, green tick. Row 3 "Red Token": 700, −180, +40, +60, 0, 620 /
₹3,100.00, green tick. Close with a heavier total row on a grey fill: 4,700,
−1,780, +580, +880, −140, 4,240 and ₹51,100.00.

Above the table, a red banner: #FEE2E2 fill, 1px #EF4444 border, reading "Blue
Token balance doesn't match its ledger — difference 50 coins (₹500.00)". Bottom
bar with one outlined "Export CSV" button only, and the grey note "PDF isn't
offered for this report — it's a working document".
```

---

## 8. Party order statement — `/reports/party-statement`

### 8.1 Purpose

A client-facing document: every scheduled delivery day with its items and totals, every payment received, and the closing balance. Given to the party at the end of an event, or during it if they ask what they owe. This is the only report an outsider reads, so its screen version is deliberately plainer than the others.

### 8.2 Layout

```
Filters: [PTY-000012 · Shreeji Wedding Hall ▾]              [Run report]

SUMMARY: TOTAL PAYABLE ₹24,800.00 · RECEIVED ₹18,000.00
         OUTSTANDING ₹6,800.00 · DAYS DELIVERED 3 of 5

┌── Delivery schedule ─────────────────────────────────────────────┐
│ DAY  DATE          ITEMS                    QTY   RATE    AMOUNT │
│  1   14 Aug 2026   20L Jar                   80  ₹40.00 ₹3,200.00│
│      Delivered · Ramesh Patel · 6:20 pm                          │
│  2   15 Aug 2026   20L Jar                  120  ₹40.00 ₹4,800.00│
│      Delivered · Ramesh Patel                                    │
│  3   16 Aug 2026   20L Jar                  100  ₹40.00 ₹4,000.00│
│      20L Jar Cold                            40  ₹45.00 ₹1,800.00│
│      Delivered · Jayesh Solanki                                  │
│  4   17 Aug 2026   20L Jar                  120  ₹40.00 ₹4,800.00│
│      Scheduled                                                   │
│  5   18 Aug 2026   20L Jar                  150  ₹40.00 ₹6,000.00│
│      Scheduled                                                   │
│                                    Total payable      ₹24,800.00 │
└──────────────────────────────────────────────────────────────────┘
┌── Payments received ─────────────────────────────────────────────┐
│ DATE          MODE           NOTE                        AMOUNT  │
│ 10 Aug 2026   Bank transfer  Advance                ₹10,000.00   │
│ 15 Aug 2026   Cash                                   ₹8,000.00   │
│                              Total received         ₹18,000.00   │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  Total payable ₹24,800.00 − Received ₹18,000.00                  │
│  Closing balance                                     ₹6,800.00   │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 Region-by-region spec

| Region | Spec |
|---|---|
| Filters | One required search-select, 360px, showing `PTY-000012 · Shreeji Wedding Hall` with `14–18 Aug 2026 · 5 days` as the option's secondary line. No date range — the party order defines its own period |
| Summary band | `TOTAL PAYABLE` · `RECEIVED` · `OUTSTANDING` Spark Red when above zero, the critical figure · `DAYS DELIVERED` as `3 of 5` mono with a 4px progress bar below in Nova Blue at 60% |
| Schedule table | `DAY` 56px centred mono · `DATE` · `ITEMS` (one line per line item; multi-item days keep the day cell rowspan-merged) · `QTY` right mono · `RATE` right mono · `AMOUNT` right mono |
| Day status line | A second line under each day's first item, Caption Gray 600: status word + assigned staff + delivered time. Status is a **word, not a badge**, here — the client-facing register style stays consistent with the printed version |
| Planned days | Rendered at 100% opacity with the status `Scheduled`; not dimmed. A client needs to see what is still coming |
| Skipped days | Amount `—` in Gray 300, status `Skipped`, and the day's amount excluded from the total |
| Payments table | `DATE` · `MODE` Default badge · `NOTE` (`Advance` where flagged) · `AMOUNT` right mono. Total row |
| Closing card | `#F3F4F6`, 20px padding: the arithmetic on one line in Body SM mono, then `Closing balance` in H4 with the figure at 20px mono 700, Spark Red when owed, Spark Green with the label `Fully paid` at zero, Nova Blue with `Refund due ₹600.00` when negative |
| No row links | Rows do **not** navigate. This is the client-facing report; making the rows clickable would be an internal affordance on a document meant to be read flat. The `⋯` menu carries `Open party order ›` |

### 8.4 Content and copy

Title `Party order statement` · subtitle `Shreeji Wedding Hall · PTY-000012 · 14–18 Aug 2026` · headings `Delivery schedule` `Payments received` · statuses `Delivered` `Scheduled` `Skipped` `Cancelled` · totals `Total payable` `Total received` `Closing balance` · zero balance `Fully paid — nothing outstanding` · negative `Refund due ₹600.00` · advance note `Advance` · prompt `Choose a party order` / `Pick the event this statement is for.` · empty payments `No payments received yet.`

### 8.5 States

Per §4.5, plus: **prompt** is the arrival state · **fully paid** turns the closing card Spark Green with `CheckCircle2` · **refund due** turns it Nova Blue with `RotateCcw` · **cancelled order** shows a Default banner: `This party order was cancelled on 12 Aug 2026. The statement shows the position at cancellation.`

### 8.6 Interactions

Selecting a party order runs it immediately. `🖨 Print` and `Export PDF` produce the A4 document in §12.3, which is the point of this report. A language toggle sits in the `⋯` menu — `Generate PDF in ગુજરાતી` — because this document goes to a client who may not read English, and it is the only report where the output language differs from the UI language often enough to deserve its own control.

### 8.7 Responsive

Below `md`: the schedule table scrolls horizontally with `DAY` pinned; the status line wraps under the items. Payments table fits. The closing card stacks its arithmetic onto two lines with the balance at 20px on its own row.

### 8.8 Dark mode

Per §4.8. The closing card uses `#0F172A` with a 1px `#334155` border; the balance takes `#F87171` when owed, `#34D399` when clear, `#3B82F6` when a refund is due.

### 8.9 Stitch prompt

```text
Design a client-facing "Party order statement" report screen, light mode, Inter
with JetBrains Mono figures. Title 28px semibold with the grey subtitle "Shreeji
Wedding Hall · PTY-000012 · 14–18 Aug 2026". Filter card with a single 360px
search-select reading "PTY-000012 · Shreeji Wedding Hall" and a blue "Run report".

Grey summary band, four columns: TOTAL PAYABLE ₹24,800.00; RECEIVED ₹18,000.00;
OUTSTANDING ₹6,800.00 in #EF4444; DAYS DELIVERED "3 of 5" with a thin blue
progress bar at 60% underneath. Values 20px JetBrains Mono Semibold.

Card 1, "Delivery schedule": header row DAY, DATE, ITEMS, QTY, RATE, AMOUNT with
the last three right-aligned. Five day rows: day numbers 1–5 centred in mono, 14
to 18 Aug 2026, items like "20L Jar" with 80 at ₹40.00 = ₹3,200.00. Under each
day's first line a small grey status line — "Delivered · Ramesh Patel · 6:20 pm"
for days 1–3 and just "Scheduled" for days 4–5. Day 3 has two item lines, "20L
Jar" 100 and "20L Jar Cold" 40 at ₹45.00. Close with a ruled row "Total payable
₹24,800.00".

Card 2, "Payments received": columns DATE, MODE, NOTE, AMOUNT. Rows "10 Aug 2026
/ Bank transfer / Advance / ₹10,000.00" and "15 Aug 2026 / Cash / — / ₹8,000.00",
then "Total received ₹18,000.00". Modes appear as small grey pills.

Card 3, light grey fill: one line "Total payable ₹24,800.00 − Received
₹18,000.00", then "Closing balance" in 18px semibold on the left with
"₹6,800.00" in 20px JetBrains Mono Bold #EF4444 on the right.

Plain and document-like — no coloured status badges, statuses written as words,
no row hover highlighting.
```

---

## 9. Product movement — `/reports/product-movement`

### 9.1 Purpose

What actually sells, through which channel, and how much of the base price survives contact with the field.

### 9.2 Layout

```
Filters: [All products ▾] [01 Aug 2026 📅] [14 Aug 2026 📅]  [Run report]

SUMMARY: TOTAL UNITS 29,110 · TOTAL LITRES 4,86,200 L
         REVENUE ₹9,42,600.00 · AVG DISCOUNT ▼ 4.2% vs base

PRODUCT        DELIVERY  PARTY  WALK-IN   UNITS    LITRES   REVENUE  AVG RATE
20L Jar           8,860  2,400    1,220  12,480  2,49,600 ₹4,36,800   ₹35.00
  Base ₹35.00                                                        ── 0.0%
20L Jar Cold      4,980  1,940      300   7,220  1,44,400 ₹2,88,800   ₹40.00
  Base ₹42.00                                                        ▼ 4.8%
1L Bottle         3,900    720      240   4,860     4,860   ₹48,600   ₹10.00
…
──────────────────────────────────────────────────────────────────────────
Total            21,340  5,860    1,910  29,110  4,86,200 ₹9,42,600
```

### 9.3 Region-by-region spec

| Region | Spec |
|---|---|
| Filters | Product multi-select 240px (`All products` default, or `3 products` when narrowed); date range; chips `This month` `Last month` `Last 90 days` |
| Summary band | `TOTAL UNITS` · `TOTAL LITRES` (litres formatted `4,86,200 L`) · `REVENUE` Gray 900 · `AVG DISCOUNT vs BASE` shown as `▼ 4.2%` in Spark Orange, because a discount is neither good news nor bad |
| Columns | `PRODUCT` two-line (title + `Base ₹35.00` in Caption) · `DELIVERY` · `PARTY` · `WALK-IN` · `UNITS` mono 600 · `LITRES` · `REVENUE` mono 600 · `AVG RATE` two-line (rate + variance against base) |
| Channel columns | Right-aligned mono. Zero renders `—`. Each cell carries a Caption percentage-of-row on hover in the tooltip: `8,860 units · 71% of this product` |
| Variance | `── 0.0%` Gray 600 at parity · `▼ 4.8%` Spark Orange when realised is below base · `▲ 2.1%` Spark Green when above |
| Sort | Default `UNITS` descending. All numeric columns sortable |
| Total row | Units, litres and revenue only. **`AVG RATE` shows `—` in the total row**, because averaging averages is wrong and printing a wrong number is worse than printing none |
| Row link | `/products/[id]` → Movement tab, date-filtered to the report range |
| Non-returnable marker | A Default badge `Non-returnable` in the product cell, so it is clear why a bottle never appears in jar reconciliation |

### 9.4 Content and copy

Title `Product movement` · subtitle `Product movement, 01 Aug – 14 Aug 2026` · summary labels `TOTAL UNITS` `TOTAL LITRES` `REVENUE` `AVG DISCOUNT vs BASE` · variance tooltip `Base ₹42.00 · Realised ₹40.00 · 4.8% below base across 7,220 units` · empty `No products moved between 01 Aug and 14 Aug 2026. Try widening the date range.` · filtered-empty `No movement for the 3 products selected. Clear the product filter to see everything.`

### 9.5 States

Per §4.5. Addition: a product with movement but zero revenue (fully discounted or written off) renders revenue as `—` and carries a Caption Gray 600 note in the row — `No revenue recorded` — rather than an alarming `₹0.00`.

### 9.6 Interactions

Clicking a channel cell opens that channel's list filtered to the product and the date range. Clicking `LITRES` in the summary band toggles the whole table between units and litres as the primary measure, with the button label reading `Show litres` / `Show units` — a genuinely different reading of the same data and cheaper than a second report.

### 9.7 Responsive

Below `md`: horizontal scroll with `PRODUCT` pinned. On narrow viewports the three channel columns collapse behind a single `CHANNELS` cell showing `71 / 19 / 10%` in mono with the full split in a tap tooltip.

### 9.8 Dark mode

Per §4.8. Variance `#FB923C` below base, `#34D399` above, `#94A3B8` at parity.

### 9.9 Stitch prompt

```text
Design a "Product movement" report table, light mode, Inter with JetBrains Mono
numbers, for an internal Indian water-plant app. Subtitle "Product movement, 01
Aug – 14 Aug 2026". Filter card: a 240px multi-select reading "All products", two
180px date fields, chips "This month / Last month / Last 90 days", blue "Run
report" button.

Grey summary band, four columns: TOTAL UNITS 29,110; TOTAL LITRES "4,86,200 L";
REVENUE ₹9,42,600.00; AVG DISCOUNT vs BASE "▼ 4.2%" in orange. 20px JetBrains
Mono Semibold values under 12px uppercase grey labels.

Table card, 44px grey header with uppercase labels PRODUCT, DELIVERY, PARTY,
WALK-IN, UNITS, LITRES, REVENUE, AVG RATE — everything but PRODUCT right-aligned.
56px two-line rows: the product title in medium weight with "Base ₹35.00" in
small grey beneath; in the AVG RATE column the rate on the first line and a small
variance on the second — "── 0.0%" in grey, "▼ 4.8%" in orange, "▲ 2.1%" in green.

Rows: "20L Jar" 8,860 / 2,400 / 1,220 / 12,480 / 2,49,600 / ₹4,36,800.00 /
₹35.00 with ── 0.0%. "20L Jar Cold" 4,980 / 1,940 / 300 / 7,220 / 1,44,400 /
₹2,88,800.00 / ₹40.00 with ▼ 4.8%. "1L Bottle" 3,900 / 720 / 240 / 4,860 / 4,860
/ ₹48,600.00 / ₹10.00, with a small grey "Non-returnable" pill next to its name.
"10L Jar" and "500ml Bottle" beneath. Close with a heavier grey total row: 21,340
/ 5,860 / 1,910 / 29,110 / 4,86,200 / ₹9,42,600.00 and an em dash under AVG RATE.

Dense 48–56px rows, borders only, no zebra stripes, sortable-column arrows in the
header at low opacity.
```

---

## 10. Profit & loss summary — `/reports/profit-loss`

### 10.1 Purpose

Answer *"did the business make money this period?"* with income by channel against expenses by category. Not a bookkeeping statement — a categorised list of outgoings against categorised income, which is sufficient and immediately understandable.

### 10.2 Layout

```
Filters: [01 Aug 2026 📅] [14 Aug 2026 📅]  ● This month ● Last month
                                            ● This year      [Run report]

SUMMARY: INCOME ₹12,34,500.00 · EXPENSES ₹4,86,200.00
         PROFIT ₹7,48,300.00 · MARGIN 60.6%

┌── Income ────────────────────────────────────────────────────────┐
│ CHANNEL                              AMOUNT      % OF INCOME      │
│ Delivery orders                ₹8,64,150.00           70.0%  ███ │
│ Party orders                   ₹2,64,300.00           21.4%  █   │
│ Walk-in sales                  ₹1,06,050.00            8.6%  ▌   │
│                    Total income ₹12,34,500.00        100.0%      │
└──────────────────────────────────────────────────────────────────┘
┌── Expenses ──────────────────────────────────────────────────────┐
│ CATEGORY                             AMOUNT     % OF EXPENSES     │
│ Fuel                             ₹1,62,400.00         33.4%  ███ │
│ Staff salary                     ₹1,44,000.00         29.6%  ██  │
│ Electricity                        ₹68,200.00         14.0%  █   │
│ Bottle & jar purchase              ₹52,600.00         10.8%  █   │
│ Plant maintenance                  ₹31,000.00          6.4%  ▌   │
│ Vehicle maintenance                ₹18,000.00          3.7%  ▌   │
│ Miscellaneous                      ₹10,000.00          2.1%  ▏   │
│                  Total expenses  ₹4,86,200.00        100.0%      │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  Income ₹12,34,500.00 − Expenses ₹4,86,200.00                    │
│  NET PROFIT                                     ₹7,48,300.00     │
│  Margin 60.6% · 14 days · ₹53,450.00 average per day             │
└──────────────────────────────────────────────────────────────────┘
```

### 10.3 Region-by-region spec

| Region | Spec |
|---|---|
| Filters | Date range only, defaulting to the current month. Chips `This month` `Last month` `This year`. Auto-runs |
| Summary band | `INCOME` · `EXPENSES` · `PROFIT` Gray 900, the critical figure, Spark Red and parenthesised when negative · `MARGIN` as `60.6%`, Spark Red below zero |
| Two tables | `Income` then `Expenses`, each in its own card |
| Columns | `CHANNEL` / `CATEGORY` · `AMOUNT` right mono 500 · `% OF INCOME` / `% OF EXPENSES` right mono · an inline proportion bar |
| Proportion bar | 6px tall, 4px radius, 80px track in `#E5E7EB`, filled Nova Blue on income and Spark Orange on expenses, scaled to the largest row in its own table. Purely supplementary — the percentage carries the value, the bar carries the shape |
| Ordering | Descending by amount, always. The biggest leak reads first |
| Zero-value categories | Omitted from the table, with a Caption Gray 600 footnote: `3 categories had no expenses in this period.` |
| Net card | `#F3F4F6`, 24px padding: arithmetic line in Body SM mono; `NET PROFIT` in H4 with the figure at **28px mono 700**, the only 28px figure in the module; a Caption context line with margin, period length and daily average |
| Loss | Label becomes `NET LOSS`, figure `(₹42,100.00)` in Spark Red, card gets a 3px Spark Red left border |
| Row link | Income rows → the channel's list filtered to the period. Expense rows → `/expenses?category=fuel&from=…&to=…` |

### 10.4 Content and copy

Title `Profit & loss summary` · subtitle `01 Aug – 14 Aug 2026` · headings `Income` `Expenses` · totals `Total income` `Total expenses` `NET PROFIT` / `NET LOSS` · context `Margin 60.6% · 14 days · ₹53,450.00 average per day` · footnote `3 categories had no expenses in this period.` · empty `No income or expenses recorded between 01 Aug and 14 Aug 2026.` · income-only `Expenses haven't been recorded for this period, so the profit figure is income only.` in a Warning banner — a P&L with no expenses is almost always a data gap, not a very good month.

### 10.5 States

Per §4.5. Additions: **loss** as above · **income only** with the Warning banner · **expenses only** with `No income recorded in this period.` and the net card showing the full loss.

### 10.6 Interactions

Clicking a category row opens the expense list filtered to that category and period. Clicking `MARGIN` opens a 560px modal with the last 6 months' margin as a small line chart — Spark Green line, 2px, one y-axis in per cent, a 1px Gray 400 zero rule, and the current period's point ringed. Chips apply immediately.

### 10.7 Responsive

Below `md`: both tables fit without scrolling (three columns); the proportion bar is dropped below 480px and the percentage stays. Summary band 2×2. The net card keeps its 28px figure — this is the number the owner opened the report for.

### 10.8 Dark mode

Per §4.8. Proportion bar track `#334155`, income fill `#3B82F6`, expense fill `#FB923C`. Net card `#0F172A` with a 1px `#334155` border; profit `#F1F5F9`, loss `#F87171`.

### 10.9 Stitch prompt

```text
Design a "Profit & loss summary" report screen, light mode, Inter with JetBrains
Mono figures, for an internal Indian business app. Subtitle "01 Aug – 14 Aug
2026". Filter card: two 180px date fields, chips "This month / Last month / This
year", blue "Run report" button.

Grey summary band, four columns: INCOME ₹12,34,500.00; EXPENSES ₹4,86,200.00;
PROFIT ₹7,48,300.00; MARGIN 60.6%. 20px JetBrains Mono Semibold under 12px
uppercase grey labels.

Card 1 "Income": columns CHANNEL, AMOUNT, % OF INCOME, plus a narrow column
holding a 6px-tall horizontal proportion bar in #2563EB on an #E5E7EB track. Rows:
"Delivery orders ₹8,64,150.00 70.0%" with a nearly full bar; "Party orders
₹2,64,300.00 21.4%"; "Walk-in sales ₹1,06,050.00 8.6%". Ruled total row "Total
income ₹12,34,500.00 100.0%".

Card 2 "Expenses": same structure with the bars in #F97316. Rows: Fuel
₹1,62,400.00 33.4%; Staff salary ₹1,44,000.00 29.6%; Electricity ₹68,200.00
14.0%; Bottle & jar purchase ₹52,600.00 10.8%; Plant maintenance ₹31,000.00 6.4%;
Vehicle maintenance ₹18,000.00 3.7%; Miscellaneous ₹10,000.00 2.1%. Total row
"Total expenses ₹4,86,200.00 100.0%". A small grey footnote below: "3 categories
had no expenses in this period."

Card 3, light grey fill, 24px padding: a small line "Income ₹12,34,500.00 −
Expenses ₹4,86,200.00", then "NET PROFIT" in 18px Inter Semibold on the left and
"₹7,48,300.00" in 28px JetBrains Mono Bold on the right, then a 12px grey line
"Margin 60.6% · 14 days · ₹53,450.00 average per day".

Sorted biggest first, right-aligned money in mono, 48px rows, borders only.
```

---

## 11. Jar reconciliation — `/reports/jar-reconciliation`

### 11.1 Purpose

Where every jar is. Issued, returned empty, returned filled, written off, still out — per staff member and product. The operational counterpart to the coin ledger.

### 11.2 Layout

```
Filters: [01 Jul 2026 📅] [14 Aug 2026 📅] [All staff ▾] [All products ▾]

SUMMARY: ISSUED 18,420 · RETURNED 17,173 · WRITTEN OFF 0
         STILL OUT 1,247  🔴 312 out 7+ days   RETURN RATE 93.2%

STAFF / PRODUCT      ISSUED  EMPTY  FILLED  LOST  STILL OUT  RETURN %
─ Ramesh Patel        6,240  5,510     318     0        412     93.4%
    20L Jar           4,180  3,720     210     0        250     93.6%
    20L Jar Cold      1,420  1,290      68     0         62     95.6%
    10L Jar             640    500      40     0        100     84.4%
─ Suresh Chauhan      5,120  4,600     252     0        268     94.8%
    …
─ રમેશ પટેલ           3,180  2,840     143     0        197     93.8%
    …
────────────────────────────────────────────────────────────────────
Total                18,420 16,290     883     0      1,247     93.2%
```

### 11.3 Region-by-region spec

| Region | Spec |
|---|---|
| Filters | Date range; staff select 240px (`All staff`); product multi-select 240px (`All products`). Chips `This month` `Last 90 days` `This year` |
| Summary band | `ISSUED` · `RETURNED` (empty + filled) · `WRITTEN OFF` · `STILL OUT` Spark Red with the Danger sub-badge `312 out 7+ days` · `RETURN RATE` as `93.2%`. Five cells on `xl`, dropping to 3+2 on `lg` |
| Grouping | Staff group row (40px, `#F3F4F6`, name 600, group totals right-aligned in every numeric column), then one indented row per product at 48px with a 24px left indent |
| Columns | `STAFF / PRODUCT` · `ISSUED` · `EMPTY` · `FILLED` · `LOST` · `STILL OUT` mono 600 · `RETURN %` |
| Still out | Mono 600 with a 6px leading dot: Spark Red when any of that row's jars are 7+ days out, Spark Orange for 1–6 days, no dot at zero where the cell shows `—` |
| Return rate | Right-aligned mono. Below 85% the cell text takes Spark Orange; below 70%, Spark Red. Exactly 100% takes Spark Green with a `Settled` context |
| Lost column | Zeros render `—`. Any non-zero value takes Spark Red and its cell tooltip names the write-off reason and date |
| Filled note | Caption Gray 600 under the table: `"Filled" jars came back unsold and were credited against the order total.` — without this the column reads as an error |
| Total row | 52px, `#F3F4F6`, 2px top border, 16px mono 700. Return % is recomputed from the totals, never averaged |
| Row link | Staff group row → `/staff/[id]`. Product row → `/orders?staff=12&product=1&return_status=NOT_RETURNED,PARTIAL` |

### 11.4 Content and copy

Title `Jar reconciliation` · subtitle `Jar movement, 01 Jul – 14 Aug 2026` · summary labels `ISSUED` `RETURNED` `WRITTEN OFF` `STILL OUT` `RETURN RATE` · footnote as above · empty `No jars were issued between 01 Jul and 14 Aug 2026.` · non-returnable note when the product filter selects one: `1L Bottle is non-returnable, so it doesn't appear in this report.` · all-settled state `Every jar issued in this period has been accounted for.` with a 48px Spark Green `PackageCheck`.

### 11.5 States

Per §4.5. Additions: **all settled** as above · **write-offs present** adds a Warning banner: `18 jars were written off in this period. They're excluded from the return rate.` · a staff group with no jars out still renders, showing that they are clear.

### 11.6 Interactions

Staff groups collapse on click, persisted per user; collapsed groups still show their totals on the group row, so a collapsed report is a per-staff summary. Clicking `STILL OUT` in the summary band applies an in-place filter to rows with jars out. The `312 out 7+ days` badge links to `/orders?return_status=NOT_RETURNED,PARTIAL&age_gt=7`. Sorting applies to product rows within each staff group; group order is by `STILL OUT` descending and does not change.

### 11.7 Responsive

Below `md`: horizontal scroll with `STAFF / PRODUCT` pinned. `EMPTY`, `FILLED` and `LOST` collapse behind a single `RETURNED` column showing the combined figure, with the split in a tap tooltip — `STILL OUT` and `RETURN %` must stay visible without scrolling.

### 11.8 Dark mode

Per §4.8. Still-out dots `#F87171` / `#FB923C`. Return-rate thresholds `#FB923C` / `#F87171` / `#34D399`.

### 11.9 Stitch prompt

```text
Design a "Jar reconciliation" report table, light mode, Inter with JetBrains Mono
numbers, for an internal Indian water-plant app. Subtitle "Jar movement, 01 Jul –
14 Aug 2026". Filter card: two 180px date fields, a 240px "All staff" select, a
240px "All products" select, chips "This month / Last 90 days / This year", and a
blue "Run report" button.

Grey summary band with five columns: ISSUED 18,420; RETURNED 17,173; WRITTEN OFF
0; STILL OUT 1,247 in #EF4444 with a small red pill "312 out 7+ days"; RETURN
RATE 93.2%. Values 20px JetBrains Mono Semibold.

Table card with a 44px grey header: STAFF / PRODUCT, ISSUED, EMPTY, FILLED, LOST,
STILL OUT, RETURN % — all numeric columns right-aligned. The body is grouped by
staff: a 40px light-grey group row with the staff name in semibold on the left and
that staff member's totals filling every numeric column, then indented 48px
product rows beneath it. Group 1 "Ramesh Patel" 6,240 / 5,510 / 318 / — / 412 /
93.4%, with rows "20L Jar", "20L Jar Cold" and "10L Jar" indented 24px. Group 2
"Suresh Chauhan". Group 3 written in Gujarati script as "રમેશ પટેલ" 3,180 / 2,840 /
143 / — / 197 / 93.8%, rendering at the same row height as the others.

STILL OUT figures are semibold with a small red or amber dot before them. Zeros
in the LOST column show as grey em dashes. Close with a heavier total row on grey:
18,420 / 16,290 / 883 / — / 1,247 / 93.2%. Below the table a 12px grey note:
'"Filled" jars came back unsold and were credited against the order total.'
```

---

## 12. Print / PDF layout — the three printed documents

### 12.1 Purpose and shared page design

These are **not screenshots of the screen**. They are documents, designed for a monochrome laser printer and a settlement conversation across a table. Everything the screen carries in colour must survive as a word.

**The page**

| Property | Spec |
|---|---|
| Page | A4 portrait, 210 × 297mm, 20mm margins → a 170 × 257mm live area |
| Body type | Inter 10pt / 14pt leading. Caption 8pt / 11pt. Figures JetBrains Mono at the same size |
| Colour | **Black `#000000` on white.** No tints except a single `#F2F2F2` table-header fill and a `#F2F2F2` total-row fill. No badges, no coloured text, no coloured rules |
| Status | Printed as a **word in the row**: `Unpaid`, `Partial`, `Paid`, `Delivered`, `Scheduled`, `Skipped`, `Jars out`. Where the screen shows `₹450 due` in an amber badge, the page shows `Partial — ₹450.00 due` in plain text |
| Emphasis | Weight and rules only. Semibold for totals and balances, 0.5pt rules for row separation, 1pt above a subtotal, 1.5pt above a grand total |
| Rules | 0.5pt `#000000` at 60% for body rows; solid black for totals. No vertical rules |
| Table | Header 8pt uppercase semibold on `#F2F2F2`, 6mm tall. Body rows 7mm. Cell padding 2mm vertical, 3mm horizontal. **No zebra** |
| Repeat | The table header repeats on every page (`thead` display table-header-group). Group headings repeat with `(continued)` appended |
| Page breaks | Never inside a row; never orphan a group heading; a subtotal never starts a page alone. Sections A/B/C start on a new page only when fewer than 40mm remain |
| Footer | 8pt, on every page: `Page 1 of 3` centred, document code left, `Generated 14 Aug 2026, 6:05 pm` right |
| Gujarati | Noto Sans Gujarati embedded as a subset, verified for conjunct and matra shaping with a real name and address. Gujarati lines get 16pt leading rather than 14pt, because matras sit above and below |
| Digits | Latin 0–9 in both languages, always |
| Signature block | On the staff statement only — see §12.2 |

**The shared header block** (top 35mm of page 1, header rules repeat as a 12mm compact band on pages 2+)

```
┌────────────────────────────────────────────────────────────────┐
│  MARUTI JAL                                                    │
│  Mineral Water Plant · Mehsana, Gujarat · 9876543210           │
│  ────────────────────────────────────────────────────────────  │
│  STAFF OUTSTANDING STATEMENT                                   │
│  Ramesh Patel · 9876543210                                     │
│  Period 01 Jul 2026 – 14 Aug 2026                              │
│  Generated 14 Aug 2026, 6:05 pm                    ORD/STF/12  │
└────────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Business name | Inter 16pt 700, letter-spacing 0.02em, uppercase |
| Business line | 8pt, `·` separated |
| Rule | 1pt solid black, 4mm below |
| Document title | 12pt 600 uppercase, 4mm below the rule |
| Subject line | 10pt — the staff member, the party, or the date |
| Period | 9pt: `Period 01 Jul 2026 – 14 Aug 2026`, or `For 14 Aug 2026` on the collection sheet |
| Generated | 8pt, always present — so a printed copy found in six months is not mistaken for current |
| Document code | 8pt mono, right-aligned on the same baseline |

### 12.2 Staff outstanding statement — print

```
[header block]

SUMMARY
Order balances            ₹48,600.00
Coin dues                 ₹12,400.00
                        ─────────────
TOTAL OWED                ₹61,000.00
Jars still out                   412   (118 out more than 7 days)

A · OPEN DELIVERY ORDERS
ORDER        DATE          TOTAL       PAID     BALANCE  STATUS   AGE
ORD-000098   22 Jul 2026  2,480.00  2,030.00     450.00  Partial  22 d
ORD-000104   28 Jul 2026  1,400.00         —   1,400.00  Unpaid   16 d
─────────────────────────────────────────────────────────────────────
Subtotal                 52,180.00  3,580.00  48,600.00

B · OPEN COIN ISSUES
ISSUE        DATE      ISSUED        RETURNED     PAID     PENDING
CIS-000045   29 Jul    400 / 5,000   50 / 500  1,000.00    3,500.00
─────────────────────────────────────────────────────────────────────
Subtotal                                                  12,400.00

C · JARS STILL OUT                (all jars out, any date)
PRODUCT        FROM ORDER   DATE OUT      QTY   DAYS OUT
20L Jar        ORD-000098   22 Jul 2026    18       22 d
20L Jar Cold   ORD-000112   05 Aug 2026    44        9 d
─────────────────────────────────────────────────────────────────────
Total                                     412

                        ─────────────
TOTAL AMOUNT OWED         ₹61,000.00


Received by ______________________    Date __________________
Ramesh Patel

Issued by ________________________    Date __________________
For Maruti Jal

Page 1 of 2                                  Generated 14 Aug 2026, 6:05 pm
```

| Element | Print-specific spec |
|---|---|
| Summary block | A 60mm-wide right-aligned label/value list at the top, **not** the screen's four-column band — a band of large figures reads as a poster; a settlement document needs a running total |
| `₹` symbol | Appears in the summary and total rows only. Table columns are headed `TOTAL (₹)` and drop the symbol per cell, which buys 4mm of column width across the page |
| Status column | Added to Section A, absent from the screen — the screen carries it as a badge colour, the page needs the word |
| Section C note | `(all jars out, any date)` on the heading line, 8pt |
| Total owed | 12pt semibold with a 1.5pt rule above, repeated at the foot of the last page even when Section C ends mid-page |
| Signature block | Two lines, 20mm apart, 15mm below the total, 8pt labels. `Received by` names the staff member under the rule; `Issued by` reads `For Maruti Jal` |
| Gujarati | With `રમેશ પટેલ` as the subject, the header subject line and every occurrence in the body render in Noto Sans Gujarati at 16pt leading. The signature block label stays in the document's language |
| Pages | Typically 2. Section headings repeat as `A · OPEN DELIVERY ORDERS (continued)` |

### 12.3 Party order statement — print

```
[header block: PARTY ORDER STATEMENT · Shreeji Wedding Hall
 PTY-000012 · 14–18 Aug 2026]

DELIVERY SCHEDULE
DAY  DATE          ITEM              QTY    RATE      AMOUNT   STATUS
 1   14 Aug 2026   20L Jar            80   40.00    3,200.00   Delivered
 2   15 Aug 2026   20L Jar           120   40.00    4,800.00   Delivered
 3   16 Aug 2026   20L Jar           100   40.00    4,000.00   Delivered
                   20L Jar Cold       40   45.00    1,800.00
 4   17 Aug 2026   20L Jar           120   40.00    4,800.00   Scheduled
 5   18 Aug 2026   20L Jar           150   40.00    6,000.00   Scheduled
──────────────────────────────────────────────────────────────────────
TOTAL PAYABLE                                     ₹24,800.00

PAYMENTS RECEIVED
DATE          MODE             NOTE                        AMOUNT
10 Aug 2026   Bank transfer    Advance                  10,000.00
15 Aug 2026   Cash                                       8,000.00
──────────────────────────────────────────────────────────────────────
TOTAL RECEIVED                                    ₹18,000.00

                        ═════════════
CLOSING BALANCE           ₹6,800.00

This statement covers the period shown above and reflects records as at
14 Aug 2026, 6:05 pm.

Page 1 of 1                            MARUTI JAL · PTY-000012
```

| Element | Print-specific spec |
|---|---|
| Audience | The only document an outsider reads. No internal codes beyond `PTY-000012`, no staff names, no assigned-to column — a client does not need to know who drove |
| Day cell | Number and date print once per day; extra item lines leave those cells blank rather than repeating |
| Status | Word in the last column. `Skipped` days print with `—` in the amount and are excluded from the total |
| Closing balance | 14pt semibold with a 1.5pt double rule above. When zero: `CLOSING BALANCE  ₹0.00 — fully paid`. When negative: `REFUND DUE  ₹600.00` |
| Closing note | 8pt sentence stating the period and the as-at timestamp — the sentence that stops an old printout being read as current |
| Language | Generated in the language chosen at export, independent of the UI language. Headings and labels come from the message catalogue; codes and figures never translate |
| Footer | Business name and the party order code, rather than a document code |

### 12.4 Daily collection sheet — print

```
[header block: DAILY COLLECTION SHEET · For 14 Aug 2026]

TIME     SOURCE            REFERENCE     FROM              MODE    AMOUNT
DELIVERY ORDER COLLECTIONS
09:20 am Delivery order    ORD-000131    Ramesh Patel      Cash  2,480.00
11:05 am Delivery order    ORD-000132    Suresh Chauhan    Coins 1,200.00
─────────────────────────────────────────────────────────────────────────
Subtotal                                     14 receipts        16,980.00

PARTY PAYMENTS
02:15 pm Party order       PTY-000012    Shreeji Wedding   Cash  5,000.00
─────────────────────────────────────────────────────────────────────────
Subtotal                                      3 receipts         8,200.00

WALK-IN SALES … COIN ISSUE PAYMENTS …
═════════════════════════════════════════════════════════════════════════
TOTAL COLLECTED                              31 receipts    ₹28,740.00

COINS RECEIVED, BY TYPE
COIN TYPE      PER COIN    COINS      VALUE
Blue Token        10.00      480   4,800.00
Green Token       20.00       60   1,200.00
Red Token          5.00       50     250.00
────────────────────────────────────────────
Total                        590   ₹6,250.00

CASH RECONCILIATION
Cash collected                              ₹22,490.00
UPI / bank transfer                                  —
                                          ─────────────
EXPECTED IN DRAWER                          ₹22,490.00

Counted _______________  Difference _______________

Checked by ______________________  Date __________________

Page 1 of 2                        MARUTI JAL · DCS-2026-08-14
```

| Element | Print-specific spec |
|---|---|
| Purpose on paper | This sheet is filled in by hand after printing — the drawer gets counted against it |
| Group headings | 9pt uppercase semibold on `#F2F2F2`, 6mm, spanning the full width |
| `Counted` / `Difference` | Two 40mm handwriting rules, 8pt labels, 12mm below the expected figure. **This is the whole reason the document is printed** |
| Checked-by block | One signature rule, 15mm below |
| Coins block | Kept visually separate with 8mm of space above, because coins are not drawer cash and the layout has to make that impossible to confuse |
| Document code | `DCS-2026-08-14` — date-derived, so two copies of the same day's sheet carry the same code |
| Empty groups | Print as the heading plus `No receipts` in 9pt italic. An absent group would read as a printing fault |

### 12.5 States (print pipeline)

| State | Presentation |
|---|---|
| Print preview | A full-screen overlay showing the paginated A4 at 100% with a page-count strip, `Print` and `Close` in a 64px bar. `⌘P` opens it, Escape closes |
| Generating | The export button shows a spinner, label becomes `Preparing PDF…`, both export buttons disable |
| Ready | Success toast `PDF ready · Staff statement, Ramesh Patel` with a `Download` action, 5s |
| Failed | Error toast, manual dismiss: `Couldn't generate the PDF` + reason + `Retry` |
| Font fallback failure | Blocking modal, not a toast: H4 `Gujarati text can't be rendered in this PDF`, Body SM `The Gujarati font didn't load, so names would print as empty boxes. The PDF was not generated.`, `[Try again]` primary + `[Export CSV instead]` secondary. Silently printing boxes is the failure this modal exists to prevent |
| Multi-page overflow | A statement above 20 pages prompts first: `This statement runs to 34 pages. Narrow the date range, or continue.` with `[Continue]` and `[Change filters]` |

### 12.6 Interactions

`🖨 Print` opens the preview; `Export PDF` downloads directly. Both use the same server-rendered document, so what previews is exactly what downloads. The language selector in the `⋯` menu applies to the document only. Browser print CSS: `@page { size: A4 portrait; margin: 20mm; }`, `@media print` hides the sidebar, topbar, filter panel and export bar entirely, and forces `-webkit-print-color-adjust: exact` only for the two grey fills.

### 12.7 Responsive

Not applicable — A4 is fixed. The **preview** is responsive: below `md` it fits the page to the viewport width with pinch-zoom, and the action bar becomes two full-width 44px buttons.

### 12.8 Dark mode

**The document is never dark.** Print and PDF output is black on white regardless of the app theme — a dark-mode PDF wastes toner and is unreadable in mono. The *preview overlay* follows the theme: `#0B1220` backdrop with the white A4 page floating on it, and a 1px `#334155` page border so the sheet's edge is visible.

### 12.9 Stitch prompt

```text
Design an A4 portrait printed business document — a "Staff outstanding statement"
for an Indian mineral-water plant. Pure black on white, 20mm margins, Inter 10pt
body, JetBrains Mono for every figure. No colour, no badges, no icons, no shading
except a light #F2F2F2 fill behind table header and total rows.

Header: "MARUTI JAL" in 16pt Inter Bold uppercase, letter-spaced; an 8pt line
"Mineral Water Plant · Mehsana, Gujarat · 9876543210"; a 1pt full-width black
rule; then "STAFF OUTSTANDING STATEMENT" in 12pt semibold uppercase, "Ramesh
Patel · 9876543210" at 10pt, "Period 01 Jul 2026 – 14 Aug 2026" at 9pt, and
"Generated 14 Aug 2026, 6:05 pm" at 8pt with "ORD/STF/12" right-aligned.

A narrow right-aligned summary list: "Order balances ₹48,600.00", "Coin dues
₹12,400.00", a short rule, "TOTAL OWED ₹61,000.00" in semibold, then "Jars still
out 412 (118 out more than 7 days)".

Three tables headed "A · OPEN DELIVERY ORDERS", "B · OPEN COIN ISSUES" and "C ·
JARS STILL OUT (all jars out, any date)". Each has an 8pt uppercase semibold
header row on #F2F2F2 and 7mm body rows separated by hairline rules — no vertical
rules, no zebra. Table A columns: ORDER, DATE, TOTAL (₹), PAID (₹), BALANCE (₹),
STATUS, AGE, with statuses written as the plain words "Partial" and "Unpaid",
never coloured pills, and money right-aligned in mono without a per-cell rupee
symbol. Each table closes with a ruled subtotal row.

At the foot, "TOTAL AMOUNT OWED ₹61,000.00" in 12pt semibold above a 1.5pt rule.
15mm below it, two signature blocks side by side: an underscore rule labelled
"Received by" with "Ramesh Patel" beneath, and one labelled "Issued by" with "For
Maruti Jal", each followed by a "Date" rule. Page footer in 8pt: "Page 1 of 2"
centred, timestamp right. Formal, dense, photocopier-proof.
```

---

## 13. Export bar

### 13.1 Purpose

The bottom of every report screen: what was generated, when, how big, and the two ways to take it away. Every list page in the app carries the CSV half of this in its page header; reports carry the full bar.

### 13.2 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Generated 14 Aug 2026, 6:05 pm · 8 rows      [⬇ Export CSV]      │
│                                              [⬇ Export PDF]      │
└──────────────────────────────────────────────────────────────────┘

Exporting:
│ Generated … · 8 rows           [⟳ Preparing CSV…]  [⬇ Export PDF] │
                                   ↑ disabled ─────────────────────

Failed:
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ Couldn't export the PDF                                        │
│   The report took too long to render. Narrow the date range and  │
│   try again.                                    [Retry]  [✕]     │
├──────────────────────────────────────────────────────────────────┤
│ Generated 14 Aug 2026, 6:05 pm · 8 rows  [⬇ Export CSV] [⬇ PDF]  │
└──────────────────────────────────────────────────────────────────┘
```

### 13.3 Region-by-region spec

| Element | Spec |
|---|---|
| Container | Card, 12px radius, 1px border, `shadow-sm`, 16px/24px padding, 24px above, full content width. Not sticky on desktop — it marks the end of the report |
| Left | Caption Gray 600: `Generated 14 Aug 2026, 6:05 pm · 8 rows`. Stale adds a Warning chip `⏱ from cache, 12 min ago` with a Nova Blue `Refresh` link |
| Buttons | Secondary, 40px, 8px radius, 1px `#D1D5DB` border, Gray 900 text, 16px `Download` leading icon, 12px apart, right-aligned |
| Labels | `Export CSV` · `Export PDF`. Never `Download` alone — the format is the decision |
| PDF availability | Only on daily collection, staff statement and party statement. On the other four the button is absent, with the Caption note `PDF isn't offered for this report — it's a working document, not one that gets handed over.` |
| Print | `🖨 Print` lives in the page header, not the export bar, because it is an action on the current view rather than a file |
| CSV encoding | UTF-8 **with a byte-order mark**. Without the BOM, Excel on Windows renders `રમેશ પટેલ` as mojibake while every other tool looks fine, and it gets reported as a broken export weeks later |
| Filename | `maruti-jal_staff-outstanding_ramesh-patel_2026-07-01_2026-08-14.csv` — report, subject, range. Gujarati subjects transliterate to Latin in the filename only |
| CSV content | Respects every applied filter, includes group and subtotal rows as real rows with a `row_type` column (`data` / `subtotal` / `total`), and carries a 4-line header block: report name, filters, generated timestamp, row count |
| Row count | Reflects data rows only, excluding subtotals: `8 rows` |

### 13.4 Content and copy

`Generated 14 Aug 2026, 6:05 pm · 8 rows` · `Export CSV` · `Export PDF` · in flight `Preparing CSV…` / `Preparing PDF…` · toast success `CSV ready · 8 rows` with `Download`, 5s · `PDF ready · Staff statement, Ramesh Patel` with `Download`, 5s · errors: `Couldn't export the CSV` / `The report took too long to render. Narrow the date range and try again.` · `Couldn't export the PDF` / `Gujarati text can't be rendered in this PDF. The font didn't load.` · `Nothing to export` / `Run a report with at least one row first.` · large export warning `This export contains 12,480 rows and may take a minute.` with `[Continue]` `[Cancel]`.

### 13.5 States

| State | Presentation |
|---|---|
| **Idle** | Both buttons enabled |
| **Disabled** | Before a report has run, or when it returned zero rows: 40% opacity, `not-allowed` cursor, tooltip `Run a report with at least one row first.` |
| **Exporting** | The pressed button's icon becomes a spinner and its label becomes present tense — `Preparing CSV…`. **Both** buttons disable, so a second export cannot be started. The report itself stays fully readable and scrollable |
| **Progress** | Above 3 seconds, a 2px indeterminate Nova Blue bar appears along the bar's bottom edge. Above 10 seconds the label gains a Caption sub-line `Still working — large reports can take a minute.` |
| **Success** | Buttons return to idle; the file downloads; an Info toast appears bottom-right with a `Download` action for browsers that blocked it |
| **Error** | A Danger banner slides in **above** the export bar — `#FEE2E2`, 1px `#EF4444`, 12px radius, 16px padding, 20px `AlertTriangle`, bold reason line, plain-language explanation, `Retry` secondary and a `✕`. Buttons return to idle. The report stays on screen; an export failure never costs the run |
| **Partial failure** | PDF succeeded, CSV failed, or the reverse: only the failing format's error shows, and the successful download still happens |
| **Offline** | Both buttons disabled with the tooltip `You're offline. Reconnect to export.` |

### 13.6 Interactions

Click starts the export immediately — no format dialog, because the button *is* the format. Above 5,000 rows a 420px confirm appears first with the row count. `⌘/Ctrl + E` exports CSV from any report or list screen. The success toast's `Download` re-triggers the same file without regenerating it, for 10 minutes. Retry re-uses the same filters; it never silently changes the range. Focus returns to the pressed button after a success or a failure, so keyboard users are not stranded.

### 13.7 Responsive

Below `md` the bar becomes **sticky to the bottom of the viewport** with a 1px top border and a `shadow-lg` upward — on a phone the report scrolls long and the export must remain reachable. The generated line moves above the buttons in Caption, and the two buttons sit side by side at 50% width each, 44px tall. When only CSV is available it spans the full width.

### 13.8 Dark mode

Bar `#1E293B` on `#0B1220`, 1px `#334155` border. Buttons: transparent fill, 1px `#334155` border, `#F1F5F9` text; hover `#334155` fill. Caption `#94A3B8`. Error banner `#7F1D1D` fill, 1px `#EF4444` border, `#FECACA` text. The indeterminate progress bar `#3B82F6`.

### 13.9 Stitch prompt

```text
Design an export bar for the bottom of a business report screen, light mode,
Inter font. A white card, 12px corner radius, 1px #E5E7EB border, subtle shadow,
16px vertical and 24px horizontal padding, spanning the content width.

Left side, vertically centred: 12px #4B5563 text reading "Generated 14 Aug 2026,
6:05 pm · 8 rows". Right side: two outlined buttons 12px apart, each 40px tall
with an 8px radius, a 1px #D1D5DB border, #111827 label and a 16px download icon
before the text — "Export CSV" and "Export PDF".

Show four variants stacked vertically so the states are comparable:
1. Idle, as described.
2. Exporting: the "Export CSV" button shows a small spinner in place of the
   download icon and reads "Preparing CSV…"; both buttons are dimmed to 40%
   opacity; a 2px blue indeterminate progress bar runs along the bottom edge of
   the card.
3. Disabled: both buttons at 40% opacity with a small grey tooltip above reading
   "Run a report with at least one row first."
4. Error: directly above the bar, a #FEE2E2 banner with a 1px #EF4444 border,
   12px radius, 16px padding, a 20px alert-triangle in #B91C1C, the bold line
   "Couldn't export the PDF" in #B91C1C and beneath it "The report took too long
   to render. Narrow the date range and try again." in #7F1D1D, with a small
   outlined "Retry" button and an "✕" close icon on the right.

Also show the mobile version: the same bar pinned to the bottom of a narrow
viewport with a 1px top border and an upward shadow, the grey generated line on
its own row above two 44px-tall buttons sitting side by side at half width each.
```

---

## Module design checklist

- [ ] Every report screen follows the archetype: filter panel → summary band → report table → export bar
- [ ] Page header carries a title **and** a subtitle that restates the applied filters in prose
- [ ] Summary band values are 20px mono 600 — not 28px; that size belongs to the dashboard and to the P&L net figure alone
- [ ] Money right-aligned, mono, `₹`, 2 decimals, em dash for zero, parentheses and Danger for negative
- [ ] Every group row is a heading **and** a subtotal; grand totals recompute rather than averaging averages
- [ ] Report tables scroll horizontally on mobile with the first column pinned — they never become cards
- [ ] Every row that owns a record links to it; the client-facing party statement deliberately does not
- [ ] Nothing on any report screen writes. `Record payment` navigates; it never opens a modal
- [ ] All states designed: prompt, loading, re-run, empty, partial, filled, error, stale, exporting, export failed
- [ ] Filters live in the URL; the view is shareable and browser back works
- [ ] The three printed documents are designed as A4 documents, not screenshots — 20mm margins, 10pt Inter, black on white
- [ ] **Status prints as a word, never as a colour**
- [ ] Business header, period, generation timestamp and `Page n of m` on every printed page
- [ ] Table headers repeat across pages; group headings repeat with `(continued)`; rows never split
- [ ] Signature and handwriting blocks present where the document is filled in by hand
- [ ] Gujarati font embedded and shaping verified; Gujarati lines get 16pt leading; the PDF fails loudly rather than printing boxes
- [ ] CSV is UTF-8 **with a BOM**, respects the applied filters, and names its file after the report, subject and range
- [ ] PDF offered only on the three printed reports, with the reason stated on the other four
- [ ] Export bar sticky to the viewport bottom below `md`
- [ ] Designed in both light and dark; the printed document is never dark
- [ ] Figures use Latin digits in both languages
- [ ] Icons drawn from the §17 map
