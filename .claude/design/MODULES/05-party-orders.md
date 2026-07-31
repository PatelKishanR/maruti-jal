# Module 05 — Party / Event Orders · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/05-party-orders.md](../../MODULES/05-party-orders.md)
>
> A party order is a **calendar of deliveries**, not a single document. Everything in this module follows from that: a four-step booking wizard whose middle step is a schedule builder, a detail page organised as a vertical timeline of day-cards, and a month calendar across every booking. Build Staff (01) and Products (02) first; this module is independent of Delivery Orders (03) and does not touch the jar-return flow.

---

## 1. Design context (for Stitch)

Everything an AI design tool needs, restated so this file works pasted on its own.

**Product.** Internal back-office tool for the owner of a mineral-water plant in Gujarat, India. One user, many times a day, often in a hurry, sometimes on a phone in a vehicle. Dense, fast, unglamorous. Not a consumer app.

**Colour — light / dark**

| Token | Light | Dark | Use |
|---|---|---|---|
| Nova Blue (primary) | `#2563EB` | `#3B82F6` | Primary button, links, active nav, focus ring, doc codes, advance payments |
| Surface (card) | `#FFFFFF` | `#1E293B` | Cards, day-cards, table body, modals |
| Surface subtle | `#F3F4F6` | `#0F172A` | Table headers, day-card footers, inset panels, row hover |
| Page background | `#F8FAFC` | `#0B1220` | Behind cards |
| Text primary | `#111827` | `#F1F5F9` | Values, headings |
| Text secondary | `#4B5563` | `#94A3B8` | Labels, captions, helper text |
| Text disabled / empty | `#D1D5DB` | `#475569` | The `—` used for zero, no-delivery markers |
| Border | `#E5E7EB` | `#334155` | Card borders, table rules, timeline rail |
| Input border | `#D1D5DB` | `#334155` | Field outlines |
| Success | `#22C55E` | same | Delivered, Paid |
| Warning | `#F97316` | same | Skipped, partial payment, rate override |
| Danger | `#EF4444` | same | Unpaid, outstanding, destructive |

**Type** — Inter everywhere; **JetBrains Mono** (`tabular-nums`) for every figure; **Noto Sans Gujarati** in the fallback stack.

| Role | Size / LH / Weight | Used for |
|---|---|---|
| H2 | 28px / 1.3 / 600 | Page titles |
| H3 | 22px / 1.4 / 600 | Card and section headings |
| H4 | 18px / 1.4 / 600 | Sub-sections, modal titles, wizard step titles |
| Body | 16px / 1.6 / 400 | Detail content, day-card date headers |
| Body SM | 14px / 1.5 / 400 | **Table cells, form labels, day-card item rows, most of the app** |
| Caption | 12px / 1.4 / 500 | Metadata, badges, helper text, column headers, no-delivery markers |
| Table amount | 14px mono 500, right | Money in a column |
| Emphasised amount | 14px mono 600 `#111827`, right | Outstanding, day total |
| KPI value | 28px mono 700 | KPI cards |
| Form total | 18px mono 600 | Grand total in a form |

**Spacing** 4 · 8 · 12 · 16 · 24 · 32 only. **Radius** input 4px · button/chip 8px · badge full · card/modal 12px. **Shadow** card `0 1px 2px rgba(0,0,0,.05)` · modal `0 20px 25px rgba(0,0,0,.15)`.

**Metrics** Sidebar 240px · Topbar 64px · content max 1440px · content padding 24px (16px below `md`) · section gap 32px · card grid gap 24px. **Table header row 44px · body row 48px · line-item row 56px · toolbar 56px · quick chips 44px · tabs 44px · day-card header 44px · day-card item row 32px · day-card footer 48px · no-delivery marker 28px.**

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
| Day planned | Primary | `Scheduled` | `Calendar` |
| Day delivered | Success | `Delivered` | `Check` |
| Day skipped | Warning | `Skipped` | `SkipForward` |
| Day cancelled | Default | `Cancelled` + card at 60% opacity | `Ban` |
| Unpaid | Danger | `Unpaid` | `Circle` |
| Partially paid | Warning | `₹4,500 due` — **show the number** | `CircleDashed` |
| Paid | Success | `Paid` | `CheckCircle2` |
| Overpaid | Warning | `Overpaid ₹600` | `AlertCircle` |
| Refund due | Primary | `Refund ₹500` | `RotateCcw` |
| Advance payment | Primary | `Advance` | `Banknote` |

**Money** `₹` + Indian lakh grouping + always 2 decimals → `₹12,34,567.00`. Zero renders as `—` in `#D1D5DB`, never `₹0.00`. Negative in parentheses, Danger text → `(₹500.00)`. Quantities grouped, no decimals. Dates `14 Aug 2026`; recent dates become `Today` / `Yesterday`; ranges collapse shared parts → `14–18 Aug 2026`. Times `6:05 pm`. **Digits are always Latin 0–9 in both languages.**

**Icons** Lucide, 1.5px stroke. `PartyPopper` party order · `Calendar` schedule / scheduled · `CalendarPlus` add day · `CalendarDays` calendar view · `Repeat` repeat pattern · `Copy` duplicate day · `Check` delivered · `SkipForward` skipped · `Ban` cancelled · `Users` assigned staff · `MapPin` address · `Phone` phone · `Banknote` payment · `Wallet` cash · `Package` product · `Plus` add · `Pencil` edit · `Trash2` delete · `Search` search · `SlidersHorizontal` filter · `Download` export · `MoreHorizontal` more · `AlertTriangle` warning.

**The five principles that override generic taste**

1. **Density over whitespace** — 25 rows on screen, not 8. Day-cards are tight, not airy.
2. **Numbers are the interface** — figures get mono, right alignment and more weight than their labels.
3. **Status is scannable without reading** — red = money outstanding, amber = partial or skipped, green = delivered or settled, blue = scheduled or advance.
4. **Every number is a door** — KPI values, day totals, progress fractions and badge counts all navigate.
5. **Entry speed is a feature** — first field autofocused, deliberate tab order, `⌘/Ctrl + Enter` submits, nothing needs a mouse.

**Bilingual.** Every label ships in English and Gujarati. Gujarati runs **20–40% longer** and is **taller**. Party names and addresses are frequently Gujarati — `શ્રીજી વાડી`, `પટેલ સમાજ વાડી, કલોલ ચાર રસ્તા પાસે` — so the party column, the address column and the day-card header must all be built for two-line wrapping, never truncation to a fixed width. Weekday abbreviations localise (`Fri` → `શુક્ર`) and get 20% more room in the calendar header.

---

## 2. Screens in this module

| Screen | Route | Archetype | Purpose |
|---|---|---|---|
| Party order list | `/party-orders` | **A — List** | Every booking, its date range, progress and money position |
| Booking wizard | `/party-orders/new` | **C — Form** (4-step variant) | Book a party: details → schedule → advance → review |
| ↳ Step 2, schedule builder | same route | Form / timeline | The centrepiece: a vertical timeline of day-cards |
| ↳ Repeat-pattern generator | modal, 720px | Modal form (table) | Generate N days from a start, end and interval |
| Party order detail | `/party-orders/[id]` | **B — Detail** | Schedule timeline, payment history, balances |
| Edit party order | `/party-orders/[id]/edit` | **C — Form** | Party details and schedule, out of the wizard |
| Calendar | `/party-orders/calendar` | **A — List** (calendar variant) | Month grid of every upcoming party delivery |
| Edit delivery day | modal, 720px | Modal form (table) | One day's items, status, staff, notes |
| Record payment | modal, 560px | Modal form | Amount, mode, advance flag |

---

## 3. Party order list — `/party-orders`

### 3.1 Purpose

The overview of every booking. It answers: which events are running now, how far through each one is, and who owes what. The `Progress` column is the column unique to this module — a `3/5 days` fraction that tells you at a glance whether an event is upcoming, mid-flight or finished.

### 3.2 Layout

Application shell per standards §3. Content area only shown below.

```
Party Orders                      [📅 Calendar]  [⬇ Export CSV]  [ + New Booking ]
Multi-day event bookings, their delivery schedule and their money

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 🎉 ACTIVE PARTIES│ │ 📅 DELIVERIES    │ │ 💰 PARTY REVENUE │ │ 🔴 PARTY         │
│                  │ │    TODAY         │ │    THIS MONTH    │ │    OUTSTANDING   │
│ 6                │ │ 3                │ │ ₹1,84,200.00     │ │ ₹38,600.00       │
│ 2 start this week│ │ 210 jars planned │ │ ▲ 18.2% vs July  │ │ across 4 parties │
│ 24 days scheduled│ │ Ramesh · Suresh  │ │ 11 bookings      │ │ Oldest 12 days   │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search code, party name, phone, address…   ]  [⚙ Filters (1)] [⚙ Columns]   │ 56
│ ● Upcoming   ● In progress   ● Money pending   ● Completed        Clear all     │ 44
├─────────────────────────────────────────────────────────────────────────────────┤
│ CODE ↕     PARTY ↕          DATES ↕      DAYS  PAYABLE ↕ RECEIVED OUTSTAND ↕ ⋯ │ 44
├─────────────────────────────────────────────────────────────────────────────────┤
│ PTY-000045 Shreeji Wedding  14–18 Aug   ▓▓▓░░  ₹18,400  ₹10,000  ₹8,400        │
│            Hall             2026        3/5                       🟠 ₹8,400 due │ 48
│            9825044556                                             🔵 In progress⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ PTY-000046 પટેલ સમાજ વાડી   20–22 Aug   ░░░    ₹9,600   ₹5,000   ₹4,600        │
│            9909112233       2026        0/3                       🟠 ₹4,600 due │ 48
│                                                                   🔵 Upcoming  ⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ PTY-000044 Ramada Banquet   08–10 Aug   ▓▓▓    ₹22,750  ₹22,750       —        │
│            9825771144       2026        3/3                       🟢 Paid       │ 48
│                                                                   🟢 Completed ⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ PTY-000043 Krishna Farm     02–04 Aug   ▓▓░    ₹14,000  ₹15,000  (₹1,000)      │
│            9737665544       2026        2/3                       🔵 Refund ₹1,000│ 48
│                                                                   🟠 1 day skipped⋯│
├─────────────────────────────────────────────────────────────────────────────────┤
│ Showing 1–25 of 87            [25 ▾]                    ‹  1  2  3  4  ›        │ 56
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Region-by-region spec

**Page header**

| Element | Spec | Content |
|---|---|---|
| Title | H2 28px/1.3 600 Gray 900 `#111827` | `Party Orders` |
| Subtitle | Body SM 14px/1.5 400 Gray 600 `#4B5563` | `Multi-day event bookings, their delivery schedule and their money` |
| Secondary action 1 | Button MD 40px outlined `#2563EB`, 16px `CalendarDays` + 8px gap | `Calendar` |
| Secondary action 2 | Button MD 40px outlined, 16px `Download` | `Export CSV` |
| Primary action | Button MD 40px filled `#2563EB`, white 15px 500, 16px `Plus` | `+ New Booking` |

**KPI strip** — 4 across on `xl`, 2 on `md`, 1 below, 24px gap, equal heights.

| Card | Icon | Label | Value | Trend / third line | Navigates to |
|---|---|---|---|---|---|
| 1 | `PartyPopper` | `ACTIVE PARTIES` | `6` | `2 start this week` · `24 days scheduled` | `/party-orders?status=active` |
| 2 | `Calendar` | `DELIVERIES TODAY` | `3` | `210 jars planned` · `Ramesh · Suresh` | `/party-orders/calendar?date=today` |
| 3 | `Banknote` | `PARTY REVENUE THIS MONTH` | `₹1,84,200.00` | `▲ 18.2% vs July` green · `11 bookings` | `/reports/party-revenue?period=month` |
| 4 | `AlertCircle` | `PARTY OUTSTANDING` | `₹38,600.00` | `across 4 parties` · `Oldest 12 days` in `#B91C1C` | `/party-orders?payment=pending` |

Card 4 uses the **alert variant** when non-zero: 3px `#EF4444` left border, value `#B91C1C`.

**Toolbar and chips**

| Element | Spec | Content |
|---|---|---|
| Search | 40px input, `Search` 16px left, max-width 400px, 300ms debounce | Placeholder `Search code, party name, phone, address…` |
| Filters popover | 320px: Date range (two 180px date inputs + presets `This week` `This month` `Next 30 days`) · Payment status (Unpaid / Partial / Paid / Overpaid / Refund due) · Delivery status (Upcoming / In progress / Completed / Cancelled) · Assigned staff (search select) | `Filters (1)` |
| Quick chips | 32px, 12px horizontal padding, 8px gaps | `Upcoming` · `In progress` · `Money pending` · `Completed` |

**Table**

| Column | Width | Align | Sort | Rendering |
|---|---|---|---|---|
| CODE | 120px, sticky-left below 1280px | left | ✅ | `PTY-000045` mono 13px 500 `#2563EB` |
| PARTY | 220px flex | left | ✅ | Three lines compressed into 48px is too many — use two: name Body SM 500 Gray 900 (**wraps to two lines**, min-height keeps the row at 48px, grows to 64px only when genuinely needed for Gujarati), phone Caption 12px Gray 600 |
| ADDRESS | 200px, **hidden by default**, available in the Columns menu | left | ✖ | Body SM Gray 600, single line truncated with a tooltip carrying the full address |
| DATES | 130px | left | ✅ default asc on start date | Range with shared parts collapsed: `14–18 Aug 2026`, `28 Aug – 2 Sep 2026`. Single-day: `14 Aug 2026` |
| DAYS | 90px | left | ✖ | Progress: a 48×4px track `#E5E7EB` radius full with a `#22C55E` fill, and `3/5` beneath it in mono 12px Gray 700. Fill is `#F97316` if any day is skipped, `#D1D5DB` at 0 |
| PAYABLE | 110px | **right** | ✅ | mono 14px 500 |
| RECEIVED | 110px | **right** | ✖ | mono 14px 500, `—` at zero |
| OUTSTANDING | 120px | **right** | ✅ | mono 14px **600** Gray 900; negative `(₹1,000.00)` in `#B91C1C` |
| STATUS | 190px | centre | ✖ | **Two badges stacked**, payment first, delivery second, 4px gap |
| ⋯ | 56px | centre | ✖ | 32×32 button at a 44×44 target, `MoreHorizontal` 16px, always visible |

Delivery-status badge values: `Upcoming` (Primary, `Calendar`) · `In progress` (Primary, `Calendar`) · `Completed` (Success, `Check`) · `1 day skipped` (Warning, `SkipForward`) · `Cancelled` (Default, `Ban`, row at 60%).

**Row actions menu**: `View booking` · `Record payment` · `Add a delivery day` · `Edit booking` · `Print statement` · divider · `Cancel booking` in `#B91C1C`.

### 3.4 Content and copy

| Slot | English | Gujarati note |
|---|---|---|
| Page title | `Party Orders` | `પાર્ટી ઓર્ડર` |
| Subtitle | `Multi-day event bookings, their delivery schedule and their money` | +25%, wraps to two lines below `lg` |
| Primary button | `+ New Booking` | `+ નવું બુકિંગ` (+30%, min-width 160px) |
| Search placeholder | `Search code, party name, phone, address…` | +28%, input min-width 340px |
| Quick chips | `Upcoming` · `In progress` · `Money pending` · `Completed` | `આગામી` · `ચાલુ` · `પૈસા બાકી` · `પૂર્ણ` |
| Column headers | `CODE` `PARTY` `ADDRESS` `DATES` `DAYS` `PAYABLE` `RECEIVED` `OUTSTANDING` `STATUS` | Wrap to two lines |
| Empty (no data) title | `No party bookings yet` | — |
| Empty (no data) body | `A party order is a calendar of deliveries — 50 jars on the 14th, nothing on the 15th, 80 on the 16th. Book the party once, then build the day-by-day schedule.` | — |
| Empty (no data) CTA | `+ New Booking` | — |
| Empty (no results) title | `No party orders match your filters` | — |
| Empty (no results) body | `No bookings between 01 and 16 Aug 2026 with money pending. Try widening the date range or clearing the payment filter.` (echo the **actual** filters) | — |
| Empty (no results) CTA | `Clear filters` | — |
| Error title | `Couldn't load party orders` | — |
| Error body | `The server didn't respond. Your bookings are safe — nothing has been lost.` | — |
| Partial error | `Totals may be a few minutes out of date. Schedules are being recalculated.` | — |
| Progress tooltip | `3 of 5 days delivered · 1 skipped · 1 still scheduled` | — |
| Refund-due tooltip | `Krishna Farm paid ₹15,000.00 and a cancelled day dropped the total to ₹14,000.00. ₹1,000.00 is refundable.` | — |

### 3.5 States

| State | Presentation |
|---|---|
| **Loading — first load** | KPI labels real, values as 100×28 shimmer bars. Table: 8 skeleton rows at 48px, bar widths 60/40/80/45/55/35/35/90%, 1.5s shimmer, real header row |
| **Loading — refilter / repage** | Existing table stays at 60% opacity, `pointer-events: none`, 2px indeterminate `#2563EB` bar under the header. KPI cards untouched |
| **Empty — no records at all** | Centred 320px block: 48px `PartyPopper` Gray 300, H4 `No party bookings yet`, Body SM copy from 3.4, primary `+ New Booking`. KPI strip renders zeros in Gray 400 with context lines |
| **Empty — no results for filters** | 48px `SearchX` Gray 300, H4 `No party orders match your filters`, Body SM naming the actual active filters, secondary `Clear filters`. Chips stay visible |
| **Filled** | As wireframe |
| **Error** | 48px `AlertTriangle` `#EF4444`, H4 `Couldn't load party orders`, Body SM reason, primary `Try again`, Caption ref code in Gray 400 |
| **Partial error** | Warning banner above the table, not dismissible |
| **Cancelled booking row** | Whole row 60% opacity, money columns `—`, progress bar all `#D1D5DB`, Default badge `Cancelled` |
| **Refund-due row** | OUTSTANDING renders `(₹1,000.00)` in `#B91C1C`; payment badge is the Primary `Refund ₹1,000` with `RotateCcw`. Tooltip explains why the total dropped |
| **Today's-delivery emphasis** | A booking with a delivery scheduled today gets a 3px `#2563EB` left border on the row and a 12px `Calendar` before the code. This is the row the owner is looking for at 6 am |
| **Overdue** | Outstanding older than 15 days: DATES cell adds `overdue 18 days` in Caption `#B91C1C` |
| **Read-only user** | `+ New Booking` and all row-menu write actions hidden entirely |

