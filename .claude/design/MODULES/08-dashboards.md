# Module 08 — Dashboards · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/08-dashboards.md](../../MODULES/08-dashboards.md)

---

## 1. Design context (for Stitch)

**Product.** Maruti Jal — an internal admin web app for a mineral-water plant in Gujarat, India. One user: the owner. Opened many times a day, often on a phone in a vehicle on the way to the plant. Data-dense business tool, not a consumer app.

**Colour — light / dark**

| Token | Light | Dark |
|---|---|---|
| Primary — Nova Blue | `#2563EB` | `#3B82F6` |
| Surface (card) | `#FFFFFF` | `#1E293B` |
| Page background | `#F8FAFC` | `#0B1220` |
| Surface subtle (table header, band) | `#F3F4F6` | `#1E293B` |
| Text primary | `#111827` | `#F1F5F9` |
| Text secondary | `#4B5563` | `#94A3B8` |
| Border | `#E5E7EB` | `#334155` |
| Success | `#22C55E` | `#34D399` |
| Warning | `#F97316` | `#FB923C` |
| Danger | `#EF4444` | `#F87171` |

Badge pairs (bg / text): Default `#E5E7EB`/`#374151` · Primary `#DBEAFE`/`#1D4ED8` · Success `#DCFCE7`/`#15803D` · Warning `#FEF3C7`/`#B45309` · Danger `#FEE2E2`/`#B91C1C`. Dark: `#334155`/`#E2E8F0` · `#1E3A8A`/`#BFDBFE` · `#14532D`/`#BBF7D0` · `#7C2D12`/`#FED7AA` · `#7F1D1D`/`#FECACA`.

**Type.** Inter for text, JetBrains Mono `tabular-nums` for every figure, Noto Sans Gujarati in the fallback stack. H1 36/1.2/700 (dashboard greeting only) · H2 28/1.3/600 page title · H3 22/1.4/600 card heading · H4 18/1.4/600 · Body 16/1.6/400 · Body SM 14/1.5/400 (most of the app) · Caption 12/1.4/500.

**Spacing.** 4 · 8 · 12 · 16 · 24 (card padding, grid gap) · 32 (section gap). Nothing larger.

**Radius / elevation.** Input 4px · button, chip 8px · card and table container 12px + 1px border + `shadow-sm` · modal 12px + `shadow-xl`. **Cards never lift on hover.**

**Layout.** Sidebar 240px · topbar 64px sticky · content max-width 1440px · content padding 24px (16px below `md`) · section gap 32px · card grid gap 24px. Breakpoints sm 640 · md 768 · lg 1024 · xl 1280.

**KPI card anatomy.** Card, 20px padding, 12px radius, 1px border, `shadow-sm`. Line 1: 16px Lucide icon Gray 400 + Caption 12/600 uppercase `0.04em` Gray 600 label. Line 2 (8px below): **value in 28px JetBrains Mono 700**, Gray 900. Line 3: Caption trend with `TrendingUp`/`TrendingDown`. Line 4: Caption Gray 600 breakdown, `·` separated. Whole card is clickable; hover fades the border to Nova Blue at 40% over 100ms. **Alert variant:** 3px Spark Red left border, value in Danger.

**Chart palette.** Categorical order, never cycled: `#2563EB` → `#F97316` → `#14B8A6` → `#22C55E` → `#8B5CF6`. Purple sits last deliberately — against Nova Blue it separates by only ΔE 2.3 under protanopia, so it must never be the second hue reached for. **Semantic assignments override the sequence:** Revenue/Cash = Nova Blue · Expenses/Party = Spark Orange · Coins = Teal · Profit/Walk-in = Spark Green · Outstanding = Spark Red. Ranked bar charts (top-N) use a **single hue with direct labels**, not the categorical sequence. Grid: 1px horizontal only in border colour, no vertical lines. Axes: Caption Gray 600, ticks only, no axis line. Y-axis money abbreviated (`₹30K`, `₹4L`), full value in the tooltip. Bars 4px top radius, 60% category width. Lines 2px, dots only on hover. Areas 12% fill. Chart height 280px, 320px with a legend.

**Money and dates — non-negotiable.** `₹` + Indian lakh grouping + 2 decimals in tables (`₹12,34,567.00`). Zero renders as an em dash `—` in Gray 300, never `₹0.00`. Negative in parentheses with Danger text: `(₹500.00)`. KPI values drop paise and abbreviate above ₹1 lakh: `₹1.85L`, `₹1.24Cr`, with the exact figure in the hover tooltip. Quantities grouped, no decimals: `1,247`. Dates `14 Aug 2026`; today and yesterday render as `Today` / `Yesterday`. Time `6:05 pm`. Ageing in plain days — `8 days ago` — Spark Orange past 7, Spark Red past 15. **Digits are always Latin 0–9, in both languages.**

**Bilingual.** Every label has a Gujarati counterpart that runs 20–40% longer and taller. Nothing is width-locked to its English string; KPI labels wrap to two lines, chart legends wrap to two rows. Figures never change.

**Icons.** Lucide, 1.5px stroke. Dashboard `LayoutDashboard` · Staff `Users` · Delivery order `ClipboardList` · Product `Package` · Coin `Coins` · Coin ledger `BookOpen` · Party `PartyPopper` · Direct sale `Droplet` · Expense `Receipt` · Payment `Banknote` · Cash `Wallet` · Return `RotateCcw` · Jars out `PackageX` · Report `FileBarChart` · Filter `SlidersHorizontal` · Export `Download`.

**The five principles that override generic taste.** ① Density over whitespace — 48px table rows, tight cards. ② Numbers are the interface — figures get more weight than the labels beside them. ③ Status is scannable without reading — red is money or jars outstanding, amber is partial, green is settled. ④ **Every number is a door** — every KPI, badge count and chart segment navigates to a filtered list. ⑤ Entry speed is a feature.

---

## 2. Screens in this module

| Screen | Route | Archetype | Purpose |
|---|---|---|---|
| Executive dashboard | `/` | **D — Dashboard** | The whole business on one page: today, money at risk, trends, what needs doing |
| Global date filter | component, on `/` | — | Scopes rows 1 and 3 to a period. Never rows 2 and 4 |
| Coin reconciliation banner | component, on `/` | — | Non-dismissible alarm when a coin type's cached balance disagrees with its ledger |
| Module KPI strip | component, on all 8 module list pages | part of **A — List** | Three to five cards answering "what's happening in *this* area today" |

---

## 3. Executive dashboard — `/`

### 3.1 Purpose

Answer four questions without scrolling past the second row: *how much came in today, how much is at risk, is the trend healthy, what needs doing right now.* This screen replaces the moment the owner used to spend flipping between four registers. Every figure on it is a link into the record set behind it.

The greeting line is the only H1 in the entire application.

### 3.2 Layout — desktop (`xl`, 1440px content)

