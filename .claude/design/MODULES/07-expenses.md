# Module 07 — Expenses · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/07-expenses.md](../../MODULES/07-expenses.md)
>
> A cash-out register, not an accounting system. The question this module answers is *"did the business make money this month?"* — so the month is the default frame, and profit sits on the same screen as the outgoings.

---

## 1. Design context (for Stitch)

**Product:** internal web app for the owner of a mineral-water plant in Gujarat, India. Data-dense, used many times a day, English + Gujarati, light + dark.

### 1.1 Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| Primary — Nova Blue | `#2563EB` | `#3B82F6` | Primary buttons, links, focus rings |
| Surface (card) | `#FFFFFF` | `#1E293B` | Cards, table body, modals |
| Surface subtle | `#F3F4F6` | `#1E293B` | Table headers, inset panels, dropzone |
| Page background | `#F8FAFC` | `#0B1220` | Behind cards |
| Text primary | `#111827` | `#F1F5F9` | Values, headings |
| Text secondary | `#4B5563` | `#94A3B8` | Labels, captions, helper |
| Text muted / empty | `#D1D5DB` | `#475569` | Em-dash zero values |
| Border | `#E5E7EB` | `#334155` | Card borders, table rules |
| Input border | `#D1D5DB` | `#334155` | Field outlines |
| Success | `#22C55E` | same | Profit, active category |
| Warning | `#F97316` | same | Attention, over-budget |
| Danger | `#EF4444` | same | Errors, upload failure, loss |

### 1.2 Type

| Role | Spec |
|---|---|
| H2 page title | 28px / 1.3 / 600 / `#111827` |
| H3 card heading | 22px / 1.4 / 600 |
| H4 modal + section | 18px / 1.4 / 600 |
| Body | 16px / 1.6 / 400 |
| Body SM (default) | 14px / 1.5 / 400 — table cells, form labels |
| Caption | 12px / 1.4 / 500 — metadata, badges, column headers, helper |

Fonts: **Inter**, **JetBrains Mono** (`tabular-nums`) for every figure, **Noto Sans Gujarati** in the fallback stack.

| Figure role | Spec |
|---|---|
| Table amount | 14px mono 500, right-aligned |
| Emphasised amount (month total, profit) | 14px mono 600 `#111827`, right-aligned |
| KPI value | 28px mono 700 |
| Form total | 18px mono 600 |

### 1.3 Space, radius, metrics

`space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-6` 24 · `space-8` 32. Table header **44px**, body row **48px**, editable line row **56px**, toolbar 56px, input 40px. Radius: input 4px · button/chip 8px · badge full · card/modal 12px. Card shadow `0 1px 2px rgba(0,0,0,.05)`, modal `0 20px 25px rgba(0,0,0,.15)`. Content max 1440px, padding 24px (16px below `md`). Sidebar 240px, topbar 64px.

### 1.4 Badges — §7.1 variants, verbatim

| Variant | Light bg / text | Dark bg / text |
|---|---|---|
| Default | `#E5E7EB` / `#374151` | `#334155` / `#E2E8F0` |
| Primary | `#DBEAFE` / `#1D4ED8` | `#1E3A8A` / `#BFDBFE` |
| Success | `#DCFCE7` / `#15803D` | `#14532D` / `#BBF7D0` |
| Warning | `#FEF3C7` / `#B45309` | `#7C2D12` / `#FED7AA` |
| Danger | `#FEE2E2` / `#B91C1C` | `#7F1D1D` / `#FECACA` |

22px tall, 8px horizontal padding, full radius, 12px/500, optional 12px leading icon + 4px gap. Used here for: category chips (Default / Primary when active), `Active` Success and `Inactive` Default on categories, and `Draft`-style neutrals nowhere else — expenses have no lifecycle status.

### 1.5 Numbers

`₹` + Indian lakh grouping + **2 decimals** → `₹1,42,300.00`. Zero → `—` `#D1D5DB`. Negative → parentheses in Danger `(₹12,400.00)`. Date `14 Aug 2026`, today → `Today`. Percentage 1 decimal with an arrow `▲ 8.4%`. **Digits are Latin 0–9 in both languages.**

> **Trend colours invert here.** Expenses rising is bad: `▲ 8.4%` renders in `#B91C1C` with `TrendingUp`, `▼ 5.2%` in `#15803D` with `TrendingDown`. Profit behaves normally — up is green.

### 1.6 Icons (Lucide, 1.5px stroke, §17 map)

`Receipt` expense · `Wallet` cash · `Banknote` payment · `Users` staff · `Coins` coin printing · `Package` jar purchase · `Plus` add · `Pencil` edit · `Trash2` delete · `Search` search · `SlidersHorizontal` filter · `Download` export · `MoreHorizontal` more · `Paperclip` attachment · `Upload` dropzone · `FileText` PDF · `ImageIcon` photo · `X` remove · `AlertTriangle` error · `AlertCircle` field error · `TrendingUp` / `TrendingDown` trend.

### 1.7 The five principles

1. **Density over whitespace** — 48px rows; 25 expenses visible at once.
2. **Numbers are the interface** — amounts get mono, right alignment, more weight than their labels.
3. **Status is scannable without reading** — the category chip's colour and the attachment clip are read before any text.
4. **Every number is a door** — the profit KPI opens the income breakdown; the biggest-category KPI opens this list filtered to it.
5. **Entry speed is a feature** — amount autofocused, category remembered from the last entry, `⌘/Ctrl + Enter` saves.

---

## 2. Screens in this module

| # | Screen | Route | Archetype | Purpose |
|---|---|---|---|---|
| 3 | Expense list | `/expenses` | **A — List** | This month's outgoings, by category, with profit on the same screen |
| 4 | Expense create / edit | `/expenses/new` · `/expenses/[id]/edit` | **C — Form** | Record one payment out, with the bill photo attached |
| 5 | Expense detail | `/expenses/[id]` | **B — Detail** | One expense, with the receipt shown full size |
| 6 | Category management | `/expenses/categories` | **A — List (compact)** | A short editable list — rename, add, deactivate |
| 7 | Modal — Receipt viewer | over 3 / 5 | Modal 720px | Read the bill without downloading it |

---

## 3. Screen — Expense list `/expenses`

### 3.1 Purpose

Where the money went this month, and whether the month is ahead. The default view is **this month, newest first** — the owner almost never wants "all time", and asking him to pick a date range every visit costs more than it gives.

### 3.2 Layout