### 3.6 Interactions

| Trigger | Behaviour |
|---|---|
| Hover row | Background `#F3F4F6` over 100ms |
| Click row | `/party-orders/[id]`. Clicks on `⋯`, a badge or the progress bar do not navigate to the same place |
| Click progress bar | `/party-orders/[id]?tab=schedule` — straight to the schedule |
| Click a payment badge | List filtered by that payment status |
| Click `Calendar` | `/party-orders/calendar` |
| Sort | none → asc → desc → none. Default sort: start date ascending, so the next event is at the top |
| Search | 300ms debounce, matches code, party name, phone and address |
| Quick chips | `Upcoming` / `In progress` / `Completed` are mutually exclusive; `Money pending` combines with any of them |
| Tab order | Search → Filters → Columns → chips → Clear all → first sortable header → row 1 → row 1 `⋯` → … → page size → pagination |
| Keyboard | `n` opens the booking wizard · `c` opens the calendar · `↑ ↓` move row focus · `Enter` opens |
| Refilter | URL updates so the view is shareable and back-button-safe |

### 3.7 Responsive — below `md` (768px)

Content padding 16px. KPI strip goes 1 per row, ordered Party outstanding → Deliveries today → Active parties → Party revenue. Toolbar becomes a full-width search plus a 40×40 `Filters` icon button opening a bottom sheet. Chips scroll horizontally. `Calendar` and `Export CSV` move into a `⋯` in the page header; `+ New Booking` stays visible.

Rows become cards:

```
┌───────────────────────────────────────────┐
│ PTY-000045              🟠 ₹8,400 due     │
│                         🔵 In progress    │
│ Shreeji Wedding Hall                      │
│ 9825044556 · 14–18 Aug 2026               │
│ ▓▓▓░░  3/5 days                           │
│ Payable ₹18,400.00   Outstanding ₹8,400.00│
└───────────────────────────────────────────┘
```

Line 1 code + stacked badges. Line 2 party name Body SM 500 (wraps freely). Line 3 phone and dates Caption Gray 600. Line 4 progress bar full width at 6px tall with the fraction to its right. Line 5 figures right-aligned above a 1px top rule.

### 3.8 Dark mode

Page `#0B1220`, cards and table `#1E293B`, header `#0F172A`, borders `#334155`. Doc codes `#3B82F6`. Progress track `#334155`, fill `#22C55E`. Badge dark pairs from §1. `—` for zero becomes `#475569`. Today's-delivery left border stays `#3B82F6`. Skeletons `#334155` with `#475569` shimmer.

### 3.9 Stitch prompt

```text
Design a dense internal list screen titled "Party Orders" for a mineral water plant
in India. Light theme: page #F8FAFC, white cards, 1px #E5E7EB borders, 12px radius.
Inter for text, JetBrains Mono for every number. Blue #2563EB primary.

Page header: 28px semibold "Party Orders" and beneath it grey 14px "Multi-day event
bookings, their delivery schedule and their money". Top right: outlined "Calendar",
outlined "Export CSV", filled blue "+ New Booking".

Four KPI cards in a row, 24px gap, 20px padding, each with a 12px uppercase grey
label and a 28px bold mono value: ACTIVE PARTIES 6 ("2 start this week");
DELIVERIES TODAY 3 ("210 jars planned"); PARTY REVENUE THIS MONTH ₹1,84,200.00 with
a green "▲ 18.2% vs July"; PARTY OUTSTANDING ₹38,600.00 with a 3px red #EF4444 left
border and a dark-red value.

Then a table card. 56px toolbar with a search field "Search code, party name, phone,
address…" and buttons "Filters (1)" and a gear. A 44px row of pill chips: Upcoming,
In progress, Money pending, Completed — "In progress" active with a #DBEAFE fill and
blue border.

Table header 44px #F3F4F6, 12px uppercase grey: CODE, PARTY, DATES, DAYS, PAYABLE,
RECEIVED, OUTSTANDING, STATUS. Rows 48px, 1px bottom borders, no zebra.
Row 1: PTY-000045 in blue mono; "Shreeji Wedding Hall" with 9825044556 in small grey
beneath; "14–18 Aug 2026"; a small 48px-wide green progress bar three-fifths full
with "3/5" beneath it in mono; right-aligned ₹18,400.00, ₹10,000.00, bold ₹8,400.00;
and two stacked pills — amber "₹8,400 due" and blue "In progress".
Row 2: PTY-000046, party name in Gujarati script "પટેલ સમાજ વાડી", "20–22 Aug 2026",
empty progress bar "0/3", amber "₹4,600 due", blue "Upcoming".
Row 3: PTY-000044, "Ramada Banquet", full green bar "3/3", em-dash for outstanding,
green "Paid" and green "Completed".
Footer: "Showing 1–25 of 87" left, page size and pagination right.
```

---

## 4. Booking wizard — shell and Step 1 — `/party-orders/new`

### 4.1 Purpose

Booking a party is four decisions taken in order — who, when, deposit, confirm — and a schedule is much easier to build once the party's dates are roughly known. A wizard is used rather than one long form because Step 2 is a full working surface in its own right and would be lost inside a scrolling page. The step indicator must make it obvious that Step 2 is where the work is.

### 4.2 Layout

```
‹ Party Orders
New Party Booking
Book the party, build the day-by-day schedule, take a deposit

┌───────────────────────────────────────────────────────────────────────────────┐
│    ①━━━━━━━━━━━━━━━━━━━②━━━━━━━━━━━━━━━━━━━③━━━━━━━━━━━━━━━━━━━④              │
│  Party details        Schedule           Advance            Review            │
│  Name, phone,         5 days ·           Optional           Confirm and       │
│  address              ₹18,400.00         deposit            book              │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ Party details ────────────────────────────────────────── max 720px ──────────┐
│  Party name *                                                                  │
│  [ Shreeji Wedding Hall                                                    ]   │
│  The name you'll recognise on the day — hall, family or contact person          │
│                                                                                │
│  Phone *                              Alternate phone                          │
│  [ 9825044556              ]          [ 9909112233              ]              │
│                                                                                │
│  Delivery address *                                                            │
│  [ Shreeji Party Plot, Nr. Kalol Cross Road,                               ]   │
│  [ Gandhinagar – 382721                                                    ]   │
│  [                                                                         ]   │
│                                                                                │
│  Notes                                                                         │
│  [ Ask for Bhavesh at the gate. Jars go to the back kitchen, not the       ]   │
│  [ main hall.                                                              ]   │
│  Access instructions, contact person, anything useful on the day               │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                  [Cancel]   [Next: Schedule ›] │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Region-by-region spec

**Step indicator** — a card, 12px radius, 1px `#E5E7EB`, 24px padding, full content width, 96px tall, 24px below the page header and 32px above the step card.

| Element | Spec |
|---|---|
| Step node | 32px circle. **Upcoming:** 2px `#D1D5DB` border, transparent fill, number Body SM 600 Gray 600. **Current:** filled `#2563EB`, white number, plus a 4px `#DBEAFE` ring at 2px offset. **Complete:** filled `#DCFCE7` with a 16px `Check` `#15803D`, and the whole node is a button |
| Connector | 2px line between nodes, flexes to fill. `#E5E7EB` ahead of the current step, `#2563EB` behind it |
| Step title | Body SM 600 below the node, 8px gap. Current Gray 900; complete Gray 900; upcoming Gray 600 |
| Step sub-line | Caption Gray 600, 4px below the title, **two lines maximum**. On complete steps it shows the actual entered summary — `5 days · ₹18,400.00` — not the generic description |
| Alignment | 4 equal columns; node centred over its column; the first node aligns left and the last right so the connectors reach the card's inner edges |
| Clickability | Complete steps are clickable and return to that step, preserving all input. Upcoming steps are not clickable until reached; hovering one shows a tooltip `Finish the schedule first` |

**Step 1 card** — Card, 24px padding, max-width 720px (single-column form), centred in the content area.

| Element | Spec | Content |
|---|---|---|
| Card heading | H4 18px 600 Gray 900 with a 1px bottom divider 12px below | `Party details` |
| Label | Body SM 500 Gray 900, blue `*` for required, 6px above the field | `Party name *` |
| Party name | Full-width 48px input (the first field on a fast-entry form), autofocused, any script | Placeholder `e.g. Shreeji Wedding Hall` |
| Party name helper | Caption Gray 600, space reserved | `The name you'll recognise on the day — hall, family or contact person` |
| Phone / Alternate phone | **Two-column row** — the only two-column pairing in this form, per standards §6.1. Each 40px, 200px wide, `tel` input mode | Placeholder `e.g. 9825044556` |
| Delivery address | Full-width textarea, 3 rows, resizable vertically only, any script | Placeholder `Plot, landmark, area, city and PIN` |
| Notes | Full-width textarea, 3 rows | Placeholder `Access instructions, contact person, anything useful on the day` |
| Footer | Sticky inside the card, 1px top border, 16px/24px padding, right-aligned, 12px gap | `[Cancel]` ghost · `[Next: Schedule ›]` primary |

### 4.4 Content and copy

| Slot | Literal string |
|---|---|
| Page title / subtitle | `New Party Booking` / `Book the party, build the day-by-day schedule, take a deposit` |
| Step titles | `Party details` · `Schedule` · `Advance` · `Review` |
| Step sub-lines (empty) | `Name, phone, address` · `Delivery days and items` · `Optional deposit` · `Confirm and book` |
| Step sub-lines (complete) | `Shreeji Wedding Hall` · `5 days · ₹18,400.00` · `₹10,000.00 advance` · — |
| Card heading | `Party details` |
| Labels | `Party name *` · `Phone *` · `Alternate phone` · `Delivery address *` · `Notes` |
| Placeholders | `e.g. Shreeji Wedding Hall` · `e.g. 9825044556` · `e.g. 9909112233` · `Plot, landmark, area, city and PIN` · `Access instructions, contact person, anything useful on the day` |
| Helpers | `The name you'll recognise on the day — hall, family or contact person` · `Access instructions, contact person, anything useful on the day` |
| Buttons | `Cancel` · `Next: Schedule ›` |
| Error — name | `Enter the party or hall name.` |
| Error — phone | `Enter a 10-digit mobile number.` |
| Error — phone same as alternate | `The alternate number is the same as the main number.` |
| Error — address | `Enter the delivery address — this is what the driver reads on the day.` |
| Duplicate-party notice | Info banner: `A booking for Shreeji Wedding Hall on 9825044556 already exists — PTY-000039, 12–14 Jun 2026. Carry on if this is a new event.` with a `View PTY-000039` link, dismissible |
| Cancel-confirm | Title `Discard this booking?` · Body `You've entered the party details and 5 delivery days. Nothing has been saved yet.` · `[Keep editing]` + `[Discard]` destructive |

### 4.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Step indicator renders fully; the card shows five 40–48px shimmer bars in the field positions. Under 300ms in practice |
| **Loading (returning to step 1 from step 3)** | No loading — all wizard state is held client-side; steps switch instantly |
| **Empty — first open** | All fields blank, Party name autofocused, `Next: Schedule ›` **enabled** (validation happens on click, so the button never looks broken) |
| **Empty (no results)** | Not applicable |
| **Filled** | As wireframe |
| **Error — validation** | Per-field 1px `#EF4444` border with a Caption error and a 14px `AlertCircle` below; plus a Danger banner above the footer titled `Fill in the party details before continuing` listing each missing field as a clickable line |
| **Partial error** | Duplicate-party lookup unavailable: no banner, no blocking. Silently degrade — this check is a convenience, not a gate |
| **Submitting** | Step 1 never submits to the server; `Next` is instant |
| **Success** | Step indicator advances: node 1 becomes a green tick with the sub-line `Shreeji Wedding Hall`, node 2 becomes current. Content swaps over 200ms |
| **Disabled** | Nothing on this step is disabled |
| **Read-only** | Not applicable |
| **Recovered draft** | If the browser was closed mid-wizard, on reopen show an Info banner above the step indicator: `Picking up where you left off — Shreeji Wedding Hall, 5 days. [Start over]` |

### 4.6 Interactions

| Trigger | Behaviour |
|---|---|
| Load | Party name autofocused |
| Tab order | Party name → Phone → Alternate phone → Delivery address → Notes → Cancel → Next |
| `Enter` in a single-line field | Advances to the next field, does **not** submit the step |
| `⌘/Ctrl + Enter` | Advances the step |
| Click `Next: Schedule ›` | Validates all four required fields; on failure focuses the first invalid one and scrolls it into view. On success advances |
| Click a completed step node | Returns to that step with everything preserved |
| Phone blur | Validates 10 digits; strips spaces, hyphens and a `+91` prefix silently rather than erroring on them |
| Cancel | Discard confirm if anything is entered anywhere in the wizard |
| Browser back | Moves back one wizard step rather than leaving the page; leaving triggers `beforeunload` |

### 4.7 Responsive — below `md` (768px)

Content padding 16px. The step indicator collapses to a **compact bar**, 64px tall: on the left `Step 1 of 4` Caption 12px 600 uppercase Gray 600 with the current step title `Party details` in Body SM 600 Gray 900 beneath; on the right the three remaining steps as 8px dots (current filled `#2563EB`, complete `#22C55E`, upcoming `#D1D5DB`). A 2px progress bar fills the bar's bottom edge at 25 / 50 / 75 / 100%. Tapping the bar opens a bottom sheet listing all four steps with their sub-lines, completed ones tappable.

The Phone / Alternate phone pair stacks. The footer becomes a fixed 72px bottom bar with `Next: Schedule ›` full-width primary and `Cancel` as a text link above it.

### 4.8 Dark mode

Cards `#1E293B` on `#0B1220`. Step indicator: upcoming node border `#334155` with `#94A3B8` number; current node `#3B82F6` with a `#1E3A8A` ring; complete node `#14532D` fill with a `#22C55E` tick. Connectors `#334155` ahead, `#3B82F6` behind. Input borders `#334155`, focus `#3B82F6`. Textarea backgrounds stay `#1E293B` — do not tint inputs darker than the card, or they read as disabled.

### 4.9 Stitch prompt

```text
Design step 1 of a four-step booking wizard, "New Party Booking", for an internal
Indian water-plant app. Light theme: page #F8FAFC, white cards, 1px #E5E7EB borders,
12px radius. Inter for text, JetBrains Mono for numbers, blue #2563EB primary.

Top: small blue link "‹ Party Orders", 28px semibold "New Party Booking", grey 14px
"Book the party, build the day-by-day schedule, take a deposit".

Then a full-width white card, 96px tall, holding a horizontal 4-step indicator.
Four 32px circles joined by 2px connector lines. Circle 1 is filled blue #2563EB
with a white "1" and a soft #DBEAFE ring around it. Circles 2, 3 and 4 have 2px grey
#D1D5DB outlines with grey numbers, and the connectors between them are grey. Under
each circle: a 14px semibold title and a 12px grey sub-line — "Party details / Name,
phone, address", "Schedule / Delivery days and items", "Advance / Optional deposit",
"Review / Confirm and book".

Below, a centred white card max 720px wide with 24px padding. Heading "Party
details" in 18px semibold with a thin divider under it. Then a single-column form:
a full-width 48px text input labelled "Party name *" (asterisk in blue) containing
"Shreeji Wedding Hall", with small grey helper text beneath. Then two 200px fields
side by side, "Phone *" = 9825044556 and "Alternate phone" = 9909112233. Then a
full-width 3-row textarea "Delivery address *" containing "Shreeji Party Plot, Nr.
Kalol Cross Road, Gandhinagar – 382721". Then a 3-row textarea "Notes" with helper
text "Access instructions, contact person, anything useful on the day".

A footer strip inside the card with a 1px top border, right-aligned: ghost "Cancel"
and filled blue "Next: Schedule ›".
```

---

## 5. Booking wizard Step 2 — the schedule builder

### 5.1 Purpose

**The centrepiece of the module.** A party order is a calendar, and this is where the calendar is built. It has to make three things effortless: adding an arbitrary day, generating a run of days, and copying a day. It then has to make every generated day individually editable, because the whole reason this is one row per date rather than a recurrence rule is that the owner cancels Tuesday and doubles Wednesday.

Gaps have to be **visible**. A missing date is information — it is the day the wedding didn't need water — and a timeline that silently jumps from the 14th to the 16th hides an error just as effectively as it hides an intention. So empty days render as thin markers.

### 5.2 Layout