```
┌────────────┬──────────────────────────────────────────────────────────────────┐
│ Maruti Jal │ Dashboard                    [🔍 ⌘K] [EN|ગુ] [☀] [Avatar ▾]     │
├────────────┼──────────────────────────────────────────────────────────────────┤
│ ● Dashboard│                                                                  │
│            │  Good morning                                                    │
│ OPERATIONS │  Friday, 14 Aug 2026 · Updated 6:05 pm    [Today ▾] [↻ Refresh]  │
│  Delivery 6│                                                                  │
│  Coin Issue│  ┌────────────────────────────────────────────────────────────┐  │
│  Party Ord.│  │ 🛑  Blue Token balance doesn't match its ledger            │  │
│  Direct Sl.│  │     Cached 2,440 coins · Ledger 2,390 coins · Diff 50      │  │
│            │  │     (₹500.00). Recorded since 12 Aug 2026, 4:20 pm.        │  │
│ MASTERS    │  │                          [Open Blue Token ledger]          │  │
│  Staff     │  └────────────────────────────────────────────────────────────┘  │
│  Products  │                                                                  │
│  Coin Types│  TODAY                                                           │
│  Exp. Cats.│  ┌─────────────┐┌─────────────┐┌─────────────┐┌─────────────┐   │
│            │  │💧 REVENUE   ││💰 COLLECTION││🧾 EXPENSES  ││📈 NET       │   │
│ MONEY      │  │             ││             ││             ││             │   │
│  Expenses  │  │ ₹32,180     ││ ₹28,740     ││ ₹6,320      ││ ₹22,420     │   │
│  Payments  │  │ ▲ 8.4% v yd ││ ▲ 4.1% v yd ││ ▲ 11.2% v yd││ ▲ 2.6% v yd │   │
│            │  │ Del ₹21,450 ││ Cash ₹22,490││ 7 entries   ││ Coll − Exp  │   │
│ INSIGHTS   │  │ Pty ₹8,200  ││ Coins ₹6,250││ Top: Fuel   ││             │   │
│  Reports   │  │ Walk ₹2,530 ││             ││             ││             │   │
│  Coin Ldgr │  └─────────────┘└─────────────┘└─────────────┘└─────────────┘   │
│            │                                                                  │
│            │  MONEY AT RISK                              Current, not period  │
│            │  ┏━━━━━━━━━━━━━┓┏━━━━━━━━━━━━━┓┏━━━━━━━━━━━━━┓┏━━━━━━━━━━━━━┓   │
│            │  ┃💵 STAFF CASH┃┃🎉 PARTY DUES┃┃🪙 COIN DUES ┃┃📦 JARS OUT  ┃   │
│            │  ┃ ₹1.85L      ┃┃ ₹96,400     ┃┃ ₹42,800     ┃┃ 1,247       ┃   │
│            │  ┃ 23 orders   ┃┃ 6 parties   ┃┃ 9 issues    ┃┃ 🔴 312 out  ┃   │
│            │  ┃ Oldest 22 d ┃┃ Oldest 31 d ┃┃ Oldest 18 d ┃┃    7+ days  ┃   │
│            │  ┗━━━━━━━━━━━━━┛┗━━━━━━━━━━━━━┛┗━━━━━━━━━━━━━┛┗━━━━━━━━━━━━━┛   │
│            │                                                                  │
│            │  ┌── Revenue trend · last 30 days ──┐┌── Revenue vs expenses ───┐│
│            │  │ ₹40K┤       ▁▃█▂             │ │ ₹6L┤  ▌▌   ▌▌   ▌▌  ▌▌  ││
│            │  │ ₹20K┤ ▂▄█▆▃█████▅▃▄█▆▂▄██▅▃  │ │ ₹3L┤ ▌▌▌ ▌▌▌ ▌▌▌ ▌▌▌ ●─● ││
│            │  │   ₹0└─────────────────────── │ │  ₹0└──────────────────── ││
│            │  │  16 Jul   26 Jul   05 Aug 14 │ │  Mar Apr May Jun Jul Aug ││
│            │  │  ● Delivery ● Party ● Walk-in│ │ ▌Revenue ▌Expenses ●Profit││
│            │  └──────────────────────────────┘└──────────────────────────┘│
│            │                                                                  │
│            │  ┌── Top 5 products · Aug 2026 ─────┐┌── Collection mix · Aug ──┐│
│            │  │ 20L Jar        ████████ 12,480 u││ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░     ││
│            │  │ 20L Jar Cold   █████ 7,220 u    ││ Cash  ₹8,42,300    72.4% ││
│            │  │ 1L Bottle      ███ 4,860 u      ││ Coins ₹3,21,150    27.6% ││
│            │  │ 10L Jar        ██ 2,940 u       ││ ─────────────────────────││
│            │  │ 500ml Bottle   █ 1,610 u        ││ Total ₹11,63,450         ││
│            │  └─────────────────────────────────┘└──────────────────────────┘│
│            │                                                                  │
│            │  ┌── Staff scoreboard · Aug 2026 ──────────────────[View all]──┐ │
│            │  │ STAFF      ORDERS  REVENUE   CASH OUT   JARS  COIN DUES     │ │
│            │  │ Ramesh Patel  38  ₹1,42,300  ₹48,600 🔴 412  ₹12,400        │ │
│            │  │ 9876543210                                                  │ │
│            │  │ Suresh Chauhan 31 ₹1,08,750  ₹31,200 🟠 268  ₹8,600         │ │
│            │  │ રમેશ પટેલ      27   ₹94,120  ₹22,450 🟠 197       —         │ │
│            │  │ Jayesh Solanki 24   ₹81,900  ₹14,800    142  ₹6,200         │ │
│            │  │ Kiran Vaghela  19   ₹63,400   ₹9,750    118       —         │ │
│            │  └─────────────────────────────────────────────────────────────┘ │
│            │                                                                  │
│            │  ┌── Coin position ──────────────┐┌── Attention needed  12 ────┐ │
│            │  │ COIN     STOCK  OUT   VALUE   ││ 🔴 Ramesh Patel · ₹8,400   │ │
│            │  │ Blue Tkn 2,440  860 ₹24,400 ›││    unpaid 22 days ORD-000098│ │
│            │  │ Green Tk 1,180  240 ₹23,600 ›││ 🔴 118 jars out 18 days     │ │
│            │  │ Red Tkn    620   90  ₹3,100 ›││    Suresh Chauhan · ORD-000..│ │
│            │  └───────────────────────────────┘│ 🟠 CIS-000045 unsettled 16 d│ │
│            │                                   │ 🔵 Shreeji Wedding Hall today│ │
│            │  ┌── Today's party schedule ──────┴─────────────────────────────┐ │
│            │  │ PARTY                  ITEMS          STAFF     TOTAL  STATUS│ │
│            │  │ Shreeji Wedding Hall   20L Jar × 80   Ramesh   ₹3,200 🔵 Sch.│ │
│            │  │ PTY-000012 · Day 2 of 3                        [Mark delivrd]│ │
│            │  │ Umiya Mandap Service   20L Jar × 50   Jayesh   ₹2,000 🟢 Del.│ │
│            │  └──────────────────────────────────────────────────────────────┘ │
└────────────┴──────────────────────────────────────────────────────────────────┘
```

### 3.3 Region-by-region spec

#### 3.3.1 Page header

| Element | Spec | Content |
|---|---|---|
| Greeting | **H1 36px/1.2/700**, Gray 900. The only H1 in the app. Time-based: before 12 pm / before 5 pm / after | `Good morning` |
| Meta line | Body SM 14px Gray 600, 8px below, `·` separated | `Friday, 14 Aug 2026 · Updated 6:05 pm` |
| Stale marker | When the cache is older than 5 minutes, the meta line appends a Warning chip, 22px, Caption | `Updated 6:05 pm` + `⏱ 12 min ago` |
| Date filter | Right-aligned, 40px segmented control + custom popover — see §4 | `Today` selected |
| Refresh | 40px secondary icon button, Lucide `RotateCw`, 16px, `aria-label="Refresh dashboard"` | tooltip `Refresh` |
| Header bottom margin | 24px | |

#### 3.3.2 Row 1 — Today (standard KPI cards)

Grid: 4 columns on `xl` and `lg`, 2 on `md`, 1 below. 24px gap, equal heights (align by grid, not by fixed height — Gujarati labels wrap to two lines).

| # | Icon | Label | Value (28px mono 700) | Trend | Breakdown | Click destination |
|---|---|---|---|---|---|---|
| 1 | `Droplet` | `TODAY'S REVENUE` | `₹32,180` | `▲ 8.4% vs yesterday`, Spark Green | `Delivery ₹21,450 · Party ₹8,200 · Walk-in ₹2,530` — each segment is its own link | `/orders?date=2026-08-14` · segments → `/orders?date=…`, `/party-orders?delivery_date=…`, `/direct-sales?date=…` |
| 2 | `Wallet` | `TODAY'S COLLECTION` | `₹28,740` | `▲ 4.1% vs yesterday`, Spark Green | `Cash ₹22,490 · Coins ₹6,250` | `/reports/daily-collection?date=2026-08-14` |
| 3 | `Receipt` | `TODAY'S EXPENSES` | `₹6,320` | `▲ 11.2% vs yesterday` — **Spark Red**, because up is bad here | `7 entries · Top: Fuel ₹2,800` | `/expenses?date=2026-08-14` |
| 4 | `TrendingUp` | `TODAY'S NET` | `₹22,420` | `▲ 2.6% vs yesterday`, Spark Green | `Collection − expenses` | `/reports/profit-loss?from=2026-08-14&to=2026-08-14` |

Rules: the value tooltip on hover shows the unabbreviated figure with paise (`₹32,180.00`). A negative net renders `(₹4,120)` in Spark Red with the card's left border turning 3px Spark Red — the alert variant applies to net whenever it is below zero, on any period. Trend comparison text changes with the filter: `vs yesterday` → `vs last week` → `vs last month` → `vs previous period` for custom ranges.

#### 3.3.3 Row 2 — Money at risk (ALERT variant KPI cards)

A section label sits above the grid: Caption 12px 600 uppercase `0.04em` Gray 600, `MONEY AT RISK`, with a right-aligned Caption Gray 600 note `Current position — not affected by the date filter`. That note is load-bearing: without it the owner will assume the ₹1.85L is a today figure.

All four cards use the **alert variant**: 3px Spark Red left border, value in Spark Red `#EF4444` (dark `#F87171`), card background unchanged. When a card's value is zero it drops to the standard variant, value `₹0` in Gray 400 with the context line `Nothing outstanding` — the border returns to 1px Gray 200.

