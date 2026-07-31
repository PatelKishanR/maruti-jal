# Module 01 — Staff · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/01-staff.md](../../MODULES/01-staff.md)
>
> **This is the reference module.** The list → detail → form pattern defined here is copied by Products, Delivery Orders, Coins, Party Orders, Direct Sales, Expenses and Payments. Where a later module differs it says so explicitly; where it is silent, it does what this file does.

---

## 1. Design context (for Stitch)

**Product:** Maruti Jal — internal admin tool for a mineral water plant in Gujarat, India. One user: the owner. Used dozens of times a day, often in a hurry, sometimes on a phone. Dense, fast, numeric. Not a consumer app.

**Colour — light / dark**

| Token | Light | Dark | Use |
|---|---|---|---|
| Primary (Nova Blue) | `#2563EB` | `#3B82F6` | Primary buttons, links, active nav, focus ring |
| Surface (card) | `#FFFFFF` | `#1E293B` | Cards, table container |
| Surface subtle | `#F3F4F6` | `#1E293B` | Table header, summary band, row hover |
| Page background | `#F8FAFC` | `#0B1220` | Behind cards |
| Text primary | `#111827` | `#F1F5F9` | Values, headings |
| Text secondary | `#4B5563` | `#94A3B8` | Labels, captions, helper text |
| Border | `#E5E7EB` | `#334155` | Card borders, table rules |
| Input border | `#D1D5DB` | `#334155` | Field outlines |
| Success | `#22C55E` | same | Settled, active, paid |
| Warning | `#F97316` | same | Partial, money due, attention |
| Danger | `#EF4444` | same | Jars out, unpaid, destructive |

**Type** — Inter everywhere; **JetBrains Mono** (`tabular-nums`) for every figure; **Noto Sans Gujarati** in the fallback stack.

| Role | Spec | Role | Spec |
|---|---|---|---|
| H2 page title | 28px / 1.3 / 600 | Body SM | 14px / 1.5 / 400 — table cells, labels, most of the app |
| H3 card heading | 22px / 1.4 / 600 | Caption | 12px / 1.4 / 500 — metadata, badges, column headers |
| H4 section / modal | 18px / 1.4 / 600 | Table amount | 14px mono 500 right |
| Body | 16px / 1.6 / 400 | Emphasised amount | 14px mono **600** right `#111827` |
| KPI value | 28px mono 700 | Detail summary figure | 20px mono 600 |

**Spacing** (only these six): 4 · 8 · 12 · 16 · 24 · 32. **Radius:** input/small button 4px · button/chip 8px · badge full · card & table 12px · modal 12px · dropdown 8px. **Shadow:** cards `0 1px 2px rgba(0,0,0,0.05)`; modals `0 20px 25px rgba(0,0,0,0.15)`. Cards never lift on hover.

**Table metrics — exact.** Header row **44px**, sticky, `#F3F4F6`, Caption 12px 600 UPPERCASE `0.04em`, `#4B5563`. Body row **48px**, 1px bottom border `#E5E7EB`, Body SM. Cell padding 12px vertical / 16px horizontal. Row hover `#F3F4F6` at 100ms, cursor pointer, whole row navigates. **No zebra striping.** Text left · numbers and money **right** · badges and actions centre. Actions column fixed 56px. Toolbar 56px, quick-chip strip 44px, footer 56px.

**Badges** — 22px tall, 8px horizontal padding, full radius, Caption 12px 500, optional 12px leading icon at 4px gap.

| Variant | Light bg / text | Dark bg / text |
|---|---|---|
| Default | `#E5E7EB` / `#374151` | `#334155` / `#E2E8F0` |
| Primary | `#DBEAFE` / `#1D4ED8` | `#1E3A8A` / `#BFDBFE` |
| Success | `#DCFCE7` / `#15803D` | `#14532D` / `#BBF7D0` |
| Warning | `#FEF3C7` / `#B45309` | `#7C2D12` / `#FED7AA` |
| Danger | `#FEE2E2` / `#B91C1C` | `#7F1D1D` / `#FECACA` |

**Money format:** `₹` + Indian lakh grouping + always 2 decimals → `₹12,34,567.00`. Zero renders as an em dash `—` in `#D1D5DB`, never `₹0.00`. Negative in parentheses, Danger text. Quantities: grouped, no decimals. Dates `14 Aug 2026`; today `Today`, yesterday `Yesterday`. Digits are always Latin `0–9`, in both languages.

**Icons:** Lucide, 1.5px stroke, 16px dense / 20px inline / 24px standalone. Staff `Users` · Delivery order `ClipboardList` · Coin `Coins` · Payment `Banknote` · Cash `Wallet` · Return `RotateCcw` · Jar out `PackageX` · Add `Plus` · Edit `Pencil` · Search `Search` · Filter `SlidersHorizontal` · Export `Download` · More `MoreHorizontal`.

**The five principles that override generic good design:** ① Density over whitespace — 25 rows visible, not 8. ② Numbers are the interface — mono, right-aligned, heavier than their labels. ③ Status is scannable without reading — a problem row is visible at arm's length. ④ Every number is a door — KPIs and counts navigate to a filtered list. ⑤ Entry speed is a feature — first field autofocused, Enter submits, no mouse required.

---

## 2. Screens in this module

| Screen | Route | Archetype | Purpose |
|---|---|---|---|
| Staff list | `/staff` | **A — List** | Scan the whole team and see who owes cash or jars |
| Staff detail | `/staff/[id]` | **B — Detail** | One person's complete history and current exposure |
| Add staff | `/staff/new` | **C — Form** | Register a new delivery person |
| Edit staff | `/staff/[id]/edit` | **C — Form** | Correct details, deactivate or reactivate |
| Deactivate dialogs | overlay on list & detail | Dialog | Confirm, or explain why deactivation is blocked |

---

## 3. Staff list — `/staff`

### 3.1 Purpose

The owner scans the whole delivery team in one screen and answers a single question: *who do I need to chase today, for money or for jars?*

### 3.2 Layout

```
┌──────────────┬────────────────────────────────────────────────────────────────────────────────────────┐
│  MARUTI JAL  │  Staff                              [🔍 Search  ⌘K]   [ EN │ ગુ ]   [☀]   [ RP ▾ ]     │ 64px topbar
├──────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
│ ▤ Dashboard  │                                                                                        │
│              │  Staff                                                  [⭳ Export CSV]  [+ Add staff]  │
│ OPERATIONS   │  Who delivers for you, and what each of them owes right now                            │
│ ▤ Delivery 12│                                                                                        │
│ ◎ Coin Issues│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│ ✦ Party Ord. │  │ 👥 TOTAL STAFF  │ │ ✓ ACTIVE STAFF  │ │ 💰 CASH OUTSTAND│ │ 📦 JARS OUT     │       │
│ ○ Direct Sale│  │                 │ │                 │ │                 │ │                 │       │
│              │  │ 14              │ │ 12              │ │ ₹18,450.00      │ │ 126             │       │
│ MASTERS      │  │ 2 inactive      │ │ 86% of the team │ │ across 6 people │ │ with 4 people   │       │
│ ▸ Staff   ●  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘       │
│ ▪ Products   │                                                                                        │
│ ◎ Coin Types │  ┌────────────────────────────────────────────────────────────────────────────────────┐│
│ ▤ Exp. Cats. │  │ [🔍 Search name, phone or address…        ]      [⚙ Filters (1)]  [⚙ Columns]     ││ 56
│              │  ├────────────────────────────────────────────────────────────────────────────────────┤│
│ MONEY        │  │ ● All   ● Active   ● Money pending   ● Jars out   ● Inactive          Clear all    ││ 44
│ ▤ Expenses   │  ├────────────────────────────────────────────────────────────────────────────────────┤│
│ ▤ Payments   │  │ CODE      NAME ↑           PHONE        ADDRESS       CASH ↕   JARS ↕  COINS  STATUS ⋯││ 44
│              │  ├────────────────────────────────────────────────────────────────────────────────────┤│
│ INSIGHTS     │  │ STF-000004 Ramesh Patel    9876543210  12 Krishna N… ₹2,480.00   18   ₹240.00 🔴18 jars out ⋯││ 48
│ ▤ Reports    │  │ STF-000007 Suresh Bhai Ch… 9825014477  Plot 44, GID…   ₹960.00    —      —    🟠 ₹960 due   ⋯││ 48
│ ▤ Coin Ledger│  │ STF-000002 રમેશ પટેલ        9898765432  શ્રીજી સોસા…        —      42      —    🔴 42 jars out ⋯││ 48
│              │  │ STF-000011 Dinesh Solanki  9427318890  Nr. Bus Stan…       —       —      —    🟢 Active     ⋯││ 48
│              │  │ STF-000009 Kiran Vaghela   9909112233  8 Shanti Par… ₹1,240.00   14   ₹120.00 🔴14 jars out ⋯││ 48
│              │  │ STF-000005 Mahesh Thakor   9737654321  Odhav Road, …       —       —      —    ⬚ Inactive   ⋯││ 48
│              │  ├────────────────────────────────────────────────────────────────────────────────────┤│
│              │  │ Showing 1–25 of 14              [25 ▾]                             ‹  1  ›         ││ 56
│              │  └────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────┴────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Region-by-region spec

**Shell**

| Element | Spec | Content |
|---|---|---|
| Sidebar | 240px, page background `#F8FAFC` / `#0F172A`, 1px right border `#E5E7EB` | Groups: (ungrouped) Dashboard · **Operations** · **Masters** · **Money** · **Insights** |
| Nav item | 40px tall, 12px/16px padding, 20px Lucide icon, 8px gap, Body SM `#4B5563` | `Users` icon + `Staff` |
| Nav active | 3px Nova Blue `#2563EB` left border + `#DBEAFE` background + `#1D4ED8` text at weight 500 | Staff row is active |
| Topbar | 64px sticky, surface bg, 1px bottom border | Breadcrumb `Staff` (single crumb, Gray 900) |
| Topbar right | 40px controls, 8px gap | Global search · `EN │ ગુ` segmented toggle (two-state, not a dropdown) · theme toggle · avatar menu |