```
    ①━━━━━━━━━━━━━━━━━━━②━━━━━━━━━━━━━━━━━━━③━━━━━━━━━━━━━━━━━━━④
  ✓ Party details       Schedule            Advance             Review
  Shreeji Wedding Hall  Delivery days       Optional            Confirm and
                        and items           deposit             book

┌─ Schedule ─────────────────────────────────────────────────────────────────────┐
│  5 delivery days · 14–18 Aug 2026 · 430 units          Total  ₹18,400.00       │
│                                                                                │
│  [ + Add a day ]   [ 🔁 Repeat pattern ]   [ ⧉ Duplicate a day ]               │
│  ────────────────────────────────────────────────────────────────────────────  │
│                                                                                │
│  ● ┌ 14 Aug 2026 · Fri ──────────────────────────────── 🔵 Scheduled ─── ⋯ ┐  │
│  │ │  20L Jar          × 50   @ ₹40.00           ₹2,000.00                 │  │
│  │ │  1L Bottle        × 100  @ ₹10.00           ₹1,000.00                 │  │
│  │ │  ─────────────────────────────────────────────────────────────────    │  │
│  │ │  👤 Ramesh Patel                        Day total    ₹3,000.00        │  │
│  │ └───────────────────────────────────── [Edit day] [⧉ Duplicate] ────────┘  │
│  │                                                                            │
│  ┆ · · · · 15 Aug 2026 · Sat — no delivery · · · · · · · · · [+ Add day] · ·  │
│  │                                                                            │
│  ● ┌ 16 Aug 2026 · Sun ──────────────────────────────── 🔵 Scheduled ─── ⋯ ┐  │
│  │ │  20L Jar          × 80   @ ₹40.00           ₹3,200.00                 │  │
│  │ │  ─────────────────────────────────────────────────────────────────    │  │
│  │ │  👤 Not assigned                        Day total    ₹3,200.00        │  │
│  │ └───────────────────────────────────── [Edit day] [⧉ Duplicate] ────────┘  │
│  │                                                                            │
│  ● ┌ 17 Aug 2026 · Mon ─────────────────────────────── 🔵 Scheduled ──── ⋯ ┐  │
│  │ │  20L Jar         × 120   @ ₹38.00           ₹4,560.00                 │  │
│  │ │    ┃ ⚠ Rate ₹38.00 vs base ₹35.00 · +₹3.00/unit                       │  │
│  │ │  500ml Cold      × 200   @ ₹8.00            ₹1,600.00                 │  │
│  │ │  ─────────────────────────────────────────────────────────────────    │  │
│  │ │  👤 Suresh Chauhan                      Day total    ₹6,160.00        │  │
│  │ └───────────────────────────────────── [Edit day] [⧉ Duplicate] ────────┘  │
│  │                                                                            │
│  ┆ · · · · 18–21 Aug 2026 · 4 days with no delivery · · · [Show days] · · · · │
│  │                                                                            │
│  ● ┌ 22 Aug 2026 · Sat ──────────────────────────────── 🔵 Scheduled ─── ⋯ ┐  │
│  │ │  20L Jar          × 60   @ ₹40.00           ₹2,400.00                 │  │
│  │ │  ─────────────────────────────────────────────────────────────────    │  │
│  │ │  👤 Ramesh Patel                        Day total    ₹2,400.00        │  │
│  ● └───────────────────────────────────── [Edit day] [⧉ Duplicate] ────────┘  │
│                                                                                │
│                                        Days scheduled                    5     │
│                                        Total units                     430     │
│                                        ──────────────────────────────────────  │
│                                        Total payable          ₹18,400.00       │
├────────────────────────────────────────────────────────────────────────────────┤
│                               [‹ Back]   [Cancel]   [Next: Advance ›]          │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Region-by-region spec

**Schedule card header**

| Element | Spec | Content |
|---|---|---|
| Summary line | Body SM Gray 600 left, `·` separated; right-aligned `Total` label Body SM 600 Gray 900 + **18px mono 600** value | `5 delivery days · 14–18 Aug 2026 · 430 units` · `Total ₹18,400.00` |
| Action row | Three buttons, 40px, 12px gap, left-aligned, with a 1px `#E5E7EB` rule 16px below | `+ Add a day` primary-outlined with `CalendarPlus` · `Repeat pattern` outlined with `Repeat` · `Duplicate a day` outlined with `Copy` |
| Button hierarchy | `+ Add a day` is the only one with a `#2563EB` border and blue label; the other two are Gray 600 with `#D1D5DB` borders. Adding one day is the common case; the other two are power tools | — |

**Timeline rail** — a 2px vertical line `#E5E7EB` at x = 16px inside the card's content area, running from the first node to the last. Each day-card gets a **12px dot** centred on the rail, vertically aligned with the card's header row: `#2563EB` filled for Scheduled, `#22C55E` for Delivered, `#F97316` for Skipped, `#D1D5DB` hollow for Cancelled. No-delivery markers get no dot; the rail behind them switches to a 2px **dashed** line, so a gap is legible from the rail alone.

**Day-card**

| Element | Spec | Content |
|---|---|---|
| Card | 12px radius, 1px `#E5E7EB`, surface background, `shadow-sm`, left margin 40px (clearing the rail), 16px gap between cards | — |
| Header | **44px**, 16px horizontal padding, 1px bottom border. Left: date Body 16px 600 Gray 900 + `·` + weekday Body SM Gray 600. Right: status badge, then a 32×32 `⋯` at a 44×44 target | `14 Aug 2026 · Fri` `🔵 Scheduled` |
| Date emphasis | If the date is today: date renders `Today · 16 Aug 2026` and the card gets a 3px `#2563EB` left border. If it is in the past and still Scheduled: an amber `AlertTriangle` 14px sits before the badge with tooltip `This day is in the past and hasn't been marked delivered` | — |
| Item row | **32px**, 16px horizontal padding. Product Body SM Gray 900 (flex) · `× 50` mono 14px 500 Gray 700 (80px right) · `@ ₹40.00` mono 14px 500 Gray 600 (100px right) · line total mono 14px 500 Gray 900 (120px right) | `20L Jar × 50 @ ₹40.00 ₹2,000.00` |
| Delivered quantity | When actual ≠ planned, the quantity cell shows `× 50 → 48` with the planned figure struck in Gray 400 and the actual in Gray 900, and the line total uses the actual | `× 50 → 48` |
| Override strip | When the unit price ≠ product base price: a 28px sub-line under that item, indented 32px, with a 2px `#F97316` left border and Caption `#B45309` | `⚠ Rate ₹38.00 vs base ₹35.00 · +₹3.00/unit` |
| Divider | 1px `#E5E7EB`, full card width, above the footer content | — |
| Assignment + total row | 40px. Left: 14px `Users` Gray 400 + Body SM Gray 700 staff name, or `Not assigned` in Gray 400. Right: `Day total` Body SM 600 Gray 900 + **16px mono 600** value, 16px gap | `👤 Ramesh Patel` · `Day total ₹3,000.00` |
| Footer | **48px**, `#F3F4F6` background, 1px top border, right-aligned actions, 12px gap, 16px padding | `[Edit day]` secondary 32px · `[⧉ Duplicate]` ghost 32px. On the **detail** page this becomes `[Edit day]` `[Mark Delivered]` |
| `⋯` menu | 200px: `Edit day` · `Duplicate to another date` · `Assign staff` · `Mark skipped` · divider · `Remove day` in `#B91C1C` (label becomes `Cancel day` and the item is the only destructive option once the day is delivered) | — |
| Notes | When a day has notes, a 32px row above the divider: 14px `FileText` Gray 400 + Body SM Gray 600 in quotes | `"Deliver by 10 am, mandap starts at 11"` |

**No-delivery marker** — the pattern that makes gaps visible.

| Element | Spec | Content |
|---|---|---|
| Single day | **28px** tall, left margin 40px, full width. A 1px **dashed** `#E5E7EB` line runs through the vertical centre; a centred label sits on it with 12px of surface-coloured padding either side so the line appears to break: Caption 12px 500 `#D1D5DB` | `15 Aug 2026 · Sat — no delivery` |
| Hover | The label lifts to Gray 600, and a 28px ghost `+ Add day` button fades in at the right end over 100ms. Clicking anywhere on the marker opens the Edit-day modal pre-set to that date | `+ Add day` |
| Collapsed run | Runs of **4 or more** consecutive empty days collapse to a single 32px marker with a `Show days` link at the right: expanding replaces it with the individual markers | `18–21 Aug 2026 · 4 days with no delivery` · `Show days` |
| Boundaries | Markers only render **between** the first and last scheduled day. There are no markers before the start or after the end — a schedule doesn't have infinite empty days on either side | — |
| Ordering | Days are always in ascending date order and cannot be reordered; the date is the ordering | — |

**Totals block** — right-aligned, 320px, 24px above the footer, 8px row gap: `Days scheduled` `5` (mono 500) · `Total units` `430` (mono 500) · 1px top border · `Total payable` label Body SM 600 Gray 900, value **18px mono 600** Gray 900.

**Wizard footer** — sticky inside the card: `[‹ Back]` ghost · `[Cancel]` ghost Gray 600 · `[Next: Advance ›]` primary.

### 5.4 The repeat-pattern generator — modal, 720px

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Repeat pattern                                                         ✕  │
│  Generate a run of delivery days, then edit any of them afterwards          │
├────────────────────────────────────────────────────────────────────────────┤
│  Start date              End date                Repeat                    │
│  [ 14 Aug 2026    📅 ]   [ 22 Aug 2026    📅 ]   [ Every day ▾ ]           │
│                                                   Every day                │
│                                                   Alternate days           │
│                                                   Every N days →  [ 3 ]    │
│                                                                            │
│  Items for each generated day                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ PRODUCT             QTY     BASE      UNIT PRICE      LINE TOTAL     │  │ 44
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ [20L Jar        ▾]  [ 50]  ₹35.00    [₹  40.00]       ₹2,000.00  ✕  │  │ 56
│  │   ┃ ⚠ Rate overridden +₹5.00/unit · +₹250.00                        │  │ 40
│  │ [1L Bottle      ▾]  [100]  ₹10.00    [₹  10.00]       ₹1,000.00  ✕  │  │ 56
│  └──────────────────────────────────────────────────────────────────────┘  │
│  [ + Add item ]                          Per-day total       ₹3,000.00     │
│                                                                            │
│  Assign staff (optional)                                                   │
│  [ Ramesh Patel · 9876543210                                          ▾ ]  │
│                                                                            │
│  ── Preview ──────────────────────────────────────────── 5 days ──────────  │
│  ☑ 14 Aug · Fri    ☑ 16 Aug · Sun    ☑ 18 Aug · Tue                        │
│  ☑ 20 Aug · Thu    ☑ 22 Aug · Sat                                          │
│  ☒ 15 Aug · Sat — already scheduled, will be skipped                       │
├────────────────────────────────────────────────────────────────────────────┤
│  5 days · 750 units · ₹15,000.00 will be added                             │
│                                        [Cancel]   [Generate 5 days]        │
└────────────────────────────────────────────────────────────────────────────┘
```

| Element | Spec | Content |
|---|---|---|
| Modal | 720px (it contains a table), max-height `min(700px, 90vh)`, header and footer fixed | — |
| Title / subtitle | H4 `Repeat pattern` / Body SM Gray 600 | `Generate a run of delivery days, then edit any of them afterwards` |
| Start / End date | Two 180px date inputs. End must be ≥ start. Start defaults to today or, if days already exist, the day after the last one | — |
| Repeat select | 200px select: `Every day` · `Alternate days` · `Every N days`. Choosing the third reveals an inline 80px quantity input to its right with the label `days` and a min of 3 | — |
| Items table | Identical 56px line-item pattern to the delivery-order form: PRODUCT search select · QTY 100px · BASE read-only computed · UNIT PRICE 140px money input pre-filled from base · LINE TOTAL read-only computed mono 600 · `✕` | — |
| Override strip | Same as elsewhere: 2px `#F97316` left border on the block, Warning chip with per-unit and line difference | `⚠ Rate overridden +₹5.00/unit · +₹250.00` |
| Per-day total | Right-aligned beside `+ Add item`, Body SM 600 label + 16px mono 600 value | `Per-day total ₹3,000.00` |
| Assign staff | Full-width search select, optional, applies to every generated day | Placeholder `Same staff for every day (optional)` |
| **Preview band** | 32px section band, Caption 12px 600 uppercase Gray 600 left, count right. Below it, generated dates as a wrapping grid of 32px chips, 8px gaps, 4 per row on desktop | `PREVIEW` · `5 days` |
| Date chip | Default badge style at 32px with a 16px checkbox on the left, checked by default: `☑ 14 Aug · Fri`. Unticking excludes that date without changing the pattern — the escape hatch that makes a rigid pattern usable | — |
| Conflict chip | A date already in the schedule renders unchecked, non-interactive, at 60% opacity with a strikethrough date and the reason appended in Caption `#B45309` | `☒ 15 Aug · Sat — already scheduled, will be skipped` |
| Footer summary | Body SM Gray 600 with mono figures, left | `5 days · 750 units · ₹15,000.00 will be added` |
| Actions | `[Cancel]` ghost · `[Generate 5 days]` primary — **the button counts what it will do** and updates live as chips are ticked | — |

**After generation:** the modal closes, the timeline scrolls to the first new day, and every generated day-card is marked with a 22px Primary badge `Generated` next to its status badge for the remainder of the session. An Info banner appears above the timeline: `5 days generated from 14 to 22 Aug. Edit any of them individually — they're ordinary days now.` Dismissible.

### 5.5 The duplicate-a-day flow — dialog, 420px

Opened from `Duplicate a day` in the action row (which first asks which day) or directly from a day-card's `⧉ Duplicate`.

```
┌────────────────────────────────────────────────┐
│  ⧉                                             │
│  Duplicate 14 Aug 2026                         │
│                                                │
│  2 items · 150 units · ₹3,000.00 will be       │
│  copied to the date you choose.                │
│                                                │
│  Copy to *                                     │
│  [ 19 Aug 2026                          📅 ]   │
│                                                │
│  ☑ Also copy the assigned staff (Ramesh Patel) │
│  ☐ Also copy the day's notes                   │
│                                                │
│                  [Cancel]  [Duplicate day]     │
└────────────────────────────────────────────────┘
```

Copy: title `Duplicate 14 Aug 2026`; body `2 items · 150 units · ₹3,000.00 will be copied to the date you choose.`; date label `Copy to *`; checkbox labels `Also copy the assigned staff (Ramesh Patel)` and `Also copy the day's notes`; error when the target already exists — `19 Aug 2026 is already in this schedule. Pick another date, or edit that day instead.` with an `Edit 19 Aug` link; success toast `14 Aug copied to 19 Aug · ₹3,000.00 added`.

### 5.6 Content and copy

| Slot | Literal string |
|---|---|
| Card heading | `Schedule` |
| Summary line | `5 delivery days · 14–18 Aug 2026 · 430 units` (singular `1 delivery day · 14 Aug 2026 · 150 units`) |
| Action buttons | `+ Add a day` · `Repeat pattern` · `Duplicate a day` |
| Day-card status badges | `Scheduled` · `Delivered` · `Skipped` · `Cancelled` |
| Unassigned | `Not assigned` |
| Day total | `Day total` |
| Day-card actions | `Edit day` · `Duplicate` · on detail `Mark Delivered` |
| No-delivery marker | `15 Aug 2026 · Sat — no delivery` |
| Collapsed run | `18–21 Aug 2026 · 4 days with no delivery` · link `Show days` · when expanded `Hide days` |
| Past-day warning tooltip | `This day is in the past and hasn't been marked delivered` |
| Totals labels | `Days scheduled` · `Total units` · `Total payable` |
| Empty schedule title | `No delivery days yet` |
| Empty schedule body | `A party order is a calendar. Add the first day, or generate a run of days and edit them afterwards — 50 jars on the 14th, nothing on the 15th, 80 on the 16th is a perfectly normal schedule.` |
| Empty schedule CTAs | `+ Add the first day` primary · `Repeat pattern` secondary |
| Generator title / subtitle | `Repeat pattern` / `Generate a run of delivery days, then edit any of them afterwards` |
| Generator labels | `Start date` · `End date` · `Repeat` · `Items for each generated day` · `Assign staff (optional)` · `PREVIEW` |
| Repeat options | `Every day` · `Alternate days` · `Every N days` + `days` |
| Generator conflict chip | `15 Aug · Sat — already scheduled, will be skipped` |
| Generator footer | `5 days · 750 units · ₹15,000.00 will be added` |
| Generator button | `Generate 5 days` (singular `Generate 1 day`) |
| Post-generation banner | `5 days generated from 14 to 22 Aug. Edit any of them individually — they're ordinary days now.` |
| Error — no items in generator | `Add at least one item — every generated day needs something to deliver.` |
| Error — end before start | `The end date is before the start date.` |
| Error — too many days | `That pattern makes 94 days. Shorten the range — a booking longer than 60 days is almost always a typo.` |
| Error — all dates conflict | `Every date in that range is already scheduled. Change the range, or edit the existing days.` |
| Error — no days selected | `Tick at least one date to generate.` |
| Error — day without items | Inline on the day-card: `This day has no items. Add at least one, or remove the day.` with the card getting a 1px `#EF4444` border |
| Step-level error | `Add at least one delivery day before continuing.` |
| Buttons | `‹ Back` · `Cancel` · `Next: Advance ›` |

### 5.7 States