```
Expenses                                            [⬇ Export CSV]  [+ Add expense]
What the business paid out, and what's left after income

┌──────────────────┐┌──────────────────┐┌──────────────────┐┌──────────────────┐
│ 🧾 THIS MONTH    ││ 🧾 BIGGEST       ││ 📈 VS LAST MONTH ││ 💰 MONTH'S PROFIT│
│ ₹1,42,300.00     ││ Fuel             ││ ▲ 8.4%           ││ ₹86,750.00       │
│ 34 expenses      ││ ₹48,200.00 · 34% ││ ₹11,050 more     ││ Income ₹2,29,050 │
└──────────────────┘└──────────────────┘└──────────────────┘└──────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Search paid to, note, expense no…]   [Aug 2026 ▾] [Filters ▾] [⚙ Columns] │
│ ● All  ● Fuel  ● Staff salary  ● Electricity  ● Plant maintenance  ● +6 more   │
│ Category: Fuel ✕                                                  [Clear all]  │
├────────────┬──────────┬───────────────┬──────────────────┬──────────┬─────────┤
│ EXPENSE ↕  │ DATE ↕   │ CATEGORY ↕    │ PAID TO          │  AMOUNT ↕│ MODE    │
├────────────┼──────────┼───────────────┼──────────────────┼──────────┼─────────┤
│ EXP-000148 │ Today    │ ● Fuel        │ Shakti Petroleum │ ₹4,850.00│ Cash  📎│
│ EXP-000147 │ 14 Aug   │ ● Staff salary│ Ramesh Patel     │₹12,000.00│ UPI    —│
│ EXP-000146 │ 14 Aug   │ ● Electricity │ Torrent Power    │ ₹8,420.00│ Bank  📎│
│ EXP-000145 │ 12 Aug   │ ● Jar purchase│ Jay Ambe Plastics│₹22,400.00│ Cheque📎│
│ EXP-000144 │ 11 Aug   │ ● Misc        │ —                │   ₹340.00│ Cash   —│
├────────────┴──────────┴───────────────┴──────────────────┼──────────┼─────────┤
│ Aug 2026 total                                            │₹1,42,300.00        │
├───────────────────────────────────────────────────────────┴──────────┴─────────┤
│ Showing 1–25 of 34        [25 ▾]                              ‹ 1 2 ›          │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Title / subtitle | H2 28px/1.3 600 `#111827` / Body SM `#4B5563` | `Expenses` · `What the business paid out, and what's left after income` |
| Primary action | 40px `#2563EB`, white 15px 500, radius 8px, `Plus` 16px + 8px gap | `+ Add expense` |
| Secondary | Ghost 40px `#4B5563`, `Download` 16px | `Export CSV` |
| KPI card | 20px padding, radius 12px, 1px `#E5E7EB`, `shadow-sm`; label Caption 12px 600 uppercase `0.04em` `#4B5563` with a 16px `#9CA3AF` icon; value 28px mono 700; breakdown Caption `#4B5563` | Four cards, all clickable |
| KPI 2 (biggest category) | Value is the **category name in 22px Inter 600**, not mono — it is a word, not a figure; the amount sits in the breakdown line in mono | `Fuel` / `₹48,200.00 · 34%` |
| KPI 3 (vs last month) | Value 28px mono 700 with a 20px `TrendingUp` before it, **`#B91C1C` when up** (inverted), `#15803D` when down | `▲ 8.4%` / `₹11,050 more than Jul` |
| KPI 4 (profit) | Value `#15803D` when positive, `(₹12,400.00)` `#B91C1C` when negative. Breakdown names both sides | `₹86,750.00` / `Income ₹2,29,050 − Expenses ₹1,42,300` |
| Month selector | 140px select in the toolbar, 40px, `ChevronDown`; options are the last 24 months plus `Custom range…` | `Aug 2026` |
| Category chips | 44px band; each chip 28px, radius 8px, 8px gap, with a 8px colour dot; inactive Default `#E5E7EB`/`#374151`; active `#DBEAFE` + 1px `#2563EB`. Beyond five, a `+6 more` chip opens a popover list | |
| Header row | 44px `#F3F4F6`, Caption 12px 600 uppercase `0.04em` `#4B5563`, sticky | `EXPENSE` `DATE` `CATEGORY` `PAID TO` `AMOUNT` `MODE` `ATTACHMENT` |
| Code | Mono 13px `#2563EB` 500, 130px | `EXP-000148` |
| Date | 100px Body SM; `Today` / `Yesterday` for recent | `14 Aug 2026` |
| Category | 170px; 8px colour dot + Body SM `#111827` | `● Fuel` |
| Paid to | Flexible min 180px, Body SM `#111827`; empty → `—` `#D1D5DB` | `Shakti Petroleum` · `રમેશ પટેલ` |
| Amount | 130px right, mono 14px 500 | `₹4,850.00` |
| Mode | 100px, Body SM `#4B5563` | `Cash` `UPI` `Bank transfer` `Cheque` |
| **Attachment** | 60px centred. Present → 16px `Paperclip` `#4B5563` in a 32px button (padded to 44px), tooltip `View receipt`; absent → `—` `#D1D5DB`. **Never blank** — an empty cell reads as "not loaded" | |
| Actions | 56px `⋯`: `View` · `Edit` · `Download receipt` · `Delete` (Danger text) | |
| **Total row** | 48px foot row above pagination, `#F3F4F6`, 1px `#111827` top border; label Body SM 600 left, amount mono **16px 600** right. Shows the **filtered** total, and says so | `Aug 2026 total` · `Fuel in Aug 2026 total` when filtered |
| Row | 48px, 1px `#E5E7EB` bottom, hover `#F3F4F6` 100ms, click → detail | |

### 3.4 Content and copy

- Search placeholder: `Search paid to, note, expense no…`
- Filters popover: `Category` (multi) · `Date range` · `Payment mode` · `Amount range` (min–max) · `Linked staff` · `Has attachment` (Any / With receipt / Without receipt)
- KPI labels: `THIS MONTH'S EXPENSES` · `BIGGEST CATEGORY` · `VS LAST MONTH` · `THIS MONTH'S PROFIT`
- Empty (no data): H4 `No expenses recorded yet` · Body SM `Diesel, salary, electricity, repairs — record what goes out and the dashboard can show real profit instead of just turnover.` · `+ Add expense`
- Empty (no results, month has none): H4 `Nothing recorded in Aug 2026` · Body SM `Try another month, or add the first expense for this one.` · `[View Jul 2026]` secondary + `+ Add expense` primary
- Empty (no results, filters): H4 `No expenses match your filters` · Body SM `Filters: Category Fuel · With receipt · Aug 2026` · `Clear filters`
- Error: H4 `Couldn't load expenses` · Body SM `The server didn't respond. Nothing has been changed.` · `Try again`
- Profit KPI unavailable: value `—`, breakdown `Income figures unavailable` + `Retry` link
- Delete confirm: H4 `Delete EXP-000148?` · Body SM `₹4,850.00 to Shakti Petroleum on 16 Aug 2026 will be removed from this month's profit. It stays in the records and can be restored.` · `[Cancel]` `[Delete expense]`
- Delete success toast: `EXP-000148 deleted — ₹4,850.00` + `Undo` for 8 seconds

### 3.5 States

| State | Presentation |
|---|---|
| Loading (first) | Toolbar and header render; 8 skeleton rows at 60% / 40% / 80% widths, 1.5s shimmer; KPI labels visible, values shimmer |
| Loading (refilter / month change) | Table stays at 60% opacity, pointer-events off, 2px `#2563EB` indeterminate bar under the header. KPIs shimmer independently since they recompute per month |
| Empty (no data at all) | 48px `Receipt` `#D1D5DB` centred in 320px + copy + primary CTA |
| Empty (no results — month) | Distinct copy naming the month, plus a shortcut to the previous month |
| Empty (no results — filters) | 48px `SearchX`, active filters listed, `Clear filters` |
| Filled | As drawn |
| Error | 48px `AlertTriangle` `#EF4444` + `Try again` |
| Partial error | Table renders with a Danger banner above: `Profit couldn't be calculated — income figures are unavailable. Expense totals below are correct.` |
| Profit negative | KPI 4 value `(₹12,400.00)` `#B91C1C`, card gets a 3px `#EF4444` left border, breakdown `Expenses were higher than income this month` |
| Read-only | `+ Add expense`, `⋯` and delete hidden; rows still open |