**Page header**

| Element | Spec | Content |
|---|---|---|
| Title | H2 28px/1.3 600 `#111827` | `Staff` |
| Subtitle | Body SM 14px/1.5 400 `#4B5563`, 4px below title | `Who delivers for you, and what each of them owes right now` |
| Secondary action | 40px button, 1px `#2563EB` border, `#2563EB` text, radius 8px, 16px padding, `Download` 16px icon | `Export CSV` |
| Primary action | 40px button, `#2563EB` fill, `#FFFFFF` text, radius 8px, `Plus` 16px icon | `Add staff` |
| Bottom margin | 24px | — |

**KPI strip** — 4 across on `xl`, 2 on `md`, 1 below `md`; grid gap 24px; equal heights.

| Element | Spec | Content (in order) |
|---|---|---|
| Card | 20px padding, 12px radius, 1px `#E5E7EB`, `shadow-sm`, surface bg, whole card clickable | 4 cards |
| Label | Caption 12px 600 UPPERCASE `0.04em` `#4B5563`, 16px Lucide icon `#9CA3AF` before it, 4px gap | `TOTAL STAFF` · `ACTIVE STAFF` · `CASH OUTSTANDING` · `JARS OUT` |
| Icons | 16px | `Users` · `UserCheck` · `Wallet` · `PackageX` |
| Value | 28px JetBrains Mono 700 `#111827`, 8px below label | `14` · `12` · `₹18,450.00` · `126` |
| Breakdown | Caption `#4B5563`, single line, `·` separated | `2 inactive` · `86% of the team` · `across 6 people` · `with 4 people` |
| Hover | Border → `#2563EB` at 40% opacity, 100ms, cursor pointer. No lift | — |
| Deep link | Card 1 → `/staff?status=all` · Card 2 → `?status=active` · Card 3 → `?has_balance=1&sort=-cash` · Card 4 → `?has_jars=1&sort=-jars` | — |
| Alert variant | Cards 3 and 4 take a 3px Spark Red `#EF4444` left border and a `#B91C1C` value **when their figure is above zero** — outstanding money and jars out are always a problem | — |

**Toolbar (56px)**

| Element | Spec | Content |
|---|---|---|
| Search input | 40px tall, full width up to 400px, 1px `#D1D5DB`, radius 4px, `Search` 16px icon left at 12px inset, 300ms debounce | Placeholder `Search name, phone or address…` |
| Clear | `X` 16px `#9CA3AF` inside right, appears once there is text | — |
| Filters button | 40px secondary button, `SlidersHorizontal` 16px, count appended when active | `Filters` → `Filters (1)` |
| Columns button | 40px ghost icon button, `Settings` 16px, 44×44 hit area | Tooltip `Choose columns` |

**Filter popover** — 320px, radius 8px, 1px border, `shadow-lg`, 16px padding, opens below the button.

| Filter | Control | Options |
|---|---|---|
| Status | 3-segment control | `Active` (default) · `Inactive` · `All` |
| Has outstanding balance | Toggle 44×24 | off by default |
| Has jars out | Toggle 44×24 | off by default |
| Footer | 1px top border, 12px padding | `[Reset]` ghost · `[Apply filters]` primary |

Applied filters appear as removable chips below the toolbar: `Status: Active ✕`, `Has jars out ✕`.

**Quick chips (44px strip)** — one-tap presets. Inactive = Default badge, clickable. Active = Primary badge `#DBEAFE`/`#1D4ED8` + 1px `#2563EB` border. `Clear all` in Body SM `#4B5563` at the right once anything is on.

`All` · `Active` · `Money pending` · `Jars out` · `Inactive`

**Table columns**

| # | Header | Width | Align | Sort | Cell spec |
|---|---|---|---|---|---|
| 1 | `CODE` | 112px | left | no | `STF-000004` — mono 13px 500 `#2563EB` |
| 2 | `NAME` | flex, min 200px | left | ✅ default ↑ | Body SM 500 `#111827`. ICU-collated so Gujarati and Latin names interleave naturally. Truncate + tooltip |
| 3 | `PHONE` | 140px | left | no | Mono 13px 400 `#111827`. Alt phone, when present, on a second line in Caption `#4B5563` |
| 4 | `ADDRESS` | flex, min 180px | left | no | Body SM `#4B5563`, single line, ellipsis, full text in tooltip. Empty → `—` `#D1D5DB` |
| 5 | `CASH` | 132px | **right** | ✅ | Emphasised money: 14px mono **600** `#111827`. Zero → `—` `#D1D5DB` |
| 6 | `JARS` | 92px | **right** | ✅ | Quantity: 14px mono 600 `#111827`, no decimals. Zero → `—` `#D1D5DB` |
| 7 | `COINS` | 120px | **right** | no | Money 14px mono 500. Zero → `—` |
| 8 | `STATUS` | 200px | left | no | Settlement badge rule, below |
| 9 | actions | 56px | centre | no | `MoreHorizontal` 16px in a 44×44 hit area, `#4B5563`. **Always visible**, not hover-only |

**Settlement badge rule** (max two badges, 4px gap, jars first because jars are physical assets):

| Condition | Badge(s) |
|---|---|
| `is_active = false` | `Inactive` — Default. Wins over everything; an inactive member cannot have dues by business rule |
| jars out > 0 | `18 jars out` — Danger, `PackageX` icon |
| money outstanding > 0 (cash + coin dues) | `₹960 due` — Warning, `CircleDashed` icon. Tooltip: `Cash ₹840.00 · Coins ₹120.00` |
| both | both badges, jars then money |
| active, nothing outstanding | `Active` — Success, no icon |

**Sortable header** — label + `ArrowUpDown` 14px at 40% opacity; active becomes `ArrowUp`/`ArrowDown` at full opacity in `#2563EB` with the label in `#111827`. Cycle: none → asc → desc → none.

**Row actions menu** — 200px dropdown, radius 8px, `shadow-lg`, 36px items, Body SM:

`View` (`Eye`) · `Edit` (`Pencil`) · divider · `Deactivate` (`Ban`, `#B91C1C` text) — or `Reactivate` (`CheckCircle2`, `#15803D`) when inactive.

**Pagination (56px)** — Left: `Showing 1–14 of 14` Caption `#4B5563`. Right: page-size select `10 / 25 / 50 / 100` (default 25), then `‹ 1 2 3 … ›` with the current page filled `#2563EB` white text and arrows at 40% opacity when disabled.

### 3.4 Content and copy

| Slot | English | Gujarati |
|---|---|---|
| Page title | `Staff` | `સ્ટાફ` |
| Subtitle | `Who delivers for you, and what each of them owes right now` | `તમારા માટે કોણ ડિલિવરી કરે છે અને દરેક પાસે અત્યારે શું બાકી છે` |
| Primary button | `Add staff` | `સ્ટાફ ઉમેરો` (≈40% wider — button sizes to content, min-width 120px) |
| Secondary button | `Export CSV` | `CSV ડાઉનલોડ કરો` |
| Search placeholder | `Search name, phone or address…` | `નામ, ફોન કે સરનામું શોધો…` |
| KPI labels | `TOTAL STAFF` · `ACTIVE STAFF` · `CASH OUTSTANDING` · `JARS OUT` | `કુલ સ્ટાફ` · `સક્રિય સ્ટાફ` · `બાકી રોકડ` · `બહાર ગયેલા જાર` |
| Columns | `CODE` `NAME` `PHONE` `ADDRESS` `CASH` `JARS` `COINS` `STATUS` | `કોડ` `નામ` `ફોન` `સરનામું` `રોકડ` `જાર` `સિક્કા` `સ્થિતિ` |
| Chips | `All` `Active` `Money pending` `Jars out` `Inactive` `Clear all` | `બધા` `સક્રિય` `પૈસા બાકી` `જાર બહાર` `નિષ્ક્રિય` `બધું સાફ કરો` |
| Empty — no data (H4) | `No staff yet` | `હજી કોઈ સ્ટાફ નથી` |
| Empty — no data (body) | `Add your delivery people here. Once they're in, you can assign orders, issue coins, and see exactly what each person owes you.` | — |
| Empty — no data (CTA) | `Add your first staff member` | — |
| Empty — no results (H4) | `No staff match your filters` | `તમારા ફિલ્ટર સાથે કોઈ સ્ટાફ મળ્યો નહીં` |
| Empty — no results (body) | `Nothing matches "vaghel" with Status: Inactive and Has jars out.` | — |
| Empty — no results (CTA) | `Clear filters` | `ફિલ્ટર સાફ કરો` |
| Error (H4) | `Couldn't load staff` | `સ્ટાફ લોડ થઈ શક્યો નહીં` |
| Error (body) | `The server didn't respond. Check your connection and try again.` | — |
| Error (CTA) | `Try again` | `ફરી પ્રયાસ કરો` |
| Partial-error banner | `Outstanding figures may be out of date. The last refresh was at 6:05 pm.` | — |
| Row menu | `View` · `Edit` · `Deactivate` · `Reactivate` | — |
| Pagination | `Showing 1–14 of 14` | `14 માંથી 1–14 બતાવી રહ્યા છીએ` |