| State | Presentation |
|---|---|
| **Loading (first)** | Card header and action row real; the timeline area shows 2 skeleton day-cards — a 44px header bar, two 32px item bars and a 48px footer bar, all shimmering |
| **Loading (generating)** | The generator's primary button shows a spinner with the label `Generating…`; on close, new day-cards appear **already rendered** — they are not animated in, per standards §16 |
| **Loading (recalculating totals)** | The totals block values shimmer in place for the ~200ms recalculation; day-cards stay interactive |
| **Empty — no days at all** | Centred 320px block inside the timeline area: 48px `Calendar` Gray 300, H4 `No delivery days yet`, Body SM copy from 5.6, primary `+ Add the first day` and secondary `Repeat pattern` side by side. Totals show `0` / `0` / `—`. `Next: Advance ›` is enabled but validates on click |
| **Empty — no results** | Not applicable |
| **Empty — a day with no items** | The day-card body is replaced by a 64px centred Caption Gray 600 `No items on this day yet` and a 32px ghost `+ Add items`. The card gets a 1px `#EF4444` border once `Next` has been pressed |
| **Filled** | As wireframe |
| **Filled — with gaps** | No-delivery markers between scheduled days; runs of 4+ collapsed |
| **Generated days** | Each carries a Primary `Generated` badge for the session, plus the dismissible Info banner |
| **Rate overridden** | 2px `#F97316` left border on the item's sub-line, Warning Caption naming the base price and the per-unit difference |
| **Delivered quantity differs** | `× 50 → 48` with the planned figure struck; a Caption under the day total reads `Billed on delivered quantities` |
| **Skipped day** | Card body at 60% opacity, badge Warning `Skipped`, day total renders `—` with a Caption `Not billed`, rail dot `#F97316` |
| **Cancelled day** | Card at 60% opacity, Default `Cancelled` badge, total `—`, footer actions reduced to `⋯ › Restore day`, rail dot hollow |
| **Error — generator** | Danger banner inside the modal above the footer; values preserved |
| **Partial error** | Product prices failed to load: the generator's BASE column shows `—` and a Warning banner reads `Base prices couldn't be loaded. Enter the unit price manually — it won't be flagged as an override.` |
| **Submitting** | Step 2 holds state client-side; `Next` is instant. Only the generator submits, and only into local state |
| **Success** | Step indicator advances; node 2 becomes a green tick with sub-line `5 days · ₹18,400.00` |
| **Disabled** | `Duplicate a day` disabled at 40% when no days exist, tooltip `Add a day first`. `Generate` disabled when no date chips are ticked, with Caption `Tick at least one date` |
| **Read-only** | On the detail page's schedule tab for a cancelled booking: all action buttons removed, day-cards render at full opacity for audit, no-delivery markers stay |

### 5.8 Interactions

| Trigger | Behaviour |
|---|---|
| Click `+ Add a day` | Opens the Edit-day modal (§8) with a blank date defaulting to the day after the last scheduled day |
| Click a no-delivery marker | Opens the Edit-day modal pre-set to that exact date. This is the fastest path to filling a gap and must be discoverable — hence the hover treatment |
| Click `Show days` on a collapsed run | Expands in place over 200ms; the link becomes `Hide days`; state is per-run and not persisted |
| Click `Repeat pattern` | Opens the 720px generator. Focus moves to Start date |
| Change any generator input | The preview chips and the footer summary recompute immediately; the primary button's count updates |
| Untick a preview chip | Removes that date from the run without altering the pattern; count and summary update |
| Click `Generate N days` | Closes the modal, inserts the days in date order, scrolls the first new card into view, shows the Info banner |
| Click `Duplicate a day` in the action row | Opens a 420px picker listing existing days as radio rows (`14 Aug · Fri · 2 items · ₹3,000.00`), then the duplicate dialog |
| Click `⧉ Duplicate` on a card | Skips the picker, opens the duplicate dialog for that day |
| Click `Edit day` | Opens the Edit-day modal (§8) for that date |
| Click `⋯ › Remove day` | Confirm dialog: `Remove 16 Aug 2026?` / `2 items worth ₹3,200.00 will be removed from this schedule. Total payable goes from ₹18,400.00 to ₹15,200.00.` / `[Cancel]` + `[Remove day]` destructive |
| Keyboard on the timeline | `↑ ↓` move focus between day-cards and markers; `Enter` opens the focused card's Edit modal; `d` duplicates the focused card; `Delete` opens the remove confirm |
| Tab order | Add a day → Repeat pattern → Duplicate a day → day 1 `⋯` → day 1 Edit → day 1 Duplicate → marker `+ Add day` → day 2 … → Back → Cancel → Next |
| Generator tab order | Start → End → Repeat → (N) → item rows → Add item → Assign staff → first date chip → … → Cancel → Generate |
| `⌘/Ctrl + Enter` | Advances the wizard step; inside the generator, generates |
| Validation timing | Never while typing. A day with no items is flagged only once `Next` is pressed, and then live-clears the moment an item is added |

### 5.9 Responsive — below `md` (768px)

Content padding 16px. The three action buttons stack into a full-width segmented row 44px tall: `+ Add a day` takes 50% as a filled primary; `Repeat` and `Duplicate` take 25% each as icon-plus-label outlined buttons.

The timeline rail moves to x = 8px and day-cards get a 24px left margin. Day-card headers wrap: date on line 1, weekday and badge on line 2. Item rows become two lines each — product name on line 1, `× 50 @ ₹40.00` left and the line total right on line 2 — because four columns in 320px is unreadable. Day-card footers keep both buttons at 44px, splitting the width.

No-delivery markers keep their 28px height and dashed line but drop the `+ Add day` button; the whole marker is tappable at a 44px effective target achieved with vertical padding.

The generator modal becomes a full-screen sheet. Its items table becomes one card per line (as in module 03 §4.7). Preview chips go 2 per row. The footer keeps the summary line above the full-width `Generate 5 days` button.

### 5.10 Dark mode

Day-cards `#1E293B` on `#0B1220`; card footers `#0F172A`. The timeline rail `#334155`; the dashed segment behind no-delivery markers `#334155` at 60% opacity. No-delivery marker label `#475569`, lifting to `#94A3B8` on hover, with the label's "break" padding drawn in the page colour `#0B1220` rather than the card colour. Rail dots keep their semantic colours. `Generated` badge `#1E3A8A` / `#BFDBFE`. Override strip border stays `#F97316` with a `#FED7AA` label. In the generator, preview chips are `#334155` / `#E2E8F0`; conflict chips drop to 50% opacity with a `#FED7AA` reason.

### 5.11 Stitch prompt

```text
Design step 2 of a booking wizard — a vertical SCHEDULE TIMELINE for multi-day event
water deliveries, for an internal Indian app. Light theme: page #F8FAFC, white cards,
1px #E5E7EB borders, 12px radius. Inter for text, JetBrains Mono for all numbers.

At the top, a 4-step indicator: step 1 is a green circle with a tick labelled "Party
details / Shreeji Wedding Hall", step 2 is a filled blue #2563EB circle labelled
"Schedule", steps 3 and 4 are grey outlined circles.

Below, a wide white card headed "Schedule". Its top line reads "5 delivery days ·
14–18 Aug 2026 · 430 units" in grey on the left, and on the right "Total ₹18,400.00"
with the figure in 18px bold mono. Under it, three buttons: a blue-outlined
"+ Add a day", and grey-outlined "🔁 Repeat pattern" and "⧉ Duplicate a day". A thin
rule beneath.

Then a vertical timeline: a 2px light-grey rail down the left with 12px blue dots.
Each dot connects to a DAY CARD — a white card with a 1px border and 12px radius.
Card header 44px: "14 Aug 2026 · Fri" in 16px semibold with the weekday in grey, and
on the right a blue pill "Scheduled" and a ⋯ button. Card body: item rows 32px each
— "20L Jar" left, then right-aligned mono "× 50", "@ ₹40.00" in grey, "₹2,000.00".
Second row "1L Bottle × 100 @ ₹10.00 ₹1,000.00". A thin divider, then a row with a
small person icon and "Ramesh Patel" on the left and "Day total ₹3,000.00" bold on
the right. A 48px light-grey #F3F4F6 footer with two small buttons "Edit day" and
"⧉ Duplicate".

Between the first and second day card, show a NO-DELIVERY MARKER: a 28px tall row
with a thin DASHED grey line running through it, broken in the middle by pale grey
12px text "15 Aug 2026 · Sat — no delivery". The rail behind it is dashed too.

Show three day cards, one no-delivery marker, and one collapsed marker reading
"18–21 Aug 2026 · 4 days with no delivery" with a small "Show days" link. One card's
item has a small amber sub-line with a 2px orange left bar: "⚠ Rate ₹38.00 vs base
₹35.00 · +₹3.00/unit".

At the bottom right: "Days scheduled 5", "Total units 430", a rule, and "Total
payable ₹18,400.00" in 18px bold mono. Footer: ghost "‹ Back", ghost "Cancel",
filled blue "Next: Advance ›".
```

---

## 6. Booking wizard Steps 3 and 4 — Advance and Review

### 6.1 Purpose

Step 3 takes the deposit, which is optional and may legitimately exceed the current total — a party pays ₹20,000 up front before the full schedule is built. Step 4 is the last chance to catch a wrong date or a wrong rate before the booking exists, so it shows everything at once, read-only, with an edit route back into each step.

### 6.2 Layout

```
    ✓━━━━━━━━━━━━━━━━━━━✓━━━━━━━━━━━━━━━━━━━③━━━━━━━━━━━━━━━━━━━④
  Party details        Schedule            Advance             Review
  Shreeji Wedding Hall 5 days ·            Optional            Confirm and
                       ₹18,400.00          deposit             book

┌─ Advance payment ──────────────────────────────────── max 720px ─────────────┐
│  Taking a deposit is optional. You can record payments any time after booking. │
│                                                                                │
│  [ ● ] Record an advance now                                                   │
│                                                                                │
│  Date                        Amount *                    Mode *                │
│  [ 16 Aug 2026      📅 ]     [ ₹    10,000.00 ]          [ Cash        ▾ ]     │
│                                                           Cash                 │
│                                                           UPI                  │
│                                                           Bank transfer        │
│  Reference                                                                     │
│  [ Paid by Bhavesh at the plant                                            ]   │
│                                                                                │
│                              Total payable                     ₹18,400.00      │
│                              Advance now                       ₹10,000.00      │
│                              ────────────────────────────────────────────      │
│                              Outstanding after booking          ₹8,400.00      │
├────────────────────────────────────────────────────────────────────────────────┤
│                               [‹ Back]   [Cancel]   [Next: Review ›]           │
└────────────────────────────────────────────────────────────────────────────────┘
```

```
┌─ Review ───────────────────────────────────────────────────────────────────────┐
│  Party details                                                    [Edit]       │
│  Shreeji Wedding Hall · 9825044556 · 9909112233                                │
│  Shreeji Party Plot, Nr. Kalol Cross Road, Gandhinagar – 382721                 │
│  "Ask for Bhavesh at the gate. Jars go to the back kitchen, not the main hall." │
│  ────────────────────────────────────────────────────────────────────────────  │
│  Schedule · 5 days · 14–22 Aug 2026                               [Edit]       │
│  14 Aug · Fri   20L Jar × 50 · 1L Bottle × 100        Ramesh      ₹3,000.00    │
│  16 Aug · Sun   20L Jar × 80                          —           ₹3,200.00    │
│  17 Aug · Mon   20L Jar × 120 · 500ml Cold × 200      Suresh      ₹6,160.00    │
│  20 Aug · Thu   20L Jar × 90                          Ramesh      ₹3,640.00    │
│  22 Aug · Sat   20L Jar × 60                          Ramesh      ₹2,400.00    │
│  ────────────────────────────────────────────────────────────────────────────  │
│  Advance                                                          [Edit]       │
│  ₹10,000.00 · Cash · 16 Aug 2026 · "Paid by Bhavesh at the plant"              │
│  ────────────────────────────────────────────────────────────────────────────  │
│                              Total payable                     ₹18,400.00      │
│                              Advance                          −₹10,000.00      │
│                              ────────────────────────────────────────────      │
│                              Outstanding                        ₹8,400.00      │
├────────────────────────────────────────────────────────────────────────────────┤
│                          [‹ Back]   [Cancel]   [Book party order]              │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Step 3 intro | Body SM Gray 600, 16px below the heading | `Taking a deposit is optional. You can record payments any time after booking.` |
| Toggle | 44×24px track, label to the right, tappable. Off = the fields below are hidden entirely and the card is 152px tall | `Record an advance now` |
| Date | 180px date input, defaults today | `16 Aug 2026` |
| Amount | 200px money input, `₹` prefix Gray 600 inside, mono right-aligned, 48px tall (the primary field on this step), autofocused when the toggle turns on | — |
| Mode | 200px select, three options | `Cash` · `UPI` · `Bank transfer` |
| Reference | Full-width text input. Label changes with mode: `Reference` for Cash, `UPI reference` for UPI, `Transaction reference` for Bank transfer | Placeholder varies — see 6.4 |
| Step 3 totals | Right-aligned 320px block: `Total payable` mono 500 · `Advance now` mono 500 `#2563EB` · 1px rule · `Outstanding after booking` label Body SM 600, value **18px mono 600** | — |
| Advance-exceeds notice | When the advance is greater than the total: a Primary/info banner above the totals — copy in 6.4. **Allowed, not blocked** | — |
| Review sections | Three stacked blocks separated by 1px `#E5E7EB` rules with 24px above and below. Each has an H4-weight Body SM 600 Gray 900 heading on the left and a 32px `Edit` ghost button on the right that returns to that step | `Party details` · `Schedule · 5 days · 14–22 Aug 2026` · `Advance` |
| Review — party | Body SM Gray 900 identity line, Body SM Gray 600 address line, Body SM Gray 600 quoted notes line | — |
| Review — schedule | A compact read-only table, **40px rows** (no inputs, so tighter than a day-card): DATE 120px · ITEMS flex, `·` separated · STAFF 100px, `—` when unassigned · DAY TOTAL 120px right mono 500. Skipped and cancelled days are excluded with a Caption note beneath if any exist | — |
| Review — advance | Single Body SM line, `·` separated, with the amount in mono 600 | `₹10,000.00 · Cash · 16 Aug 2026 · "Paid by Bhavesh at the plant"` |
| Review totals | `Total payable` mono 500 · `Advance` mono 500 `#15803D` with a `−` prefix · rule · `Outstanding` label Body SM 600 Gray 900, value **18px mono 600** Gray 900 | — |
| Final button | Primary, min-width 180px, **names the action** | `Book party order` |

### 6.4 Content and copy

| Slot | Literal string |
|---|---|
| Step 3 heading / intro | `Advance payment` / `Taking a deposit is optional. You can record payments any time after booking.` |
| Toggle | `Record an advance now` |
| Labels | `Date` · `Amount *` · `Mode *` · `Reference` / `UPI reference` / `Transaction reference` |
| Reference placeholders | Cash `e.g. Paid by Bhavesh at the plant` · UPI `e.g. 421884993201` · Bank transfer `e.g. NEFT/HDFC/8841002` |
| Step 3 totals | `Total payable` · `Advance now` · `Outstanding after booking` |
| Advance-exceeds banner | `₹20,000.00 is more than the current total of ₹18,400.00. That's fine for a deposit taken before the schedule is finished — the booking will show ₹1,600.00 as a refund due until more days are added.` |
| Error — amount zero | `Enter an amount greater than ₹0.00, or turn off "Record an advance now".` |
| Error — mode | `Choose how the money came in.` |
| Error — date | `The advance date can't be in the future.` |
| Review headings | `Party details` · `Schedule · 5 days · 14–22 Aug 2026` · `Advance` |
| Review — no advance | `No advance taken. The full ₹18,400.00 is outstanding.` in Body SM Gray 600, with the `Edit` button reading `Add an advance` |
| Review totals | `Total payable` · `Advance` · `Outstanding` |
| Review columns | `DATE` · `ITEMS` · `STAFF` · `DAY TOTAL` |
| Buttons | `‹ Back` · `Cancel` · `Next: Review ›` · `Book party order` · submitting `Booking…` |
| Success toast | `PTY-000045 booked · Shreeji Wedding Hall · 5 days · ₹18,400.00` |
| Success toast (with advance) | `PTY-000045 booked · ₹10,000.00 advance recorded · ₹8,400.00 outstanding` |
| Error — server | Banner title `This booking couldn't be saved` · Body `The server didn't respond. Nothing has been booked — your details and all 5 days are still here.` + `Try again` |
| Error — duplicate date slipped through | `16 Aug 2026 appears twice in the schedule. Go back and remove one.` with a `Fix the schedule` link |

### 6.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Instant — all wizard state is client-side |
| **Loading (booking)** | Handled under Submitting |
| **Empty — advance off** | Step 3 shows only the intro, the toggle and a Caption `You'll be able to record payments from the booking page.` Totals block shows `Total payable` and `Outstanding after booking` equal to each other |
| **Empty — no results** | Not applicable |
| **Filled** | As wireframe |
| **Advance exceeds total** | Info banner, `Outstanding after booking` renders `(₹1,600.00)` in `#B91C1C` with a Caption `Refund due — add more days and this clears` |
| **Error — validation** | Field borders `#EF4444` with Caption errors; a Danger banner above the footer listing each problem as a clickable line that focuses the field |
| **Partial error** | Not applicable on step 3; on step 4, if the day totals fail to re-verify against the server, a Warning banner reads `Totals couldn't be re-checked just now. Booking will use the figures shown.` and booking is still allowed |
| **Submitting** | `Book party order` shows a spinner, label `Booking…`; all footer buttons disable; the review card dims to 60%; the step indicator freezes |
| **Success** | Navigate to `/party-orders/[id]` with the success toast. The wizard's client-side draft is cleared |
| **Disabled** | `Book party order` is never disabled — validation runs on click and reports specifically. A disabled final button on a four-step wizard is the worst dead end in the app |
| **Read-only** | Step 4 is entirely read-only by design; every value has an `Edit` route back to its step |

### 6.6 Interactions

| Trigger | Behaviour |
|---|---|
| Toggle `Record an advance now` | Expands over 200ms and focuses Amount |
| Change Mode | The Reference label and placeholder change immediately; any typed value is kept |
| Type Amount | `Advance now` and `Outstanding after booking` recompute live; the exceeds-total banner appears and disappears at the threshold with a 100ms fade |
| Click `Edit` on a review section | Returns to that step with everything preserved; the step indicator marks steps ahead as incomplete again but keeps their data |
| `⌘/Ctrl + Enter` on step 4 | Books |
| Click `Book party order` | Validates every step; on failure jumps to the offending step, focuses the field and shows the Danger banner there |
| Success | `/party-orders/[id]`, toast, focus on the detail page title |
| Tab order (step 3) | Toggle → Date → Amount → Mode → Reference → Back → Cancel → Next |
| Tab order (step 4) | Edit (party) → Edit (schedule) → Edit (advance) → Back → Cancel → Book party order |