### 3.6 Interactions

- Row hover `#F3F4F6`; row click → `/expenses/[id]`. The `Paperclip` button opens the receipt viewer (§7) **without** navigating — `event.stopPropagation()`.
- Month selector changes the whole page including KPIs; the month is written to the URL so back works and the view is shareable.
- Category chips are multi-select and add removable filter chips below the toolbar.
- KPI 2 → this list filtered to that category. KPI 3 → the same list for last month. KPI 4 → the profit report for the month.
- Sortable: `EXPENSE`, `DATE`, `CATEGORY`, `AMOUNT`. Cycle none → asc → desc → none.
- Search debounced 300ms with a `×` clear.
- Tab order: search → month → filters → chips → headers → row 1 → its paperclip → its `⋯` → row 2 …
- Keyboard: `/` focuses search, `n` opens the create form.

### 3.7 Responsive (below 768px)

Each row becomes a card:

```
┌───────────────────────────────────────┐
│ EXP-000148                  ● Fuel  📎│
│ Shakti Petroleum · Today              │
│ Cash                    ₹4,850.00     │
└───────────────────────────────────────┘
```

Amount is the largest element, right-aligned, 16px mono 600. KPIs stack 1-across (2 at `md`) with `THIS MONTH'S PROFIT` moved to **first** — on a phone it is the only card the owner reliably wants. Toolbar becomes a full-width search plus month selector on one line, and a `Filters` button opening a bottom sheet holding the category chips. `+ Add expense` becomes a 56px `#2563EB` FAB bottom-right. The total row becomes a sticky bar above the FAB.

### 3.8 Dark mode

Page `#0B1220`; cards and table `#1E293B`; header row and total row `#0F172A`; borders `#334155`; text `#F1F5F9` / `#94A3B8`; em-dash `#475569`; row hover `#334155`; links and focus `#3B82F6`. Inverted trend colours become `#F87171` (up/bad) and `#4ADE80` (down/good) for contrast. Profit positive `#4ADE80`, negative `#FCA5A5`. Category dots keep raw hex.

### 3.9 Stitch prompt

```text
Design a desktop table page "Expenses" for an internal Indian water-plant business app. Light theme, page background #F8FAFC, white cards with 1px #E5E7EB borders and 12px radius. Inter for text, JetBrains Mono with tabular numerals for every figure. 240px left sidebar, 64px topbar, content max 1440px with 24px padding.

Page header: 28px semibold #111827 "Expenses" with 14px #4B5563 subtitle "What the business paid out, and what's left after income". Right: ghost "Export CSV" and blue #2563EB "+ Add expense".

Four KPI cards, 24px gap, 20px padding, each with a 12px uppercase letter-spaced grey label and a small grey icon: THIS MONTH'S EXPENSES ₹1,42,300.00 in 28px mono bold / "34 expenses"; BIGGEST CATEGORY with the value shown as 22px semibold Inter word "Fuel" / "₹48,200.00 · 34%"; VS LAST MONTH "▲ 8.4%" in RED with an up-trend icon (rising expenses are bad) / "₹11,050 more than Jul"; THIS MONTH'S PROFIT ₹86,750.00 in green / "Income ₹2,29,050 − Expenses ₹1,42,300".

Table card: 56px toolbar with a search box "Search paid to, note, expense no…", a 140px month select showing "Aug 2026", and a "Filters" button. Below, a 44px row of pill chips each with a small colour dot: All, Fuel, Staff salary, Electricity, Plant maintenance, +6 more — with "Fuel" active in #DBEAFE with a blue border.

Table header 44px, #F3F4F6, 12px uppercase grey: EXPENSE, DATE, CATEGORY, PAID TO, AMOUNT, MODE, ATTACHMENT. Rows exactly 48px, 1px separators, no zebra. Rows: "EXP-000148 / Today / ● Fuel / Shakti Petroleum / ₹4,850.00 / Cash / paperclip icon"; "EXP-000147 / 14 Aug 2026 / ● Staff salary / Ramesh Patel / ₹12,000.00 / UPI / em-dash"; "EXP-000146 / 14 Aug 2026 / ● Electricity / Torrent Power / ₹8,420.00 / Bank transfer / paperclip"; "EXP-000145 / 12 Aug 2026 / ● Bottle & jar purchase / Jay Ambe Plastics / ₹22,400.00 / Cheque / paperclip"; "EXP-000144 / 11 Aug 2026 / ● Miscellaneous / em-dash / ₹340.00 / Cash / em-dash". All amounts right-aligned mono.

Below the last row a grey total row: bold "Aug 2026 total" on the left and "₹1,42,300.00" in 16px mono semibold on the right, separated by a 1px dark rule. Then a 56px footer: "Showing 1–25 of 34" left, page size and pager right.
```

---

## 4. Screen — Expense create / edit `/expenses/new` · `/expenses/[id]/edit`

### 4.1 Purpose

Record one payment out in under fifteen seconds, and let the bill photo come along for the ride. The receipt upload is the only complex part and gets a real dropzone with a preview, not a bare file input.

### 4.2 Layout

```
‹ Expenses
Add expense
Record one payment out — diesel, salary, electricity, repairs

┌── Expense ──────────────────────────────────────────────────────────┐
│  Amount *                     Date *                                │
│  [ ₹    4,850.00 ]            [ 16 Aug 2026          📅 ]           │
│                                                                     │
│  Category *                   Payment mode *                        │
│  [ ● Fuel                ▾ ]  [ Cash                     ▾ ]        │
│  + Add category                                                     │
│                                                                     │
│  Paid to                      Linked staff                          │
│  [ Shakti Petroleum        ]  [ Search staff…            ▾ ]        │
│  Vendor or person. Any script  For salary, advances, reimbursements │
│                                                                     │
│  Note                                                               │
│  [ Tempo diesel, 42 litres, Sector 7 route                    ]     │
│                                                                     │
│  Receipt                                                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │            ⬆                                                  │  │
│  │   Drop the bill photo here, or click to choose                │  │
│  │   JPG, PNG or PDF · up to 5 MB                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                                     [ Cancel ]  [ Save expense ]    │
└─────────────────────────────────────────────────────────────────────┘
```

**Dropzone with a file attached:**

```
┌───────────────────────────────────────────────────────────────┐
│ ┌──────┐  bill-shakti-16aug.jpg                          ✕    │
│ │ 🖼   │  1.4 MB · uploaded                                   │
│ │thumb │  [View]  [Replace]                                   │
│ └──────┘                                                      │
└───────────────────────────────────────────────────────────────┘
```