| # | Icon | Label | Value | Sub-line 1 | Sub-line 2 | Click destination |
|---|---|---|---|---|---|---|
| 1 | `Banknote` | `CASH OUTSTANDING FROM STAFF` | `₹1.85L` (tooltip `₹1,84,650.00`) | `Across 23 orders · 5 staff` | `Oldest 22 days` in Spark Red | `/orders?payment_status=UNPAID,PARTIAL&sort=balance&dir=desc` |
| 2 | `PartyPopper` | `OUTSTANDING FROM PARTIES` | `₹96,400` | `Across 6 party orders` | `Oldest 31 days` in Spark Red | `/party-orders?payment_status=UNPAID,PARTIAL&sort=outstanding&dir=desc` |
| 3 | `Coins` | `COIN DUES FROM STAFF` | `₹42,800` | `Across 9 open issues` | `Oldest 18 days` in Spark Red | `/coins/issues?settlement=UNSETTLED&sort=pending&dir=desc` |
| 4 | `PackageX` | `TOTAL JARS OUT` | `1,247` | **`🔴 312 out 7+ days`** — Danger badge, 22px, `AlertTriangle` 12px leading icon, its own click target | `Across 41 orders · 5 staff` | card → `/orders?return_status=NOT_RETURNED,PARTIAL` · badge → `/orders?return_status=NOT_RETURNED,PARTIAL&age_gt=7` |

The jars-out card is the only KPI in the app carrying a nested link. Give the sub-count badge 8px of vertical padding so it clears the 44×44px touch minimum, and stop click propagation so tapping it does not also fire the card link.

#### 3.3.4 Row 3 — Charts

2×2 grid, 24px gap. Each chart lives in a card: 12px radius, 1px border, `shadow-sm`, 24px padding. Card header is H3 22px 600 Gray 900 with a Caption Gray 600 period sub-label on the next line, and a right-aligned `⋯` menu (`View as table`, `Download PNG`, `Open full report`).

> **Colour-vision note, computed not guessed.** In the system palette the Spark Green ↔ Spark Orange pair separates by only ΔE 6.2 under deuteranopia — the floor band. It is legal **only** with secondary encoding. Every chart below that uses both hues therefore carries: a 2px surface-colour gap between touching fills, a legend, direct labels, and a `View as table` fallback. Orange, green and teal also fall below 3:1 contrast against a white surface, which is why the labels are mandatory rather than decorative.

**C1 — Revenue trend, last 30 days, stacked by channel**

| Property | Spec |
|---|---|
| Form | Stacked columns. 30 daily categories, one column each |
| Plot height | 280px; card total ~360px with header and legend |
| Series & stack order (bottom → top) | `Delivery` `#2563EB` · `Party` `#F97316` · `Walk-in` `#22C55E` |
| Column | 60% of the 21px category band ≈ 12px wide, 4px radius on the **top of the topmost segment only**, square everywhere else |
| Segment separation | **2px gap in the surface colour** between every stacked segment — this is the mandated secondary encoding, not decoration |
| X axis | Caption 12px Gray 600, ticks only, no axis line. Labels every 5th day: `16 Jul` `21 Jul` `26 Jul` `31 Jul` `05 Aug` `10 Aug` `14 Aug`. Below `lg`, every 7th |
| Y axis | 4 ticks: `₹0` `₹10K` `₹20K` `₹30K` `₹40K`. Caption Gray 600, right-padded 8px |
| Grid | 1px horizontal only, `#E5E7EB` (`#334155` dark). No vertical lines, never dashed |
| Hover | The hovered column's band gets a `#F3F4F6` wash (`#1E293B` dark) at 100ms; segments stay at full opacity, non-hovered columns drop to 55% |
| Tooltip | Card, 12px radius, 1px border, `shadow-lg`, 12px padding, min-width 220px. Header: `Wed 12 Aug 2026`, Caption 600 Gray 900, 1px divider below. Three rows: 8px round dot + series label (Body SM Gray 600, left) + value (14px mono 500 Gray 900, right). 1px divider. Total row: label 600, value 14px mono 600. Follows the cursor, flips side within 200px of the viewport edge |
| Legend | Below the plot, 12px round dots, 8px gap to the Caption label, 16px between entries. Click toggles a series: dot becomes a 1px hollow ring, label Gray 400, the stack re-computes with a 200ms height transition. At least one series always stays on — the last active one is not clickable |
| Direct label | The single tallest column carries its total above the bar in 12px mono 600 Gray 900, e.g. `₹41,280` |
| Click | Click a segment → that channel's list filtered to that date. Click the column background → `/reports/daily-collection?date=2026-08-12` |
| Empty | Axes drawn with real ticks, plot area blank, centred Caption Gray 600: `No sales recorded in this period. Try widening the date range.` |
| Loading | Axes and gridlines drawn in final position, plot area a shimmering `#F3F4F6` block at 1.5s, legend rendered with grey pills |

**C2 — Revenue vs expenses, last 6 months, with profit line**

| Property | Spec |
|---|---|
| Form | Grouped columns + overlaid line. **One y-axis.** All three series are rupees, so a second scale is never introduced — a dual axis is the one chart mistake this system refuses outright |
| Plot height | 320px (has a legend) |
| Series | `Revenue` columns `#2563EB` · `Expenses` columns `#F97316` · `Profit` line `#22C55E`, 2px, round joins, no dots until hover, 8px end-dot with a 2px surface-colour ring |
| Grouping | Two columns per month, 18px each, 2px surface gap between the pair, 60% band occupancy |
| Secondary encoding | Expenses (orange) and Profit (green) are the low-ΔE pair — they are separated here by **mark type** (column vs line) plus a direct end label, not by hue alone |
| X axis | `Mar` `Apr` `May` `Jun` `Jul` `Aug`, Caption Gray 600. Year appears once under the first tick: `Mar 2026` |
| Y axis | `₹0` `₹2L` `₹4L` `₹6L`. When any profit is negative the axis extends below zero and a 1px Gray 400 zero rule is drawn across the plot |
| Direct label | Profit value at the line's right end, 12px mono 600. Positive Gray 900, negative Spark Red in parentheses: `(₹12,400)` |
| Tooltip | Header `Aug 2026`. Rows: Revenue, Expenses, Profit, then a divider and `Margin 34.2%` in Caption. Negative margin in Spark Red |
| Legend | `▌ Revenue` `▌ Expenses` `─ Profit` — the profit key is a 12×2px line segment, not a dot, so the mark type reads in the legend too |
| Click | Click a month group → `/reports/profit-loss?from=2026-08-01&to=2026-08-31` |
| Empty | `No revenue or expenses recorded in the last 6 months.` |

**C3 — Top 5 products this month, by volume**

| Property | Spec |
|---|---|
| Form | Horizontal bars, sorted descending. **A single hue** — Nova Blue `#2563EB` — because the rank is not the identity. Colour follows the entity; a filter that reorders the list must never repaint it |
| Rows | 5 bars, 20px thick, 4px radius on the right (data) end, square at the left baseline, 16px vertical gap. Plot height 180px, card 280px |
| Left gutter | 160px. Product title Body SM 500 Gray 900, truncated with a full-text tooltip. Caption Gray 600 below with total litres: `2,49,600 L` |
| Bar labels | Value at the tip, outside the bar, 12px mono 600 Gray 900: `12,480 units`. If the bar is within 80px of the plot's right edge, the label moves inside and flips to white |
| Axis | No x-axis ticks and no gridlines — 5 labelled bars need neither. The scale is set by the longest bar at 100% of plot width |
| Tooltip | `20L Jar` header, then `Units 12,480` · `Litres 2,49,600` · `Revenue ₹4,36,800` · `Delivery 71% · Party 22% · Walk-in 7%` |
| Legend | None — a single series is named by the chart title |
| Click | Bar or label → `/products/[id]` (Movement tab). Card menu → `/reports/product-movement?from=2026-08-01&to=2026-08-31` |
| Empty | `No products sold this month yet.` |

**C4 — Collection mix this month, cash vs coins**

| Property | Spec |
|---|---|
| Form | One 100% stacked horizontal bar plus a two-row figure legend. Two categories do not warrant a pie — the bar plus the numbers is denser and reads exactly |
| Bar | Full card width, 32px tall, 8px radius on the outer ends only, square where the two fills meet, with a **2px surface-colour gap** between them |
| Series | `Cash` `#2563EB` · `Coins` **`#14B8A6`** — teal, not purple. The blue↔purple pair separates by only ΔE 2.3 under protanopia and fails outright; blue↔teal clears at ΔE 25.6 |
| In-bar labels | `72.4%` and `27.6%` in 12px mono 600 white, centred in their segment, drawn **only** when the segment is at least 56px wide; below that the label moves to the figure legend alone |
| Figure legend | Two rows below the bar, 12px dot + label left, `₹8,42,300` in 14px mono 600 right, `72.4%` in Caption Gray 600 in a third column. Then a 1px top border and a `Total ₹11,63,450` row in 14px mono 600 |
| Tooltip | On each segment: `Cash · ₹8,42,300.00 · 72.4% of ₹11,63,450.00 · 1,284 payments` |
| Click | Cash segment → `/payments?mode=CASH&from=2026-08-01&to=2026-08-31`. Coins segment → `/coins/ledger?direction=IN&from=2026-08-01&to=2026-08-31` |
| Empty | `No collections recorded this month.` |