### 6.7 Responsive — below `md` (768px)

Step 3: Date, Amount and Mode stack to full width; Amount stays 200px and left-aligned so it doesn't look like a text field. Totals go full width, labels left, values right.

Step 4: the review schedule table becomes stacked rows — date and day total on line 1 (date left Body SM 600, total right mono 600), items on line 2 in Caption Gray 600, staff on line 3 in Caption Gray 600. Section `Edit` buttons move to the right of their headings at a 44×44 target. The footer becomes a fixed 72px bar with `Book party order` full-width primary and `‹ Back` as a text link to its left.

### 6.8 Dark mode

Cards `#1E293B`. The step-3 `Advance now` figure lifts to `#3B82F6`; the step-4 `Advance` deduction stays `#22C55E`. The advance-exceeds info banner becomes `#1E3A8A` bg / `#BFDBFE` text / `#3B82F6` border. Review section dividers `#334155`. The read-only review table uses no fills at all — separation comes from the 1px rules, since an inset fill on dark reads as a disabled control.

### 6.9 Stitch prompt

```text
Design step 4 "Review" of a four-step booking wizard for an internal Indian
water-plant app. Light theme: page #F8FAFC, white card, 1px #E5E7EB borders, 12px
radius, 24px padding, max width 960px. Inter text, JetBrains Mono numbers, blue
#2563EB.

Top: a 4-step indicator where steps 1, 2 and 3 are green circles with white ticks
(labelled "Party details / Shreeji Wedding Hall", "Schedule / 5 days · ₹18,400.00",
"Advance / ₹10,000.00 advance") and step 4 is a filled blue circle labelled "Review /
Confirm and book". Connectors behind the current step are blue.

The card contains three stacked read-only sections separated by thin rules. Each has
a 14px semibold heading on the left and a small ghost "Edit" button on the right.

Section 1 "Party details": "Shreeji Wedding Hall · 9825044556 · 9909112233" then a
grey line "Shreeji Party Plot, Nr. Kalol Cross Road, Gandhinagar – 382721" then a
grey quoted line "Ask for Bhavesh at the gate. Jars go to the back kitchen, not the
main hall."

Section 2 "Schedule · 5 days · 14–22 Aug 2026": a compact borderless table with 40px
rows, columns DATE / ITEMS / STAFF / DAY TOTAL. Rows: "14 Aug · Fri" | "20L Jar × 50
· 1L Bottle × 100" | "Ramesh" | ₹3,000.00; "16 Aug · Sun" | "20L Jar × 80" | an
em-dash | ₹3,200.00; "17 Aug · Mon" | "20L Jar × 120 · 500ml Cold × 200" | "Suresh"
| ₹6,160.00; plus two more rows.

Section 3 "Advance": one line "₹10,000.00 · Cash · 16 Aug 2026 · \"Paid by Bhavesh
at the plant\"".

Bottom right, a totals block: "Total payable ₹18,400.00", "Advance −₹10,000.00" in
green, a rule, then "Outstanding ₹8,400.00" in 18px bold mono.

Footer: ghost "‹ Back", ghost "Cancel", and a wide filled blue button "Book party
order".
```

---

## 7. Party order detail — `/party-orders/[id]`

### 7.1 Purpose

Everything about one booking: where it is in its schedule, what has been billed, what has been received, and what happened when. It reuses the day-card timeline from the schedule builder — same component, now with `Mark Delivered` in the footer — so nothing new is learned between building a schedule and running one.

### 7.2 Layout

```
‹ Party Orders
PTY-000045                                    🟠 ₹8,400 due     🔵 In progress
Shreeji Wedding Hall · 9825044556 · 14–22 Aug 2026 · 5 days

              [📅 Add a day]  [💵 Record Payment]  [✏ Edit booking]  [⋯]

┌─ Summary ──────────────────────────────────────────────────────────────────────┐
│  TOTAL PAYABLE      RECEIVED         OUTSTANDING       PROGRESS                │
│  ₹18,400.00         ₹10,000.00       ₹8,400.00         3 of 5 days             │
│  5 days · 430 units 1 advance · 1    due from 22 Aug   ▓▓▓░░ · next 20 Aug     │
│                     payment                                                    │
└────────────────────────────────────────────────────────────────────────────────┘

┌─ 📍 Delivery address ──────────────────────────────────────────── [Copy] ─────┐
│  Shreeji Party Plot, Nr. Kalol Cross Road, Gandhinagar – 382721                │
│  "Ask for Bhavesh at the gate. Jars go to the back kitchen, not the main hall." │
└────────────────────────────────────────────────────────────────────────────────┘

[ Schedule 5 ] [ Payments 2 ] [ Activity ]
────────────────────────────────────────────────────────────────────────────────

  ● ┌ 14 Aug 2026 · Fri ─────────────────────────────── 🟢 Delivered ──── ⋯ ┐
  │ │  20L Jar          × 50 → 48   @ ₹40.00           ₹1,920.00            │
  │ │  1L Bottle        × 100       @ ₹10.00           ₹1,000.00            │
  │ │  ────────────────────────────────────────────────────────────────     │
  │ │  👤 Ramesh Patel  · delivered 6:05 pm    Day total    ₹2,920.00       │
  │ └──────────────────────────────────────────────────── [Edit day] ───────┘
  │
  ┆ · · · · 15 Aug 2026 · Sat — no delivery · · · · · · · · · [+ Add day] · ·
  │
  ● ┌ 16 Aug 2026 · Sun ─────────────────────────────── 🟢 Delivered ──── ⋯ ┐
  ...
  ● ┌ 20 Aug 2026 · Thu ─────────────────────────────── 🔵 Scheduled ──── ⋯ ┐
  │ │  20L Jar          × 90        @ ₹40.00           ₹3,600.00            │
  │ │  ────────────────────────────────────────────────────────────────     │
  │ │  👤 Ramesh Patel                         Day total    ₹3,600.00       │
  │ └────────────────────────── [Edit day] [✓ Mark Delivered] ──────────────┘
```

**Payments tab — timeline with an advance distinction**

```
│ ● 20 Aug 2026 · 2:10 pm                                   Recorded by Admin  ⋯ │
│ │  ₹4,000.00 · UPI · ref 421884993201                                          │
│ │  Running total received ₹14,000.00 of ₹18,400.00                             │
│ │                                                                              │
│ ○ 16 Aug 2026 · 11:20 am                     🔵 Advance    Recorded by Admin ⋯ │
│    ₹10,000.00 · Cash · "Paid by Bhavesh at the plant"                          │
│    Taken at booking, before any delivery                                       │
│                                                                                │
│    Received ₹14,000.00 of ₹18,400.00 · ₹4,400.00 outstanding  [💵 Record Payment]│
```

### 7.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB` with `ChevronLeft` 16px | `‹ Party Orders` |
| Title | H2 28px **mono** 600 Gray 900 | `PTY-000045` |
| Badges | Inline right of the title, 12px then 8px gaps. Payment first, delivery second | `🟠 ₹8,400 due` `🔵 In progress` |
| Meta line | Body SM Gray 600, `·` separated. Party name links to nothing (it is not an entity), phone is a `tel:` link | `Shreeji Wedding Hall · 9825044556 · 14–22 Aug 2026 · 5 days` |
| Actions | Right-aligned, 12px gap: `Add a day` primary filled with `CalendarPlus`; `Record Payment` secondary outlined with `Banknote`; `Edit booking` secondary outlined with `Pencil`; `⋯` 40×40 | — |
| `⋯` menu | `Print party statement` · `Duplicate this booking` · `Export schedule` · divider · `Cancel booking` in `#B91C1C` | — |
| Summary card | `#F3F4F6` background, 12px radius, 1px border, 24px padding, 4 columns on `lg`, 2 on `md`, 1 below | — |
| Summary labels | Caption 12px 600 uppercase `0.04em` Gray 600 | `TOTAL PAYABLE` `RECEIVED` `OUTSTANDING` `PROGRESS` |
| Summary values | **20px mono 600**. Outstanding (the critical figure) Gray 900; others Gray 700. Progress renders as `3 of 5 days` in 20px mono 600 | — |
| Summary sub-lines | Caption Gray 600. Progress's sub-line carries a 64×4px progress bar inline with `· next 20 Aug` | `5 days · 430 units` · `1 advance · 1 payment` · `due from 22 Aug` · `▓▓▓░░ · next 20 Aug` |
| Address card | Full-width card, 16px padding, 20px `MapPin` Gray 400 left. Address Body 16px Gray 900; notes Body SM Gray 600 in quotes below. A 32px ghost `Copy` button top-right copies the full address | — |
| Tabs | 44px, 2px `#2563EB` bottom indicator, counts in labels | `Schedule 5` · `Payments 2` · `Activity` |
| Schedule tab | The §5 day-card timeline, read-write, with `Mark Delivered` in the footer of any Scheduled day and no-delivery markers between days | — |
| Payments timeline | Newest first. 8px dot, 1px rail `#E5E7EB`. Most recent dot filled `#2563EB`; older hollow. Entry: timestamp Body SM 500 Gray 900 + optional `Advance` Primary badge + `Recorded by Admin` Caption Gray 600 + `⋯`. Body line 1 = amount mono 600 Gray 900 + `·` mode + `·` reference/note. Body line 2 = Caption Gray 600 running total | — |
| **Advance distinction** | An advance payment carries the Primary `Advance` badge with a `Banknote` icon **in the entry header**, and its rail dot is `#2563EB` even when it is not the newest entry. Its second body line reads `Taken at booking, before any delivery` | — |
| Timeline `⋯` | `Reverse this payment` in `#B91C1C` and `Copy details`. **No Edit** — payments are append-only | — |
| Timeline footer | 56px `#F3F4F6` band inside the tab: running summary left, `Record Payment` primary right | `Received ₹14,000.00 of ₹18,400.00 · ₹4,400.00 outstanding` |
| Activity tab | Same timeline: `Booking created · 5 days · ₹18,400.00` · `Advance recorded · ₹10,000.00 cash` · `14 Aug marked delivered · 48 of 50 jars` · `Day added · 22 Aug · ₹2,400.00` · `17 Aug cancelled · total now ₹15,200.00`, each with actor and timestamp | — |

### 7.4 Content and copy

| Slot | Literal string |
|---|---|
| Summary labels | `TOTAL PAYABLE` · `RECEIVED` · `OUTSTANDING` · `PROGRESS` |
| Summary sub-lines | `5 days · 430 units` · `1 advance · 1 payment` · `due from 22 Aug` · `next 20 Aug` |
| Outstanding sub-line, overdue | `overdue 12 days` in `#B91C1C` |
| Address card | Heading `Delivery address` · button `Copy` · toast `Address copied` |
| Tabs | `Schedule 5` · `Payments 2` · `Activity` |
| Mark-delivered button | `✓ Mark Delivered` |
| Mark-delivered dialog | Title `Mark 20 Aug 2026 as delivered?` · Body `Enter what actually went out if it differs from the plan. Leave the quantities as they are if the delivery matched.` · fields per item: `Planned 90 / Delivered [ 90 ]` · `[Cancel]` + `[Mark delivered]` |
| Delivered-quantity note | `Billed on delivered quantities` |
| Payments empty | Title `No payments recorded yet` · Body `₹18,400.00 is payable across 5 delivery days. Record an advance, a part-payment, or the full settlement — whatever actually came in.` · CTA `Record Payment` |
| Payments settled footer | `Paid in full · ₹18,400.00 received` with a green `CheckCircle2` |
| Refund-due footer | `₹1,000.00 refundable — a cancelled day dropped the total below what was paid` + `[Record refund]` |
| Advance badge | `Advance` |
| Advance sub-line | `Taken at booking, before any delivery` |
| Cancelled-day recalculation banner | Info banner above the schedule: `17 Aug was cancelled. Total payable went from ₹18,400.00 to ₹12,240.00, and ₹10,000.00 already received now leaves ₹2,240.00 outstanding.` Dismissible |
| Refund-due banner | Primary/info, not dismissible: `₹1,000.00 is refundable. Krishna Farm paid ₹15,000.00 and cancelling 04 Aug dropped the total to ₹14,000.00.` + `[Record refund]` |
| Cancelled-booking banner | `This booking was cancelled on 12 Aug 2026 by Admin. Reason: "Function postponed to November."` Default tint, not dismissible |
| Not found | Title `Party order not found` · Body `PTY-000999 doesn't exist, or it was permanently removed. Check the code.` · CTA `Back to party orders` |

### 7.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Title as a 200×28 shimmer; two 90×22 shimmer pills; summary card with real labels and shimmer values; address card with two shimmer lines; tab bar without counts; schedule tab with 2 skeleton day-cards |
| **Loading (tab switch)** | Tab content only, 60% opacity + a 2px `#2563EB` indeterminate bar under the tab rule |
| **Loading (after marking delivered)** | The affected day-card's badge and totals shimmer in place; the summary card's values shimmer; nothing else moves |
| **Empty — schedule with no days** | Only reachable via a booking created without days (possible if a draft was recovered): centred 48px `Calendar` Gray 300, H4 `No delivery days yet`, Body SM `This booking has no schedule. Add the days as they're confirmed.`, primary `+ Add the first day` |
| **Empty — payments** | 48px `Banknote` Gray 300, H4 `No payments recorded yet`, body copy from 7.4, primary `Record Payment` |
| **Empty — no results** | The Activity tab's date filter, when used, shows `No activity in this period` with a `Clear` link |
| **Filled** | As wireframe |
| **Error** | 48px `AlertTriangle` `#EF4444`, H4 `Couldn't load PTY-000045`, Body SM reason, primary `Try again`, secondary `‹ Party Orders` |
| **Partial error** | Schedule loads, payments fail: that tab shows an inline Danger banner `Couldn't load payments. The outstanding figure above is still correct.` + `Retry` |
| **Submitting** | Owned by the modals; the invoking button spins and disables while its modal is open |
| **Success** | Modal closes, toast, summary and the affected day-card update in place, tab count increments. No animation on the data itself |
| **Disabled** | `Record Payment` disabled at 40% with tooltip `This booking is paid in full` when outstanding is zero — but `⋯ › Record refund` remains when overpaid. `Add a day` disabled on a cancelled booking |
| **Read-only — cancelled booking** | Action buttons removed except `Print party statement`; day-cards render at full opacity for audit; the cancelled banner sits above the summary |
| **In progress** | The day-card for today gets a 3px `#2563EB` left border and its date reads `Today · 20 Aug 2026`; the page auto-scrolls that card into view on first load |
| **Past-due day** | A Scheduled day whose date has passed shows an amber `AlertTriangle` before its badge and a Caption under the day total: `2 days ago — mark it delivered or skipped` |
| **Refund due** | Outstanding renders `(₹1,000.00)` in `#B91C1C`, payment badge Primary `Refund ₹1,000`, non-dismissible refund banner, payments footer offers `Record refund` |

### 7.6 Interactions

| Trigger | Behaviour |
|---|---|
| Click `Add a day` | Opens the Edit-day modal (§8) with a blank date defaulting to the day after the last scheduled day |
| Click a no-delivery marker | Same modal, pre-set to that date |
| Click `Mark Delivered` | Opens a 560px dialog listing each item with `Planned 90` and a `Delivered [ 90 ]` input pre-filled to the planned figure. Saving stamps `delivered at` and recalculates the day total and the booking total |
| Click a day-card `⋯ › Mark skipped` | Confirm: `Mark 20 Aug 2026 as skipped?` / `The day stays in the schedule but isn't billed. Total payable goes from ₹18,400.00 to ₹14,800.00.` |
| Click a day-card `⋯ › Cancel day` (delivered days) | Confirm naming that a delivered day cannot be deleted, only cancelled, and that billing history is preserved |
| Click a tab | Content swaps over 200ms; URL updates to `?tab=payments` |
| Keyboard on tabs | `←` `→` move, `Home` `End` jump, content follows focus |
| Click `Copy` on the address | Copies address plus notes, toast `Address copied` |
| Click a summary figure | `TOTAL PAYABLE` and `PROGRESS` go to the Schedule tab; `RECEIVED` and `OUTSTANDING` go to the Payments tab |
| Click `Reverse this payment` | Confirm: `Reverse this ₹4,000.00 payment?` / `A reversing entry of −₹4,000.00 is added on 20 Aug 2026. The original stays visible. Outstanding goes from ₹4,400.00 to ₹8,400.00.` |
| Keyboard shortcuts | `a` add a day · `p` record payment · `e` edit booking · `Escape` back to the list |
| Print party statement | Opens the A4 print view per standards §19 in a new tab |

### 7.7 Responsive — below `md` (768px)

Title wraps; badges move to their own line beneath it. Meta line wraps to two. Actions become a fixed 72px bottom bar with `Add a day` and `Record Payment` splitting the width; `Edit booking` and `⋯` become icon buttons in the header.

Summary card goes 2×2; the progress bar in the fourth cell goes full width at 6px. The address card stacks the `Copy` button below the notes as a full-width 40px secondary. Tabs scroll horizontally with the active tab scrolled into view.

Day-cards follow §5.9. The payments timeline keeps its rail; the `Recorded by` line moves under the timestamp and the `Advance` badge moves to the line below the amount.

### 7.8 Dark mode