### 3.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens with no cached data | KPI cards render labels with a 28px×120px shimmer bar where the value goes. Toolbar and header render normally. Table shows 8 skeleton rows of grey bars at varied widths (60% / 40% / 80%), 1.5s shimmer | — |
| Loading (refilter / repage / sort) | Search typed, chip tapped, page changed, header clicked | **Existing rows stay on screen** at 60% opacity, `pointer-events: none`, with a 2px indeterminate Nova Blue bar directly under the 44px header. Never a skeleton | — |
| Empty — no data | Zero staff records exist at all | Table body replaced by a 320px-tall centred block: 48px `Users` icon `#D1D5DB`, H4, Body SM `#4B5563` max 420px, then a primary button. KPI strip shows `0` / `—` in `#9CA3AF`, not hidden | `No staff yet` / `Add your delivery people here. Once they're in, you can assign orders, issue coins, and see exactly what each person owes you.` / `Add your first staff member` |
| Empty — no results | Search or filters return nothing | Same block, 48px `SearchX` icon `#D1D5DB`, H4, then a Body SM line **naming the active filters verbatim**, then a secondary button. Toolbar, chips and filter chips stay visible and interactive | `No staff match your filters` / `Nothing matches "vaghel" with Status: Inactive and Has jars out.` / `Clear filters` |
| Filled | Rows returned | As wireframe. Rows with jars out or money due read heavier because their figures are 600 weight and their badge is coloured | — |
| Error | Request failed | Table body replaced by a 320px centred block: 48px `AlertTriangle` `#EF4444`, H4, plain-language reason, primary `Try again`. **No stack traces, no status codes.** KPI cards show `—` with a small `Retry` link in `#2563EB` | `Couldn't load staff` / `The server didn't respond. Check your connection and try again.` / `Try again` |
| Partial error | Rows load but cached outstanding figures are stale | Table renders in full with a Danger banner above it: `#FEE2E2` bg, 1px `#EF4444`, 12px radius, 16px padding, 20px `AlertTriangle` | `Outstanding figures may be out of date. The last refresh was at 6:05 pm.` |
| Deactivate submitting | `Deactivate` confirmed | Row dims to 60%, its actions button becomes a 16px spinner. Table stays interactive elsewhere | — |
| Deactivate success | Server confirms | Row's status badge swaps to `Inactive`; if the `Active` chip is on, the row leaves the table with no animation. Toast, bottom-right | `Mahesh Thakor deactivated` + `Undo` for 8s |
| Deactivate blocked | Staff has outstanding money or jars | Blocked dialog (§7.3). No optimistic change | see §7.3 |
| Read-only | Not applicable — the single user is always the admin | — | — |

### 3.6 Interactions

| Interaction | Behaviour |
|---|---|
| Row hover | Background → `#F3F4F6` (`#1E293B` dark) over 100ms; cursor pointer across the whole row |
| Row click | Navigates to `/staff/[id]`. Clicks inside the actions cell do not navigate (`stopPropagation`) |
| Row keyboard | Rows are focusable. `Tab` walks rows; `Enter` opens the detail; `↑`/`↓` move between rows without leaving the table |
| Focus ring | 2px `#2563EB` at 2px offset on every interactive element, including table rows. Never removed |
| Search | Debounced 300ms; resets to page 1; result count in the pagination line updates; `Escape` clears the field |
| `⌘K` / `Ctrl+K` | Opens global search, not this one |
| Quick chips | Toggle instantly, page resets to 1, URL query updates so the view is shareable and back-button-safe |
| Sort | Click cycles none → asc → desc → none. Only one column sorts at a time. Sort persists across pagination |
| Columns `⚙` | Popover of checkboxes; `CODE` and `NAME` cannot be hidden; choice persists per user |
| Actions `⋯` | Opens on click and on `Enter`/`Space`. Arrow keys move through items, `Escape` closes and returns focus to the trigger |
| KPI card | Entire card is a link; `Tab`-reachable; `Enter` activates |
| Tab order | Skip-link → sidebar → topbar → `Export CSV` → `Add staff` → 4 KPI cards → search → Filters → Columns → chips left-to-right → table rows → page-size → pagination |
| `Add staff` | Navigates to `/staff/new` |

### 3.7 Responsive (below `md`, 768px)

- Sidebar collapses off-canvas behind a `Menu` button in the topbar; opens as a 280px left drawer over a `rgba(15,23,42,0.5)` overlay, 350ms.
- Content padding 16px. Page header stacks: title, subtitle, then a full-width `+ Add staff` primary button. `Export CSV` moves into a `⋯` overflow menu next to the title.
- KPI cards: 1 per row, full width, 20px padding, value stays 28px mono 700.
- Toolbar: full-width search on its own line, then a full-width `Filters` button opening a **bottom sheet** (rounded top corners 12px, drag handle, `Apply filters` sticky at the bottom).
- Quick chips: horizontally scrollable strip, no wrap, 8px gaps, momentum scroll, no visible scrollbar.
- **Table becomes cards**, 12px gap, 16px padding, 12px radius, 1px border, whole card tappable:

```
┌────────────────────────────────────────┐
│ STF-000004              🔴 18 jars out │
│ Ramesh Patel · 9876543210              │
│ 12 Krishna Nagar, Vatva Road           │
│ Cash ₹2,480.00        Coins ₹240.00    │
└────────────────────────────────────────┘
```

Line 1: code (mono 13px `#2563EB`) left, badges right. Line 2: name 500 `#111827` · phone `#4B5563`. Line 3: address Caption `#4B5563`, one line, ellipsis. Line 4: figures right-aligned, labels Caption `#4B5563` and values 14px mono 600. The `⋯` actions button sits at 44×44 in the card's bottom-right; on touch there is no hover, so it is always visible.

### 3.8 Dark mode

Only these change: page `#0B1220`; cards and table container `#1E293B` with 1px `#334155` — separation comes from background difference, not shadow. Table header `#0F172A` so it reads distinctly against the `#1E293B` card. Row hover `#1E293B` lightened to `#243347`. Text `#F1F5F9` primary, `#94A3B8` secondary. Nova Blue lifts to `#3B82F6` for the code links, active nav text, focus ring and sorted-header arrow. Badges swap to their dark pairs from §1. Skeleton bars `#334155`. Em-dash zero values `#475569`.

### 3.9 Stitch prompt

```text
Design a desktop admin list screen called "Staff" for an internal Indian water-plant
management tool. Font: Inter; all numbers in JetBrains Mono with tabular figures.
Light theme: page background #F8FAFC, white cards, borders #E5E7EB, primary text
#111827, secondary #4B5563, accent Nova Blue #2563EB.

Layout: a 240px left sidebar (page-background, 1px right border) with grouped nav —
Dashboard, then "OPERATIONS" (Delivery Orders, Coin Issues, Party Orders, Direct
Sales), "MASTERS" (Staff — active, Products, Coin Types, Expense Categories),
"MONEY" (Expenses, Payments), "INSIGHTS" (Reports, Coin Ledger). The active Staff
item has a 3px #2563EB left border, #DBEAFE background, #1D4ED8 text. A 64px sticky
topbar holds a breadcrumb on the left and, on the right, a search field, an
"EN | ગુ" two-state segmented toggle, a theme toggle and an avatar.

Main content, max 1440px, 24px padding: page title "Staff" at 28px semibold with the
subtitle "Who delivers for you, and what each of them owes right now" at 14px #4B5563,
and right-aligned buttons "Export CSV" (outlined) and "+ Add staff" (filled #2563EB).

Below: four equal KPI cards, 24px gap, each 20px padding with a 12px uppercase grey
label and a 28px monospace bold value — TOTAL STAFF 14, ACTIVE STAFF 12, CASH
OUTSTANDING ₹18,450.00, JARS OUT 126. The last two carry a 3px #EF4444 left border.

Then a table card: a 56px toolbar with a search field placeholder "Search name, phone
or address…" plus "Filters (1)" and a gear button; a 44px row of pill chips — All,
Active, Money pending, Jars out, Inactive; a 44px sticky header in #F3F4F6 with 12px
uppercase letter-spaced labels CODE, NAME, PHONE, ADDRESS, CASH, JARS, COINS, STATUS;
then 48px rows, no zebra stripes, 1px #E5E7EB dividers. Rows: STF-000004 Ramesh Patel
9876543210 "12 Krishna Nagar, Vatva Road" ₹2,480.00 18 ₹240.00 with a red pill
"18 jars out"; STF-000007 Suresh Bhai Chauhan 9825014477 ₹960.00 with an amber pill
"₹960 due"; STF-000002 રમેશ પટેલ 9898765432 with a red pill "42 jars out"; STF-000011
Dinesh Solanki with a green pill "Active"; STF-000005 Mahesh Thakor with a grey pill
"Inactive". Codes are monospace blue; money is right-aligned monospace with ₹ and two
decimals; zeros show as a grey em dash. Footer row: "Showing 1–14 of 14" left, page
size selector and pagination right.
```