#### 3.3.5 Row 4 — Operational tables

All four use the standard table container: 12px radius, 1px border, `shadow-sm`, `overflow: hidden`. Header row 44px, subtle background, Caption 12px 600 uppercase `0.04em` Gray 600. Body rows 48px, 1px bottom border, Body SM, hover `#F3F4F6`. Money right-aligned mono, quantities right-aligned mono, badges centred. Card heading H3 with a Caption period sub-label, and a right-aligned Body SM Nova Blue link.

**T1 — Staff scoreboard** — the single most useful table in the app. Full content width on `lg`, so it gets its own row.

| Column | Align | Rendering | Sortable |
|---|---|---|---|
| `STAFF` | left | Name Gray 900 500 with phone in Caption Gray 600 below — two lines inside the 48px row. Gujarati names render at the same row height | ✓ |
| `ORDERS` | right | `38` mono | ✓ |
| `REVENUE` | right | `₹1,42,300.00` mono 500 | ✓ |
| `CASH OUT` | right | `₹48,600.00` mono **600** Gray 900. Zero → `—` Gray 300 | ✓ default, desc |
| `JARS OUT` | right | `412` mono 600 with a 6px leading dot: Spark Red when any are 7+ days old, Spark Orange when 1–6 days, no dot when zero and the cell shows `—` | ✓ |
| `COIN DUES` | right | `₹12,400.00` mono 500, `—` when nil | ✓ |
| — | — | Whole row navigates to `/staff/[id]` | |

Shows the top 8 by cash outstanding; footer link `View all staff ›` → `/staff?sort=outstanding_cash&dir=desc`. Sorting is client-side over the loaded 8 with a Caption note `Sorted within the top 8 · View all staff for the full list` — this prevents the owner mistaking a re-sort for a full ranking.

**T2 — Coin position** — half width.

| Column | Rendering |
|---|---|
| `COIN TYPE` | `Blue Token` Gray 900 500, Caption below: `100 per packet · ₹10.00 each` |
| `IN STOCK` | `2,440` mono right, Caption below `24.4 packets` |
| `OUT WITH STAFF` | `860` mono right, Spark Orange when above zero |
| `VALUE IN STOCK` | `₹24,400.00` mono 600 right |
| `›` | 16px `ChevronRight` Gray 400, 40px fixed column |

Row click → `/coins/types/[id]` on the Ledger tab. A row whose cached balance disagrees with its ledger gets a 3px Spark Red left border and a `⚠` 14px icon before the coin name — the same defect the banner in §5 announces, surfaced again in context.

**T3 — Attention needed** — half width, a merged action list, not a table. Header carries a count badge: `Attention needed` + Danger badge `12`.

| Row anatomy | Spec |
|---|---|
| Height | 56px, two lines, 1px bottom border, 16px horizontal padding |
| Severity dot | 8px, 16px from the left edge, vertically centred: Spark Red (overdue payment, jars 7+ days), Spark Orange (coin issue 15+ days), Nova Blue (party delivery scheduled today) |
| Line 1 | Body SM Gray 900: subject + the number. `Ramesh Patel · ₹8,400.00 unpaid` |
| Line 2 | Caption Gray 600: `ORD-000098 · 22 days ago` — the ageing text takes Spark Orange past 7 days and Spark Red past 15 |
| Order | Severity first, then age descending. Red before amber before blue |
| Cap | 6 rows visible, then a footer `Show all 12 ›` expanding in place to a max of 400px with internal scroll |
| Empty | 48px `CheckCircle2` in Spark Green, H4 `Nothing needs attention`, Body SM Gray 600 `No overdue payments, no jars out past a week, no unsettled coin issues.` |

The four source queries merged into this list: delivery orders with a balance and an order date older than 7 days · order lines with jars out 7+ days · coin issues unsettled 15+ days · party schedule days with today's date and status `Planned`.

**T4 — Today's party schedule** — half width, or full width when `Attention needed` is empty.

| Column | Rendering |
|---|---|
| `PARTY` | `Shreeji Wedding Hall` Gray 900 500, Caption below `PTY-000012 · Day 2 of 3` |
| `ITEMS` | `20L Jar × 80` Body SM. Multiple items collapse to a Default chip `2 items · 130 units` with the detail in a tooltip |
| `STAFF` | `Ramesh Patel`, or `— Unassigned` in Gray 300 |
| `TOTAL` | `₹3,200.00` mono right |
| `STATUS` | Badge: Primary `Scheduled` `Calendar` · Success `Delivered` `Check` · Warning `Skipped` `SkipForward` |
| Action | 32px secondary button `Mark delivered`, visible only on `Scheduled` rows. Opens the confirm dialog, does not navigate |

Empty: 48px `Calendar` Gray 300, H4 `No party deliveries scheduled today`, Body SM Gray 600 `The next one is on 16 Aug 2026.` with a link to the calendar.

### 3.4 Content and copy

**Greeting** — `Good morning` (before 12 pm) · `Good afternoon` (12 pm – 5 pm) · `Good evening` (after 5 pm). Gujarati: `સુપ્રભાત` · `નમસ્તે` · `શુભ સાંજ`.

**Meta line** — `Friday, 14 Aug 2026 · Updated 6:05 pm`

**Section labels** — `TODAY` · `MONEY AT RISK` · `Current position — not affected by the date filter`

**KPI labels (EN / ગુ)** — `TODAY'S REVENUE` / `આજની આવક` · `TODAY'S COLLECTION` / `આજની વસૂલાત` · `TODAY'S EXPENSES` / `આજનો ખર્ચ` · `TODAY'S NET` / `આજનો ચોખ્ખો નફો` · `CASH OUTSTANDING FROM STAFF` / `સ્ટાફ પાસે બાકી રોકડ` · `OUTSTANDING FROM PARTIES` / `પાર્ટી પાસે બાકી` · `COIN DUES FROM STAFF` / `સ્ટાફ પાસે સિક્કા બાકી` · `TOTAL JARS OUT` / `કુલ બહાર ગયેલા જાર`. The Gujarati for the third money-at-risk label is 27 characters against 21 — it wraps to two lines, which is why KPI cards align on a grid row and never on a fixed height.

**Chart titles** — `Revenue trend` / sub `Last 30 days · 16 Jul – 14 Aug 2026` · `Revenue vs expenses` / sub `Last 6 months · Mar – Aug 2026` · `Top 5 products` / sub `By volume · Aug 2026` · `Collection mix` / sub `Cash vs coins · Aug 2026`.

**Chart legends** — `Delivery` `Party` `Walk-in` · `Revenue` `Expenses` `Profit` · `Cash` `Coins`. Gujarati: `ડિલિવરી` `પાર્ટી` `વોક-ઇન` — 40% wider, so the legend wraps to two rows below `lg` rather than shrinking the plot.

**Table headings** — `Staff scoreboard` / `August 2026` · `Coin position` / `Live stock` · `Attention needed` · `Today's party schedule` / `14 Aug 2026`.

**Empty states**
- Whole dashboard, no data ever: H3 `Nothing recorded yet`, Body SM Gray 600 `Once you record your first delivery order, this page fills up.`, primary `+ New delivery order`
- Period with no data: H4 `No activity on 14 Aug 2026`, Body SM `Try Today, This week, or a custom range.`
- Chart: `No sales recorded in this period. Try widening the date range.`
- Attention needed: `Nothing needs attention` / `No overdue payments, no jars out past a week, no unsettled coin issues.`

**Errors**
- Whole page: H4 `Couldn't load the dashboard`, Body SM `The server didn't respond. Your data is safe — nothing was lost.`, primary `Try again`
- Single card: value renders `—` in Gray 300 with a Caption Nova Blue `Retry` link below
- Single chart: axes drawn, centred 24px `AlertTriangle` Spark Red, Caption `Couldn't load this chart`, `Retry` link
- Partial: Danger banner above row 1 — `Some figures may be out of date. Coin totals last refreshed at 5:40 pm.`

### 3.5 States