Page `#0B1220`, cards `#1E293B`. The summary card, `#F3F4F6` in light, becomes `#0F172A` so it still reads as inset. Address card keeps the card colour with a `#334155` border. Tab indicator `#3B82F6`. Timeline rail `#334155`; newest dot `#3B82F6`; hollow dots get a `#475569` ring; advance dots stay `#3B82F6`. `Advance` badge `#1E3A8A` / `#BFDBFE`. The refund-due banner becomes `#1E3A8A` / `#BFDBFE` with a `#3B82F6` border. Progress bar track `#334155`, fill `#22C55E`.

### 7.9 Stitch prompt

```text
Design a detail page for a multi-day party water booking in an internal Indian app.
Light theme: page #F8FAFC, white cards, 1px #E5E7EB borders, 12px radius. Inter
text, JetBrains Mono numbers, blue #2563EB.

Header: small blue "‹ Party Orders" link, then a 28px monospace title "PTY-000045"
with two pills beside it — amber "₹8,400 due" and blue "In progress". Below, grey
14px "Shreeji Wedding Hall · 9825044556 · 14–22 Aug 2026 · 5 days". Top right:
filled blue "Add a day", outlined "Record Payment", outlined "Edit booking", ⋯ icon.

A summary card with a light grey #F3F4F6 fill, 24px padding, four columns, each a
12px uppercase grey label above a 20px bold mono value and a small grey sub-line:
TOTAL PAYABLE ₹18,400.00 / "5 days · 430 units"; RECEIVED ₹10,000.00 / "1 advance ·
1 payment"; OUTSTANDING ₹8,400.00 (darkest) / "due from 22 Aug"; PROGRESS "3 of 5
days" with a small green progress bar three-fifths full and "next 20 Aug".

Below it a slim card with a map-pin icon: "Shreeji Party Plot, Nr. Kalol Cross Road,
Gandhinagar – 382721" and a grey quoted line "Ask for Bhavesh at the gate. Jars go
to the back kitchen, not the main hall." A small ghost "Copy" button top right.

A 44px tab bar with a 2px blue underline on the active tab: "Schedule 5",
"Payments 2", "Activity". Show the PAYMENTS tab: a vertical timeline with a thin
grey rail and dots. Newest entry has a filled blue dot: "20 Aug 2026 · 2:10 pm" with
"Recorded by Admin" small and grey on the right, then "₹4,000.00 · UPI · ref
421884993201" and a small grey line "Running total received ₹14,000.00 of
₹18,400.00". Second entry has a blue dot and a BLUE PILL reading "Advance" beside
its timestamp: "16 Aug 2026 · 11:20 am", "₹10,000.00 · Cash · \"Paid by Bhavesh at
the plant\"", and a small grey line "Taken at booking, before any delivery".

A grey footer band inside the tab: "Received ₹14,000.00 of ₹18,400.00 · ₹4,400.00
outstanding" on the left and a filled blue "Record Payment" on the right.
```

---

## 8. Modal — Edit delivery day

### 8.1 Purpose

One day's worth of a party: its date, its items and rates, who is delivering it, its status and its notes. Used from `+ Add a day`, from a no-delivery marker, from `Edit day` on any card, and from the calendar. One modal, four entry points, so the mental model is single: **a day is a thing you open and change**.

### 8.2 Layout — 720px

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Edit delivery day                                                      ✕  │
│  PTY-000045 · Shreeji Wedding Hall                                         │
├────────────────────────────────────────────────────────────────────────────┤
│  Delivery date *              Status                    Assigned staff     │
│  [ 17 Aug 2026        📅 ]    [ Scheduled      ▾ ]      [ Suresh    ▾ ]    │
│                                                                            │
│  Items                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ PRODUCT           PLANNED  DELIVERED  BASE     UNIT PRICE    TOTAL   │  │ 44
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ [20L Jar      ▾]  [ 120]   [    —]   ₹35.00   [₹ 38.00]  ₹4,560.00 ✕│  │ 56
│  │   ┃ ⚠ Rate overridden +₹3.00/unit · +₹360.00                        │  │ 40
│  │ [500ml Cold   ▾]  [ 200]   [    —]   ₹8.00    [₹  8.00]  ₹1,600.00 ✕│  │ 56
│  └──────────────────────────────────────────────────────────────────────┘  │
│  [ + Add item ]                                                            │
│  Delivered quantities are optional — fill them in when you mark the day     │
│  delivered, and billing switches to what actually went out.                 │
│                                                                            │
│  Notes                                                                     │
│  [ Deliver by 10 am, mandap starts at 11                               ]   │
├────────────────────────────────────────────────────────────────────────────┤
│  Day total                                                    ₹6,160.00    │
│  Booking total     ₹18,400.00 → ₹21,160.00                                 │
│                                          [Cancel]   [Save day]             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Modal | 720px (it contains a table), max-height `min(680px, 90vh)`, header and footer fixed, middle scrolls | — |
| Title | H4 18px 600. `Add a delivery day` when new, `Edit delivery day` when existing | — |
| Subtitle | Body SM Gray 600 | `PTY-000045 · Shreeji Wedding Hall` |
| Delivery date | 180px date input, required, autofocused when adding. **Dates already in this schedule are disabled in the calendar popover** with a tooltip `Already scheduled` | `17 Aug 2026` |
| Status | 180px select. New days are locked to `Scheduled` and the control renders read-only with a Caption `A new day always starts as Scheduled` | `Scheduled` · `Delivered` · `Skipped` · `Cancelled` |
| Assigned staff | 220px search select, optional, active staff only, with a `Clear` option | Placeholder `Nobody assigned` |
| Items table | 56px line-item rows. PRODUCT search select (flex) · PLANNED 100px quantity · DELIVERED 100px quantity, empty by default showing `—` in Gray 300 · BASE read-only computed 90px · UNIT PRICE 130px money input · TOTAL read-only computed mono 600 120px · `✕` | — |
| Billing indicator | When DELIVERED has a value, the TOTAL cell computes from it and a 12px `Info` appears beside the figure with tooltip `Billed on 48 delivered, not 50 planned` | — |
| Override strip | 40px sub-line, 2px `#F97316` left border on the block, Warning chip with per-unit and line difference, plus an optional 280px reason input | `⚠ Rate overridden +₹3.00/unit · +₹360.00` |
| Add item | Full-width 48px dashed ghost | `+ Add item` |
| Helper | Caption Gray 600 under the add button, two lines, space reserved | Copy in 8.4 |
| Notes | Full-width textarea, 2 rows | Placeholder `e.g. Deliver by 10 am, mandap starts at 11` |
| Footer | Fixed, 1px top border, `#F3F4F6`, 16px/24px padding | — |
| `Day total` | Label Body SM 600 Gray 900, value **18px mono 600** Gray 900 | `₹6,160.00` |
| `Booking total` | Label Body SM Gray 600, old value mono Gray 400 struck, `→`, new value mono 600 Gray 900 | `₹18,400.00 → ₹21,160.00` |
| Actions | `[Cancel]` ghost · `[Save day]` primary (`[Add day]` when new) | — |

### 8.4 Content and copy

| Slot | Literal string |
|---|---|
| Title (new / edit) | `Add a delivery day` / `Edit delivery day` |
| Subtitle | `PTY-000045 · Shreeji Wedding Hall` |
| Labels | `Delivery date *` · `Status` · `Assigned staff` · `Items` · `Notes` |
| Status locked helper | `A new day always starts as Scheduled` |
| Staff placeholder | `Nobody assigned` |
| Item columns | `PRODUCT` · `PLANNED` · `DELIVERED` · `BASE` · `UNIT PRICE` · `TOTAL` |
| Delivered helper | `Delivered quantities are optional — fill them in when you mark the day delivered, and billing switches to what actually went out.` |
| Notes placeholder | `e.g. Deliver by 10 am, mandap starts at 11` |
| Footer labels | `Day total` · `Booking total` |
| Buttons | `Cancel` · `Add day` / `Save day` · submitting `Saving…` |
| Success toast (new) | `17 Aug added · ₹6,160.00 · booking total now ₹21,160.00` |
| Success toast (edit) | `17 Aug updated · ₹6,160.00 · booking total now ₹21,160.00` |
| Success toast (delivered qty) | `14 Aug updated · billed on 48 delivered · booking total now ₹18,320.00` |
| Error — date missing | `Choose the delivery date.` |
| Error — duplicate date | `17 Aug 2026 is already in this schedule. Pick another date, or edit that day instead.` with an `Edit 17 Aug` link |
| Error — no items | `Add at least one item — a delivery day needs something to deliver.` |
| Error — planned zero | `Enter a planned quantity greater than 0.` |
| Error — delivered exceeds planned | `You delivered 60 but planned 50. That's allowed — the extra will be billed. Change the planned quantity if this was a schedule change.` (Warning, **not blocking**) |
| Error — price | `Enter a unit price of ₹0.00 or more.` |
| Warning — delivered day edited | `This day is already marked delivered. Changing it will re-bill the booking and the total will move.` Amber banner, not blocking |
| Warning — day in the past | `17 Aug 2026 is in the past. Add it anyway if you're catching up on records.` Amber, not blocking |
| Dirty-close confirm | Title `Discard this day?` · Body `You've entered 2 items worth ₹6,160.00. Nothing has been saved yet.` · `[Keep editing]` + `[Discard]` |

### 8.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Modal opens instantly; product and staff option lists load in the background with a 40px shimmer in the select positions. The date field is usable immediately |
| **Loading (recalculating booking total)** | The footer's `Booking total` shows a 60×14 shimmer for the arrow's right-hand value; `Day total` never shimmers — it is computed client-side |
| **Empty — new day** | Date pre-filled to the day after the last scheduled day (or today, if none), status locked to `Scheduled` and read-only, one blank item row with `✕` disabled, footer showing `Day total —` and `Booking total ₹18,400.00 → ₹18,400.00` |
| **Empty — no products defined** | Items area replaced by a 96px inset `#F3F4F6` panel: `No products set up yet.` + `Add a product` link. `Save day` disabled |
| **Empty — no results in a select** | `No product matches "jarr". Check the spelling, or add it in Products.` |
| **Filled** | As wireframe |
| **Rate overridden** | 2px `#F97316` left border, Warning chip with both differences, optional reason input |
| **Delivered quantities entered** | TOTAL recomputes from DELIVERED; a 12px `Info` appears; the footer gains a Caption `Billed on delivered quantities` |
| **Delivered day being edited** | Amber banner at the top of the modal body, not dismissible while the condition holds |
| **Duplicate date** | Date field 1px `#EF4444`, Caption error with an `Edit 17 Aug` link that swaps this modal to that day without closing |
| **Submitting** | `Save day` spinner + `Saving…`; both buttons disable; modal body dims to 60%; `✕` and Escape blocked |
| **Success** | Modal closes over 150ms; the timeline inserts or updates the card in date order and scrolls it into view; no-delivery markers recompute; toast |
| **Error** | Danger banner above the footer, values preserved, modal stays open |
| **Partial error** | Base prices unavailable: BASE shows `—` and a Warning banner reads `Base prices couldn't be loaded. Enter the unit price manually — it won't be flagged as an override.` |
| **Disabled** | `Save day` disabled at 40% when no date is chosen or no item row has a product and quantity, with a Caption to its left: `Choose a date and add an item` |
| **Read-only — cancelled booking** | The modal is not reachable; `Edit day` is removed from every card |

### 8.6 Interactions

| Trigger | Behaviour |
|---|---|
| Open (new) | Focus on Delivery date; the calendar popover opens automatically, with already-scheduled dates disabled |
| Open (edit) | Focus on the first PLANNED quantity — the field most likely to change |
| Select a product | BASE fills, UNIT PRICE pre-fills from base, focus jumps to PLANNED |
| Type PLANNED or UNIT PRICE | TOTAL, `Day total` and `Booking total` all recompute on every keystroke |
| Blur UNIT PRICE ≠ BASE | Override strip animates in over 100ms; the value formats with lakh grouping |
| Type DELIVERED | TOTAL switches to bill on the delivered figure immediately, with the `Info` icon |
| `Enter` on the last item field | Adds a row and focuses its product select |
| `⌘/Ctrl + Enter` | Saves |
| Tab order | Date → Status → Assigned staff → item 1 Product → Planned → Delivered → Unit price → (reason) → `✕` → item 2 … → Add item → Notes → Cancel → Save day. Computed cells skipped |
| Escape / overlay | Closes when clean; discard confirm when dirty |
| Click `Edit 17 Aug` in the duplicate error | Loads that day into the same modal without closing, preserving nothing from the failed attempt |
| Validation timing | On blur per field; everything on save with focus to the first error; live re-validation once errored |

### 8.7 Responsive — below `md` (768px)

Full-screen sheet: 100vw × 100vh, no radius, 64px fixed header with a back chevron, 128px fixed footer. Date, Status and Assigned staff stack to full width. Item rows become cards:

```
┌───────────────────────────────────────────┐
│ Item 1                              [✕]   │
│ [ 20L Jar                            ▾ ]  │
│ Planned        Delivered       Unit price │
│ [    120 ]     [      — ]      [ ₹38.00 ] │
│ Base ₹35.00                Total ₹4,560.00│
│ ┃ ⚠ Rate overridden +₹3.00/unit           │
└───────────────────────────────────────────┘
```

The three numeric fields stay on one row at 44px each — they are short and must be comparable at a glance. Base and Total render as a Caption/mono pair on one line. The footer keeps both figure lines above a full-width `Save day` primary with `Cancel` as a text link.

### 8.8 Dark mode

Modal `#1E293B`, overlay `rgba(2, 6, 23, 0.7)`. Item table header and read-only computed cells `#0F172A` with `#94A3B8` text. Footer band `#0F172A`. Struck-through prior booking total `#475569`. Override strip border `#F97316`, chip `#7C2D12` / `#FED7AA`. Disabled calendar dates render at 30% opacity with a `#334155` fill.

### 8.9 Stitch prompt

```text
Design a 720px modal dialog "Edit delivery day" over a dimmed page, for an internal
Indian water-plant app. White modal, 12px radius, heavy shadow, overlay
rgba(15,23,42,0.5). Inter text, JetBrains Mono numbers, blue #2563EB.

Header: 18px bold "Edit delivery day", grey 14px subtitle "PTY-000045 · Shreeji
Wedding Hall", ✕ top right.

Body: three fields in a row — a 180px date input "Delivery date *" showing "17 Aug
2026", a 180px select "Status" showing "Scheduled", and a 220px search select
"Assigned staff" showing "Suresh".

Label "Items", then a bordered mini table. Header 44px, #F3F4F6, 12px uppercase grey
labels: PRODUCT, PLANNED, DELIVERED, BASE, UNIT PRICE, TOTAL. Two 56px rows with
real inputs. Row 1: dropdown "20L Jar", number input "120", an empty number input
showing a pale grey em-dash, a borderless grey read-only cell "₹35.00", a money
input "₹38.00", bold mono "₹4,560.00", and an ✕. Row 1 has a 2px ORANGE #F97316 left
border and a 40px sub-line beneath holding an amber pill "⚠ Rate overridden
+₹3.00/unit · +₹360.00". Row 2: "500ml Cold", 200, em-dash, ₹8.00, ₹8.00, ₹1,600.00.

Below: a full-width dashed ghost button "+ Add item", then small grey helper text
"Delivered quantities are optional — fill them in when you mark the day delivered,
and billing switches to what actually went out." Then a 2-row textarea "Notes"
containing "Deliver by 10 am, mandap starts at 11".

Fixed footer, light grey #F3F4F6 fill with a top border: "Day total" on the left
with "₹6,160.00" right-aligned in 18px bold mono; beneath, smaller, "Booking total
₹18,400.00 → ₹21,160.00" with the first figure struck through in grey. Bottom right:
ghost "Cancel" and filled blue "Save day".
```

---

## 9. Modal — Record payment (party)

### 9.1 Purpose

Simpler than the delivery-order payment modal — no coins, because parties pay in cash, UPI or bank transfer — but it carries the one thing that modal doesn't: an **advance** flag, which changes how the payment reads in the history forever and permits the amount to exceed the current total.

### 9.2 Layout — 560px

```
┌──────────────────────────────────────────────────────────┐
│  Record payment                                       ✕  │
│  PTY-000045 · Shreeji Wedding Hall · ₹8,400.00 due       │
├──────────────────────────────────────────────────────────┤
│  Date                          Amount *                  │
│  [ 20 Aug 2026        📅 ]     [ ₹      4,000.00 ]       │
│                                [ Pay full ₹8,400.00 ]    │
│                                                          │
│  Mode *                                                  │
│  [ ● Cash ]  [ ○ UPI ]  [ ○ Bank transfer ]              │
│                                                          │
│  UPI reference                                           │
│  [ 421884993201                                      ]   │
│                                                          │
│  [ ☐ ] This is an advance                                │
│  Marks it as a deposit in the payment history            │
│                                                          │
│  Note                                                    │
│  [ Second instalment, balance on the last day        ]   │
├──────────────────────────────────────────────────────────┤
│  Total payable                              ₹18,400.00   │
│  Already received                           ₹10,000.00   │
│  This payment                                ₹4,000.00   │
│  ──────────────────────────────────────────────────────  │
│  Outstanding after                           ₹4,400.00   │
│                                                          │
│                        [Cancel]    [Record payment]      │
└──────────────────────────────────────────────────────────┘
```