### 4.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, `ChevronLeft` 16px | `‹ Expenses` |
| Title / subtitle | H2 600 / Body SM `#4B5563` | `Add expense` · `Record one payment out — diesel, salary, electricity, repairs`. Edit: `Edit EXP-000148` · `Changes are recorded in the activity log` |
| Card | Max 720px, 24px padding, radius 12px, 1px `#E5E7EB`, 16px field gap | |
| Label | Body SM 500 `#111827`, 6px above; required `*` in `#2563EB` | |
| **Amount** | **200px** money input, 48px tall (the primary field on a fast-entry form), `₹` prefix inside in `#4B5563`, mono right-aligned, autofocused | Placeholder `0.00` |
| Date | **180px**, `Calendar` 16px right, defaults to today, popover with `Today` / `Yesterday` chips, future dates disabled | `16 Aug 2026` |
| Category | Search select, full column width, options show a colour dot; inactive categories excluded; `+ Add category` pinned at the bottom of the list **and** repeated as a text link under the field | Placeholder `Choose a category` |
| Payment mode | Select, full column width | `Cash` · `UPI` · `Bank transfer` · `Cheque` |
| Paid to | Text, full column width, any script | Placeholder `e.g. Shakti Petroleum` |
| Linked staff | Search select, optional, options `Ramesh Patel · 9876543210`; clearable with a `×` | Placeholder `Search staff…` |
| Note | Textarea, 3 rows, full width, vertical resize only | Placeholder `e.g. Tempo diesel, 42 litres, Sector 7 route` |
| **Dropzone (empty)** | Full width, **120px** tall, `#F3F4F6` bg, 1px **dashed** `#D1D5DB`, radius 8px, centred content: 24px `Upload` `#9CA3AF`, Body SM `#4B5563` line, Caption `#9CA3AF` line. Whole area clickable, keyboard focusable with a 2px `#2563EB` ring | See §4.4 |
| Dropzone (drag over) | Border becomes 2px solid `#2563EB`, background `#DBEAFE`, icon and text `#1D4ED8`; 100ms transition | `Drop to attach` |
| **Dropzone (filled)** | Height 88px, solid 1px `#E5E7EB`, white bg. Left: 64×64 thumbnail, radius 4px, `object-fit: cover`; PDFs show a 24px `FileText` `#4B5563` on `#F3F4F6`. Right of it: filename Body SM 500 `#111827` truncated in the middle (`bill-shakti-…-16aug.jpg`), then Caption `#4B5563` `1.4 MB · uploaded`, then two 28px ghost buttons `View` and `Replace`. Far right: `✕` 16px `#9CA3AF` → `#EF4444` | |
| Dropzone (uploading) | Thumbnail at 40% opacity; filename row replaced by a 4px `#E5E7EB` track with a `#2563EB` fill; Caption `Uploading… 62%`; `✕` becomes `Cancel` | |
| Footer | Sticky inside the card, 1px `#E5E7EB` top, 16px/24px padding, right-aligned | `[Cancel]` ghost · `[Save expense]` primary |

### 4.4 Content and copy

- Dropzone empty: `Drop the bill photo here, or click to choose` / `JPG, PNG or PDF · up to 5 MB`
- Dropzone empty, mobile: `Take a photo of the bill` / `or choose from your gallery · JPG, PNG or PDF · up to 5 MB`
- Dropzone drag-over: `Drop to attach`
- Field errors: `Enter an amount` · `Amount must be more than ₹0.00` · `Choose a category` · `Choose a payment mode` · `The date can't be in the future` · `Note can't be longer than 500 characters`
- **Upload errors** (shown inside the dropzone, which turns 1px `#EF4444` with `#FEE2E2` bg):
  - `That file is 8.2 MB. Receipts must be under 5 MB — try photographing it again at a lower quality.`
  - `.heic files can't be read. Save it as JPG or PNG and try again.`
  - `Upload failed. Your expense hasn't been saved yet, so nothing is lost.` + `Retry` and `Remove`
  - `You're offline. The receipt will need to be attached again once you're back on.`
- Form-level error banner (Danger tint `#FEE2E2`, 1px `#EF4444`, radius 12px, 16px padding): `This expense couldn't be saved` + the plain-language reason
- Edit warning (Warning tint): `EXP-000148 is in Aug 2026. Changing the amount or date will change that month's profit figure.`
- Buttons: `Save expense` / submitting `Saving…` / edit `Save changes`
- Success toast: `Expense of ₹4,850.00 recorded` · with receipt: `Expense of ₹4,850.00 recorded with receipt`
- `+ Add category` inline: opens a 420px dialog with a single `Category name *` field and `[Cancel]` `[Add category]`; on success the new category is selected automatically and a toast reads `Category "Borewell repair" added`
- Cancel confirm: H4 `Discard this expense?` · Body SM `₹4,850.00 to Shakti Petroleum and the attached receipt will be lost.` · `[Keep editing]` `[Discard]`

### 4.5 States

| State | Presentation |
|---|---|
| Loading (edit) | Card renders with labels; fields are 40px shimmer bars; dropzone is an 88px shimmer; footer disabled |
| Empty (new) | All blank except date = today and category = the last category used, shown with Caption `Last used — change if needed`. Amount autofocused |
| Filled | As drawn |
| Error (field) | 1px `#EF4444` border, 16px `AlertCircle` `#EF4444` inside right, Caption `#EF4444` below with a 14px `AlertCircle` and 4px gap. Space reserved so nothing shifts |
| **Upload — uploading** | Progress state above; `Save expense` disabled at 40% with tooltip `Wait for the receipt to finish uploading` |
| **Upload — failed** | Red dropzone with the error copy and `Retry` / `Remove`. The form is still submittable without the receipt — a failed photo must never block the expense |
| **Upload — rejected (size/type)** | Red dropzone, specific copy, file not attached, focus moved to the dropzone |
| Submitting | Primary shows a spinner, label `Saving…`, both buttons disabled, card dims to 60% |
| Success | Navigate to `/expenses/[id]` with a success toast |
| Error (save) | Form banner above the footer; every entered value and the uploaded receipt preserved |
| Disabled (category inactive, edit mode) | The historical category still shows, marked `● Coin printing · inactive` in `#4B5563`, with Caption `This category is no longer active. Leave it, or pick another.` |
| Read-only | Inputs borderless on `#F3F4F6` with `#4B5563` text; dropzone replaced by the filled receipt row with only `View`; footer removed |

### 4.6 Interactions

- Autofocus `Amount`. Tab order: Amount → Date → Category → Payment mode → Paid to → Linked staff → Note → Dropzone → Cancel → Save.
- `Enter` in any single-line field submits (this is a short form and speed matters); `⌘/Ctrl + Enter` submits from the textarea.
- Money field accepts `4850`, `4,850`, `4850.50`; reformats with lakh grouping on blur.
- Validation on blur once touched; on submit validate everything and focus the first error; after an error, re-validate live.
- Dropzone: click opens the file picker; drag-over changes style; drop uploads immediately with progress; `Enter`/`Space` when focused opens the picker; paste (`⌘/Ctrl + V`) of an image attaches it.
- `Replace` opens the picker and swaps the file, keeping the old one until the new upload succeeds. `✕` removes with a Caption undo link `Receipt removed · Undo` for 8 seconds.
- `View` opens the receipt viewer (§7).
- Selecting a `Linked staff` value shows Caption `This will appear on Ramesh Patel's cost summary`.
- `Esc` triggers the cancel confirm when dirty.

### 4.7 Responsive (below 768px)