| State | Presentation |
|---|---|
| **Loading (first paint)** | Page header and all section labels render immediately. Every KPI card renders its icon and label, with a 32×140px shimmering `#F3F4F6` bar where the value goes and a 12×90px bar for the breakdown. Charts render their card, title and axes with the plot area shimmering. Tables render header rows plus 5 skeleton rows at 60%/40%/80% widths. Shimmer cycle 1.5s. **No full-page spinner, ever** |
| **Loading (date filter change)** | Rows 1 and 3 only. The existing content **stays on screen** at 60% opacity with pointer events off, and a 2px indeterminate Nova Blue bar appears under the page header. Rows 2 and 4 are untouched and stay fully interactive |
| **Empty (no data for the period)** | Rows 1 and 3 show zero states — KPI values `₹0` in Gray 400 with the Caption context line `No sales on this date`, charts show their empty message with axes drawn. Row 2 keeps showing real outstanding figures, because outstanding is not a period figure |
| **Partial data** | Any card or chart that failed renders its own error state; the rest render normally. A Danger banner sits above row 1 naming what is missing. The page is never blocked by one failed query |
| **Filled** | As specified above |
| **Error (whole page)** | The shell, sidebar and page header stay. Content area shows a centred 320px block: 48px Spark Red `AlertTriangle`, H4, Body SM, `Try again` |
| **Stale / cached** | Meta line appends a Warning chip `⏱ 12 min ago`. Above 15 minutes the chip becomes Danger and the refresh button gets a 6px Spark Orange dot. Figures are shown, never hidden — a stale number is more useful than no number, as long as it says so |
| **Reconciliation defect** | Non-dismissible Danger banner between the page header and row 1 — see §5. It pushes content down; it never overlays |
| **Offline** | Sticky Warning bar under the topbar: `You're offline. Showing figures from 6:05 pm.` Refresh disabled with the tooltip `Reconnect to refresh` |

### 3.6 Interactions

**Date filter** — see §4. Applies to rows 1 and 3 only. Writes to the URL as `?period=today` or `?from=2026-08-01&to=2026-08-14`, so a view is shareable and browser back works. Trend comparison copy re-words with the period.

**KPI click-through — the complete destination map.** Standards §1.4: a number you can't drill into is a dead end.

| Card / element | Destination |
|---|---|
| Today's revenue (card) | `/orders?date=2026-08-14` |
| ↳ `Delivery ₹21,450` | `/orders?date=2026-08-14` |
| ↳ `Party ₹8,200` | `/party-orders?delivery_date=2026-08-14` |
| ↳ `Walk-in ₹2,530` | `/direct-sales?date=2026-08-14` |
| Today's collection (card) | `/reports/daily-collection?date=2026-08-14` |
| ↳ `Cash ₹22,490` | `/payments?mode=CASH&date=2026-08-14` |
| ↳ `Coins ₹6,250` | `/coins/ledger?direction=IN&date=2026-08-14` |
| Today's expenses | `/expenses?date=2026-08-14` |
| ↳ `Top: Fuel ₹2,800` | `/expenses?date=2026-08-14&category=fuel` |
| Today's net | `/reports/profit-loss?from=2026-08-14&to=2026-08-14` |
| Cash outstanding from staff | `/orders?payment_status=UNPAID,PARTIAL&sort=balance&dir=desc` |
| Outstanding from parties | `/party-orders?payment_status=UNPAID,PARTIAL&sort=outstanding&dir=desc` |
| Coin dues from staff | `/coins/issues?settlement=UNSETTLED&sort=pending&dir=desc` |
| Total jars out (card) | `/orders?return_status=NOT_RETURNED,PARTIAL` |
| ↳ `312 out 7+ days` badge | `/orders?return_status=NOT_RETURNED,PARTIAL&age_gt=7` |
| C1 column segment | Channel list filtered to that single date |
| C1 column background | `/reports/daily-collection?date=…` |
| C2 month group | `/reports/profit-loss?from=…&to=…` |
| C3 bar | `/products/[id]` → Movement tab |
| C4 cash segment | `/payments?mode=CASH&from=…&to=…` |
| C4 coins segment | `/coins/ledger?direction=IN&from=…&to=…` |
| Scoreboard row | `/staff/[id]` |
| Scoreboard `Cash out` cell | `/orders?staff=12&payment_status=UNPAID,PARTIAL` |
| Scoreboard `Jars out` cell | `/orders?staff=12&return_status=NOT_RETURNED,PARTIAL` |
| Coin position row | `/coins/types/[id]` → Ledger tab |
| Attention row | The specific record — `/orders/98`, `/coins/issues/45`, `/party-orders/12` |
| Schedule row | `/party-orders/12` |
| Banner CTA | `/coins/types/3` → Ledger tab, scrolled to the first divergent entry |

Cells that are themselves links inside a clickable row get a 1px dotted Gray 300 underline on row hover, so it is visible that the cell goes somewhere different from the row.

**Chart interactions** — hover any column, bar or segment for a tooltip within 100ms, no entry animation. Crosshair on C1 and C2: a 1px Gray 300 vertical rule at the hovered category. Legend entries toggle series; the last active series is not clickable. Keyboard: `Tab` focuses the chart, arrow keys walk categories with the tooltip following, `Enter` follows the click destination. Every chart card's `⋯` menu offers `View as table` — a modal with the same figures in a real table, which is the accessible fallback and the answer to the sub-3:1 contrast warning.

**Table interactions** — click a sortable header to cycle none → asc → desc → none. Row hover `#F3F4F6`, cursor pointer, whole row navigates. `Mark delivered` opens a 420px confirm dialog: H4 `Mark Day 2 delivered?`, Body SM `Shreeji Wedding Hall · 20L Jar × 80 · ₹3,200.00 on 14 Aug 2026.`, `[Cancel]` ghost + `[Mark delivered]` primary. On success a toast reads `Day 2 marked delivered · Shreeji Wedding Hall` with `Undo` for 8 seconds, and the row updates in place with no animation.

**Refresh** — invalidates the cache and reloads every region. Icon spins for the duration, the meta timestamp updates, nothing else moves.

**Never animate** number changes, table rows appearing, or content on load. Data should feel instant. All motion respects `prefers-reduced-motion`.

### 3.7 Responsive — below `md` (768px)

**Row order changes.** This is the most important mobile decision on the screen:

1. Coin reconciliation banner (if present)
2. **MONEY AT RISK** — moved above Today, because this is what gets checked on the way to the plant
3. TODAY
4. Attention needed
5. Today's party schedule
6. Charts
7. Staff scoreboard
8. Coin position

| Element | Below `md` |
|---|---|
| Content padding | 16px |
| Greeting | H2 28px instead of H1 |
| Meta + date filter | Stack: meta line, then the filter as a full-width 44px select that opens a bottom sheet |
| KPI grid | 2 across, 16px gap. Value drops to 24px mono 700. Breakdown truncates to one `·` separated line with a tooltip |
| Jars-out sub-badge | Stays full size — it is the reason this row is first |
| Charts | Full width, stacked, 24px gap. C1's 30 columns scroll horizontally inside the card at 24px per day with a sticky y-axis; a Caption Gray 600 hint `Swipe to see earlier days ›` sits under the plot on first view. C2, C3 and C4 fit without scrolling |
| Chart tooltip | Tap to open, pinned above the mark rather than following a cursor, tap elsewhere to dismiss |
| Staff scoreboard | Card per staff member: name + phone on line 1; `38 orders · ₹1,42,300` on line 2; `Cash ₹48,600` and `412 jars` right-aligned on line 3 with their colour dots. Sort becomes a `Sort by ▾` select above the list |
| Coin position | Card per coin type, three labelled figures in a row |
| Attention needed | Unchanged — it is already a list. Rows grow to 64px for touch |
| Party schedule | Card per delivery, `Mark delivered` a full-width 44px secondary button at the card foot |
| Touch targets | Every card, row and badge at least 44×44px |

Between `md` and `lg`: KPI rows 2 across, charts 1 across, tables full width, row order returns to the desktop order.

### 3.8 Dark mode

Page `#0B1220`, cards `#1E293B` with a 1px `#334155` border. Separation comes from the background difference, not shadow — shadows are nearly invisible on dark. Text `#F1F5F9` primary, `#94A3B8` secondary. Nova Blue lifts to `#3B82F6` for text, borders and focus rings.

**Chart colours on dark — a selected palette, not a flipped one.**

| Series | Light | Dark | Why |
|---|---|---|---|
| Delivery / Revenue / Cash | `#2563EB` | `#3B82F6` | Blue 600 sits too dark on `#1E293B` |
| Party / Expenses | `#F97316` | `#FB923C` | |
| Walk-in / Profit | `#22C55E` | **`#34D399`** | Emerald 400, not Green 400. Against `#FB923C` this lifts deutan separation from ΔE 7.1 to 10.5 — it clears the floor instead of scraping it |
| Categorical 4 | `#8B5CF6` | `#A78BFA` | |
| Coins / Categorical 5 | `#14B8A6` | `#2DD4BF` | |
| Outstanding / Danger | `#EF4444` | `#F87171` | |

All five dark hues clear 3:1 against `#1E293B`, so the sub-3:1 contrast relief that light mode needs does not apply — but the labels and the table view stay anyway, because the layout must not change between themes.