---

## 4. Staff detail — `/staff/[id]`

### 4.1 Purpose

Everything about one delivery person in one place: what they owe, what they're holding, and every order, coin packet and payment behind those numbers.

### 4.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ‹ Staff                                                                                 │
│  Ramesh Patel                          🔴 18 jars out    🟠 ₹2,720.00 due                │
│  STF-000004 · 9876543210 · Joined 12 Mar 2025 · Active                                   │
│                                          [🏦 Record Payment]  [✎ Edit]  [ ⋯ ]            │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  CASH OUTSTANDING     JARS OUT          COIN DUES         LIFETIME REVENUE         │  │
│  │  ₹2,480.00            18 of 402         ₹240.00           ₹3,84,260.00             │  │
│  │  across 3 orders      4.5% not returned  2 open issues     since 12 Mar 2025       │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  [ Overview ]  [ Delivery Orders 42 ]  [ Coin Issues 6 ]  [ Payments 18 ]  [ Activity ]  │
│  ──────────────────────────────────────────────────────────────────────────────────────  │
│  ┌────────────────────────────────────┐  ┌──────────────────────────────────────────┐    │
│  │  Contact                           │  │  Note                                    │    │
│  │  Phone          9876543210         │  │  Morning route only. Brother of Suresh   │    │
│  │  Alternate      9909112233         │  │  Bhai Chauhan (STF-000007).              │    │
│  │  Address        12 Krishna Nagar,  │  │                                          │    │
│  │                 Vatva Road,        │  ├──────────────────────────────────────────┤    │
│  │                 Ahmedabad 382445   │  │  Record                                  │    │
│  │  Joined on      12 Mar 2025        │  │  Created   12 Mar 2025, 9:14 am · Admin  │    │
│  │  Status         🟢 Active          │  │  Updated   14 Aug 2026, 6:05 pm · Admin  │    │
│  └────────────────────────────────────┘  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Region-by-region spec

**Header**

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, `ChevronLeft` 16px, 8px above the title, 44px hit height | `‹ Staff` |
| Title | H2 28px/1.3 600 `#111827`. **Sans, not mono** — a person's name is not a document code | `Ramesh Patel` / `રમેશ પટેલ` |
| Badges | Inline after the title with a 12px gap, 4px between badges, vertically centred to the title | `18 jars out` Danger `PackageX` · `₹2,720.00 due` Warning `CircleDashed` |
| Meta line | Body SM `#4B5563`, `·` separated, 4px below the title. The code is mono 13px `#4B5563` | `STF-000004 · 9876543210 · Joined 12 Mar 2025 · Active` |
| Actions | Right-aligned, 8px gap, aligned to the title's baseline block | `[Record Payment]` primary (`Banknote`) · `[Edit]` secondary (`Pencil`) · `[⋯]` ghost icon |
| `⋯` menu | 200px dropdown | `Export statement (PDF)` (`FileBarChart`) · divider · `Deactivate` (`Ban`, `#B91C1C`) |

**Summary card** — always visible above the tabs, so the four figures stay on screen no matter which tab is open.

| Element | Spec |
|---|---|
| Container | Subtle background `#F3F4F6` (`#0F172A` dark), 12px radius, 1px `#E5E7EB`, 24px padding, 32px below the header |
| Grid | 4 columns on `lg`, 2 on `md`, 1 below. 24px gap, 1px `#E5E7EB` vertical rules between columns on `lg` |
| Label | Caption 12px 600 UPPERCASE `0.04em` `#4B5563` |
| Value | **20px JetBrains Mono 600**, 8px below the label. The critical figure (`CASH OUTSTANDING`) is `#111827`; the rest `#374151` |
| Context line | Caption `#4B5563`, 4px below the value |
| Clickable | Cash → Payments tab · Jars → Delivery Orders tab filtered to unsettled · Coin dues → Coin Issues tab · Lifetime revenue → Reports, filtered to this staff member. Hover: value underlines in `#2563EB` |
| Contents | `CASH OUTSTANDING ₹2,480.00 / across 3 orders` · `JARS OUT 18 of 402 / 4.5% not returned` · `COIN DUES ₹240.00 / 2 open issues` · `LIFETIME REVENUE ₹3,84,260.00 / since 12 Mar 2025` |

**Tabs** — 44px tall, 24px horizontal padding, 2px bottom indicator in `#2563EB`, active label `#111827` 600, inactive `#4B5563` 400. Counts sit in the label so nothing hides. Full-width 1px `#E5E7EB` rule under the strip. 32px below the summary card.

`Overview` · `Delivery Orders 42` · `Coin Issues 6` · `Payments 18` · `Activity`

**Overview tab** — two cards side by side, 24px gap, 60/40 split on `lg`.

| Element | Spec | Content |
|---|---|---|
| Card | 24px padding, 12px radius, 1px border, `shadow-sm` | — |
| Card heading | H4 18px/1.4 600 `#111827`, 16px bottom margin | `Contact` · `Note` · `Record` |
| Definition row | Two columns: label Body SM 500 `#4B5563` fixed 140px, value Body 16px/1.6 `#111827`. 12px row gap | — |
| Address value | Body 16px/1.6, wraps to up to 3 lines, never truncated on a detail page | `12 Krishna Nagar, Vatva Road, Ahmedabad 382445` |
| Phone value | Mono 15px `#111827`, with a `Phone` 16px icon button beside it that calls `tel:` on touch devices | `9876543210` |
| Empty value | Em dash `—` `#D1D5DB` | Alternate phone when absent |
| Note body | Body 16px/1.6 `#111827`, line height 1.6 minimum so Gujarati matras are not clipped, preserves line breaks | `Morning route only. Brother of Suresh Bhai Chauhan (STF-000007).` |
| Record rows | Caption `#4B5563` | `Created 12 Mar 2025, 9:14 am · Admin` / `Updated 14 Aug 2026, 6:05 pm · Admin` |

**Delivery Orders tab** — the standard table (44px header, 48px rows) scoped to this person, newest first.

Columns: `ORDER` (mono blue `ORD-000318`) · `DATE` · `ITEMS` (Default chip `3 items · 62 units`) · `TOTAL` (money right) · `BALANCE` (emphasised money right) · `STATUS` (dual badge: payment then return, per §7.3).

Toolbar: a single quick chip `Unsettled only` plus a date-range filter. No search — the list is already scoped. Sample rows:

```
ORD-000318   16 Aug 2026   3 items · 62 units   ₹2,480.00   ₹450.00   🟠 ₹450 due  🔴 8 jars out
ORD-000311   14 Aug 2026   2 items · 40 units   ₹1,400.00        —    🟢 Paid      🟠 10 jars out
ORD-000296   12 Aug 2026   1 item · 24 units      ₹240.00        —    🟢 Paid      🟢 Settled
```

**Coin Issues tab** — columns `ISSUE` (`CIS-000042`) · `DATE` · `COIN TYPE` · `ISSUED` · `RETURNED` · `COLLECTED` (money) · `PENDING` (emphasised money) · `STATUS`.

**Payments tab** — a §9 timeline, newest first, not a table, because payments arrive against different parents and a timeline shows the sequence:

```
│ ● 16 Aug 2026 · 7:40 pm            Recorded by Admin
│ │  ₹2,030.00 cash against ORD-000318
│ │  Note: "Balance tomorrow"
│ ○ 14 Aug 2026 · 6:05 pm            Recorded by Admin
│    ₹1,400.00 cash against ORD-000311
```

8px dot in the semantic colour, 1px connecting line in `#E5E7EB`, the most recent dot filled `#2563EB`. Amount 16px mono 600 `#111827`, target code as a `#2563EB` link, note in Caption `#4B5563` inside quotes.

**Activity tab** — the same timeline showing field-level changes: `Phone changed from 9876543210 to 9898765432 · Admin · 14 Aug 2026, 6:05 pm`. Old value struck through in `#9CA3AF`, new value 500 `#111827`.

### 4.4 Content and copy

| Slot | Copy |
|---|---|
| Back link | `‹ Staff` |
| Actions | `Record Payment` · `Edit` · `Export statement (PDF)` · `Deactivate` / `Reactivate` |
| Summary labels | `CASH OUTSTANDING` · `JARS OUT` · `COIN DUES` · `LIFETIME REVENUE` |
| Summary context | `across 3 orders` · `4.5% not returned` · `2 open issues` · `since 12 Mar 2025` |
| Tab labels | `Overview` · `Delivery Orders 42` · `Coin Issues 6` · `Payments 18` · `Activity` |
| Card headings | `Contact` · `Note` · `Record` |
| Field labels | `Phone` · `Alternate` · `Address` · `Joined on` · `Status` |
| Note empty | `No note on this staff member.` in Body SM `#4B5563` |
| Orders tab empty | `No delivery orders yet` / `Orders assigned to Ramesh Patel will appear here.` |
| Orders tab no-results | `No unsettled orders` / `Everything Ramesh Patel has taken out is paid and returned.` |
| Coin issues empty | `No coin issues yet` / `Coin packets issued to Ramesh Patel will appear here.` |
| Payments empty | `No payments recorded` / `Payments from Ramesh Patel across orders and coin issues will appear here.` |
| Activity empty | `Nothing has changed since this record was created.` |
| Not found | `That staff member doesn't exist` / `The record may have been removed. Go back to the staff list to find who you're looking for.` / `Back to staff` |
| Inactive banner | `This staff member is inactive. They won't appear in new order or coin issue forms.` — Default tint `#F3F4F6`, 1px `#E5E7EB`, `Info` icon, with a `Reactivate` link on the right |
| Statement toast | `Statement for Ramesh Patel is ready` + `Download` |