Card full width, 16px padding. Every field pair stacks; Amount grows to 48px with an 18px mono value; Date full width. Dropzone becomes two stacked 48px buttons — `Take photo` (with a `Camera` icon, opening the camera directly) and `Choose file` — with the drag copy removed, since dragging is meaningless on a phone. The filled state keeps the 88px row with a 56px thumbnail. Footer becomes fixed to the viewport bottom: `Save expense` 48px full width, `Cancel` as a link above.

### 4.8 Dark mode

Card `#1E293B` on `#0B1220`. Dropzone `#0F172A` with a dashed `#334155` border and `#94A3B8` text; drag-over `#1E3A8A` with a `#3B82F6` border; filled state `#1E293B` with a `#334155` border; error state `#7F1D1D` with `#EF4444` border and `#FECACA` text. Progress track `#334155`, fill `#3B82F6`. Input borders `#334155`, focus ring `#3B82F6`. Thumbnails keep their own colours with a 1px `#334155` frame.

### 4.9 Stitch prompt

```text
Design a desktop form page "Add expense" for an internal Indian business app. Light theme, page background #F8FAFC, one white card max 720px wide with 12px radius, 1px #E5E7EB border and 24px padding. Inter for text, JetBrains Mono for numbers.

Above the card: a small blue "‹ Expenses" link, a 28px semibold #111827 title "Add expense", and a 14px #4B5563 subtitle "Record one payment out — diesel, salary, electricity, repairs".

Fields in pairs with 16px gaps, labels 14px medium #111827 with blue asterisks on required ones, inputs 1px #D1D5DB with 4px radius. Row 1: "Amount *" — a 200px, 48px-tall money input with a grey ₹ prefix inside and right-aligned mono "4,850.00" — and "Date *", a 180px field showing "16 Aug 2026" with a calendar icon. Row 2: "Category *" a select showing a small orange dot and "Fuel", with a small blue "+ Add category" text link beneath it, and "Payment mode *" a select showing "Cash". Row 3: "Paid to" showing "Shakti Petroleum" with 12px grey helper "Vendor or person. Any script", and "Linked staff" an empty select with placeholder "Search staff…" and helper "For salary, advances, reimbursements". Then a full-width "Note" textarea containing "Tempo diesel, 42 litres, Sector 7 route".

Then the receipt uploader, labelled "Receipt": a full-width 120px dropzone with a #F3F4F6 background, a 1px dashed #D1D5DB border and 8px radius, centred content — a 24px grey upload arrow icon, then 14px #4B5563 "Drop the bill photo here, or click to choose", then 12px #9CA3AF "JPG, PNG or PDF · up to 5 MB".

Beside it, show a second variant of the same uploader in its filled state: an 88px white row with a 1px border containing a 64px rounded photo thumbnail of a fuel bill on the left, then "bill-shakti-16aug.jpg" in 14px medium, "1.4 MB · uploaded" in 12px grey, two small ghost buttons "View" and "Replace", and a grey ✕ on the far right.

Card footer: 1px top border, right-aligned ghost "Cancel" and blue #2563EB "Save expense".
```

---

## 5. Screen — Expense detail `/expenses/[id]`

### 5.1 Purpose

One expense, fully readable, with the bill big enough to actually check against the amount.

### 5.2 Layout

```
‹ Expenses
EXP-000148                                                   ● Fuel
Shakti Petroleum · 16 Aug 2026 · Recorded by Admin · Edited once
                                          [Download receipt] [Edit] [⋯]

┌── Summary ────────────────────────────────────────────────────────────┐
│  Amount          Category        Payment mode      Linked staff       │
│  ₹4,850.00       Fuel            Cash              —                  │
└───────────────────────────────────────────────────────────────────────┘

┌── Note ───────────────────┐  ┌── Receipt ──────────────────────────┐
│ Tempo diesel, 42 litres,  │  │  ┌───────────────────────────────┐  │
│ Sector 7 route            │  │  │                               │  │
└───────────────────────────┘  │  │      [bill photo preview]     │  │
                               │  │                               │  │
┌── Activity ───────────────┐  │  └───────────────────────────────┘  │
│ ● 16 Aug 2026 · 6:05 pm   │  │  bill-shakti-16aug.jpg · 1.4 MB      │
│ │  Amount changed         │  │  [ View full size ]  [ Download ]    │
│ │  ₹4,500.00 → ₹4,850.00  │  └──────────────────────────────────────┘
│ ○ 16 Aug 2026 · 5:40 pm   │
│    Expense created        │
└───────────────────────────┘
```

### 5.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Title | H2 **mono** 28px 600 `#111827`, category chip inline at 12px gap (Default variant with a colour dot) | `EXP-000148` + `● Fuel` |
| Meta line | Body SM `#4B5563`, `·` separated; `Paid to` links to a filtered list of that vendor | `Shakti Petroleum · 16 Aug 2026 · Recorded by Admin · Edited once` |
| Actions | `Download receipt` ghost + `Download` icon (hidden when none) · `Edit` secondary · `⋯`: `Duplicate` · `Delete` (Danger text) | |
| Summary card | `#F3F4F6`, radius 12px, 20px padding, 4 columns on `lg` / 2 on `md`. Label Caption `#4B5563` above, value **20px mono 600** below; `Amount` is `#111827`, others `#374151`. Non-numeric values (Category, Mode) use Inter 20px 600, not mono | |
| Note card | Card, 20px padding, H4 `Note`; body Body 16px/1.6 `#111827`; any script; empty → `—` `#D1D5DB` |
| Receipt card | Card, 20px padding, H4 `Receipt`. Preview: max 320px tall, `object-fit: contain`, `#F3F4F6` letterbox, radius 8px, 1px `#E5E7EB`; PDFs render page 1 with a Default `PDF` badge overlaid top-left. Below: Caption `#4B5563` filename + size, then `[View full size]` secondary and `[Download]` ghost, 32px | |
| Activity | Timeline: 8px dot in the semantic colour, 1px `#E5E7EB` connector, newest first with the most recent dot filled `#2563EB`. Entry: timestamp Caption `#4B5563`, action Body SM `#111827`, change line in mono with the old value in `#9CA3AF` | `₹4,500.00 → ₹4,850.00` |
| Layout | Two columns on `lg`: left 60% (Summary spans full width, then Note, then Activity), right 40% (Receipt). Section gap 32px | |

### 5.4 Content and copy

- Summary labels: `Amount` · `Category` · `Payment mode` · `Linked staff`
- Receipt empty state: 40px `Paperclip` `#D1D5DB`, H4 `No receipt attached`, Body SM `Add a photo of the bill so you can check it later.`, `[Add receipt]` secondary (opens the edit form focused on the dropzone)
- Receipt failed to load: 40px `AlertTriangle` `#EF4444`, Body SM `Couldn't load the receipt. The file may have been moved.`, `[Try again]`
- Note empty: `—` in `#D1D5DB` with Caption `No note was added`
- Activity entries: `Expense created` · `Amount changed ₹4,500.00 → ₹4,850.00` · `Receipt attached` · `Category changed Miscellaneous → Fuel`
- Delete confirm: H4 `Delete EXP-000148?` · Body SM `₹4,850.00 to Shakti Petroleum on 16 Aug 2026 will be removed from Aug 2026's profit. It stays in the records and can be restored.` · `[Cancel]` `[Delete expense]`
- Deleted banner (Default tint, non-dismissible): `Deleted on 17 Aug 2026 by Admin. This expense no longer counts towards profit.` + `[Restore]`
- Error: H4 `Couldn't load EXP-000148` · Body SM `It may have been deleted. Nothing has been changed.` · `Try again`