| Element | Dark treatment |
|---|---|
| Gridlines | `#334155`, still 1px horizontal only |
| Axis text | `#94A3B8` |
| Stacked-segment gap | 2px in `#1E293B` — the card colour, not black |
| Dot / end-marker ring | 2px in `#1E293B` |
| Chart tooltip | `#1E293B` surface on a `#0F172A` page needs separation: use `#0F172A` for the tooltip with a 1px `#475569` border and `shadow-xl` |
| Alert KPI cards | Left border `#F87171`, value `#F87171`, card background unchanged |
| Reconciliation banner | Background `#7F1D1D`, 1px `#EF4444` border, text `#FECACA`, icon `#F87171` |
| Skeletons | `#334155` base with a `#475569` shimmer |
| Severity dots | `#F87171` / `#FB923C` / `#3B82F6` |
| Focus ring | 2px `#3B82F6` at 2px offset |

### 3.9 Stitch prompt

```text
Design a dense executive dashboard for "Maruti Jal", an internal admin app for an
Indian mineral-water plant. Light mode, Inter for text, JetBrains Mono for every
figure. 240px sidebar on #F8FAFC, 64px topbar, #F8FAFC page, 24px padding.

Header: "Good morning" in 36px Inter Bold #111827 over "Friday, 14 Aug 2026 ·
Updated 6:05 pm" in 14px #4B5563; right-aligned segmented control reading Today /
This week / This month / Last month / Custom. Below it a red banner (#FEE2E2 fill,
1px #EF4444 border, 12px radius, alert-triangle icon, no close button): "Blue
Token balance doesn't match its ledger" over "Cached 2,440 coins · Ledger 2,390
coins · Difference 50 coins (₹500.00)".

Row labelled TODAY in 12px uppercase grey: four white cards, 12px radius, 1px
#E5E7EB border, 20px padding, 24px gap. Each: 16px grey icon + 12px uppercase
label, then the value in 28px JetBrains Mono Bold, then a green trend line, then a
grey breakdown. TODAY'S REVENUE ₹32,180 / "Delivery ₹21,450 · Party ₹8,200 ·
Walk-in ₹2,530"; TODAY'S COLLECTION ₹28,740 / "Cash ₹22,490 · Coins ₹6,250";
TODAY'S EXPENSES ₹6,320; TODAY'S NET ₹22,420.

Row labelled MONEY AT RISK: four identical cards but each with a 3px #EF4444 left
border and the value in #EF4444 — ₹1.85L staff cash, ₹96,400 party dues, ₹42,800
coin dues, and 1,247 jars out with a small red pill "312 out 7+ days" beneath.

A 2x2 grid of white chart cards: (a) 30-day stacked column chart, 12px columns,
segments #2563EB / #F97316 / #22C55E separated by 2px white gaps, horizontal
gridlines only, y-axis ₹0–₹40K, legend "Delivery · Party · Walk-in"; (b) 6-month
grouped columns in #2563EB and #F97316 with a 2px #22C55E profit line, one y-axis
only; (c) five horizontal bars in a single #2563EB sorted longest first with
"12,480 units" at each tip; (d) one 32px 100% bar split #2563EB / #14B8A6.

Finally a wide table card "Staff scoreboard": 44px grey header with uppercase
labels STAFF / ORDERS / REVENUE / CASH OUT / JARS OUT / COIN DUES, then 48px
rows — names with the phone in small grey beneath, money right-aligned in mono,
jars-out figures carrying a small red dot. First row: Ramesh Patel, 9876543210,
38, ₹1,42,300, ₹48,600, 412, ₹12,400.
```

---

## 4. Global date filter

### 4.1 Purpose

Scope the period-based half of the dashboard without ever implying that outstanding balances are period figures. It is the reason rows 2 and 4 carry a visible "current position" note.

### 4.2 Layout

```
┌────────────────────────────────────────────────────────────────┐
│  [ Today │ This week │ This month │ Last month │ Custom ▾ ]    │
└────────────────────────────────────────────────────────────────┘

Custom open:
┌──────────────────────────────────────┐
│  From                To              │
│  [ 01 Aug 2026 📅 ]  [ 14 Aug 2026 📅]│
│                                      │
│  ‹    August 2026    ›               │
│  M  T  W  T  F  S  S                 │
│                 1  2  3              │
│  4  5  6  7  8  9 10                 │
│ 11 12 13 ⟨14⟩                        │
│                                      │
│  Last 7 days · Last 30 days · This yr│
│                                      │
│  Selected: 01–14 Aug 2026 · 14 days  │
│              [Cancel]  [Apply range] │
└──────────────────────────────────────┘
```

### 4.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Container | Segmented control, 40px tall, 8px radius, 1px `#D1D5DB` border, surface background, `overflow: hidden`, 1px dividers between segments | |
| Segment | 12px/16px padding, Body SM 14px Gray 600, min-width sized to content — **never fixed**, because `આ મહિનો` and `ગયો મહિનો` differ in width from their English strings | `Today` `This week` `This month` `Last month` `Custom` |
| Active segment | `#DBEAFE` background, `#1D4ED8` text, weight 500. No border change — the fill carries it | |
| Hover (inactive) | `#F3F4F6` background, 100ms | |
| Custom segment | Carries a 14px `ChevronDown`. When a custom range is active, the label becomes the range itself: `14–16 Aug 2026`, and the segment widens | |
| Popover | 320px, 8px radius, 1px border, `shadow-lg`, 16px padding, anchored to the Custom segment's right edge | |
| Date inputs | Two 140px date fields, `DD MMM YYYY`, 40px tall, calendar icon right | |
| Calendar | Single month, arrows to page. Today ringed in 1px Nova Blue; selected range filled `#DBEAFE` with solid `#2563EB` endpoints. Future dates disabled at 40% opacity | |
| Shortcut row | Three ghost links, Caption Nova Blue, 12px gap | `Last 7 days` `Last 30 days` `This year` |
| Summary | Caption Gray 600 above the footer, showing the resolved range and its length | `Selected: 01–14 Aug 2026 · 14 days` |
| Footer | 1px top border, right-aligned | `[Cancel]` ghost · `[Apply range]` primary |

### 4.4 Content and copy

Segments: `Today` / `આજે` · `This week` / `આ અઠવાડિયું` · `This month` / `આ મહિનો` · `Last month` / `ગયો મહિનો` · `Custom` / `પસંદગીનું`.
Range summary: `Selected: 01–14 Aug 2026 · 14 days`. Single day: `Selected: 14 Aug 2026 · 1 day`.
Validation: `The end date can't be before the start date.` · `Ranges are limited to 366 days. Choose a shorter period.` · `Future dates aren't available — there's no data yet.`
Applied-range caption under the header when not `Today`: `Showing 01 Aug – 14 Aug 2026`.

### 4.5 States

Default `Today` selected · hover · active · **applying** — the pressed segment shows a 2px indeterminate Nova Blue underline while rows 1 and 3 dim to 60% · custom open · invalid range with `Apply range` disabled at 40% and the message in Caption Spark Red · disabled entirely while the whole page is in its error state.

### 4.6 Interactions

Click applies immediately — no Apply button on the four presets, because a preset that needs confirming is slower than the register. `Custom` opens the popover; Escape closes it and reverts; clicking outside closes and reverts. Applying writes `?from=&to=` to the URL and pushes a history entry, so browser back returns to the previous period. Keyboard: arrow keys move between segments, Enter or Space applies, `Tab` enters the popover, which traps focus and restores it to the Custom segment on close. Changing the period re-words every trend line and every chart sub-label; rows 2 and 4 do not flicker, reload, or dim.

### 4.7 Responsive

Below `md`, the segmented control becomes a full-width 44px select showing the current period with a `ChevronDown`. Tapping opens a bottom sheet: five 56px rows with the active one carrying a Nova Blue `Check`, then a divider, then the custom range fields and a single-month calendar. Footer buttons are full-width, stacked, primary on top.

### 4.8 Dark mode

Track `#0F172A` with a 1px `#334155` border. Inactive text `#94A3B8`, hover `#1E293B`. Active `#1E3A8A` background with `#BFDBFE` text. Popover `#1E293B` with a 1px `#334155` border. Calendar: today ringed `#3B82F6`, range fill `#1E3A8A`, endpoints `#3B82F6`, disabled dates at 30%.

### 4.9 Stitch prompt