### 4.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens | Back link and tab strip render immediately. Title becomes a 240×28px shimmer, badges become two 100×22px shimmer pills, summary card shows four shimmer bars at the value position with labels already legible, tab content shows 5 skeleton rows | — |
| Loading (tab switch) | Another tab is clicked | Tab indicator moves instantly (200ms), the previous tab's content stays at 60% opacity with a 2px Nova Blue bar under the tab strip until the new content arrives | — |
| Empty (tab has no rows) | e.g. no coin issues | Centred 240px block inside the tab area: 48px `Coins` icon `#D1D5DB`, H4, Body SM. **No CTA on the Coin Issues and Payments tabs** — those records are created from their own modules, not from here | `No coin issues yet` / `Coin packets issued to Ramesh Patel will appear here.` |
| Empty (tab filtered to nothing) | `Unsettled only` chip on an all-settled person | 48px `PackageCheck` icon in `#22C55E` — a positive empty state, because this one is good news | `No unsettled orders` / `Everything Ramesh Patel has taken out is paid and returned.` |
| Filled | Record loads | As wireframe | — |
| Error | Request fails | Below the back link, a 320px centred block: 48px `AlertTriangle` `#EF4444`, H4, reason, `Try again` | `Couldn't load this staff member` / `The server didn't respond. Check your connection and try again.` |
| Not found (404) | Bad id | Same block with a 48px `SearchX` and a `Back to staff` primary button | see §4.4 |
| Partial error | Header loads, a tab fails | Header and summary render; the failing tab shows an inline Danger banner with `Retry` | `Couldn't load payments for this person.` + `Retry` |
| Read-only / inactive | `is_active = false` | Default-tinted banner directly under the header. `Record Payment` stays enabled — an inactive person can still be settling old dues. Meta line ends `· Inactive` and the header badge is `Inactive` Default | see §4.4 |
| Submitting | `Record Payment` modal submits | Modal footer button shows a spinner and reads `Recording…`, both buttons disabled, modal body at 60% | — |
| Success | Payment recorded | Modal closes, summary figures update in place **without animation**, toast appears | `Payment of ₹450.00 recorded for Ramesh Patel` |
| Disabled | `Deactivate` on someone with dues | Menu item stays enabled and clicking it opens the blocking dialog (§7.3). A disabled item with no explanation is worse than a clear refusal | — |

### 4.6 Interactions