### 5.5 States

| State | Presentation |
|---|---|
| Loading | Title and meta render from the list's cached row; summary values shimmer; receipt card shows a 320px shimmer rectangle |
| Empty (no receipt) | Receipt card empty state above — the card is never omitted, so the absence is explicit |
| Empty (no note) | `—` plus the caption |
| Filled | As drawn |
| Error | Error block replaces the body; header keeps the back link |
| Partial error | Receipt failed while the rest loaded: only the receipt card shows its error, everything else is normal |
| Deleted (soft) | Grey banner at the top, whole page at 70% opacity except the banner, all actions replaced by `[Restore]` |
| Read-only | `Edit`, `⋯` and `Add receipt` hidden; `Download receipt` remains |

### 5.6 Interactions

- Preview click or `View full size` opens the receipt viewer (§7).
- `Download` fetches the original file, keeping its original filename.
- Category chip → the list filtered to that category and month. `Linked staff` → the staff record.
- `Edit` → the edit form; on save it returns here with a toast.
- `⌘/Ctrl + P` prints a one-page voucher: header, summary table, note, receipt image scaled to fit.
- Tab order: back link → actions → category chip → receipt preview → receipt buttons → activity links.

### 5.7 Responsive (below 768px)

Single column in this order: title and badges, meta, summary (2×2 grid), **receipt**, note, activity. The receipt moves above the note because on a phone the photo is why the owner opened the record. Actions collapse into a sticky bottom bar with `Edit` full width and everything else behind `⋯`. Receipt preview goes full width with a 240px max height and tap-to-open.

### 5.8 Dark mode

Cards `#1E293B`, summary card `#0F172A`. Receipt letterbox `#0F172A` with a `#334155` frame — photos are shown unmodified, never dimmed or inverted, because the owner is reading a printed bill. Timeline connector `#334155`, active dot `#3B82F6`. Deleted banner `#334155` / `#E2E8F0`.

### 5.9 Stitch prompt

```text
Design a desktop detail page for a single business expense in an internal Indian app. Light theme, #F8FAFC page, white cards 12px radius 1px #E5E7EB, Inter for text and JetBrains Mono for figures.

Header: a small blue "‹ Expenses" link; a 28px semibold JetBrains Mono title "EXP-000148" with a grey pill beside it showing an orange dot and the word "Fuel"; a 14px grey meta line "Shakti Petroleum · 16 Aug 2026 · Recorded by Admin · Edited once". Right-aligned: ghost "Download receipt", outlined "Edit", and a "⋯" icon button.

Below, a #F3F4F6 summary card with four columns, each a 12px uppercase grey label above a 20px semibold value: Amount ₹4,850.00 in mono and near-black, Category "Fuel", Payment mode "Cash", Linked staff an em-dash.

Then a two-column layout with a 24px gap. Left column (60%): a "Note" card containing 16px text "Tempo diesel, 42 litres, Sector 7 route"; below it an "Activity" card with a vertical timeline — a filled blue dot with "16 Aug 2026 · 6:05 pm", "Amount changed", and a mono line "₹4,500.00 → ₹4,850.00" where the first figure is grey; then a hollow dot with "16 Aug 2026 · 5:40 pm" and "Expense created", joined by a thin grey connecting line.

Right column (40%): a "Receipt" card containing a photo of a paper fuel bill fitted inside a light grey letterbox area, 320px tall, 8px radius, 1px border; beneath it 12px grey "bill-shakti-16aug.jpg · 1.4 MB" and two small buttons, an outlined "View full size" and a ghost "Download".
```

---

## 6. Screen — Category management `/expenses/categories`

### 6.1 Purpose

Ten-ish rows the owner owns. Renaming must take one click, and a category in use must be impossible to delete — only switched off.

### 6.2 Layout

```
‹ Expenses
Expense Categories                                        [+ Add category]
Your own list — rename, add or switch off. Ten to start with.

┌──────────────────────────────────────────────────────────────────────┐
│ [🔍 Search categories…]              ● All  ● Active  ● Inactive     │
├──────┬─────────────────────────┬──────────┬───────────────┬──────────┤
│      │ CATEGORY                │ EXPENSES │  THIS MONTH   │ STATUS   │
├──────┼─────────────────────────┼──────────┼───────────────┼──────────┤
│  ●   │ Fuel                    │      112 │  ₹48,200.00   │ ●Active ⋯│
│  ●   │ Staff salary            │       48 │  ₹36,000.00   │ ●Active ⋯│
│  ●   │ Staff advance           │       19 │   ₹6,500.00   │ ●Active ⋯│
│  ●   │ Electricity             │       14 │   ₹8,420.00   │ ●Active ⋯│
│  ●   │ Plant maintenance       │       22 │  ₹14,900.00   │ ●Active ⋯│
│  ●   │ Bottle & jar purchase   │        9 │  ₹22,400.00   │ ●Active ⋯│
│  ●   │ [ Coin printing      ]  │        4 │   ₹3,200.00   │ ●Active ⋯│  ← editing
│  ●   │ Vehicle maintenance     │       17 │   ₹2,340.00   │ ●Active ⋯│
│  ●   │ Rent                    │       12 │       —       │ ●Active ⋯│
│  ●   │ Miscellaneous           │       31 │     ₹340.00   │ ●Active ⋯│
│  ●   │ Borewell repair         │        0 │       —       │ Inactive⋯│
├──────┴─────────────────────────┴──────────┴───────────────┴──────────┤
│ 11 categories · 10 active                                            │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Title / subtitle | H2 600 / Body SM `#4B5563` | `Expense Categories` · `Your own list — rename, add or switch off. Ten to start with.` |
| Primary action | 40px `#2563EB`, `Plus` 16px | `+ Add category` |
| Toolbar | 56px; search 40px max 320px; status chips right-aligned | `Search categories…` · `All` `Active` `Inactive` |
| Header row | 44px `#F3F4F6`, Caption 12px 600 uppercase `#4B5563` | swatch 48px · `CATEGORY` flexible · `EXPENSES` 110px · `THIS MONTH` 150px · `STATUS` 110px · `⋯` 56px |
| Colour swatch | 20px circle in a 48px cell, 1px `#E5E7EB` inner ring; click opens an 8-swatch popover | `#2563EB` `#F97316` `#22C55E` `#EF4444` `#8B5CF6` `#14B8A6` `#F59E0B` `#64748B` |
| Name (read) | Body SM 500 `#111827`. Hovering the row shows a 14px `Pencil` `#9CA3AF` after the name | `Bottle & jar purchase` |
| **Name (editing)** | The cell becomes a 32px inline input, 1px `#2563EB`, radius 4px, text selected. **Row height stays 48px** — no jump | |
| Expenses count | 110px right, mono 14px 500 `#4B5563`; zero → `0` (not an em dash — zero uses here is meaningful, it means safe to delete) | `112` |
| This month | 150px right, mono 14px 500; zero → `—` `#D1D5DB` | `₹48,200.00` |
| Status | 110px centred, Success `Active` / Default `Inactive` badge | |
| Actions | 56px `⋯`: `Rename` · `Change colour` · `Deactivate` / `Reactivate` · `Delete` (Danger, **disabled with a tooltip when the count is above zero**) | |
| Inactive row | Name and figures at 60% opacity; the swatch keeps full colour so the row is still identifiable | |
| Footer | 48px, `#F3F4F6`, Caption `#4B5563` | `11 categories · 10 active` |
| Row | 48px, hover `#F3F4F6`. **Rows do not navigate** — this is a settings list, not an index. Clicking the name starts an inline rename | |