```text
Design a compact date-period filter for a business dashboard toolbar, light mode,
Inter font. A 40px-tall segmented control, 8px corner radius, 1px #D1D5DB border,
white background, with five segments divided by 1px vertical rules: "Today",
"This week", "This month", "Last month", and "Custom" with a small chevron-down.
Segments are sized to their text, not to a fixed width. The active segment
"Today" has a #DBEAFE background and #1D4ED8 text at medium weight; the others
are 14px #4B5563 on white.

Beside it, show the open state of the Custom option: a 320px white popover, 8px
radius, 1px #E5E7EB border, soft drop shadow, 16px padding, anchored below the
Custom segment. Inside, two 140px date fields side by side labelled "From" and
"To" reading "01 Aug 2026" and "14 Aug 2026" with small calendar icons; below
them a single-month calendar for August 2026 with a two-letter weekday header
row, the 14th ringed in #2563EB, the range 1–14 filled #DBEAFE with solid #2563EB
endpoints, and dates after the 14th greyed to 40%. Under the calendar, three
small blue text links in a row: "Last 7 days", "Last 30 days", "This year". Then
a 12px grey line "Selected: 01–14 Aug 2026 · 14 days". A 1px top border, then
two right-aligned buttons: a ghost "Cancel" and a solid #2563EB "Apply range".
Keep everything dense and businesslike — no large spacing, no decoration.
```

---

## 5. Coin reconciliation danger banner

### 5.1 Purpose

Turn *"the coin numbers are wrong somehow"* — an unfixable complaint — into a named coin type, a signed discrepancy, and a link to the exact ledger. It should never fire. That it exists is the point, which is why it cannot be dismissed: a dismissible alarm about a private currency is not an alarm.

### 5.2 Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚠  Blue Token balance doesn't match its ledger                       │
│    Cached balance 2,440 coins · Ledger total 2,390 coins             │
│    Difference 50 coins (₹500.00) · First seen 12 Aug 2026, 4:20 pm   │
│                                            [Open Blue Token ledger]  │
└──────────────────────────────────────────────────────────────────────┘

Two or more coin types affected:
┌──────────────────────────────────────────────────────────────────────┐
│ ⚠  2 coin types don't match their ledgers                            │
│    Blue Token  −50 coins (₹500.00)   ·   Green Token  +12 coins      │
│    (₹240.00) · First seen 12 Aug 2026, 4:20 pm                       │
│                                                  [Open coin ledger]  │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 Region-by-region spec

| Element | Spec |
|---|---|
| Position | Full content width, between the page header and row 1. It **pushes content down** — never an overlay, never a toast, never a floating bar |
| Container | `#FEE2E2` background, 1px `#EF4444` border, 12px radius, 16px padding, 24px bottom margin |
| Icon | 20px Lucide `AlertTriangle`, `#B91C1C`, top-aligned, 12px gap to the text |
| Title | Body SM 14px **600** `#B91C1C`. Names the coin type — never a generic "data error" |
| Detail lines | Body SM 14px `#7F1D1D`, 1.6 line height. Figures in JetBrains Mono. Coin counts have no decimals; the rupee equivalent has two |
| Difference | The signed number is the emphasis: mono 600. `−50 coins` when the ledger is short, `+12 coins` when it is over |
| Timestamp | `First seen 12 Aug 2026, 4:20 pm` — so the owner knows whether this is new or has been sitting there |
| Action | Secondary button, 32px, 1px `#B91C1C` border, transparent background, `#B91C1C` text. Right-aligned on `md` and up; below the text on mobile, full width |
| Dismiss | **None.** No `✕`. The banner disappears only when the discrepancy is resolved |
| Multiple types | One banner, not a stack. Title becomes the count, and each coin type gets a `·` separated entry. Above 3, the first 3 show and the rest collapse to `+2 more` |
| Also | The affected row in the Coin position table (§3.3.5 T2) gets a 3px Spark Red left border and a `⚠` before the name |
| Screen reader | `role="alert"` with `aria-live="assertive"` — this is the one place on the dashboard that interrupts |

### 5.4 Content and copy

- Single: `Blue Token balance doesn't match its ledger`
- Multiple: `2 coin types don't match their ledgers`
- Detail: `Cached balance 2,440 coins · Ledger total 2,390 coins`
- Difference: `Difference 50 coins (₹500.00)` — the parenthetical is the value, not a negative figure, so it stays in `#7F1D1D` rather than taking the negative-money treatment
- Timestamp: `First seen 12 Aug 2026, 4:20 pm`
- Action: `Open Blue Token ledger` / multiple: `Open coin ledger`
- Gujarati title: `બ્લુ ટોકનનું બેલેન્સ તેના લેજર સાથે મેળ ખાતું નથી` — roughly 45% longer, so the banner is height-flexible and the button never sits on the same line as the title on narrow viewports

### 5.5 States

| State | Presentation |
|---|---|
| Absent | Not rendered; nothing reserves space for it |
| Present, one type | As specified |
| Present, many types | Merged, as specified |
| Loading | The banner is never skeletoned. It renders only once the check has returned — a flash of "everything is broken" that then disappears is worse than a 300ms delay |
| Check failed | A **Warning** banner instead: `Couldn't verify coin balances. Figures below may not reconcile.` with a `Retry` link. Amber, dismissible for the session |
| Resolved while open | The banner leaves on the next refresh with no exit animation, and a Success toast appears: `Blue Token now reconciles · 2,390 coins` |

### 5.6 Interactions

The action button navigates to `/coins/types/3` with the Ledger tab active, scrolled to the first entry where the running balance diverges, that row highlighted with a `#FEF3C7` background. No dismiss. No snooze. The banner is keyboard-reachable as the first focusable element in the content area, and screen readers announce it on arrival.

### 5.7 Responsive

Below `md`: 16px horizontal margin, icon stays top-left at 20px, all text wraps freely, the action becomes a full-width 44px button below the text with 12px of space above. On a multi-type banner the coin entries stack one per line rather than running `·` separated.

### 5.8 Dark mode

Background `#7F1D1D`, 1px `#EF4444` border, title and icon `#FECACA`, detail text `#FCA5A5`, button 1px `#FCA5A5` border with `#FECACA` text and a transparent background. The warning variant uses `#7C2D12` / `#FED7AA`.

### 5.9 Stitch prompt

```text
Design a full-width, non-dismissible error banner for a business dashboard, light
mode, Inter font, sitting directly under the page header and above the first row
of metric cards. Background #FEE2E2, 1px #EF4444 border, 12px corner radius, 16px
padding, no close button anywhere.

Left: a 20px alert-triangle icon in #B91C1C, top-aligned, 12px from the text.
Text block: first line "Blue Token balance doesn't match its ledger" in 14px
Inter Semibold #B91C1C. Second line "Cached balance 2,440 coins · Ledger total
2,390 coins" in 14px #7F1D1D with the numbers in JetBrains Mono. Third line
"Difference 50 coins (₹500.00) · First seen 12 Aug 2026, 4:20 pm" with "50 coins"
in JetBrains Mono Semibold.

Right, vertically centred: a 32px-tall outlined button reading "Open Blue Token
ledger" — transparent fill, 1px #B91C1C border, #B91C1C text, 8px radius.

Show a second variant beneath it for the multi-error case: same styling, title
"2 coin types don't match their ledgers", and a detail line listing "Blue Token
−50 coins (₹500.00) · Green Token +12 coins (₹240.00)". Button reads "Open coin
ledger". Serious and plain — no illustration, no gradient, no rounded pill shape.
```

---

## 6. Module KPI strip — shared spec

### 6.1 Purpose

The three-to-five card strip at the top of every module list page, answering "what's happening in *this* area today". **This section is the canonical spec; modules 01–07 reference it rather than restating it.** The only things a module file supplies are its card labels, values, breakdowns and destinations.

### 6.2 Layout

```
Delivery Orders                                [Export CSV]  [+ New Order]
Track jars issued, returned, and money collected

┌───────────────┐┌───────────────┐┌───────────────┐┌───────────────┐
│📋 TODAY'S     ││💰 TODAY'S     ││💵 OUTSTANDING ││📦 JARS OUT    │
│   ORDERS      ││   COLLECTION  ││   CASH        ││               │
│ 14            ││ ₹18,450       ││ ₹1.85L        ││ 1,247         │
│ ▲ 3 vs yest.  ││ ▲ 12% vs yest.││ 23 orders     ││ 🔴 312 · 7+ d │
└───────────────┘└───────────────┘└───────────────┘└───────────────┘

[🔍 Search order no, staff name, phone…]    [Filters (2)]  [⚙ Columns]
● Today  ● Money pending  ● Jars out  ● Settled            [Clear all]
```

### 6.3 Region-by-region spec

Identical anatomy to §3.3.2. Differences from the dashboard:

| Property | Module strip | Dashboard |
|---|---|---|
| Position | Between the page header and the table toolbar, 24px above the toolbar | Two full rows |
| Count | 3–5 cards, grid `repeat(auto-fit, minmax(220px, 1fr))` | Always 4 |
| Value size | **28px mono 700** — unchanged. Do not shrink it because the card is in a strip | 28px |
| Padding | 20px | 20px |
| Alert variant | Used only on the outstanding/jars-out card, and only when the value is non-zero | Whole of row 2 |
| Filter coupling | The strip reflects the module's **current filters**, and says so: when any filter is active, a Caption Gray 600 line sits above the strip — `Figures reflect the 2 active filters` with a `Show all` link | Only the date filter |