| Interaction | Behaviour |
|---|---|
| Tabs | Click or `←`/`→` when the strip has focus. `Home`/`End` jump to first/last. The active tab is written to the URL (`?tab=orders`) so refresh and back work |
| Summary figure | Hover underlines the value in `#2563EB`; click switches to the relevant tab with its filter pre-applied |
| Nested table rows | Click opens that order or coin issue in the module, with a breadcrumb back to `Staff / Ramesh Patel` |
| `Record Payment` | Opens a 560px modal: `Amount` (money input, autofocused), `Paid against` (search select of that person's unsettled orders and coin issues), `Date` (defaults today), `Note`. `Enter` submits from any field, `Escape` closes with a confirm if dirty |
| `Edit` | Navigates to `/staff/[id]/edit` |
| `Export statement (PDF)` | Button shows a spinner, label becomes `Preparing…`; an Info toast with `Download` follows |
| `Deactivate` | Opens the confirm dialog (§7.2) or the blocked dialog (§7.3) |
| Phone | The number is a `tel:` link on touch; on desktop, a `Copy` icon button appears on hover and copies with a 4s `Phone number copied` toast |
| Tab order | Back link → Record Payment → Edit → `⋯` → 4 summary figures → tab strip (one stop, arrows move within) → tab content |
| Keyboard | `E` opens Edit, `P` opens Record Payment, when focus is not in a field. Both listed in the `⋯` menu as hints |

### 4.7 Responsive (below `md`)

- Header stacks: back link, title (wraps to two lines, badges drop to their own line beneath it), meta line. Actions become a full-width row: `Record Payment` fills the width; `Edit` and `⋯` sit beside it as 44×44 icon buttons.
- Summary card: 2×2 grid, 16px padding, values stay 20px mono 600, vertical rules removed.
- Tabs become a horizontally scrollable strip with an edge fade; the active tab scrolls into view on load.
- Nested tables become the same row-cards as §3.7.
- Overview cards stack full width, `Contact` first.
- Timeline: dot column narrows to 20px, timestamps move above the content instead of beside it.

### 4.8 Dark mode

Page `#0B1220`; cards `#1E293B` with 1px `#334155`. The summary card's "subtle" background becomes `#0F172A` — one step *darker* than the cards, so it still reads as inset. Tab indicator and back link `#3B82F6`. Timeline connector `#334155`; the newest dot `#3B82F6`. Struck-through old values in Activity use `#64748B`. Badge pairs from §1. The inactive banner becomes `#1E293B` with a `#334155` border and `#94A3B8` text.

### 4.9 Stitch prompt

```text
Design a desktop detail page for one staff member in an internal Indian water-plant
admin tool. Inter for text, JetBrains Mono for all numbers. Light theme: page
#F8FAFC, white cards, 1px #E5E7EB borders, text #111827, muted #4B5563, accent
#2563EB. Same 240px sidebar and 64px topbar as the list screen; breadcrumb reads
"Staff / Ramesh Patel".

Content area, 24px padding: a small blue back link "‹ Staff"; then the name "Ramesh
Patel" at 28px semibold with two pills beside it — a red pill "18 jars out" and an
amber pill "₹2,720.00 due", both 22px tall, fully rounded, 12px text with a small
leading icon. Under the name, a 14px grey meta line: "STF-000004 · 9876543210 ·
Joined 12 Mar 2025 · Active". Right-aligned: a filled blue "Record Payment" button,
an outlined "Edit" button, and a three-dot icon button.

Below, a full-width inset summary panel with a #F3F4F6 background, 12px radius and
24px padding, split into four equal columns separated by thin vertical rules. Each
column: a 12px uppercase grey label, then a 20px monospace semibold value, then a
12px grey context line. Contents: CASH OUTSTANDING ₹2,480.00 "across 3 orders";
JARS OUT 18 of 402 "4.5% not returned"; COIN DUES ₹240.00 "2 open issues";
LIFETIME REVENUE ₹3,84,260.00 "since 12 Mar 2025".

Then a 44px tab strip with a 2px blue underline on the active tab: Overview,
Delivery Orders 42, Coin Issues 6, Payments 18, Activity. Overview is active and
shows two white cards side by side (60/40). Left card "Contact" lists label/value
pairs: Phone 9876543210, Alternate 9909112233, Address "12 Krishna Nagar, Vatva
Road, Ahmedabad 382445", Joined on 12 Mar 2025, Status with a green "Active" pill.
Right column has a "Note" card reading "Morning route only. Brother of Suresh Bhai
Chauhan (STF-000007)." and below it a "Record" card with two 12px grey lines:
"Created 12 Mar 2025, 9:14 am · Admin" and "Updated 14 Aug 2026, 6:05 pm · Admin".
Dense layout, no decorative whitespace.
```

---

## 5. Add staff — `/staff/new`

### 5.1 Purpose

Register a new delivery person in under twenty seconds, using only the keyboard.

### 5.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ‹ Staff                                                                 │
│  Add staff                                                               │
│  Register a delivery person so you can assign orders and issue coins     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Full name *                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ Ramesh Patel                                                 │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │  English or ગુજરાતી — type it however you say it                    │  │
│  │                                                                    │  │
│  │  Phone *                        Alternate phone                    │  │
│  │  ┌───────────────────────────┐  ┌───────────────────────────────┐  │  │
│  │  │ 9876543210                │  │ e.g. 9909112233               │  │  │
│  │  └───────────────────────────┘  └───────────────────────────────┘  │  │
│  │  10 digits, no +91                                                 │  │
│  │                                                                    │  │
│  │  Address                                                           │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ 12 Krishna Nagar, Vatva Road, Ahmedabad 382445                │  │  │
│  │  │                                                              │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  Joined on                                                         │  │
│  │  ┌────────────────────┐                                            │  │
│  │  │ 14 Aug 2026    📅  │                                            │  │
│  │  └────────────────────┘                                            │  │
│  │                                                                    │  │
│  │  Note                                                              │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ e.g. Morning route only                                      │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  │  Only you see this                                                 │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │                                        [ Cancel ]   [ Save staff ] │  │ sticky
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, `ChevronLeft` 16px | `‹ Staff` |
| Title | H2 28px/1.3 600 `#111827` | `Add staff` |
| Subtitle | Body SM `#4B5563` | `Register a delivery person so you can assign orders and issue coins` |
| Card | 24px padding, **max width 720px**, 12px radius, 1px `#E5E7EB`, `shadow-sm`, left-aligned in the content area | — |
| Field gap | 16px vertical | — |
| Label | Body SM 14px 500 `#111827`, 6px above the field | — |
| Required marker | `*` in `#2563EB` immediately after the label text, 4px gap. **Required is marked, optional is not** | Full name, Phone |
| Input | 40px tall, 1px `#D1D5DB`, radius 4px, 12px horizontal padding, Body SM `#111827` | — |
| Name input | 48px tall — the primary field on a fast-entry form is taller | — |
| Placeholder | `#9CA3AF`, an example not a repeat of the label | `e.g. 9909112233` |
| Helper text | Caption 12px `#4B5563`, 4px below the field. **The space is always reserved**, so nothing shifts when an error replaces it | — |
| Focus | 2px `#2563EB` border + 2px offset ring | — |
| Phone row | Two columns, 16px gap, each 50% — the only paired row on this form | Phone / Alternate phone |
| Phone input | Mono 14px, `inputmode="numeric"`, max 10 digits, non-digits silently stripped on paste so `+91 98765 43210` becomes `9876543210` | — |
| Address | Textarea, 3 rows, resizable vertically only, line height 1.6 | — |
| Date input | **180px wide**, `Calendar` 16px icon right, format `DD MMM YYYY`, defaults to today, calendar popover with `Today` and `Yesterday` quick chips inside | `14 Aug 2026` |
| Note | Textarea, 3 rows | — |
| Footer | Sticky inside the card, 1px top border `#E5E7EB`, 16px vertical / 24px horizontal padding, right-aligned, 8px gap | — |
| Cancel | Ghost button 40px, `#4B5563` text | `Cancel` |
| Primary | 40px, `#2563EB` fill, white text, radius 8px. **Names the action** | `Save staff` |

### 5.4 Content and copy

| Slot | English | Gujarati |
|---|---|---|
| Title / subtitle | `Add staff` / `Register a delivery person so you can assign orders and issue coins` | `સ્ટાફ ઉમેરો` / `ઓર્ડર સોંપવા અને સિક્કા આપવા માટે ડિલિવરી કરનારને નોંધો` |
| Full name label / placeholder / helper | `Full name` / `e.g. Ramesh Patel` / `English or ગુજરાતી — type it however you say it` | `પૂરું નામ` / `દા.ત. રમેશ પટેલ` |
| Phone label / placeholder / helper | `Phone` / `e.g. 9876543210` / `10 digits, no +91` | `ફોન નંબર` / `10 અંક, +91 વગર` |
| Alternate phone | `Alternate phone` / `e.g. 9909112233` | `વૈકલ્પિક ફોન` |
| Address | `Address` / `e.g. 12 Krishna Nagar, Vatva Road, Ahmedabad 382445` | `સરનામું` |
| Joined on | `Joined on` / helper `Leave as today if they start now` | `જોડાયા તારીખ` |
| Note | `Note` / `e.g. Morning route only` / `Only you see this` | `નોંધ` |
| Buttons | `Cancel` · `Save staff` · while saving `Saving…` | `રદ કરો` · `સ્ટાફ સાચવો` · `સાચવી રહ્યા છીએ…` |
| Success toast | `Ramesh Patel added` | `રમેશ પટેલ ઉમેરાયા` |

**Validation messages — the literal strings**

| Field | Condition | Message |
|---|---|---|
| Full name | empty | `Enter the staff member's name` |
| Full name | > 120 characters | `Name can be at most 120 characters` |
| Phone | empty | `Enter a phone number` |
| Phone | not 10 digits | `Enter a 10-digit mobile number` |
| Phone | doesn't start 6–9 | `Indian mobile numbers start with 6, 7, 8 or 9` |
| Phone | already used by an active staff member | `9876543210 already belongs to Suresh Bhai Chauhan (STF-000007)` — with `View` as an inline `#2563EB` link |
| Phone | belongs to a **deactivated** member | Amber warning, not an error: `9876543210 was last used by Mahesh Thakor, who is inactive. Saving will give this number to the new record.` — submission still allowed |
| Alternate phone | not 10 digits | `Enter a 10-digit mobile number` |
| Alternate phone | same as Phone | `Alternate phone must be different from the main phone` |
| Joined on | future date | `Joining date can't be in the future` |
| Form level | server rejects | `This staff member couldn't be saved` / `The phone number is already in use. Change it and try again.` |
| Form level | offline | `You're offline` / `Nothing was saved. Reconnect and press Save staff again — your entries are still here.` |

### 5.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | `/staff/new` opens | Renders instantly — there is nothing to fetch. **No skeleton on a create form** | — |
| Empty (default) | Fresh form | All fields blank except `Joined on`, pre-filled with today and shown in `#111827`, not as a placeholder. Focus is in `Full name` | — |
| Filled | User has typed | As wireframe | — |
| Field error | Blur on an invalid touched field | 1px `#EF4444` border (background unchanged — never a red fill), 16px `AlertCircle` `#EF4444` inside the field at the right, message replaces the helper text in Caption `#EF4444` with a 14px `AlertCircle` and 4px gap | see §5.4 |
| Warning | Phone belonged to a deactivated member | 1px `#F97316` border, `AlertTriangle` inside right in `#F97316`, message in Caption `#B45309`. **Submission still allowed** | see §5.4 |
| Form error | Submit rejected by the server | Danger banner above the footer: `#FEE2E2` bg (`#7F1D1D` dark), 1px `#EF4444`, 12px radius, 16px padding, 20px `AlertTriangle`, H4-weight title on line 1 and Body SM detail below. Focus moves to the banner and it is announced by a live region | see §5.4 |
| Submitting | `Save staff` pressed and valid | Primary shows a 16px spinner where no icon was, label becomes `Saving…`; both footer buttons disable; the form body dims to 60% and stops accepting input | `Saving…` |
| Success | Server confirms | Navigate to `/staff/[id]` — **never leave the user on the form wondering**. Success toast, 4s | `Ramesh Patel added` |
| Error (offline) | Network unavailable on submit | Form-level banner, form re-enables at full opacity with every value intact. The primary returns to `Save staff` | see §5.4 |
| Disabled | Not applicable on create — the primary is always enabled so that pressing it surfaces the errors. **Never disable a submit button to express invalidity**; a disabled button explains nothing | — | — |
| Dirty cancel | `Cancel` or back with changes | 420px confirm dialog | `Discard this staff member?` / `Ramesh Patel hasn't been saved. Everything you typed will be lost.` / `[Keep editing]` ghost · `[Discard]` destructive |

### 5.6 Interactions

| Interaction | Behaviour |
|---|---|
| Autofocus | `Full name` receives focus on mount, cursor at position 0 |
| Tab order | Full name → Phone → Alternate phone → Address → Joined on → Note → Cancel → Save staff. Exactly the reading order, no traps |
| `Enter` | Submits from any single-line field. Inside a textarea it inserts a newline; `⌘/Ctrl + Enter` submits from anywhere |
| `Escape` | Triggers Cancel, with the discard confirm if the form is dirty |
| Validation timing | **Never while typing.** On blur, only if the field has been touched. On submit, everything at once — then focus and scroll to the first invalid field. Once a field is in error it re-validates on every keystroke so the error clears the instant it is fixed |
| Phone uniqueness | Checked on blur against the server, debounced 400ms. While in flight, a 14px spinner sits inside the field at the right |
| Phone paste | `+91 98765 43210`, `098765 43210` and `91-9876543210` all normalise to `9876543210` on paste and on blur |
| Date field | Typing accepts `14/08/2026`, `14-8-26` and `14 Aug 2026`; reformats to `14 Aug 2026` on blur. The calendar opens on icon click or `↓`; arrows move by day, `PageUp`/`PageDown` by month, `Escape` closes |
| Gujarati input | No script restriction anywhere except phone. IME composition events must not fire validation mid-composition |
| Unsaved-changes guard | Browser navigation, sidebar clicks and the back link all pass through the discard confirm |
| Success navigation | `/staff/[id]` for the new record, with the toast anchored bottom-right |

### 5.7 Responsive (below `md`)

- Content padding 16px; the card loses its border and radius and becomes flush with the page background, so no horizontal space is wasted on chrome.
- The Phone / Alternate phone pair **stacks to one column** — two 50% inputs at 360px are too narrow to read a 10-digit number in.
- Inputs go to 48px tall for touch. The date field keeps its 180px cap but the calendar opens as a bottom sheet.
- The footer detaches from the card and becomes a fixed bar at the bottom of the viewport: 72px tall, surface background, 1px top border, 16px padding, `Save staff` at 60% width on the right and `Cancel` at 40% on the left. It sits above the keyboard on iOS via `env(safe-area-inset-bottom)`.

### 5.8 Dark mode

Card `#1E293B` on a `#0B1220` page. Inputs: background `#0F172A`, 1px `#334155` border, text `#F1F5F9`, placeholder `#64748B`. Focus border `#3B82F6` with the ring at 40% opacity. Error border stays `#EF4444`; the error message lifts to `#FCA5A5` for contrast on dark. The form-level Danger banner uses `#7F1D1D` background with `#FECACA` text. The date picker popover is `#1E293B` with `#334155` borders and today's date ringed in `#3B82F6`.

### 5.9 Stitch prompt

```text
Design a desktop "Add staff" form for an internal Indian water-plant admin tool.
Inter for text, JetBrains Mono for numbers. Light theme: page background #F8FAFC,
white card, 1px #E5E7EB borders, text #111827, muted #4B5563, accent #2563EB.
Keep the 240px left sidebar and 64px topbar from the rest of the app; breadcrumb
reads "Staff / Add staff".

Content area with 24px padding: a small blue back link "‹ Staff", then the title
"Add staff" at 28px semibold, then a 14px grey subtitle "Register a delivery person
so you can assign orders and issue coins".

Below that, a single white card, maximum 720px wide, 24px padding, 12px radius,
containing a single-column form with 16px gaps. Each field has a 14px medium label
above it and a 12px grey helper line below it. Fields in order:

1. "Full name" with a blue asterisk — a 48px-tall input containing "Ramesh Patel",
   helper "English or ગુજરાતી — type it however you say it".
2. A two-column row, 16px gap: "Phone" with a blue asterisk, a 40px input showing
   "9876543210" in monospace, helper "10 digits, no +91"; and "Alternate phone",
   40px input with grey placeholder "e.g. 9909112233".
3. "Address" — a three-row textarea containing "12 Krishna Nagar, Vatva Road,
   Ahmedabad 382445".
4. "Joined on" — a narrow 180px input showing "14 Aug 2026" with a calendar icon
   on the right.
5. "Note" — a three-row textarea with placeholder "e.g. Morning route only",
   helper "Only you see this".

Inputs are 40px tall, 4px radius, 1px #D1D5DB border, 12px horizontal padding.
Show one field in its focused state with a 2px #2563EB border and a soft 2px offset
ring. At the bottom of the card, a footer separated by a 1px top border with 16px
vertical padding and right-aligned buttons: a ghost "Cancel" and a filled blue
"Save staff". Compact and utilitarian, not airy.
```

---

## 6. Edit staff — `/staff/[id]/edit`

### 6.1 Purpose

Fix a wrong phone number, record a new address, or switch someone active or inactive.

### 6.2 Layout

Identical to §5.2 with three additions, shown here as a diff:

```
│  ‹ Ramesh Patel                                                          │  ← back goes to the DETAIL page
│  Edit staff                                                              │
│  STF-000004 · Created 12 Mar 2025                                        │  ← meta line replaces the generic subtitle
│  … all fields from §5.2, pre-filled …                                    │
│                                                                          │
│  ──────────────────────────────────────────────────────────────────────  │  ← 32px section gap + 1px divider
│  Status                                                                  │  ← H4 section heading
│  ┌────┐                                                                  │
│  │ ●──│  Active                                                          │  ← 44×24 toggle, label to the right
│  └────┘  Inactive staff don't appear in new order or coin issue forms    │
│                                                                          │
│                                       [ Cancel ]   [ Save changes ]      │
```

### 6.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB` | `‹ Ramesh Patel` — back to the record, not the list |
| Title | H2 | `Edit staff` |
| Meta line | Body SM `#4B5563`, code in mono 13px | `STF-000004 · Created 12 Mar 2025` |
| Status section | 32px above it, H4 18px 600 `#111827`, 1px `#E5E7EB` divider under the heading | `Status` |
| Toggle | 44×24px track, `#2563EB` when on / `#D1D5DB` when off, 20px white knob, 200ms slide. Label to the right in Body SM 500, the whole row tappable at 44px height | `Active` |
| Toggle helper | Caption `#4B5563` under the label | `Inactive staff don't appear in new order or coin issue forms` |
| Primary | Names the action | `Save changes` |

### 6.4 Content and copy

| Slot | Copy |
|---|---|
| Title | `Edit staff` |
| Section heading | `Status` |
| Toggle label / helper | `Active` / `Inactive staff don't appear in new order or coin issue forms` |
| Buttons | `Cancel` · `Save changes` · while saving `Saving…` |
| Success toast | `Ramesh Patel updated` |
| Discard dialog | `Discard your changes?` / `Your changes to Ramesh Patel haven't been saved.` / `[Keep editing]` · `[Discard changes]` |
| Toggle-off blocked | Inline Danger banner directly under the toggle, replacing its helper text — see §7.3 for the copy |
| Concurrent edit | `This record changed while you were editing` / `Someone updated Ramesh Patel at 6:05 pm. Reload to see the current details — your changes will be lost.` / `[Reload]` |
| No changes | Pressing `Save changes` with nothing edited navigates back with an Info toast: `No changes to save` |

### 6.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens | Labels and the card frame render immediately; each input shows a `#F3F4F6` shimmer block at its own height, so the form doesn't reflow when values arrive | — |
| Filled | Record loaded | Every field pre-filled with the stored value. The form is clean; `Save changes` is enabled but a no-op until something changes | — |
| Empty (optional fields) | Address, note, alt phone unset | Empty inputs showing their placeholders — **never** the string `null` or `N/A` | — |
| Field error | Blur on invalid | As §5.5 | as §5.4 |
| Toggle-off blocked | `Active` switched off while dues exist | The toggle **springs back to on** after 200ms, and a Danger banner appears in the helper slot listing exactly what is blocking, each item a link | see §7.3 |
| Submitting | `Save changes` | As §5.5 | `Saving…` |
| Success | Saved | Navigate to `/staff/[id]`, success toast | `Ramesh Patel updated` |
| Conflict (409) | Record changed elsewhere | Form-level Warning banner with a `Reload` button; fields stay editable so nothing typed is lost until Reload is pressed | see §6.4 |
| Error | Save failed | Form-level Danger banner, form re-enabled with values intact | `Couldn't save your changes` / `The server didn't respond. Try again in a moment.` |
| Read-only | Not applicable | — | — |

### 6.6 Interactions

Everything in §5.6 applies. Additionally:

| Interaction | Behaviour |
|---|---|
| Autofocus | **None.** Focus goes to the card container, not the name field — auto-selecting an existing name invites accidental overwrites |
| Dirty tracking | Compares against the loaded values, not against empty. Reverting a change back to its original value makes the form clean again and disarms the discard guard |
| Phone uniqueness | Excludes this record from the check, so re-saving an unchanged number never errors |
| Toggle | Switching off fires the blocking check **before** the visual change commits, so an impossible state is never shown as accepted |
| Tab order | Full name → Phone → Alternate phone → Address → Joined on → Note → Active toggle → Cancel → Save changes |

### 6.7 Responsive (below `md`)

As §5.7. The `Status` section keeps its 32px gap and divider; the toggle row is 56px tall for a comfortable thumb target, with the label and helper stacked to the right of the track.

### 6.8 Dark mode

As §5.8. The toggle's off state is `#334155`; on state `#3B82F6` with a `#F1F5F9` knob. The blocked-toggle Danger banner uses `#7F1D1D` background, `#FECACA` text, and links in `#93C5FD`.

### 6.9 Stitch prompt

```text
Design a desktop "Edit staff" form for an internal Indian water-plant admin tool,
matching an existing "Add staff" screen. Inter for text, JetBrains Mono for numbers.
Light theme: page #F8FAFC, white card, 1px #E5E7EB borders, text #111827, muted
#4B5563, accent #2563EB. Keep the 240px sidebar and 64px topbar.

Header: a blue back link "‹ Ramesh Patel", the title "Edit staff" at 28px semibold,
and a 14px grey meta line "STF-000004 · Created 12 Mar 2025".

A single white card, max 720px wide, 24px padding, 12px radius, single column,
16px gaps, every field pre-filled: "Full name" (48px input, "Ramesh Patel"), a
two-column row of "Phone" ("9876543210", monospace) and "Alternate phone"
("9909112233"), "Address" (three-row textarea, "12 Krishna Nagar, Vatva Road,
Ahmedabad 382445"), "Joined on" (180px input, "12 Mar 2025", calendar icon), and
"Note" (textarea, "Morning route only. Brother of Suresh Bhai Chauhan."). Labels are
14px medium above each field; required fields carry a blue asterisk; a 12px grey
helper line sits under each field.

After the last field, leave a 32px gap and draw a 1px #E5E7EB divider, then an 18px
semibold section heading "Status" followed by a 44×24px toggle switched on and
coloured #2563EB, with the label "Active" to its right and a 12px grey line beneath:
"Inactive staff don't appear in new order or coin issue forms".

Card footer: 1px top border, 16px vertical padding, right-aligned ghost "Cancel" and
filled blue "Save changes".

Also show a second variation of the same screen where switching the toggle off has
been refused: the toggle is back in its on position and a red-tinted banner
(#FEE2E2 background, 1px #EF4444 border, 12px radius, warning triangle icon) sits
directly beneath it reading "Ramesh Patel can't be deactivated yet — ₹2,480.00
outstanding across 3 orders, 18 jars not returned, ₹240.00 of coins pending."
```

---

## 7. Deactivate dialogs

### 7.1 Purpose

Stop a staff member from silently disappearing while still holding the owner's money or jars — and, when they hold nothing, get out of the way in one click.

### 7.2 Confirm dialog — nothing outstanding

```
┌──────────────────────────────────────────────────┐
│  ⚠                                            ✕  │
│  Deactivate Mahesh Thakor?                       │
│                                                  │
│  They'll stop appearing in new order and coin    │
│  issue forms. Their 128 past orders stay exactly │
│  as they are, and you can reactivate them any    │
│  time.                                           │
│                                                  │
│                    [ Cancel ]   [ Deactivate ]   │
└──────────────────────────────────────────────────┘
```

| Element | Spec | Content |
|---|---|---|
| Width | 420px, 12px radius, `shadow-xl`, 24px padding, overlay `rgba(15,23,42,0.5)` | — |
| Icon | 24px `AlertTriangle` `#EF4444`, above the title, 12px gap | — |
| Title | H4 18px/1.4 600 `#111827`. **Names the object** | `Deactivate Mahesh Thakor?` |
| Body | Body SM 14px/1.5 `#4B5563`, states the consequence and the reversibility | see wireframe |
| Close | `X` 16px `#9CA3AF` top-right, 44×44 hit area | — |
| Footer | 1px top border, 16px above, right-aligned, 8px gap | `[Cancel]` ghost · `[Deactivate]` destructive `#EF4444` fill, white text. **The confirm button repeats the verb** — never `Yes`/`OK` |
| Motion | Enter 200ms fade + scale from 0.96; exit 150ms. Focus traps inside and returns to the `⋯` trigger on close. `Escape` and overlay click both cancel | — |
| Reactivate variant | Icon becomes 24px `CheckCircle2` `#22C55E`; title `Reactivate Mahesh Thakor?`; body `They'll appear in new order and coin issue forms again.`; confirm `Reactivate` in primary blue, not destructive | — |

### 7.3 Blocked dialog — money or jars outstanding

```
┌────────────────────────────────────────────────────────┐
│  ⛔                                                  ✕  │
│  Ramesh Patel can't be deactivated yet                 │
│                                                        │
│  Three things are still open. Settle them, then        │
│  deactivate.                                           │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 💰  ₹2,480.00 cash outstanding    3 orders   ›   │  │
│  │ 📦  18 jars not returned          2 orders   ›   │  │
│  │ ◎   ₹240.00 of coins pending      2 issues   ›   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│                     [ Close ]   [ Record Payment ]     │
└────────────────────────────────────────────────────────┘
```

| Element | Spec | Content |
|---|---|---|
| Width | 480px — wider than a plain confirm because it carries a list | — |
| Icon | 24px `Ban` `#EF4444` | — |
| Title | H4 600 `#111827` | `Ramesh Patel can't be deactivated yet` |
| Body | Body SM `#4B5563` | `Three things are still open. Settle them, then deactivate.` (`One thing is still open.` / `Two things are still open.` — the count is written out) |
| Blocker list | Inset panel `#F3F4F6`, 8px radius, 1px `#E5E7EB`. Rows 48px, 1px dividers, each a link with a `ChevronRight` 16px `#9CA3AF` at the right | — |
| Blocker row | 16px semantic Lucide icon left (`Wallet` `#EF4444` · `PackageX` `#EF4444` · `Coins` `#F97316`), then the figure in 14px mono 600 `#111827` with its noun in Body SM `#4B5563`, then the count in Caption `#4B5563` right-aligned before the chevron | as wireframe |
| Row hover | `#E5E7EB` background, chevron to `#4B5563`. Click navigates to the detail page with the relevant tab and filter applied, and closes the dialog | — |
| Footer | `[Close]` ghost · `[Record Payment]` primary — **the dialog offers the fix, not just the refusal**. When only jars are outstanding the primary becomes `Record Return` | — |
| Only-one-blocker variant | The list still renders with a single row; the body reads `One thing is still open. Settle it, then deactivate.` | — |

**States**

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading | Dialog opens while the blocking check runs | Dialog opens immediately at final size with three 48px shimmer rows in the panel; the footer primary is disabled until the check returns | Title shows straight away |
| Filled — clear | Nothing outstanding | The confirm dialog (§7.2) is shown instead | — |
| Filled — blocked | Anything outstanding | As wireframe | — |
| Error | The check itself fails | Panel replaced by a Danger inline row: 16px `AlertTriangle`, `Couldn't check what's outstanding.` with a `Retry` link. Deactivation stays unavailable — **fail closed** | `Couldn't check what's outstanding. Try again before deactivating.` |
| Submitting | Confirm pressed in §7.2 | Destructive button shows a spinner, label becomes `Deactivating…`, both buttons disabled | — |
| Success | Server confirms | Dialog closes 150ms, list row or detail header updates, toast with `Undo` for 8s | `Mahesh Thakor deactivated` + `Undo` |

**Responsive:** below `md` both dialogs become bottom sheets — full width, 12px top corners, a 32×4px `#D1D5DB` drag handle, content padding 16px, footer buttons stacked full width with the primary on top and 8px between them. Swipe-down dismisses, subject to the same rules as `Escape`.

**Dark mode:** dialog `#1E293B`, overlay `rgba(2,6,23,0.7)`. The blocker panel becomes `#0F172A` with `#334155` dividers. Destructive button stays `#EF4444`; its focus ring is `#F87171` for separation from the fill.

### 7.9 Stitch prompt

```text
Design two modal dialogs for an internal Indian water-plant admin tool, on a dimmed
rgba(15,23,42,0.5) overlay above a staff list. Inter for text, JetBrains Mono for
numbers. Dialogs are white, 12px radius, 24px padding, with a large soft shadow.

Dialog A, 420px wide: a 24px red warning-triangle icon, then an 18px semibold title
"Deactivate Mahesh Thakor?", then 14px #4B5563 body text "They'll stop appearing in
new order and coin issue forms. Their 128 past orders stay exactly as they are, and
you can reactivate them any time." A small grey ✕ sits top-right. A footer separated
by a 1px #E5E7EB top border holds right-aligned buttons: a ghost "Cancel" and a
filled red #EF4444 "Deactivate".

Dialog B, 480px wide: a 24px red "ban" circle icon, an 18px semibold title "Ramesh
Patel can't be deactivated yet", and 14px grey body "Three things are still open.
Settle them, then deactivate." Below that, an inset light-grey #F3F4F6 panel with
8px radius containing three 48px rows separated by thin dividers, each row ending in
a grey right-chevron: a red wallet icon with "₹2,480.00 cash outstanding" and, right-
aligned in 12px grey, "3 orders"; a red package icon with "18 jars not returned" and
"2 orders"; an orange coins icon with "₹240.00 of coins pending" and "2 issues".
The rupee amounts are monospace semibold in #111827. Footer: ghost "Close" and a
filled blue #2563EB "Record Payment".

Both dialogs are compact and businesslike — no illustrations, no rounded friendly
mascots, no large empty margins.
```

---

## Module design checklist

- [ ] Page header on all four screens has a title **and** a one-line subtitle
- [ ] `+ Add staff` is the only primary on the list, top-right, and names the action
- [ ] All five core states drawn for the list: loading-first, loading-refilter, empty-no-data, empty-no-results, error — and the two empties use different icons, different copy and different CTAs
- [ ] Detail page draws loading, filled, error, 404, inactive, and a per-tab empty
- [ ] Both forms draw default, field error, form-level error, submitting, success and discard-confirm
- [ ] Table header 44px sticky, body rows 48px, cell padding 12/16, no zebra striping
- [ ] `CASH`, `COINS` and every money figure: JetBrains Mono, right-aligned, `₹`, 2 decimals, `—` in `#D1D5DB` for zero
- [ ] `JARS` is a right-aligned mono integer with no decimals
- [ ] Status cell follows the settlement badge rule; badges carry numbers (`18 jars out`, `₹960 due`), never bare words where a number exists
- [ ] Badge variants and icons taken verbatim from the §7.2 meaning map
- [ ] All four KPI cards deep-link to a filtered list; the two problem cards take the alert variant when non-zero
- [ ] Every summary figure on the detail page navigates to the tab that explains it
- [ ] Actions `⋯` column is always visible at 44×44, never hover-only
- [ ] Search placeholder names what is searched: `Search name, phone or address…`
- [ ] Validation fires on blur, never while typing, and clears live once corrected
- [ ] Every validation string is specific: `Enter a 10-digit mobile number`, not `Invalid input`
- [ ] Deactivation is blocked with an itemised, navigable explanation and an offered fix, never a silently disabled control
- [ ] Confirm buttons repeat the verb (`Deactivate`, `Discard`), never `Yes`/`OK`
- [ ] Focus ring 2px `#2563EB` at 2px offset on every interactive element, including table rows
- [ ] Tab order verified on both forms: reading order, first field autofocused on create only
- [ ] Every screen specified in light **and** dark, with dark badge pairs and `#3B82F6` for blue text
- [ ] Checked with `રમેશ પટેલ`, `શ્રીજી સોસાયટી, ઓઢવ રોડ, અમદાવાદ` and `સ્ટાફ ઉમેરો`: buttons size to content with a min-width, headers wrap to two lines rather than truncate, and no line box is fixed below 1.6
- [ ] Digits stay Latin `0–9` in Gujarati mode; only the words translate
- [ ] Mobile layout defined below 768px for list (row-cards), detail (stacked, scrollable tabs), forms (stacked pairs, fixed footer bar) and dialogs (bottom sheets)
- [ ] Icons drawn from the §17 map: `Users`, `Wallet`, `PackageX`, `Coins`, `Banknote`, `Pencil`, `Plus`, `Search`, `SlidersHorizontal`, `Download`, `MoreHorizontal`
- [ ] Nothing animates when table rows or figures change — only overlays, tabs and toasts move