### 6.4 Content and copy

- Add category dialog (420px): H4 `Add category` · field `Category name *` placeholder `e.g. Borewell repair` · colour swatch row · `[Cancel]` `[Add category]`
- Empty (no data): H4 `No categories yet` · Body SM `Categories are how you'll read your spending later — Fuel, Staff salary, Electricity. Add the ones that match how you think about the business.` · `[+ Add category]` and a secondary `[Use the standard ten]` which seeds Fuel · Staff salary · Staff advance · Electricity · Plant maintenance · Bottle & jar purchase · Coin printing · Vehicle maintenance · Rent · Miscellaneous
- Empty (no results): H4 `No categories match "borewel"` · Body SM `Check the spelling, or add it as a new category.` · `[+ Add "borewel"]`
- Errors: `Enter a category name` · `A category called "Fuel" already exists` · `Category name can't be longer than 40 characters`
- Deactivate confirm: H4 `Switch off "Coin printing"?` · Body SM `It stays on all 4 past expenses, but won't appear when you add a new one. You can switch it back on any time.` · `[Cancel]` `[Switch off]`
- Delete blocked tooltip: `"Fuel" is used by 112 expenses and can't be deleted. Switch it off instead.`
- Delete confirm (count = 0): H4 `Delete "Borewell repair"?` · Body SM `It isn't used by any expense, so nothing else changes. This can't be undone.` · `[Cancel]` `[Delete category]`
- Toasts: `Category renamed to "Bottle & jar purchase"` · `"Coin printing" switched off` · `"Borewell repair" added` · `Couldn't save the name. It hasn't been changed.` + `Retry`

### 6.5 States

| State | Presentation |
|---|---|
| Loading (first) | Header renders; 10 skeleton rows with a circle placeholder in the swatch column |
| Loading (refilter) | List at 60% opacity, 2px `#2563EB` bar under the header |
| Empty (no data) | 48px `Receipt` `#D1D5DB` + copy + both CTAs |
| Empty (no results) | 48px `SearchX` + the quoted search term + `+ Add "…"` |
| Filled | As drawn |
| **Editing a row** | Inline input active, other rows unaffected and still clickable; a second click elsewhere commits the edit rather than discarding it |
| Saving a rename | Input becomes read-only at 60% with a 14px spinner right; row still 48px |
| Error (rename) | Input keeps focus with a 1px `#EF4444` border, Caption `#EF4444` message rendered **below the row** in a 24px expansion strip so the table doesn't reflow columns |
| Inactive | Row at 60% opacity, Default `Inactive` badge, excluded from the expense form's dropdown |
| Error (load) | 48px `AlertTriangle` `#EF4444` + `Try again` |
| Read-only | `+ Add category`, `⋯` and inline editing all disabled; swatches non-clickable |

### 6.6 Interactions

- Click the name, or press `Enter` on a focused row, to start an inline rename with the text selected. `Enter` commits, `Esc` reverts, blur commits.
- `↓` / `↑` while editing commits and moves the edit to the next or previous row — the fastest way to tidy the whole list in one pass.
- Swatch click opens the colour popover; arrow keys move within it; `Enter` selects and saves immediately.
- Deactivating is optimistic: the row dims at once, and reverts with an error toast if the save fails.
- Tab order: search → chips → `+ Add category` → row 1 swatch → row 1 name → row 1 `⋯` → row 2 …
- Every category name here is the same string used by the chips on §3 and the select on §4; renaming updates all of them without touching historical expenses.

### 6.7 Responsive (below 768px)

Rows become 64px cards showing the swatch and name on line 1, and `112 expenses · ₹48,200.00 this month` in Caption on line 2, with the status badge right-aligned on line 1. Inline rename opens a bottom sheet with a single 48px field rather than an in-place input — a 32px inline input beside a thumb is not a usable target. `+ Add category` becomes a full-width 48px button pinned above the footer.

### 6.8 Dark mode

Table `#1E293B`, header and footer `#0F172A`, borders `#334155`. Inline edit input `#0F172A` with a 2px `#3B82F6` border. Swatch inner ring `#334155`. Inactive rows drop to 55% opacity — 60% is not enough separation on dark. Badges use the §1.4 dark pairs.

### 6.9 Stitch prompt

```text
Design a compact desktop settings list "Expense Categories" for an internal Indian business app. Light theme, #F8FAFC page background, one white table card with 12px radius and a 1px #E5E7EB border. Inter for text, JetBrains Mono for numbers.

Header above the card: a blue "‹ Expenses" link, a 28px semibold "Expense Categories" title, a 14px #4B5563 subtitle "Your own list — rename, add or switch off. Ten to start with.", and a blue #2563EB "+ Add category" button on the right.

Card toolbar 56px: a 320px search box "Search categories…" on the left and three small pill chips on the right — All, Active, Inactive — with "All" selected in #DBEAFE with a blue border.

Table header 44px, #F3F4F6, 12px uppercase letter-spaced grey: a narrow empty column for colour swatches, then CATEGORY, EXPENSES, THIS MONTH, STATUS, and a narrow actions column. Rows are exactly 48px with 1px #E5E7EB separators and no zebra striping. Each row starts with a 20px filled colour circle.

Rows: Fuel (orange dot) 112, ₹48,200.00, green "Active" pill; Staff salary (blue dot) 48, ₹36,000.00, Active; Staff advance (purple dot) 19, ₹6,500.00, Active; Electricity (amber dot) 14, ₹8,420.00, Active; Plant maintenance (teal dot) 22, ₹14,900.00, Active; Bottle & jar purchase (green dot) 9, ₹22,400.00, Active; Coin printing (red dot) — show THIS ROW IN INLINE EDIT MODE, with the name replaced by a 32px text input with a 2px blue border containing the selected text "Coin printing" — 4, ₹3,200.00, Active; Vehicle maintenance (slate dot) 17, ₹2,340.00, Active; Rent (blue dot) 12, em-dash, Active; Miscellaneous (grey dot) 31, ₹340.00, Active; Borewell repair (grey dot) 0, em-dash, a grey "Inactive" pill, with the whole row at 60% opacity except its colour dot.

Counts and money are right-aligned mono. A grey 48px footer strip reads "11 categories · 10 active" in 12px grey.
```

---

## 7. Modal — Receipt viewer

### 7.1 Purpose

Read the bill against the amount without downloading it or leaving the page.

### 7.2 Layout