**Per-module cards, labels and destinations**

| Module | Card 1 | Card 2 | Card 3 | Card 4 (alert) |
|---|---|---|---|---|
| **Staff** `/staff` | `TOTAL STAFF` `12` → `/staff` | `ACTIVE` `10` → `/staff?status=ACTIVE` | `CASH OUTSTANDING` `₹1.85L` → `/orders?payment_status=UNPAID,PARTIAL` | `JARS OUT` `1,247` → `/orders?return_status=NOT_RETURNED,PARTIAL` |
| **Products** `/products` | `TOTAL PRODUCTS` `18` | `ACTIVE` `15` → `?status=ACTIVE` | `TOP BY VOLUME` `20L Jar` sub `12,480 units` → `/products/1` | `TOP BY REVENUE` `20L Jar Cold` sub `₹2,88,800` → `/products/2` |
| **Delivery Orders** `/orders` | `TODAY'S ORDERS` `14` → `?date=today` | `TODAY'S COLLECTION` `₹18,450` → `/payments?date=today` | `OUTSTANDING CASH` `₹1.85L` → `?payment_status=UNPAID,PARTIAL` | `JARS OUT` `1,247` + `312 · 7+ days` → `?return_status=NOT_RETURNED,PARTIAL` |
| **Coin types** `/coins/types` | `COIN TYPES` `3` | `COINS IN STOCK` `4,240` | `VALUE IN STOCK` `₹51,100` | `OUT WITH STAFF` `1,190` → `/coins/issues?settlement=UNSETTLED` |
| **Coin issues** `/coins/issues` | `OPEN ISSUES` `9` → `?settlement=UNSETTLED` | `COINS OUT` `1,190` | `PENDING COLLECTION` `₹42,800` → `?settlement=UNSETTLED&sort=pending` | `REFUNDS DUE` `₹1,500` → `?payment_status=REFUND_DUE` |
| **Party Orders** `/party-orders` | `ACTIVE PARTIES` `6` → `?status=ACTIVE` | `DELIVERIES TODAY` `2` → `?delivery_date=today` | `REVENUE THIS MONTH` `₹2,64,300` | `PARTY OUTSTANDING` `₹96,400` → `?payment_status=UNPAID,PARTIAL` |
| **Direct Sales** `/direct-sales` | `TODAY'S SALES` `31` → `?date=today` | `TODAY'S COLLECTION` `₹2,530` | `THIS MONTH` `₹68,400` | `AVERAGE SALE` `₹82` — never the alert variant |
| **Expenses** `/expenses` | `THIS MONTH` `₹1,94,200` | `BIGGEST CATEGORY` `Fuel` sub `₹64,800 · 33.4%` → `?category=fuel` | `VS LAST MONTH` `▲ 8.2%` — **red when up** | `THIS MONTH'S PROFIT` `₹3,42,100` → `/reports/profit-loss` |

Card 4 is the alert-variant slot in every module except Products and Direct Sales, where nothing on the strip represents risk.

### 6.4 Content and copy

Labels are Caption 12px 600 uppercase and always plural or mass nouns — `TODAY'S ORDERS`, not `Order count`. Breakdown lines are `·` separated and never exceed one line at 220px; anything longer truncates with a tooltip.

Zero state per card: value `0` or `₹0` in Gray 400, with a Caption context line rather than a blank — `No orders yet today` · `Nothing outstanding` · `No jars out` · `No refunds due`.

Error per card: value `—` in Gray 300, Caption Nova Blue `Retry` below.

### 6.5 States

Loading: label and icon render, value is a 32×120px shimmer bar, breakdown a 12×80px bar. Refilter: values fade to 60% for the duration and swap in place with no count-up animation. Empty: zero states as above, cards always render. Error: per-card, never strip-wide. Stale: no separate treatment — the strip follows the list's own freshness.

### 6.6 Interactions

Whole card clickable; hover fades the border to Nova Blue at 40% over 100ms; cursor pointer; focusable with a visible 2px Nova Blue ring. Where a card links to the same list it sits on, it **applies the filter in place** rather than navigating — the quick chip lights up, the URL updates, and the table refilters. Where it links elsewhere, it navigates. A breakdown segment that is itself a link gets a dotted underline on hover.

### 6.7 Responsive

`xl` and `lg`: 4 across. `md`: 2 across, 16px gap. Below `md`: 2 across at 16px gap with the value at 24px mono 700 — **not** 1 across, because a single-column strip pushes the table below the fold on every module. Breakdown lines truncate to one line.

### 6.8 Dark mode

Card `#1E293B` on `#0B1220`, 1px `#334155` border. Label `#94A3B8`, value `#F1F5F9`, breakdown `#94A3B8`. Alert variant: 3px `#F87171` left border, value `#F87171`. Hover border `#3B82F6` at 40%. Focus ring `#3B82F6`.

### 6.9 Stitch prompt

```text
Design a four-card KPI strip that sits between a page header and a data table in
an internal business web app, light mode, Inter font with JetBrains Mono for
figures. The strip spans the content width in a four-column grid with a 24px gap
and equal card heights.

Each card: white background, 12px corner radius, 1px #E5E7EB border, very subtle
shadow, 20px padding. Inside, a 16px grey outline icon followed by a 12px
uppercase letter-spaced label in #4B5563; 8px below, the value in 28px JetBrains
Mono Bold #111827; below that a 12px trend line with a small arrow; and last a
12px #4B5563 breakdown line with parts separated by middle dots.

Card 1: clipboard icon, "TODAY'S ORDERS", value 14, "▲ 3 vs yesterday" in green.
Card 2: wallet icon, "TODAY'S COLLECTION", value ₹18,450, "▲ 12% vs yesterday" in
green, breakdown "Cash ₹14,200 · Coins ₹4,250".
Card 3: banknote icon, "OUTSTANDING CASH", value ₹1.85L, breakdown "23 orders ·
5 staff".
Card 4 is the alert variant: a 3px #EF4444 left border, package icon, "JARS OUT",
the value 1,247 in #EF4444, and below it a small red pill badge reading "312 out
7+ days".

Above the strip show a page header: "Delivery Orders" in 28px Inter Semibold with
the grey subtitle "Track jars issued, returned, and money collected", and
right-aligned buttons "Export CSV" (outlined) and "+ New Order" (solid #2563EB).
Below the strip show a 56px toolbar with a search field placeholdered "Search
order no, staff name, phone…", a "Filters (2)" button and a columns icon button,
then a row of small filter chips: Today, Money pending, Jars out, Settled.
Dense and utilitarian — this is a tool, not a marketing page.
```

---

## Module design checklist

- [ ] The greeting is the only H1 in the application; every other page title is H2
- [ ] Every KPI value is 28px JetBrains Mono 700 — including in the compact module strip
- [ ] Money is right-aligned, `₹` prefixed, lakh-grouped; zero is an em dash; KPI values abbreviate above ₹1L with the exact figure in the tooltip
- [ ] All four Money-at-risk cards use the alert variant, and drop out of it at zero
- [ ] The "Current position — not affected by the date filter" note is present above row 2
- [ ] Every KPI card, breakdown segment, chart mark, table row and badge count has a named destination (§3.6) — no dead-end numbers
- [ ] The jars-out sub-badge is its own click target and clears 44×44px
- [ ] Chart series use the §12 palette in fixed order, never cycled, never coloured by rank
- [ ] Orange↔green pairs carry secondary encoding: 2px surface gaps, legend, direct labels, `View as table`
- [ ] Cash vs coins uses blue + **teal**, never blue + purple (ΔE 2.3 protan — fails)
- [ ] No dual-axis chart anywhere; revenue, expenses and profit share one rupee axis
- [ ] Y-axis money is abbreviated with the full value in the tooltip; gridlines horizontal, 1px, solid
- [ ] Every chart has a legend for ≥2 series, an empty state, and a loading skeleton with axes drawn
- [ ] Date filter applies to rows 1 and 3 only; rows 2 and 4 never dim or reload
- [ ] The coin reconciliation banner has no dismiss control and pushes content down
- [ ] Table rows 48px, headers 44px sticky, hover `#F3F4F6`, whole row clickable
- [ ] All states designed: loading, empty, partial, filled, error, stale, offline
- [ ] Mobile order puts **Money at risk first**, above Today
- [ ] Dark mode uses the selected chart palette (green lifts to `#34D399`), not flipped light values
- [ ] Gujarati labels checked at 20–40% longer; nothing width-locked; KPI cards align on the grid, not a fixed height
- [ ] Focus rings visible on every card, segment, legend entry and chart
- [ ] Icons drawn from the §17 map