### 9.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Modal | 560px, max-height `min(620px, 90vh)`, 24px padding, header and footer fixed | — |
| Title / subtitle | H4 `Record payment` / Body SM Gray 600 naming the outstanding figure | `PTY-000045 · Shreeji Wedding Hall · ₹8,400.00 due` |
| Date | 180px date input, defaults today | `20 Aug 2026` |
| Amount | 200px money input, **48px** (primary field), `₹` prefix Gray 600, mono right-aligned, autofocused | — |
| `Pay full` shortcut | 32px secondary button directly beneath the amount field, only when outstanding > 0 | `Pay full ₹8,400.00` |
| Mode | **Segmented control**, not a select — three options is few enough that a one-tap choice beats a dropdown. 40px tall, 1px `#D1D5DB` border, radius 8px, equal thirds. Selected segment: `#DBEAFE` fill, `#1D4ED8` label 500, 1px `#2563EB` border | `Cash` · `UPI` · `Bank transfer` |
| Reference | Full-width text input. **Hidden when Cash is selected**; label and placeholder change with mode | — |
| Advance checkbox | 20px checkbox, label Body SM 500 Gray 900 to the right, whole row tappable at 44px | `This is an advance` |
| Advance helper | Caption Gray 600, 4px below | `Marks it as a deposit in the payment history` |
| Note | Full-width textarea, 2 rows | Placeholder `e.g. Second instalment, balance on the last day` |
| Footer | Fixed, 1px top border, `#F3F4F6`, four label/value rows. Labels Body SM Gray 600 left, values mono right | — |
| `This payment` | mono 14px **600** `#2563EB` | `₹4,000.00` |
| `Outstanding after` | Label Body SM 600 Gray 900, value **18px mono 600**. Gray 900 positive, `#15803D` with a `CheckCircle2` at exactly zero, `#B45309` and rendered as `Refund due ₹1,600.00` when negative | — |
| Actions | `[Cancel]` ghost · `[Record payment]` primary | — |

### 9.4 Content and copy

| Slot | Literal string |
|---|---|
| Title / subtitle | `Record payment` / `PTY-000045 · Shreeji Wedding Hall · ₹8,400.00 due` |
| Subtitle when settled | `PTY-000045 · Shreeji Wedding Hall · paid in full` |
| Labels | `Date` · `Amount *` · `Mode *` · `Reference` / `UPI reference` / `Transaction reference` · `This is an advance` · `Note` |
| Reference placeholders | UPI `e.g. 421884993201` · Bank transfer `e.g. NEFT/HDFC/8841002` |
| Advance helper | `Marks it as a deposit in the payment history` |
| Pay-full button | `Pay full ₹8,400.00` |
| Note placeholder | `e.g. Second instalment, balance on the last day` |
| Footer labels | `Total payable` · `Already received` · `This payment` · `Outstanding after` |
| Settled | `Outstanding after  ₹0.00  ✓ Settles this booking` in `#15803D` |
| Advance-exceeds banner | `₹20,000.00 is more than the ₹8,400.00 outstanding. Because this is marked as an advance, that's allowed — the booking will show ₹11,600.00 as a refund due until more days are added.` Primary/info tint |
| Overpay banner (not advance) | `₹10,000.00 is more than the ₹8,400.00 outstanding. That's allowed — ₹1,600.00 will show as a refund due. Tick "This is an advance" if more days are still to be scheduled.` Warning tint |
| Buttons | `Cancel` · `Record payment` · submitting `Recording…` |
| Success toast | `Payment of ₹4,000.00 recorded · ₹4,400.00 still due` |
| Success toast (settles) | `Payment of ₹8,400.00 recorded · PTY-000045 is paid in full` |
| Success toast (advance) | `Advance of ₹10,000.00 recorded · ₹8,400.00 outstanding` |
| Error — amount | `Enter an amount greater than ₹0.00.` |
| Error — mode | `Choose how the money came in.` |
| Error — reference | `Enter the UPI reference, or switch the mode to Cash.` |
| Error — date | `The payment date can't be in the future.` |
| Error — server | `Couldn't record the payment. Nothing was saved — the amount is still due.` + `Try again` |
| Error — duplicate submit | `This payment was already recorded a moment ago. Showing the booking as it now stands.` Info, not Danger |
| Dirty-close confirm | Title `Discard this payment?` · Body `You've entered ₹4,000.00. Nothing has been recorded yet.` |

### 9.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Modal opens instantly with all figures already known from the page. No loading state |
| **Loading (revalidating the total)** | The `Total payable` figure shows a 60×14 shimmer for under 200ms; the Amount field never waits |
| **Empty — first open** | Amount blank and focused, Mode defaulting to `Cash`, Reference hidden, advance unticked, footer showing `This payment —` and `Outstanding after ₹8,400.00` |
| **Empty (no results)** | Not applicable |
| **Filled** | As wireframe |
| **Advance ticked** | The `Advance` Primary badge previews inline beside the amount field; the exceeds-total copy switches from the Warning variant to the Primary/info variant |
| **Overpayment (not advance)** | Warning banner above the footer; `Outstanding after` renders `Refund due ₹1,600.00` in `#B45309`. **Submission stays enabled** |
| **Exact settlement** | `Outstanding after` `₹0.00` in `#15803D` with a `CheckCircle2` and a Caption `Settles this booking` |
| **Submitting** | Spinner + `Recording…`; both buttons disable; body dims to 60%; `✕` and Escape blocked |
| **Success** | Modal closes 150ms; summary and payments timeline update; toast naming the amount |
| **Error** | Danger banner above the footer, values preserved |
| **Partial error** | Payment recorded but the booking status failed to recalculate: a Warning banner on the detail page after close — `Payment of ₹4,000.00 recorded. The outstanding figure is catching up and will refresh shortly.` |
| **Disabled** | `Record payment` disabled at 40% when Amount is empty or zero, with Caption `Enter an amount` |
| **Double-submit** | Idempotency key generated on modal open; a second submit returns the first payment and closes with the Info toast |
| **Read-only** | Not reachable on a cancelled booking |

### 9.6 Interactions

| Trigger | Behaviour |
|---|---|
| Open | Amount autofocused; focus trapped; returns to `Record Payment` on close |
| Click `Pay full ₹8,400.00` | Fills and formats the exact outstanding figure, moves focus to Mode |
| Type Amount | `This payment` and `Outstanding after` recompute live; formatting applies on blur only |
| Select a Mode segment | Reference field shows or hides over 100ms; the label and placeholder change; any typed reference is preserved when switching between UPI and Bank transfer |
| Tick `This is an advance` | Banner copy swaps variant if the amount exceeds the outstanding figure; the inline `Advance` badge preview appears |
| `⌘/Ctrl + Enter` | Submits |
| Tab order | Date → Amount → Pay full → Mode segment 1 → 2 → 3 (arrow keys move within the segmented control) → Reference → Advance checkbox → Note → Cancel → Record payment |
| Escape / overlay | Closes when clean; discard confirm when dirty |
| Validation | On blur per field; everything on submit with focus to the first error; live re-validation once errored |

### 9.7 Responsive — below `md` (768px)

Full-screen sheet: 100vw × 100vh, 64px header with a back chevron, 176px fixed footer. Date and Amount stack; Amount stays 200px, left-aligned, with `Pay full` a full-width secondary below it. The Mode segmented control goes full width, still three equal segments at 44px. The footer keeps all four lines — they are why the modal exists — with `Outstanding after` at 18px mono 600. `Record payment` becomes a full-width 48px primary with `Cancel` as a text link above.

### 9.8 Dark mode

Modal `#1E293B`, overlay `rgba(2, 6, 23, 0.7)`. Footer band `#0F172A`. Segmented control: track border `#334155`, unselected label `#94A3B8`, selected `#1E3A8A` fill with `#BFDBFE` label and a `#3B82F6` border. `This payment` accent `#3B82F6`. Settled `#22C55E`. Refund-due `#FED7AA` on `#7C2D12`. Advance info banner `#1E3A8A` / `#BFDBFE`.

### 9.9 Stitch prompt

```text
Design a 560px modal dialog "Record payment" over a dimmed page, for an internal
Indian water-plant app. White modal, 12px radius, 24px padding, heavy shadow,
overlay rgba(15,23,42,0.5). Inter text, JetBrains Mono numbers, blue #2563EB.

Header: 18px bold "Record payment"; grey 14px subtitle "PTY-000045 · Shreeji Wedding
Hall · ₹8,400.00 due"; ✕ top right.

Body: a 180px date field "Date" showing "20 Aug 2026" beside a 200px, 48px-tall
money input "Amount *" with a grey ₹ prefix and right-aligned mono "4,000.00"; under
the amount, a small outlined button "Pay full ₹8,400.00".

Then a label "Mode *" and a 40px SEGMENTED CONTROL with three equal segments —
"Cash", "UPI", "Bank transfer" — inside a single rounded 8px outline. The "UPI"
segment is selected with a #DBEAFE fill, #1D4ED8 text and a blue border.

Then a full-width text input labelled "UPI reference" containing "421884993201".

Then a checkbox row: an unticked 20px checkbox with the label "This is an advance"
in 14px medium, and beneath it small grey text "Marks it as a deposit in the payment
history".

Then a 2-row textarea "Note" containing "Second instalment, balance on the last day".

Fixed footer with a light grey #F3F4F6 fill and a 1px top border, four rows of label
left and right-aligned mono value: "Total payable ₹18,400.00", "Already received
₹10,000.00", "This payment ₹4,000.00" with the value in blue, a thin rule, then
"Outstanding after" in bold with "₹4,400.00" at 18px bold mono. Bottom right: ghost
"Cancel" and filled blue "Record payment".
```

---

## 10. Calendar — `/party-orders/calendar`

### 10.1 Purpose

The schedule builder answers "what does this booking look like?". The calendar answers "what does **this week** look like?" — the question asked at 6 am when jars are being loaded. It is the only screen in the app that crosses bookings by date.

### 10.2 Layout

```
Party Delivery Calendar                    [☰ List view]   [ + New Booking ]
Every scheduled party delivery, by date

┌─────────────────────────────────────────────────────────────────────────────────┐
│  ‹  August 2026  ›     [Today]        [ Month ▾ ]        [⚙ Filters]            │ 56
│  ● All staff  ● Ramesh  ● Suresh  ● Dinesh                                      │ 44
├────────┬────────┬────────┬────────┬────────┬────────┬────────────────────────────┤
│  MON   │  TUE   │  WED   │  THU   │  FRI   │  SAT   │  SUN                      │ 44
├────────┼────────┼────────┼────────┼────────┼────────┼────────────────────────────┤
│  10    │  11    │  12    │  13    │  14    │  15    │  16                       │
│        │        │        │        │ ▪Shree │        │ ▪Shreeji 80              │
│        │        │        │        │  ji 150│        │ ▪Krishna 40              │
│        │        │        │        │ ₹3,000 │        │ ₹4,000                   │ 120
├────────┼────────┼────────┼────────┼────────┼────────┼────────────────────────────┤
│  17    │  18    │  19    │  20    │ ●21    │  22    │  23                       │
│ ▪Shree │        │        │ ▪Shree │ ▪Patel │ ▪Shree │                          │
│  ji 320│        │        │  ji 90 │  120   │  ji 60 │                          │
│ ₹6,160 │        │        │ ₹3,600 │ ₹4,800 │ ₹2,400 │                          │ 120
├────────┴────────┴────────┴────────┴────────┴────────┴────────────────────────────┤
│  3 bookings · 12 delivery days this month · 2,140 units · ₹42,600.00            │ 56
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Page header | Title H2 `Party Delivery Calendar`, subtitle Body SM Gray 600 `Every scheduled party delivery, by date`. Actions: `List view` secondary outlined with a `List` icon; `+ New Booking` primary | — |
| Nav bar (56px) | Left: `‹` and `›` 32×32 icon buttons flanking `August 2026` in H4 18px 600 Gray 900, plus a `Today` 32px secondary. Right: a 140px view select (`Month` · `Week`) and a `Filters` button | — |
| Staff chips (44px) | Quick chips, one per active staff plus `All staff`. Active chip is Primary with a 1px `#2563EB` border. Filters the pills inside the grid, not the grid itself | — |
| Weekday header | 44px, `#F3F4F6`, Caption 12px 600 uppercase `0.04em` Gray 600, centred. Week starts Monday | `MON` … `SUN` |
| Day cell | Minimum 120px tall, 1px `#E5E7EB` grid lines, 8px padding. Date number top-left, Body SM 500 Gray 900; other-month dates Gray 300 with the cell at `#F8FAFC` | — |
| Today's cell | Date number becomes a 24px filled `#2563EB` circle with white text; the cell gets a 2px `#2563EB` inset ring | — |
| Delivery pill | 22px tall, full radius, 8px horizontal padding, Caption 12px 500, 4px vertical gaps. Colour by day status: Scheduled Primary, Delivered Success, Skipped Warning, Cancelled Default at 60%. Content: a 6px status dot, the party's short name (truncated with a tooltip carrying the full name), then the unit count in mono | `▪ Shreeji 150` |
| Cell total | Bottom-right of the cell, Caption mono 12px 500 Gray 700, summing that day's non-cancelled deliveries | `₹3,000.00` |
| Overflow | More than 3 pills in a cell collapses to 2 pills plus a `+2 more` link in Caption `#2563EB` that opens a day drawer | `+2 more` |
| Footer band (56px) | `#F3F4F6`, Caption Gray 600 with mono figures, summarising the visible period | `3 bookings · 12 delivery days this month · 2,140 units · ₹42,600.00` |
| Day drawer | 400px right drawer opened by clicking a date number or `+n more`: H4 `Fri, 14 Aug 2026`, then one compact card per delivery — party name, code, items, staff, day total, status badge, and `Open booking` / `Mark Delivered` actions | — |

### 10.4 Content and copy

| Slot | Literal string |
|---|---|
| Title / subtitle | `Party Delivery Calendar` / `Every scheduled party delivery, by date` |
| Nav | `Today` · view select `Month` / `Week` |
| Staff chips | `All staff` · `Ramesh` · `Suresh` · `Dinesh` |
| Overflow link | `+2 more` |
| Footer | `3 bookings · 12 delivery days this month · 2,140 units · ₹42,600.00` |
| Empty (no data) title | `No party deliveries scheduled` |
| Empty (no data) body | `Nothing is booked for August 2026. Deliveries appear here as soon as a booking has a schedule.` CTA `+ New Booking` |
| Empty (no results) title | `No deliveries for Suresh in August 2026` |
| Empty (no results) body | `Suresh isn't assigned to any delivery this month. Clear the staff filter to see everything.` CTA `Clear filters` |
| Error | Title `Couldn't load the calendar` · Body `The server didn't respond. Your bookings are safe.` · CTA `Try again` |
| Partial error | `Some days may be missing. The calendar is still catching up.` Warning band above the grid |
| Day drawer heading | `Fri, 14 Aug 2026` with a Caption `2 deliveries · 190 units · ₹4,000.00` |
| Day drawer empty | `Nothing scheduled on 15 Aug 2026.` + `+ Add a delivery day` which asks which booking first |
| Pill tooltip | `Shreeji Wedding Hall · 20L Jar × 50, 1L Bottle × 100 · Ramesh Patel · ₹3,000.00` |

### 10.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Grid renders with real weekday headers and date numbers; each cell shows one 60×22 shimmer pill. Nav bar and chips are real |
| **Loading (month change)** | The existing grid stays at 60% opacity with a 2px `#2563EB` indeterminate bar under the weekday header. **Never** blank the grid between months — the date numbers alone are worth keeping on screen |
| **Empty — no bookings at all** | Grid still renders, all cells empty, with a centred 320px overlay block above it: 48px `CalendarDays` Gray 300, H4 `No party deliveries scheduled`, body copy, primary `+ New Booking` |
| **Empty — no results for a staff filter** | Grid renders empty with a different centred block: 48px `SearchX`, H4 `No deliveries for Suresh in August 2026`, body copy, secondary `Clear filters` |
| **Filled** | As wireframe |
| **Error** | Grid replaced by a centred 48px `AlertTriangle` block with `Try again` |
| **Partial error** | Warning band above the grid, grid still rendered |
| **Submitting** | Not applicable; marking delivered from the drawer shows a spinner in that drawer card only |
| **Success** | The affected pill changes colour in place with no animation; a toast confirms |
| **Disabled** | `›` and `‹` are never disabled — the calendar is infinite in both directions |
| **Read-only** | `+ New Booking` and drawer write actions hidden; the calendar itself is unchanged |
| **Dense day** | A cell with 4+ deliveries shows 2 pills plus `+n more` and its cell total in `#B45309` to signal a heavy day |
| **Past month** | Date numbers in Gray 600; delivered pills stay Success; any Scheduled pill in the past renders with an amber `AlertTriangle` 12px before its dot |

### 10.6 Interactions

| Trigger | Behaviour |
|---|---|
| Click a pill | Opens that booking's detail at `/party-orders/[id]?tab=schedule&day=2026-08-14` with the day-card scrolled into view |
| Click a date number or `+n more` | Opens the 400px day drawer |
| Click an empty cell | Opens a small popover `Add a delivery day` listing active bookings to add it to, then the Edit-day modal pre-set to that date |
| `‹` / `›` | Move by one month (or one week in Week view) over 200ms; URL updates to `?month=2026-09` |
| `Today` | Returns to the current month and scrolls today's cell into view |
| Keyboard | `←` `→` move by month, `t` jumps to today, `Escape` closes the drawer |
| Hover a pill | 100ms background darkening plus a tooltip after 400ms with the full booking, items, staff and total |
| Staff chips | Filter which pills render; the cell totals recompute to match, and the footer band recomputes too |
| Tab order | List view → New Booking → `‹` → month label → `›` → Today → view select → Filters → chips → first pill → … → drawer when open |

### 10.7 Responsive — below `md` (768px)

The month grid is unusable at 320px, so below `md` the calendar becomes an **agenda list** — the same data, one section per day:

```
┌───────────────────────────────────────────┐
│ FRI · 14 AUG 2026                ₹3,000.00│
├───────────────────────────────────────────┤
│ 🔵 Shreeji Wedding Hall            150 u  │
│    20L Jar × 50 · 1L Bottle × 100         │
│    Ramesh Patel                 ₹3,000.00 │
└───────────────────────────────────────────┘
┌───────────────────────────────────────────┐
│ SAT · 15 AUG 2026                     —   │
│ · · · · · no delivery · · · · · · · · · · │
└───────────────────────────────────────────┘
```