```
┌── Receipt · EXP-000148 ──────────────────────────────── ✕ ──┐
│ Shakti Petroleum · 16 Aug 2026 · ₹4,850.00                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                  [ bill image, fit to box ]                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ bill-shakti-16aug.jpg · 1.4 MB    [− 100% +]  [⬇ Download]  │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Modal | **720px** wide, max 80vh tall, radius 12px, `shadow-xl`, overlay `rgba(15,23,42,0.5)` | |
| Header | 24px padding; H4 `Receipt · EXP-000148` (code in mono `#2563EB`, a link); subtitle Body SM `#4B5563` with the amount in mono `#111827` 600; `✕` 20px in a 44px target | `Shakti Petroleum · 16 Aug 2026 · ₹4,850.00` |
| Image area | `#F3F4F6` letterbox, 24px padding, image `object-fit: contain`, max height `calc(80vh - 160px)`, radius 8px. PDFs render page 1 with `‹ 1 / 3 ›` pager centred beneath | |
| Zoom | 32px segmented control: `−` / `100%` / `+`, steps 100 / 150 / 200 / 300%. Above 100% the image pans by drag; cursor becomes `grab` | |
| Footer | 1px `#E5E7EB` top, 16px/24px padding; filename and size in Caption `#4B5563` left; zoom centre; `Download` secondary right | |

### 7.4 Content and copy

- Title: `Receipt · EXP-000148`
- Subtitle: `Shakti Petroleum · 16 Aug 2026 · ₹4,850.00`
- Footer: `bill-shakti-16aug.jpg · 1.4 MB` · button `Download`
- PDF pager: `Page 1 of 3`
- Error: 40px `AlertTriangle` `#EF4444`, H4 `Couldn't load the receipt`, Body SM `The file may have been moved or the connection dropped.`, `[Try again]` and `[Download instead]`
- Loading: Caption `#4B5563` `Loading receipt…` under a shimmering `#F3F4F6` rectangle at the image's aspect ratio

### 7.5 States

| State | Presentation |
|---|---|
| Loading | Shimmer rectangle at the stored aspect ratio, so the modal never resizes when the image lands |
| Filled (image) | As drawn |
| Filled (PDF) | Page 1 plus the pager; zoom applies per page |
| Empty | Unreachable — the trigger only exists when a receipt is attached |
| Error | Error block inside the image area; header and footer stay, `Download` remains enabled |
| Zoomed | Image scaled, panning enabled, `100%` in the control replaced by the live percentage |
| Read-only | Identical — this modal has no write actions |

### 7.6 Interactions

- Opens focused on `✕`. `Esc` and overlay click close (never dirty, so no confirm). Focus returns to the paperclip or button that opened it.
- `+` / `−` keys and `⌘/Ctrl + scroll` zoom; `0` resets to 100%.
- `←` / `→` page a PDF; on §3 they also move to the previous or next expense **that has a receipt**, with the header updating — checking a run of bills is a real task.
- `Download` saves the original file under its original name.
- The `EXP-000148` code in the title navigates to the detail page and closes the modal.

### 7.7 Responsive (below 768px)

Full-screen sheet with no page background visible. Header collapses to `EXP-000148 · ₹4,850.00` on one line. Pinch-to-zoom replaces the zoom control, which is hidden. `Download` becomes a full-width 48px button in a sticky footer; `✕` sits top-right in a 44px target.

### 7.8 Dark mode

Modal `#1E293B`, overlay `rgba(2,6,23,0.7)`. Letterbox `#0F172A`. **The image itself is never dimmed, tinted or inverted** — it is a photo of a paper bill and must stay true. Zoom control `#0F172A` with a `#334155` border. Footer text `#94A3B8`.

### 7.9 Stitch prompt

```text
Design a 720px image-viewer modal titled "Receipt · EXP-000148" for an internal Indian business app, over a dimmed page. Light theme, white modal, 12px radius, strong shadow, overlay rgba(15,23,42,0.5). Inter for text, JetBrains Mono for figures.

Header, 24px padding: 18px semibold "Receipt · " followed by "EXP-000148" in blue monospace, an ✕ close button top right, and a 14px #4B5563 subtitle line "Shakti Petroleum · 16 Aug 2026 · ₹4,850.00" where the amount is near-black monospace.

Body: a #F3F4F6 letterbox area with 24px padding containing a photograph of an Indian fuel bill, fitted inside the box without cropping, 8px radius. The modal is at most 80% of the viewport height.

Footer: a 1px #E5E7EB top border, 16px vertical and 24px horizontal padding, arranged in three parts — on the left 12px #4B5563 text "bill-shakti-16aug.jpg · 1.4 MB"; in the centre a 32px segmented zoom control with a minus button, the label "100%", and a plus button, 8px radius with 1px #D1D5DB borders; on the right an outlined button with a download icon labelled "Download".

Keep the chrome quiet and let the photograph dominate — no coloured accents anywhere except the blue expense code in the title.
```

---

## Module design checklist

- [ ] Every page header has an H2 title **and** a one-line subtitle
- [ ] Primary action top-right, named for what it does — `+ Add expense`, `Save expense`, `Add category`
- [ ] Table rows 48px, headers 44px and sticky, no zebra striping
- [ ] All money: JetBrains Mono, right-aligned, `₹` prefix, 2 decimals, `—` for zero, parentheses + Danger for negative profit
- [ ] Trend colours **inverted** for expenses (up is red), normal for profit (up is green)
- [ ] The profit KPI names both sides of the sum — `Income ₹2,29,050 − Expenses ₹1,42,300`
- [ ] Default view is this month, newest first; the month is in the URL
- [ ] The filtered total row states what it is totalling
- [ ] Attachment column shows a `Paperclip` when present and `—` when absent, never blank
- [ ] Five core states designed per screen: loading (first), loading (refilter), empty (no data), empty (no results), filled, error — plus partial error, submitting, success, disabled, read-only
- [ ] Three distinct empty states on the list: no data at all, no expenses this month, no results for filters — each with its own copy and CTA
- [ ] Upload states designed: idle, drag-over, uploading with progress, uploaded, too large, wrong type, upload failed, offline — and a failed upload never blocks saving the expense
- [ ] Upload errors state the actual size or extension and what to do about it
- [ ] Categories in use cannot be deleted; the disabled `Delete` carries a tooltip explaining why
- [ ] Inline rename keeps the row at 48px and commits on `Enter` or blur, reverts on `Esc`
- [ ] Validation on blur, never while typing; errors specific and actionable
- [ ] Every figure that could be drilled into is clickable, including all four KPI cards
- [ ] Focus rings visible on every interactive element, 2px `#2563EB` at 2px offset; the dropzone is keyboard-openable
- [ ] Icons only from the §17 map, 1.5px stroke
- [ ] Designed in both light and dark; receipt photographs are never dimmed or inverted in dark mode
- [ ] Checked with Gujarati at realistic length: `ખર્ચ ઉમેરો` on the primary button (sizes to content, min-width 140px), `ચુકવણી પ્રકાર` wrapping the `PAYMENT MODE` label to two lines, category names like `પ્લાન્ટ મેઇન્ટેનન્સ` and `બોટલ અને જાર ખરીદી` overflowing a fixed 170px column — so the category column is flexible with a 170px minimum, and `રમેશ પટેલ` in `Paid to` at line-height 1.6
- [ ] Mobile layout defined below 768px for every screen, including camera capture in place of the dropzone
- [ ] `⌘/Ctrl + Enter` submits every form; `Esc` closes modals with a dirty-check