Day headers are 40px sticky bands, `#F3F4F6`, Caption 12px 600 uppercase Gray 600 with the day total right-aligned in mono. Delivery cards are 88px with a status dot, party name, unit count, items and staff. Empty days keep the **no-delivery marker** pattern from §5 at 32px, so gaps are visible here too. The month nav becomes a 56px sticky bar with `‹ August 2026 ›` and `Today`. Staff chips scroll horizontally.

### 10.8 Dark mode

Page `#0B1220`, grid card `#1E293B`, weekday header `#0F172A`, grid lines `#334155`. Other-month cells `#0B1220` with `#475569` numbers. Today's circle `#3B82F6`; today's cell ring `#3B82F6`. Pills use the dark badge pairs. Cell totals `#94A3B8`. The footer band `#0F172A`. In agenda mode, sticky day headers `#0F172A` and no-delivery markers `#475569` on a dashed `#334155` line.

### 10.9 Stitch prompt

```text
Design a month calendar screen "Party Delivery Calendar" for an internal Indian
water-plant app. Light theme: page #F8FAFC, white card, 1px #E5E7EB borders, 12px
radius. Inter text, JetBrains Mono numbers, blue #2563EB.

Page header: 28px semibold "Party Delivery Calendar", grey 14px "Every scheduled
party delivery, by date". Top right: outlined "List view" and filled blue
"+ New Booking".

Inside a white card: a 56px nav bar with "‹  August 2026  ›" centred-left in 18px
semibold, a small outlined "Today" button, and on the right a "Month" select and a
"Filters" button. Beneath, a 44px row of pill chips: "All staff" (active, #DBEAFE
fill with a blue border), "Ramesh", "Suresh", "Dinesh".

Then a 7-column month grid. Header row 44px, #F3F4F6, 12px uppercase grey letters
MON TUE WED THU FRI SAT SUN. Cells are at least 120px tall with 1px grey grid lines
and the date number top-left in 14px medium. Days from the previous and next month
are pale grey on a #F8FAFC fill.

Inside cells, small 22px status pills with a 6px coloured dot, a truncated party
name and a unit count in mono: on Fri 14 a blue pill "Shreeji 150"; on Sun 16 two
pills "Shreeji 80" and "Krishna 40"; on Mon 17 a blue pill "Shreeji 320"; on Thu 20
"Shreeji 90"; on Fri 21 "Patel 120"; on Sat 22 "Shreeji 60". Green pills for days
already delivered in the first two weeks. Bottom-right of each occupied cell shows a
small grey mono day total like "₹3,000.00". Friday the 21st is today: its date
number sits inside a 24px filled blue circle and the cell has a 2px blue inset ring.

A 56px grey footer band across the bottom of the card: "3 bookings · 12 delivery
days this month · 2,140 units · ₹42,600.00".
```

---

## 11. Edit party order — `/party-orders/[id]/edit`

### 11.1 Purpose

The wizard, unwound. Once a booking exists there is no sequence to walk — the owner wants to change the phone number, or add a day, or fix a rate. So the edit screen is a **flat two-section form**: party details on top, the same schedule builder beneath, with the wizard's step indicator replaced by a version meta line and a history warning.

### 11.2 Layout

```
‹ PTY-000045
Edit PTY-000045
Shreeji Wedding Hall · Created 12 Aug 2026 · Edited 1 time · v2

┌────────────────────────────────────────────────────────────────────────────────┐
│ ⚠  This booking has 2 payments and 2 delivered days                            │
│    Changing the schedule will recalculate the total payable and the            │
│    outstanding balance. Delivered days can be cancelled but not removed.       │
└────────────────────────────────────────────────────────────────────────────────┘

┌─ Party details ─────────────────────────────────────── max 720px ─────────────┐
│  … identical to wizard step 1 …                                                │
└────────────────────────────────────────────────────────────────────────────────┘

┌─ Schedule ─────────────────────────────────────────────────────────────────────┐
│  … identical to wizard step 2, with delivered days locked …                    │
└────────────────────────────────────────────────────────────────────────────────┘
                                                  [Cancel]   [Save changes]
```

### 11.3 Region-by-region spec

Everything is inherited from §4 and §5. The deltas:

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB` | `‹ PTY-000045` |
| Title | H2 with a mono code | `Edit PTY-000045` |
| Meta line | Body SM Gray 600, `·` separated. `Edited 1 time` opens the revision drawer | `Shreeji Wedding Hall · Created 12 Aug 2026 · Edited 1 time · v2` |
| History warning banner | Full width, `#FEF3C7`, 1px `#F97316`, 12px radius, 16px padding, 20px `AlertTriangle`, not dismissible, present whenever payments > 0 or delivered days > 0 | See 11.4 |
| Delivered day-card | Header badge Success `Delivered`; the card's `⋯` reduces to `Edit day` and `Cancel day`; `Remove day` is absent entirely | — |
| Cancelled day-card | Card at 60%, `⋯` reduced to `Restore day` | — |
| Totals block | Adds a row when any day is cancelled: `Cancelled days excluded` `−₹6,160.00` in mono 500 Gray 600 with a 12px `Ban` | — |
| Footer | Not sticky per-section; one shared sticky footer at the page bottom: `[Cancel]` ghost · `[Save changes]` primary | — |

### 11.4 Content and copy

| Slot | Literal string |
|---|---|
| Title / meta | `Edit PTY-000045` / `Shreeji Wedding Hall · Created 12 Aug 2026 · Edited 1 time · v2` |
| History banner (payments only) | Title `This booking has 2 payments recorded` · Body `Changing the schedule will recalculate the total payable and the outstanding balance. Payments themselves are never changed.` |
| History banner (delivered days only) | Title `This booking has 2 delivered days` · Body `Delivered days can be cancelled but not removed — billing history is preserved.` |
| History banner (both) | Title `This booking has 2 payments and 2 delivered days` · Body `Changing the schedule will recalculate the total payable and the outstanding balance. Delivered days can be cancelled but not removed.` |
| Cancelled-days totals row | `Cancelled days excluded` |
| Refund-due warning on save | Title `This change puts the booking into refund` · Body `Cancelling 17 Aug drops the total payable from ₹18,400.00 to ₹12,240.00. ₹14,000.00 has already been received, so ₹1,760.00 becomes refundable.` · `[Keep editing]` ghost + `[Save changes]` primary. **Allowed — warned, not blocked** |
| Conflict banner | Title `This booking was changed while you were editing` · Body `PTY-000045 was updated 30 seconds ago by Admin. Reload to see the current version — your changes here haven't been saved.` · `[Reload booking]` primary + `[Copy my changes]` ghost |
| Success toast | `PTY-000045 updated · 6 days · total now ₹21,160.00` |
| Balance-changed toast | `Outstanding changed from ₹8,400.00 to ₹11,160.00` Info, 5s, stacked below |
| Cancel-confirm | Title `Discard your changes?` · Body `You've added 1 day and changed 2 rates. The booking will stay as it was.` |

### 11.5 States

| State | Presentation |
|---|---|
| **Loading (first)** | Both card outlines render with shimmer bars; the banner area is reserved at 88px so nothing jumps |
| **Loading (refetch after conflict)** | Both cards dim to 60% with a 2px `#2563EB` bar under the page header |
| **Empty** | Not applicable — a booking always has party details; a booking with no days shows the §5 empty schedule state inside the Schedule card |
| **Empty (no results)** | Not applicable |
| **Filled — clean booking** | No banner; every day removable |
| **Filled — with history** | Warning banner; delivered days locked to `Edit day` and `Cancel day` |
| **Error — validation** | Per-field errors plus a Danger banner above the footer listing each problem as a clickable line |
| **Error — concurrent edit** | The Warning banner is replaced by a Danger banner with the conflict copy; the form stays populated |
| **Partial error** | Revision history unavailable: `Edited — times` in Gray 400 with a Caption `Revision history unavailable` |
| **Submitting** | `Saving…` with a spinner; both cards dim to 60%; both buttons disable |
| **Success** | Navigate to `/party-orders/[id]` with the success toast and, if the outstanding figure moved, a second Info toast naming both figures |
| **Refund-due on save** | The confirm dialog from 11.4 before saving; saving proceeds and the detail page then shows the non-dismissible refund banner |
| **Disabled** | `Save changes` disabled at 40% until at least one value differs, with a Caption to its left: `No changes yet` |
| **Read-only — cancelled booking** | The route redirects to the detail page with an error toast `PTY-000045 is cancelled and can't be edited.` |

### 11.6 Interactions

As §4.6 and §5.8, plus:

| Trigger | Behaviour |
|---|---|
| Try to remove a delivered day | Not offered. The `⋯` shows `Cancel day` with a Caption in the menu: `Delivered days are kept for billing` |
| Save when the total drops below what has been received | Refund-due confirm dialog first |
| Click `Edited 1 time` | Revision drawer, 400px right: side-by-side diff, removed values `#FEE2E2`, added `#DCFCE7`, headers `v1 → v2 · 14 Aug 2026, 9:12 am · Admin` |
| Conflict on save | Danger banner, no data lost, `Reload booking` refetches |

### 11.7 Responsive

As §4.7 and §5.9. The warning banner sits above both cards at full width and wraps to three or four lines. The shared footer becomes a fixed 72px bottom bar with `Save changes` full-width and `Cancel` as a text link above it.

### 11.8 Dark mode

As §4.8 and §5.10. Warning banner `#7C2D12` / 1px `#F97316` / `#FED7AA` text. Conflict banner `#7F1D1D` / `#FECACA`. Diff drawer removed `#7F1D1D`, added `#14532D`.

### 11.9 Stitch prompt

```text
Design an "Edit PTY-000045" screen for an internal Indian water-plant app. Light
theme: page #F8FAFC, white cards, 1px #E5E7EB borders, 12px radius. Inter text,
JetBrains Mono numbers, blue #2563EB.

Top: small blue back link "‹ PTY-000045", then a 28px heading "Edit PTY-000045" with
the code in monospace, then grey 14px meta "Shreeji Wedding Hall · Created 12 Aug
2026 · Edited 1 time · v2" where "Edited 1 time" is an underlined link.

Directly below, a full-width AMBER banner: #FEF3C7 fill, 1px #F97316 border, 12px
radius, 16px padding, warning-triangle icon, bold amber heading "This booking has 2
payments and 2 delivered days", body "Changing the schedule will recalculate the
total payable and the outstanding balance. Delivered days can be cancelled but not
removed."

Then a card headed "Party details" holding a single-column form: a 48px input "Party
name *" = "Shreeji Wedding Hall", two 200px fields "Phone *" = 9825044556 and
"Alternate phone" = 9909112233, and a 3-row address textarea.

Then a card headed "Schedule" containing a vertical timeline: a 2px grey rail with
12px dots, and day cards with 44px headers. The first two cards show GREEN
"Delivered" pills and their ⋯ menus are limited. Later cards show blue "Scheduled"
pills with footers holding "Edit day" and "⧉ Duplicate". Between two of them, a 28px
row with a thin dashed grey line broken by pale grey text "18 Aug 2026 · Tue — no
delivery". Right-aligned totals at the bottom of the card: "Days scheduled 6",
"Total units 520", "Cancelled days excluded −₹6,160.00" in grey, a rule, then "Total
payable ₹21,160.00" in 18px bold mono.

Fixed bottom bar, right aligned: ghost "Cancel" and filled blue "Save changes".
```

---

## Module design checklist

Every screen and modal in this module, before it is considered finished:

**Standards compliance**

- [ ] Page header on every full screen has an H2 title **and** a one-line Body SM subtitle
- [ ] Primary action top-right, named for what it does — `+ New Booking`, `Book party order`, `Save day`, `Record payment`, `Generate 5 days`. Never `Submit` or `OK`
- [ ] Table body rows **48px**, header rows **44px** and sticky, line-item and modal-table rows **56px**, review-table rows 40px, day-card headers 44px, day-card item rows 32px, day-card footers 48px, no-delivery markers 28px, tabs 44px
- [ ] Cell padding 12px vertical / 16px horizontal, no zebra striping, row hover `#F3F4F6`
- [ ] Money is JetBrains Mono, right-aligned, `₹` prefix, always 2 decimals, `—` in `#D1D5DB` for zero, `(₹1,000.00)` in Danger for negative
- [ ] Quantities mono, right-aligned, grouped, no decimals
- [ ] Dates `14 Aug 2026`; ranges collapse shared parts (`14–18 Aug 2026`, `28 Aug – 2 Sep 2026`); recent dates become `Today`; times `6:05 pm`; digits Latin in both languages
- [ ] Status badges use the §7.2 map verbatim — `Scheduled`, `Delivered`, `Skipped`, `Cancelled`, `Unpaid`, `₹4,500 due`, `Paid`, `Overpaid ₹600`, `Refund ₹500` — **with numbers where available**
- [ ] Dual badges on list rows: payment first, delivery second, 4px apart
- [ ] Icons only from the §17 map plus this module's calendar set: `PartyPopper`, `Calendar`, `CalendarPlus`, `CalendarDays`, `Repeat`, `Copy`, `Check`, `SkipForward`, `Ban`, `Users`, `MapPin`, `Banknote`, `Package`, `Plus`, `Pencil`, `Trash2`, `Search`, `SlidersHorizontal`, `Download`, `MoreHorizontal`
- [ ] Cards do not lift on hover; only table rows and calendar pills change background
- [ ] Spacing uses only 4 / 8 / 12 / 16 / 24 / 32

**States**

- [ ] Loading-first uses skeletons; loading-refilter and month-change dim existing content and never re-skeleton
- [ ] Empty-no-data and empty-no-results have **distinct copy** on the list, the calendar and the schedule builder
- [ ] Error copy is plain language with a recovery action; no stack traces
- [ ] Partial-error designed on the list, the calendar, the detail page, the generator and the edit-day modal
- [ ] Submitting dims to 60%, spinner in the primary button, present-tense label
- [ ] Success navigates or closes with a toast naming the amount, the day or the code
- [ ] Disabled states always carry an adjacent Caption or tooltip explaining why
- [ ] The wizard's final `Book party order` button is **never** disabled — it validates and reports on click
- [ ] Read-only / cancelled booking renders fully legible with write actions removed, not disabled

**Module-specific**

- [ ] **Gaps are visible.** Days with no delivery render as a 28px dashed marker between the first and last scheduled day, on the schedule builder, the detail page and the mobile agenda calendar
- [ ] Runs of 4+ empty days collapse to a single marker with `Show days`
- [ ] Clicking a no-delivery marker opens the Edit-day modal pre-set to that date
- [ ] **Three ways to add a day** are all present and visually ranked: `+ Add a day` (blue-outlined), `Repeat pattern`, `Duplicate a day`
- [ ] The **repeat-pattern generator** previews every date as a tickable chip, marks already-scheduled dates as skipped, and counts its own action in the button label (`Generate 5 days`)
- [ ] **Generated days are ordinary days** — individually editable, with a session-scoped `Generated` badge and a one-line explainer banner
- [ ] Duplicate-a-day names the source date, the item count and the value, and refuses a date that already exists with a link to edit it instead
- [ ] Day-cards are the **same component** in the wizard, the detail page and the edit screen; only the footer actions differ
- [ ] The wizard step indicator shows real entered summaries on completed steps (`5 days · ₹18,400.00`), not generic descriptions, and completed steps are clickable
- [ ] Below `md` the step indicator collapses to a `Step 2 of 4` bar with a progress fill and a tappable bottom sheet
- [ ] **Advance payments are visually distinct** in the payment timeline: a Primary `Advance` badge in the entry header, a blue rail dot regardless of position, and the sub-line `Taken at booking, before any delivery`
- [ ] Advance payments are **allowed to exceed the total**, with Info-tinted copy; non-advance overpayments use Warning-tinted copy that offers the advance flag as the fix
- [ ] Cancelling a day that drops the total below what has been received warns with exact figures and produces the `Refund ₹1,000` badge and a non-dismissible banner
- [ ] A **delivered day cannot be deleted**, only cancelled, and the `⋯` menu says so
- [ ] Delivered quantities that differ from planned show `× 50 → 48` with the planned figure struck and a `Billed on delivered quantities` note
- [ ] Rate overrides show a 2px `#F97316` left border, a Warning chip with the per-unit **and** line difference, and an optional reason
- [ ] Concurrent-edit conflict names who changed it and when, and preserves the user's input
- [ ] The calendar degrades to an agenda list below `md`, keeping the no-delivery marker pattern

**Craft**

- [ ] Every figure that could be drilled into is clickable — KPI values, progress bars, summary sub-lines, day totals, calendar pills, doc codes
- [ ] Search placeholder names what is searched: `Search code, party name, phone, address…`
- [ ] Validation never fires while typing; on blur for touched fields; on submit with focus to the first error; live re-validation once errored
- [ ] Focus rings (2px `#2563EB` at 2px offset) visible on every interactive element, including day-cards, no-delivery markers, preview chips and calendar pills
- [ ] Modals trap focus, restore it to the trigger on close, and confirm before discarding dirty input
- [ ] Touch targets 44×44px minimum, including day-card `⋯`, no-delivery markers, preview chips and calendar overflow links
- [ ] Designed in both light and dark, with dedicated dark badge pairs and an `#0F172A` inset for what is `#F3F4F6` in light
- [ ] Checked with Gujarati at realistic length: `શ્રીજી વાડી` in the party column, `પટેલ સમાજ વાડી, કલોલ ચાર રસ્તા પાસે` in the address card, localised weekday abbreviations in the calendar header, and two-line wrapping column headers
- [ ] Mobile layout defined below `md` for all six screens and all three modals, with modals becoming full-screen sheets and the calendar becoming an agenda
- [ ] Idempotency on the payment modal so a double-tap cannot double-record
