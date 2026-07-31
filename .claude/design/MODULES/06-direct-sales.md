# Module 06 — Direct Sales (walk-in) · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/06-direct-sales.md](../../MODULES/06-direct-sales.md)
>
> Follows the list / detail / form pattern from [01-staff.md](01-staff.md), with one deliberate break: **there is no create page.** The create form is an inline row at the top of the list — name, amount, Enter. Section 4 designs that row, and it is the most important part of this file.

---

## 1. Design context (for Stitch)

**Product:** Maruti Jal — internal admin tool for a mineral water plant in Gujarat, India. One user: the owner. This module records walk-ins: someone drives up with their own cans, fills them, pays cash, leaves. Nothing is owed, nothing comes back. There is no payment status, no outstanding balance, no return tracking — by design.

**The single design goal is speed.** If recording a walk-in takes longer than serving one, it will not get recorded and the money stays invisible in a drawer. Every decision below is subordinate to the time between "customer pays" and "hands back on the counter".

**Colour — light / dark**

| Token | Light | Dark | Use |
|---|---|---|---|
| Primary (Nova Blue) | `#2563EB` | `#3B82F6` | Primary buttons, links, active nav, focus ring, entry-row accent |
| Surface (card) | `#FFFFFF` | `#1E293B` | Cards, table container |
| Surface subtle | `#F3F4F6` | `#0F172A` | Table header, group bands, entry row background, row hover |
| Page background | `#F8FAFC` | `#0B1220` | Behind cards |
| Text primary | `#111827` | `#F1F5F9` | Values, headings |
| Text secondary | `#4B5563` | `#94A3B8` | Labels, captions, helper text |
| Border | `#E5E7EB` | `#334155` | Card borders, table rules |
| Input border | `#D1D5DB` | `#334155` | Field outlines |
| Success | `#22C55E` | same | Saved confirmation flash, cash badge |
| Warning | `#F97316` | same | Backdated-entry notice |
| Danger | `#EF4444` | same | Void, failed row, destructive |

**Type** — Inter everywhere; **JetBrains Mono** (`tabular-nums`) for every figure; **Noto Sans Gujarati** in the fallback stack — walk-in names are frequently typed as `કલ્પેશ ભાઈ`.

| Role | Spec | Role | Spec |
|---|---|---|---|
| H2 page title | 28px / 1.3 / 600 | Body SM | 14px / 1.5 / 400 — table cells, labels |
| H3 card heading | 22px / 1.4 / 600 | Caption | 12px / 1.4 / 500 — metadata, badges, column headers |
| H4 section / modal | 18px / 1.4 / 600 | Table amount | 14px mono 500 right |
| Body | 16px / 1.6 / 400 | Emphasised amount | 14px mono **600** right `#111827` |
| KPI value | 28px mono 700 | Detail summary figure | 20px mono 600 |

**Spacing:** 4 · 8 · 12 · 16 · 24 · 32 only. **Radius:** input 4px · button/chip 8px · badge full · card 12px · modal 12px · dropdown 8px. **Shadow:** cards `0 1px 2px rgba(0,0,0,0.05)`; dropdowns `0 10px 15px rgba(0,0,0,0.1)`; modals `0 20px 25px rgba(0,0,0,0.15)`.

**Table metrics — exact.** Header **44px** sticky, `#F3F4F6`, Caption 12px 600 UPPERCASE `0.04em` `#4B5563`. Body row **48px**, 1px `#E5E7EB` bottom border, Body SM. **Inline entry row 56px** — taller than a body row because it contains inputs, exactly as §6.3 specifies for line-item rows. Day group band 40px. Cell padding 12px vertical / 16px horizontal. Row hover `#F3F4F6` 100ms. No zebra striping. Text left · numbers and money **right** · badges and actions centre. Actions column 56px.

**Badges** — 22px tall, 8px horizontal padding, full radius, Caption 12px 500, optional 12px leading icon at 4px gap.

| Variant | Light bg / text | Dark bg / text |
|---|---|---|
| Default | `#E5E7EB` / `#374151` | `#334155` / `#E2E8F0` |
| Primary | `#DBEAFE` / `#1D4ED8` | `#1E3A8A` / `#BFDBFE` |
| Success | `#DCFCE7` / `#15803D` | `#14532D` / `#BBF7D0` |
| Warning | `#FEF3C7` / `#B45309` | `#7C2D12` / `#FED7AA` |
| Danger | `#FEE2E2` / `#B91C1C` | `#7F1D1D` / `#FECACA` |

**Formats:** money `₹` + lakh grouping + 2 decimals → `₹1,840.00`; zero → `—` in `#D1D5DB`. Litres up to 3 decimals, trailing zeros trimmed → `40L`, `0.5L`. Quantities grouped, no decimals. Time 12-hour lower case → `6:42 pm`. Date `14 Aug 2026`; today `Today`, yesterday `Yesterday`. Digits always Latin `0–9`, in both languages.

**Icons:** Lucide, 1.5px stroke, 16px dense / 20px inline / 24px standalone. Direct sale `Droplet` · Cash `Wallet` · Product `Package` · Add `Plus` · Edit `Pencil` · Void `Ban` · Search `Search` · Filter `SlidersHorizontal` · Export `Download` · More `MoreHorizontal` · Expand `ChevronDown`.

**The five principles**, with the fifth doing most of the work here: ① Density over whitespace. ② Numbers are the interface. ③ Status scannable without reading. ④ Every number is a door. ⑤ **Entry speed is a feature** — the first field is autofocused on page load, Enter advances then submits, and a full walk-in can be recorded without ever touching the mouse.

**Motion rule that this module must respect.** The standards forbid animating table rows appearing — data must feel instant. So a saved sale **does not slide, fade or expand into the list**; it is simply there. Confirmation comes from a *colour* transition instead: the new row's background flashes `#DBEAFE` and settles to transparent over 600ms ease-out. Colour changes are permitted motion; row entrances are not.

---

## 2. Screens in this module

| Screen | Route | Archetype | Purpose |
|---|---|---|---|
| Walk-in list + inline entry | `/direct-sales` | **A — List**, with a create row | Record a sale in seconds and tally the day's cash |
| Sale detail | `/direct-sales/[id]` | **B — Detail** | Look up one old entry and see the same customer's history |
| Edit sale | `/direct-sales/[id]/edit` | **C — Form** | Fix a same-day counter mistake |
| Void dialog | overlay | Dialog | Cancel an older entry, on the record, with a reason |

---

## 3. Walk-in list — `/direct-sales`

### 3.1 Purpose

Two jobs on one screen: record the sale that is happening right now, and at closing time read off what the drawer should contain.

### 3.2 Layout

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Direct Sales                                                  [⭳ Export CSV]                  │
│  Walk-in customers who fill their own cans and pay cash                                        │
│                                                                                                │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐   │
│  │ ○ WALK-INS TODAY   │ │ 💰 COLLECTED TODAY │ │ ▲ THIS MONTH       │ │ ▪ AVERAGE SALE     │   │
│  │                    │ │                    │ │                    │ │                    │   │
│  │ 12                 │ │ ₹1,840.00          │ │ ₹38,620.00         │ │ ₹153.33            │   │
│  │ ▲ 3 vs yesterday   │ │ ▲ 18.4% vs yest.   │ │ 248 sales · August │ │ across 12 today    │   │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘ └────────────────────┘   │
│                                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ [🔍 Search customer name or phone…            ]        [⚙ Filters]        [⚙ Columns]    │  │ 56
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ ● Today   ● Yesterday   ● This week   ● This month   ● All                   Clear all   │  │ 44
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ CODE        TIME     CUSTOMER            PHONE        LITRES     AMOUNT               ⋯  │  │ 44 sticky
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ ⊕ NEW     [ Customer name             ▾]                       [₹  Amount ]  [Add sale]⌄│  │ 56 sticky
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ TODAY · 14 Aug 2026                                     12 sales          ₹1,840.00     │  │ 40
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ DWS-000329  6:42 pm  Jignesh Shah        9825014477      40L      ₹120.00              ⋯│  │ 48
│  │ DWS-000328  6:20 pm  કલ્પેશ ભાઈ            9909112233      20L       ₹60.00              ⋯│  │ 48
│  │ DWS-000327  5:55 pm  Paresh Bhai              —          80L      ₹240.00              ⋯│  │ 48
│  │ DWS-000326  5:31 pm  Ramila Ben Patel    9737654321        —      ₹100.00              ⋯│  │ 48
│  │ DWS-000325  4:48 pm  Ashok Modi          9427318890     200L      ₹600.00              ⋯│  │ 48
│  │ DWS-000324  3:10 pm  Jignesh Shah        9825014477      40L      ₹120.00   ⊘ Voided   ⋯│  │ 48 (60% opacity)
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ YESTERDAY · 13 Aug 2026                                  9 sales          ₹1,554.00     │  │ 40
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ DWS-000317  7:05 pm  Suresh Bhai Chauhan 9825014477      40L      ₹120.00              ⋯│  │ 48
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ Showing 1–25 of 248                 [25 ▾]                          ‹ 1 2 3 … 10 ›       │  │ 56
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Region-by-region spec

**Page header**

| Element | Spec | Content |
|---|---|---|
| Title | H2 28px/1.3 600 `#111827` | `Direct Sales` |
| Subtitle | Body SM `#4B5563` | `Walk-in customers who fill their own cans and pay cash` |
| Secondary | 40px outlined, 1px `#2563EB`, `Download` 16px | `Export CSV` |
| Primary | **None.** There is no `+ New sale` button, because the create form is already on screen and always focused. A button here would be a slower path to the same row, and two ways to do one thing is two things to learn | — |

**KPI strip** — 4 across on `xl`, 2 on `md`, 1 below; 24px gap; 20px padding; 12px radius; 1px border; whole card clickable.

| Card | Icon | Label | Value | Breakdown | Deep link |
|---|---|---|---|---|---|
| 1 | `Droplet` | `WALK-INS TODAY` | `12` — 28px mono 700 | `▲ 3 vs yesterday`, `TrendingUp` 12px `#15803D` | `?range=today` |
| 2 | `Wallet` | `COLLECTED TODAY` | `₹1,840.00` — 28px mono 700 | `▲ 18.4% vs yesterday` | `?range=today&sort=-amount` |
| 3 | `TrendingUp` | `THIS MONTH` | `₹38,620.00` | `248 sales · August` | `?range=month` |
| 4 | `BarChart3` | `AVERAGE SALE` | `₹153.33` | `across 12 today` | `?range=today` |

No alert variant in this module: there is no outstanding balance and no jars out, so no figure here is ever a problem. Card 2 is the cash-drawer number and is the one the owner reads at closing; it therefore renders first among the money cards.

**Toolbar**

| Element | Spec | Content |
|---|---|---|
| Search | 40px, up to 400px, `Search` 16px left, 300ms debounce | Placeholder `Search customer name or phone…` |
| Filters | 40px secondary, `SlidersHorizontal` 16px, count when active | `Filters` → `Filters (2)` |
| Columns | 40px ghost icon, `Settings` 16px, 44×44 target | Tooltip `Choose columns` |

**Filter popover** — 320px, 16px padding: `Date range` (two 180px date fields, `From` / `To`, plus preset links `Today` `Yesterday` `Last 7 days` `This month`), `Amount range` (two 140px money fields, `Min` / `Max`), `Show voided sales` toggle (off by default). Footer `[Reset]` · `[Apply filters]`.

**Quick chips:** `Today` (active by default) · `Yesterday` · `This week` · `This month` · `All` · `Clear all`. These are the primary navigation of this screen — the owner lives on `Today`.

**Day group band (40px)** — a new row type this module introduces, because the whole point is a per-day cash tally.

| Element | Spec | Content |
|---|---|---|
| Band | 40px tall, `#F3F4F6` background, 1px `#E5E7EB` top and bottom borders, full table width, **sticky beneath the header and entry row while its group is in view** | — |
| Left | Caption 12px 600 UPPERCASE `0.04em` `#4B5563` | `TODAY · 14 Aug 2026` · `YESTERDAY · 13 Aug 2026` · `12 AUG 2026` |
| Right | Count in Caption `#4B5563`, then the day total in 14px mono **600** `#111827`, 24px apart, 16px from the right edge | `12 sales` `₹1,840.00` |
| Void exclusion | Voided sales are excluded from the count and the total. When a group contains voided rows, the count reads `12 sales · 1 voided` with the voided part in `#9CA3AF` | — |

**Table columns**

| # | Header | Width | Align | Sort | Cell spec |
|---|---|---|---|---|---|
| 1 | `CODE` | 116px | left | no | `DWS-000329` mono 13px 500 `#2563EB` |
| 2 | `TIME` | 96px | left | ✅ default ↓ | `6:42 pm` Body SM `#4B5563`. The date lives in the group band, so it is never repeated per row |
| 3 | `CUSTOMER` | flex, min 200px | left | ✅ | Body SM 500 `#111827`. Any script. Truncate + tooltip. A repeat customer (2+ prior sales) carries a 12px `Repeat` icon `#9CA3AF` after the name with the tooltip `4th visit` |
| 4 | `PHONE` | 140px | left | no | Mono 13px `#111827`; absent → `—` `#D1D5DB` |
| 5 | `LITRES` | 100px | **right** | no | Mono 14px 500, trailing zeros trimmed → `40L`, `0.5L`; absent → `—` `#D1D5DB` |
| 6 | `AMOUNT` | 140px | **right** | ✅ | Emphasised money: 14px mono **600** `#111827`. Voided → struck through in `#9CA3AF` |
| 7 | status | 96px | centre | no | Empty for normal sales. Voided → `Voided` Default badge with a 12px `Ban` icon |
| 8 | actions | 56px | centre | no | `MoreHorizontal` 16px in a 44×44 target, always visible |

**Voided row** — 60% opacity across the whole row, amount struck through, `Voided` badge, per the §7.2 Cancelled treatment. Still clickable, because the void reason is on the detail page and that is exactly what someone is looking for.

**Row actions menu** — 220px:

| Item | Availability |
|---|---|
| `View` (`Eye`) | Always |
| `Edit` (`Pencil`) | Enabled only when the sale date is today. Otherwise rendered at 40% opacity with a Caption `#4B5563` line beneath it: `Only today's entries can be edited` — **a disabled control with its reason attached, never a bare grey item** |
| `Void` (`Ban`, `#B91C1C`) | Always, except on an already-voided sale, where it is replaced by `Unvoid` at 40% with the line `A voided sale can't be brought back. Record it again instead.` |

**Pagination** — `Showing 1–25 of 248` Caption left; page size `10 / 25 / 50 / 100` (default 25) and `‹ 1 2 3 … 10 ›` right. Group bands are page-local: a day split across two pages gets a band on each, with the second reading `TODAY · 14 Aug 2026 (continued)`.

### 3.4 Content and copy

| Slot | English | Gujarati |
|---|---|---|
| Title / subtitle | `Direct Sales` / `Walk-in customers who fill their own cans and pay cash` | `સીધું વેચાણ` / `ગ્રાહકો પોતાના કેન ભરાવે છે અને રોકડ ચૂકવે છે` |
| Export | `Export CSV` | `CSV ડાઉનલોડ કરો` |
| Search placeholder | `Search customer name or phone…` | `ગ્રાહકનું નામ કે ફોન શોધો…` |
| KPI labels | `WALK-INS TODAY` · `COLLECTED TODAY` · `THIS MONTH` · `AVERAGE SALE` | `આજના વોક-ઇન` · `આજની વસૂલી` · `આ મહિને` · `સરેરાશ વેચાણ` |
| Columns | `CODE` `TIME` `CUSTOMER` `PHONE` `LITRES` `AMOUNT` | `કોડ` `સમય` `ગ્રાહક` `ફોન` `લિટર` `રકમ` |
| Chips | `Today` `Yesterday` `This week` `This month` `All` `Clear all` | `આજે` `ગઈકાલે` `આ અઠવાડિયે` `આ મહિને` `બધા` `બધું સાફ કરો` |
| Group band | `TODAY · 14 Aug 2026` · `12 sales` · `1 voided` | `આજે · 14 Aug 2026` · `12 વેચાણ` |
| Empty — no data ever | `No walk-in sales yet` / `Someone drives up with their own cans, fills them, pays cash and leaves. Type a name and an amount in the row above and press Enter — that's the whole job.` / `Record the first sale` | `હજી કોઈ વોક-ઇન વેચાણ નથી` |
| Empty — none today | `Nothing yet today` / `Today's total will build up here as you record sales. Yesterday you took ₹1,554.00 from 9 walk-ins.` / `See yesterday` | `આજે હજી કંઈ નથી` |
| Empty — no results | `No walk-ins match your filters` / `Nothing matches "paresh" between 1 Aug and 14 Aug 2026.` / `Clear filters` | `તમારા ફિલ્ટર સાથે કોઈ વોક-ઇન મળ્યું નહીં` |
| Error | `Couldn't load walk-in sales` / `The server didn't respond. Check your connection and try again.` / `Try again` | `વોક-ઇન વેચાણ લોડ થઈ શક્યું નહીં` |
| Partial error | `Today's total may be incomplete. One entry hasn't finished saving.` | — |
| Void toast | `DWS-000324 voided` | — |

### 3.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens cold | **The entry row renders immediately, live and focused** — it depends on nothing. KPI labels show with shimmer bars at the value position; the table shows a real header, a real entry row, then 8 skeleton rows | — |
| Loading (refilter) | Chip, search, date range or sort change | Existing rows at 60% opacity, `pointer-events: none`, 2px indeterminate Nova Blue bar under the header. **The entry row stays at 100% opacity and keeps focus and content** — refiltering the list must never interrupt a sale being typed | — |
| Empty — no data ever | Zero sales in the system | 320px centred block below the entry row: 48px `Droplet` `#D1D5DB`, H4, Body SM (max 460px), then a secondary button that **focuses the entry row's name field instead of navigating** — there is nowhere to navigate to | `No walk-in sales yet` / `Someone drives up with their own cans, fills them, pays cash and leaves. Type a name and an amount in the row above and press Enter — that's the whole job.` / `Record the first sale` |
| Empty — none today | `Today` chip active, history exists | 280px block: 48px `Sunrise` `#D1D5DB`, H4, a Body SM line **quoting yesterday's figure** so the screen still tells the owner something, then a `See yesterday` secondary that switches the chip. Distinct from the two above: this means *not yet*, not *never* and not *you filtered too far* | `Nothing yet today` / `Today's total will build up here as you record sales. Yesterday you took ₹1,554.00 from 9 walk-ins.` |
| Empty — no results | Search or filters exclude everything | 320px block: 48px `SearchX` `#D1D5DB`, H4, a line naming the live query and date range verbatim, `Clear filters` secondary | `No walk-ins match your filters` / `Nothing matches "paresh" between 1 Aug and 14 Aug 2026.` |
| Filled | Rows returned | As wireframe, grouped by day with sticky bands | — |
| Error | Fetch failed | 320px block: 48px `AlertTriangle` `#EF4444`, H4, plain-language cause, `Try again` primary. **The entry row stays usable** and queues the sale locally if the failure is network-only | `Couldn't load walk-in sales` / `The server didn't respond. Check your connection and try again.` |
| Partial error | List loads, one optimistic row failed | Table renders; the failed row keeps a 3px `#EF4444` left border and an inline `Retry`; a Danger banner sits above the table | `Today's total may be incomplete. One entry hasn't finished saving.` |
| Submitting | `Add sale` pressed | See §4.5 — the row inserts optimistically and the entry row clears immediately | — |
| Success | Server confirms | Code fills in, background flashes `#DBEAFE` → transparent over 600ms, group band count and total recompute, KPI cards 1, 2 and 4 recompute. **No row animation, no number count-up** | Toast only on the first sale of a session: `Sale recorded — ₹120.00 from Jignesh Shah` |
| Voiding | Void confirmed | That row dims to 60%, its `⋯` becomes a spinner, the group total recomputes only after the server confirms | — |
| Void success | Server confirms | Row keeps 60% opacity, gains the `Voided` badge, amount strikes through, band total drops, toast | `DWS-000324 voided` |
| Read-only | Not applicable | — | — |

### 3.6 Interactions

Entry-row interactions are in §4.6. Everything else:

| Interaction | Behaviour |
|---|---|
| Row hover / click | `#F3F4F6` at 100ms; whole row navigates to `/direct-sales/[id]`; the actions cell stops propagation |
| Keyboard | Rows focusable; `Enter` opens; `↑`/`↓` move between rows. `↑` from the first row moves focus **into the entry row's amount field**, so the whole screen is one keyboard surface |
| `N` | Anywhere on the page outside a field, focuses the entry row's name input and scrolls it into view |
| Search | 300ms debounce, resets to page 1, `Escape` clears. Searches customer name and phone only |
| Sort | `TIME` descending by default. Sorting by `AMOUNT` or `CUSTOMER` **removes the day grouping** and shows a `DATE` column in place of `TIME`, because a per-day tally is meaningless once the rows are reordered across days. The chip strip stays as the date filter |
| Quick chips | Instant, URL query updated. Switching away from `Today` and back preserves whatever is typed in the entry row |
| Group band | Not clickable, not collapsible. It is a subtotal, not a control |
| `Export CSV` | Button spinner, label `Preparing…`, then an Info toast `Walk-in export for August 2026 is ready` + `Download` |
| Tab order | Sidebar → topbar → `Export CSV` → 4 KPI cards → search → Filters → Columns → chips → **entry row (name → amount → Add sale → details chevron)** → first table row → … → page size → pagination |
| Focus | 2px `#2563EB` ring at 2px offset on every interactive element, including table rows and the entry row's inputs |

### 3.7 Responsive (below `md`)

- Sidebar off-canvas behind a `Menu` button; content padding 16px.
- Header stacks; `Export CSV` moves into a `⋯` next to the title.
- KPI cards 1 per row, but **`COLLECTED TODAY` is promoted to first** — on a phone at the counter that is the only number that matters.
- The entry row does **not** become a card. It becomes a fixed two-line block pinned directly under the toolbar: line 1 a full-width 48px name input, line 2 a 140px amount input on the left and a `Add sale` button filling the rest, with the details chevron as a 44×44 button between them. It stays on screen while the list scrolls.
- Day bands stay, full width, 40px, with the total right-aligned.
- Rows become cards, 12px gap, 16px padding:

```
┌─────────────────────────────────────────┐
│ DWS-000329                      6:42 pm │
│ Jignesh Shah · 9825014477               │
│ 40L                          ₹120.00    │
└─────────────────────────────────────────┘
```

Line 1: code (mono 13px `#2563EB`) left, time right. Line 2: name 16px 500 `#111827` · phone `#4B5563`. Line 3: litres left, amount right in 16px mono 600. A voided card carries the `Voided` badge on line 1 and 60% opacity. The `⋯` is a 44×44 button at the card's right edge, vertically centred.

### 3.8 Dark mode

Page `#0B1220`; card and table `#1E293B` with 1px `#334155`; table header and day bands `#0F172A`; row hover `#243347`. Text `#F1F5F9` / `#94A3B8`. Codes, chips-active, focus rings `#3B82F6`. The entry row's background becomes `#0F172A` with a `#3B82F6` 3px left accent. The saved-row flash uses `#1E3A8A` → transparent over 600ms. Voided rows: struck amount `#64748B`, badge Default-dark `#334155` / `#E2E8F0`. Skeleton bars `#334155`.

### 3.9 Stitch prompt

```text
Design a desktop list screen called "Direct Sales" for an internal Indian
water-plant admin tool, where walk-in customers pay cash. Inter for text, JetBrains
Mono for all numbers. Light theme: page #F8FAFC, white cards, 1px #E5E7EB borders,
text #111827, muted #4B5563, accent #2563EB. Keep a 240px left sidebar (Dashboard;
OPERATIONS: Delivery Orders, Coin Issues, Party Orders, Direct Sales — active;
MASTERS; MONEY; INSIGHTS) and a 64px topbar with a search field, an "EN | ગુ" toggle,
a theme toggle and an avatar.

Content, 24px padding: title "Direct Sales" at 28px semibold with the 14px grey
subtitle "Walk-in customers who fill their own cans and pay cash", and a single
outlined "Export CSV" button on the right — no "new" button.

Four KPI cards, 24px gap, 20px padding, 12px radius, each with a 12px uppercase grey
label and a 28px monospace bold value: WALK-INS TODAY 12 "▲ 3 vs yesterday";
COLLECTED TODAY ₹1,840.00 "▲ 18.4% vs yesterday"; THIS MONTH ₹38,620.00 "248 sales ·
August"; AVERAGE SALE ₹153.33 "across 12 today".

Then a table card: a 56px toolbar with a search field placeholder "Search customer
name or phone…", a "Filters" button and a gear button; a 44px row of pills — Today
(selected, blue #DBEAFE with a blue border), Yesterday, This week, This month, All;
a 44px sticky header in #F3F4F6 with 12px uppercase labels CODE, TIME, CUSTOMER,
PHONE, LITRES, AMOUNT.

Directly under the header, a distinct 56px inline entry row with a #F3F4F6
background and a 3px #2563EB left border: a small blue "⊕ NEW" marker, then a wide
48px text input with placeholder "Customer name" and a dropdown chevron, then a
140px right-aligned monospace input with a grey ₹ prefix and placeholder "Amount",
then a filled blue "Add sale" button and a small chevron-down button.

Below it, a 40px light grey band reading "TODAY · 14 Aug 2026" in 12px uppercase on
the left and "12 sales   ₹1,840.00" on the right, then 48px rows: DWS-000329 6:42 pm
Jignesh Shah 9825014477 40L ₹120.00; DWS-000328 6:20 pm કલ્પેશ ભાઈ 9909112233 20L
₹60.00; DWS-000327 5:55 pm Paresh Bhai — 80L ₹240.00; DWS-000326 5:31 pm Ramila Ben
Patel 9737654321 — ₹100.00; and a 60%-opacity row DWS-000324 3:10 pm Jignesh Shah
40L with ₹120.00 struck through and a grey "Voided" pill. Then a second band
"YESTERDAY · 13 Aug 2026   9 sales   ₹1,554.00" with one row beneath it. Footer:
"Showing 1–25 of 248" left, page size and pagination right.
```

---

## 4. The inline entry row — the heart of this module

### 4.1 Purpose

Turn a completed walk-in into a saved record in under five seconds, using two keystrokes of navigation and no mouse: type the name, press Enter, type the amount, press Enter.

### 4.2 Layout

**Collapsed — the default, and what the owner sees 95% of the time**

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│▌⊕ NEW      [ Customer name                    ▾]                       [₹     Amount ]  [Add sale] ⌄│ 56
├──────────────────────────────────────────────────────────────────────────────────────────────┤
 ▲
 3px Nova Blue left accent, full row height
```

**Autocomplete open — after typing `jig`**

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│▌⊕ NEW      [ jig                              ▾]                       [₹     Amount ]  [Add sale] ⌄│ 56
└──────────────┬───────────────────────────────────────┐
               │ Jignesh Shah                          │  ← 48px option, highlighted #F3F4F6
               │ 9825014477 · last 12 Aug · ₹120.00 avg│
               ├───────────────────────────────────────┤
               │ Jigar Bhai Trivedi                    │
               │ 9998877665 · last 2 Aug · ₹80.00 avg  │
               ├───────────────────────────────────────┤
               │ ↩ Use "jig" as a new customer          │  ← always last, never hidden
               └───────────────────────────────────────┘
```

**Expanded — after `Add details` (`⌘/Ctrl + D` or the chevron)**

```
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│▌⊕ NEW      [ Jignesh Shah                      ]                       [₹     120.00 ]        ⌃│ 56
│▌ ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│▌ │  Phone              Address                              Product            Litres     │ │
│▌ │  [ 9825014477   ]   [ Nr. Kalupur Gate, Ahmedabad     ]  [ 20L Jar     ▾]   [    40 ]  │ │ 96
│▌ │                                                                                        │ │
│▌ │  Sale date          Note                                                                │ │
│▌ │  [14 Aug 2026 📅]   [ Filled 2 cans                                     ]   [Add sale] │ │ 96
│▌ └────────────────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
```

**Backdating in progress — after the sale date is changed away from today**

```
│▌⊕ 15 AUG   [ Customer name                    ▾]                       [₹     Amount ]  [Add sale] ⌄│ 56
│  ⚠ Recording for 15 Aug 2026 · not today   [Back to today ✕]                                      │ 32
```

### 4.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Row | 56px tall, `#F3F4F6` background (one step darker than the white rows below, so it reads as a control strip rather than data), 3px `#2563EB` left accent running the full height, 1px `#E5E7EB` bottom border. **Sticky at `top: 44px`**, directly under the sticky column header, so it never scrolls away | — |
| Marker cell | 116px, matching the `CODE` column. 16px `Plus` in a 20px `#DBEAFE` circle, then `NEW` in Caption 12px 600 UPPERCASE `0.04em` `#1D4ED8`. When the sale date is not today, it reads the date instead: `15 AUG` | `⊕ NEW` |
| Time cell | 96px, empty. The server stamps the time; showing a live clock would be noise | — |
| **Name input** | Fills the `CUSTOMER` column, min 200px. **48px tall** — the primary field on a fast-entry form. 1px `#D1D5DB`, 4px radius, 12px padding, Body SM `#111827`, `#9CA3AF` placeholder. A `ChevronDown` 16px `#9CA3AF` sits inside at the right, marking it as a combobox rather than a plain text field. No script restriction | Placeholder `Customer name` |
| Phone / litres cells | Empty and inert while collapsed, so the columns still line up with the data below | — |
| **Amount input** | 140px, right-aligned in the `AMOUNT` column. **48px tall**. `₹` prefix inside the field at 12px inset in `#4B5563`, never part of the editable value. JetBrains Mono 16px 600 — deliberately one step larger and heavier than a table amount, because this is the number that must be right. `inputmode="decimal"` | Placeholder `Amount` |
| **Add sale button** | 40px, `#2563EB` fill, white text, radius 8px, 16px horizontal padding, sits in the actions area at the row's right | `Add sale` |
| Details chevron | 40×40 ghost icon button, `ChevronDown` 16px `#4B5563`, rotating 180° over 200ms when open. Accessible name `Add details`. Tooltip on hover: `Add details (⌘D)` | — |
| Expanded band | Slides open beneath the entry row over 200ms ease-in-out, height auto. `#F3F4F6` background continuing the row, inset 12px, 16px padding, 12px radius on an inner `#FFFFFF` panel with a 1px `#E5E7EB` border. Two field rows, 16px gap | — |
| Band labels | Caption 12px 500 `#4B5563`, 4px above each field | — |
| Phone | 140px, mono, `inputmode="numeric"`, 10 digits, non-digits stripped on paste | Placeholder `e.g. 9825014477` |
| Address | flex, min 240px, single-line input, not a textarea — a counter clerk is not writing a paragraph | Placeholder `e.g. Nr. Kalupur Gate, Ahmedabad` |
| Product | 180px search select of active products, optional, clearable | Placeholder `Optional` |
| Litres | 100px, mono, right-aligned, up to 3 decimals | Placeholder `0` |
| Sale date | 180px, `Calendar` 16px icon right, `DD MMM YYYY`, defaults to today, popover with `Today` / `Yesterday` chips | `14 Aug 2026` |
| Note | flex, single-line input | Placeholder `Optional` |
| Add sale (expanded) | The primary **moves** into the band's bottom-right when expanded, so visual order, DOM order and tab order stay identical. The collapsed row then shows only the chevron in its actions area | `Add sale` |
| Backdate notice | 32px strip directly under the entry row: Warning tint `#FEF3C7`, 1px `#F97316` top border only, 16px `AlertTriangle` `#B45309`, Caption 12px `#B45309`, and a `Back to today ✕` link at the right in `#B45309` | `Recording for 15 Aug 2026 · not today` |
| Autocomplete dropdown | Anchored to the name field, width = field width but at least 320px, 8px radius, 1px `#E5E7EB`, `shadow-lg`, max 8 options before scrolling. Option 56px: name Body SM 500 `#111827` on line 1; `9825014477 · last 12 Aug · ₹120.00 avg` in Caption `#4B5563` on line 2. Highlighted option `#F3F4F6`. Last item always `↩ Use "jig" as a new customer` in `#2563EB` — **free text is never blocked**, because there is no customer master and a new face must not be a dead end | — |

### 4.4 Content and copy

| Slot | English | Gujarati |
|---|---|---|
| Marker | `NEW` | `નવું` |
| Name placeholder | `Customer name` | `ગ્રાહકનું નામ` |
| Amount placeholder | `Amount` | `રકમ` |
| Primary | `Add sale` · while saving `Adding…` | `વેચાણ ઉમેરો` · `ઉમેરાઈ રહ્યું છે…` |
| Expander | `Add details` · when open `Hide details` | `વિગતો ઉમેરો` · `વિગતો છુપાવો` |
| Expander tooltip | `Add details (⌘D)` | — |
| Band labels | `Phone` · `Address` · `Product` · `Litres` · `Sale date` · `Note` | `ફોન` · `સરનામું` · `પ્રોડક્ટ` · `લિટર` · `વેચાણ તારીખ` · `નોંધ` |
| Band placeholders | `e.g. 9825014477` · `e.g. Nr. Kalupur Gate, Ahmedabad` · `Optional` · `0` · `Optional` | — |
| Autocomplete secondary line | `9825014477 · last 12 Aug · ₹120.00 avg` | — |
| Autocomplete no phone | `No phone on record · last 2 Aug · ₹80.00 avg` | — |
| Autocomplete free text | `↩ Use "jig" as a new customer` | `↩ "jig" ને નવા ગ્રાહક તરીકે વાપરો` |
| Autocomplete empty | `No past customer matches "kalp"` then, below it, the free-text row | — |
| Autocomplete loading | `Searching…` with a 14px spinner | — |
| Autofill toast | `Filled in from Jignesh Shah's last visit` — Info, 4s, only when a phone match auto-fills name and address | — |
| Backdate notice | `Recording for 15 Aug 2026 · not today` / `Back to today` | `15 Aug 2026 માટે નોંધાઈ રહ્યું છે · આજની તારીખ નથી` |
| Success toast (first of session) | `Sale recorded — ₹120.00 from Jignesh Shah` | — |
| Row-level failure | `Couldn't save this sale` + `Retry` + `Discard` | `આ વેચાણ સાચવી શકાયું નહીં` |
| Offline notice | `You're offline. Sales are being kept on this device and will save when you reconnect.` — Warning banner above the table, with a count: `2 waiting` | — |

**Validation messages — literal strings**

| Field | Condition | Message | Where it appears |
|---|---|---|---|
| Customer name | empty on submit | `Enter a customer name` | A 32px popover below the name field, Danger tint, 1px `#EF4444`, 8px radius, Caption `#B91C1C`, 14px `AlertCircle`. **A popover, not an inline block — the entry row must never change height, or the whole table shifts under the cursor** |
| Amount | empty on submit | `Enter the amount collected` | Popover below the amount field |
| Amount | zero or negative | `Amount must be more than ₹0` | Popover |
| Amount | non-numeric | `Enter an amount like 120 or 120.50` | Popover |
| Phone | present and not 10 digits | `Enter a 10-digit mobile number` | Caption below the phone field inside the band, where height changes are harmless |
| Litres | negative | `Litres can't be negative` | Caption in the band |
| Sale date | in the future | `A sale can't be dated in the future` | Caption in the band |
| Sale date | more than 30 days back | Warning, not an error: `That's 47 days ago. Older entries can't be edited afterwards — only voided.` | Caption in the band, `#B45309` |

### 4.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Idle (empty) | Page load, or after a successful save | Both inputs empty showing placeholders; `Add sale` enabled; the name field **has focus with a visible ring** | — |
| Focused | Name or amount focused | 2px `#2563EB` border + 2px offset ring on that field; the row's left accent thickens from 3px to 4px, 100ms | — |
| Typing (name) | ≥1 character | Autocomplete opens after 200ms debounce; the first option is *not* auto-highlighted, so `Enter` never selects something unintended | — |
| Autocomplete loading | Query in flight | Dropdown opens immediately with a single 48px row: 14px spinner + `Searching…` in Caption `#4B5563` | `Searching…` |
| Autocomplete empty | No match | Dropdown shows `No past customer matches "kalp"` in Caption `#4B5563`, then the free-text row. **Never an empty dropdown, never a closed one** | — |
| Partially filled | Name typed, amount empty | Nothing is flagged. Validation does not run while typing | — |
| Invalid on submit | `Add sale` or Enter with a bad field | That field takes a 1px `#EF4444` border and a 16px `AlertCircle` inside right; a Danger popover appears below it; **focus jumps to the first invalid field with its content selected**; the row height is unchanged | see §4.4 |
| Submitting (optimistic) | Valid submit | The row is inserted at the top of today's group **immediately**, with a 14px spinner in place of its code and every other cell already populated. The entry row clears and refocuses its name field in the same frame, so the next customer can be typed while the first is still in flight. The `Add sale` button never enters a disabled or spinner state — blocking the button would defeat the entire design | — |
| Success | Server confirms | The pending row's code fills in (`DWS-000330`), the spinner disappears, and the row's background transitions `#DBEAFE` → transparent over **600ms ease-out**. No slide, no fade-in, no height animation, no number count-up. The day band's count and total and the KPI cards recompute instantly | Toast only on the first sale of a session: `Sale recorded — ₹120.00 from Jignesh Shah` |
| Row failure | Server rejects or the network drops | The optimistic row stays where it is, gains a 3px `#EF4444` left border, and its actions cell becomes two Caption links: `Retry` `#2563EB` and `Discard` `#B91C1C`. Its amount is excluded from the day total, which shows a 12px `AlertCircle` `#EF4444` beside it. **Nothing typed is ever lost** | `Couldn't save this sale` |
| Offline | Connection lost | Warning banner above the table with a live count; the entry row keeps working and each sale is queued as a pending row. On reconnect, queued rows save oldest-first and flash green as they land | `You're offline. Sales are being kept on this device and will save when you reconnect.` `2 waiting` |
| Expanded | `Add details` toggled | Band open, `Add sale` relocated to its bottom-right, chevron rotated 180°. The band's state persists across saves **only if the sale date was changed** — otherwise it collapses on save, because the next customer probably needs two fields, not eight | — |
| Backdated | Sale date ≠ today | Marker cell shows `15 AUG` instead of `NEW`; the 32px Warning strip appears under the row; the date **persists across saves** so a batch of yesterday's entries can be caught up in one pass; `Back to today ✕` clears it | `Recording for 15 Aug 2026 · not today` |
| Disabled | Never. The `Add sale` button is always enabled — pressing it is how the owner discovers what is missing | — | — |
| Read-only | Not applicable | — | — |

### 4.6 Interactions — exact

**The critical path**

| Step | Keystroke | Result |
|---|---|---|
| 1 | Page loads | Name field focused, cursor at position 0, ring visible |
| 2 | Type `Jignesh Shah` | Autocomplete opens after 200ms; nothing is auto-selected |
| 3 | `Enter` | **Moves focus to Amount.** Does not submit — a sale with no amount can only fail, and bouncing an error at the owner costs more time than moving one field. If an autocomplete option is highlighted, `Enter` accepts it into the name field first and stays put; a second `Enter` moves on |
| 4 | Type `120` | Nothing validates, nothing formats |
| 5 | `Enter` | **Submits.** Row inserts optimistically, entry row clears, focus returns to Name |

Total: two Enters, no Tab, no mouse. A second sale begins immediately.

| Interaction | Behaviour |
|---|---|
| Autofocus | The name field takes focus on mount and after every successful save. It does **not** steal focus if the owner is typing in the search box or a filter |
| `Tab` order, collapsed | Name → Amount → `Add sale` → details chevron → first table row |
| `Tab` order, expanded | Name → Amount → Phone → Address → Product → Litres → Sale date → Note → `Add sale` → details chevron → first table row. Visual order, DOM order and tab order are identical, which is why the button relocates |
| `Shift+Tab` from Name | Returns to the last quick chip, not into the topbar |
| `Enter` in the band | Submits from any single-line band field, exactly as from Amount |
| `⌘/Ctrl + Enter` | Submits from anywhere in the row or band |
| `⌘/Ctrl + D` | Toggles the details band; focus moves to `Phone` on open and back to `Amount` on close |
| `Escape` | First press closes the autocomplete. Second press clears every field in the row and band, collapses the band, resets the date to today, and keeps focus in Name. No confirm dialog — nothing is saved yet, and a dialog here would cost more than retyping two fields |
| `↓` from Name | Opens or moves into the autocomplete; `↑`/`↓` traverse, `Enter` accepts, `Escape` closes and returns the typed text unchanged |
| `↑` from the first table row | Moves focus into the Amount field, so the list and the entry row are one continuous keyboard surface |
| `N` from anywhere on the page | Focuses the name field |
| Autocomplete selection | Fills name, and — if the option carries them — phone and address into the band, whether or not the band is open. If the band is closed it briefly shows a Caption line under the row: `Phone and address filled in` in `#15803D`, for 3 seconds |
| Phone-first entry | Typing 10 digits into the band's `Phone` field and blurring matches past sales; on a hit, name and address auto-fill **only if they are still empty**, and an Info toast confirms it. Typed values are never overwritten |
| Amount formatting | `120` stays `120` while typing and becomes `120.00` on blur or submit. `1250` becomes `1,250.00`. The `₹` prefix is decoration, so select-all-and-retype never fights it |
| Validation timing | Never while typing. Never on blur — blurring the name field to reach the amount field is normal and must not throw an error. **Only on submit.** Once a field is in error it re-validates on every keystroke, so the error clears the instant it is fixed |
| Double submit | Pressing Enter twice quickly submits once; the second press lands on an already-cleared form and is a no-op, not a duplicate blank sale |
| Sale date persistence | A non-today date survives saves until `Back to today` is pressed or the page is reloaded |
| Reduced motion | With `prefers-reduced-motion`, the 600ms success flash becomes an instant 150ms background set-and-clear, and the band opens without a height transition |

### 4.7 Responsive (below `md`)

The row cannot survive at 360px as a row — six columns of inputs will not fit — so it becomes a **pinned two-line block** directly under the toolbar, not a card and not a modal:

```
┌─────────────────────────────────────────┐
│▌ Customer name                        ▾ │  48px input, full width
│▌ [₹     Amount ]  [   Add sale    ]  ⌄  │  48px input 140px + button flex + 44px chevron
└─────────────────────────────────────────┘
```

- `#F3F4F6` background, 3px `#2563EB` left accent, 1px bottom border, 12px padding, `position: sticky` beneath the toolbar so it stays reachable while the list scrolls.
- Both inputs 48px for touch; the amount keeps its 140px cap so the numeric keypad target is unambiguous.
- The autocomplete opens as a full-width sheet below the name field, 56px options, max height 60vh.
- `Add details` opens a **bottom sheet** with the six optional fields stacked full width, a `Sale date` row at the top, and `Add sale` as a full-width primary pinned at the bottom above `env(safe-area-inset-bottom)`.
- The backdate notice sits between the two lines, full width, 32px.
- On-screen keyboards: the amount field declares `inputmode="decimal"`, phone `inputmode="numeric"`, and litres `inputmode="decimal"`, so the right keypad appears without a tap.

### 4.8 Dark mode

Entry row background `#0F172A` against `#1E293B` rows — inverted from light, where the row is *darker* than the data; on dark it must be darker still to keep reading as a control strip. Left accent `#3B82F6`, thickening to 4px on focus. Inputs `#1E293B` with 1px `#334155`, text `#F1F5F9`, placeholder `#64748B`, `₹` prefix `#94A3B8`. Focus border `#3B82F6` with a 40%-opacity ring. The `NEW` marker chip is `#1E3A8A` background with `#BFDBFE` text. Autocomplete dropdown `#1E293B`, 1px `#334155`, highlighted option `#243347`, secondary line `#94A3B8`. Success flash `#1E3A8A` → transparent. Failed-row left border stays `#EF4444`. Backdate strip `#7C2D12` background with `#FED7AA` text.

### 4.9 Stitch prompt

```text
Design, in close-up detail, the inline "new sale" entry row that sits at the top of a
data table in an internal Indian water-plant admin tool. Inter for text, JetBrains
Mono for numbers. Light theme: white table, 1px #E5E7EB dividers, text #111827, muted
#4B5563, accent #2563EB.

Show the table's 44px sticky header first, in #F3F4F6 with 12px uppercase
letter-spaced grey labels CODE, TIME, CUSTOMER, PHONE, LITRES, AMOUNT and a narrow
actions column. Directly beneath it, the entry row: 56px tall, #F3F4F6 background, a
3px #2563EB bar down its left edge, and a 1px bottom border. In the CODE column, a
small blue circle with a plus sign followed by "NEW" in 12px uppercase blue. The TIME,
PHONE and LITRES columns are empty. In the CUSTOMER column, a 48px white text input
with a 1px #D1D5DB border, 4px radius, placeholder "Customer name" in #9CA3AF and a
small grey chevron inside on the right. In the AMOUNT column, a 140px right-aligned
48px input with a grey ₹ prefix inside and placeholder "Amount" in 16px monospace.
At the far right, a filled blue "Add sale" button and a small chevron-down icon
button.

Produce three variations stacked vertically:

1. Idle — as described, with the name input showing a 2px blue focus border and a
   soft 2px offset ring.
2. Autocomplete open — the name input contains "jig" and a white dropdown hangs below
   it with a 1px border and soft shadow, showing two 56px options: "Jignesh Shah" with
   a 12px grey second line "9825014477 · last 12 Aug · ₹120.00 avg" (highlighted in
   #F3F4F6), and "Jigar Bhai Trivedi" with "9998877665 · last 2 Aug · ₹80.00 avg";
   a final blue row reads "↩ Use "jig" as a new customer".
3. Expanded — the name input reads "Jignesh Shah" and the amount reads "120.00"; the
   chevron is rotated up, and below the row an inset white panel with a 1px border and
   12px radius contains two rows of labelled fields: Phone "9825014477", Address
   "Nr. Kalupur Gate, Ahmedabad", Product "20L Jar" as a dropdown, Litres "40"; then
   Sale date "14 Aug 2026" with a calendar icon, Note "Filled 2 cans", and the blue
   "Add sale" button at the bottom right of the panel.

Below all three, show one saved table row with a pale blue #DBEAFE background fading
out — DWS-000330, 6:48 pm, Jignesh Shah, 9825014477, 40L, ₹120.00.
```

---

## 5. Sale detail — `/direct-sales/[id]`

### 5.1 Purpose

Look up one old entry — usually because a figure is being checked against the register — and see whether this customer has been in before.

### 5.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ‹ Direct Sales                                                                          │
│  DWS-000329                                        💵 Cash                               │
│  Jignesh Shah · 14 Aug 2026, 6:42 pm · 4th visit                                         │
│                                                       [✎ Edit]  [ ⋯ ]                    │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  AMOUNT PAID         LITRES FILLED       PRODUCT              RECORDED             │  │
│  │  ₹120.00             40L                 20L Jar              14 Aug 2026, 6:42 pm │  │
│  │  cash, in full       2 cans              ₹3.00 per litre      by Admin             │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  ┌── Customer ───────────────────────────┐  ┌── This customer's other walk-ins ───────┐  │
│  │  Name       Jignesh Shah              │  │  DWS-000324  14 Aug  40L    ₹120.00 ⊘  │  │
│  │  Phone      9825014477                │  │  DWS-000298  12 Aug  40L    ₹120.00    │  │
│  │  Address    Nr. Kalupur Gate,         │  │  DWS-000241   4 Aug  20L     ₹60.00    │  │
│  │             Ahmedabad 380002          │  │  ──────────────────────────────────────  │  │
│  │  Note       Filled 2 cans             │  │  3 earlier visits            ₹300.00    │  │
│  └───────────────────────────────────────┘  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, `ChevronLeft` 16px | `‹ Direct Sales` |
| Title | H2 28px/1.3 600, **mono** — this one is a document code, unlike a person's or product's name | `DWS-000329` |
| Badge | 12px gap after the title: `Cash` Success with a 12px `Wallet` icon. There is no payment status in this module, so the badge states the only fact there is. A voided sale shows `Voided` Default with `Ban` **in addition**, and the title drops to `#6B7280` | — |
| Meta line | Body SM `#4B5563`, `·` separated | `Jignesh Shah · 14 Aug 2026, 6:42 pm · 4th visit` |
| Actions | `[Edit]` primary (`Pencil`) — same-day only; `[⋯]` ghost | — |
| `⋯` menu | `Void sale` (`Ban`, `#B91C1C`) · `Print receipt` (`Printer`) | — |
| Edit unavailable | When the sale is not from today, `Edit` renders as a 40% ghost button with the tooltip and an inline Caption beneath the action group: `Only today's entries can be edited. Void this one and record it again.` | — |
| Summary card | `#F3F4F6`, 12px radius, 1px border, 24px padding, 4 columns on `lg` with 1px vertical rules, 2 on `md`, 1 below | — |
| Summary col 1 | Label `AMOUNT PAID`, value `₹120.00` 20px mono 600 `#111827` (the critical figure), context `cash, in full` | — |
| Summary col 2 | `LITRES FILLED` / `40L` 20px mono 600 `#374151` / `2 cans` — the context line is omitted when no note explains it | — |
| Summary col 3 | `PRODUCT` / `20L Jar` **18px Inter 600** (a name, not a figure) / `₹3.00 per litre` computed | — |
| Summary col 4 | `RECORDED` / `14 Aug 2026, 6:42 pm` 16px mono 600 / `by Admin` | — |
| Customer card | 24px padding, 12px radius, 1px border. Label column 100px Body SM 500 `#4B5563`; values Body 16px/1.6 `#111827`. Absent values → `—` `#D1D5DB` | — |
| Other walk-ins | Card with a compact table: rows 44px (not 48 — these are secondary), columns code / date / litres / amount. Voided rows at 60% with a 12px `Ban`. Footer row above a 1px border: `3 earlier visits` Body SM 600 left, total 14px mono 600 right |  — |
| Match rule | Matched on phone when the sale has one, otherwise on an exact name match. The card heading names which: `This customer's other walk-ins` with a Caption `#4B5563` subheading `matched on 9825014477` or `matched on the name "Paresh Bhai"` | — |

### 5.4 Content and copy

| Slot | Copy |
|---|---|
| Back link | `‹ Direct Sales` |
| Badges | `Cash` · `Voided` |
| Actions | `Edit` · `Void sale` · `Print receipt` |
| Edit blocked | `Only today's entries can be edited. Void this one and record it again.` |
| Summary labels | `AMOUNT PAID` · `LITRES FILLED` · `PRODUCT` · `RECORDED` |
| Summary context | `cash, in full` · `2 cans` · `₹3.00 per litre` · `by Admin` |
| Card headings | `Customer` · `This customer's other walk-ins` |
| Match subheading | `matched on 9825014477` / `matched on the name "Paresh Bhai"` |
| Field labels | `Name` · `Phone` · `Address` · `Note` |
| No product | `No product recorded` in Caption `#4B5563` under a `—` value, with the line `Amount only — nothing was recorded about what was filled` |
| Others empty | `First visit` / `Nothing else has been recorded for this customer.` |
| Others no phone | `Can't match earlier visits` / `This sale has no phone number, so only exact name matches can be found — and there are none.` |
| Voided banner | `This sale was voided on 15 Aug 2026 by Admin.` then, on a second line in 14px `#111827`: `Reason: "Customer paid by mistake, refunded at the counter."` — Default tint, 20px `Ban` icon, not dismissible |
| Not found | `That sale doesn't exist` / `It may have been removed. Go back to the list to find what you're looking for.` / `Back to direct sales` |
| Error | `Couldn't load this sale` / `The server didn't respond. Check your connection and try again.` / `Try again` |

### 5.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens | Back link renders immediately; title becomes a 180×28px shimmer; the badge becomes a 70×22px shimmer pill; the summary card shows four shimmer bars with labels legible; the customer card shows four label/value shimmer rows; the others table shows 3 skeleton rows | — |
| Filled | Loaded | As wireframe | — |
| Empty — no product recorded | Sale has amount only | Summary columns 2 and 3 show `—` in `#9CA3AF` with the Caption line beneath | `Amount only — nothing was recorded about what was filled` |
| Empty — first visit | No other sales match | Others card body becomes a 180px centred block: 48px `UserPlus` `#D1D5DB`, H4, Body SM. **Positive framing** — a first-time customer is not a failure | `First visit` / `Nothing else has been recorded for this customer.` |
| Empty — unmatchable | No phone and no name match | Same block with a 48px `SearchX` and different copy, so the owner knows *why* the card is empty rather than assuming the customer is new | `Can't match earlier visits` / `This sale has no phone number, so only exact name matches can be found — and there are none.` |
| Voided | `is_voided = true` | Default-tinted banner under the header quoting the reason verbatim; the title drops to `#6B7280`; the summary amount is struck through; `Edit` is removed entirely and `Void sale` is replaced by a 40% `Already voided` item | see §5.4 |
| Error | Fetch fails | 320px centred block: 48px `AlertTriangle` `#EF4444`, H4, reason, `Try again` | `Couldn't load this sale` |
| Not found | Bad id | Same block with 48px `SearchX` and a `Back to direct sales` primary | `That sale doesn't exist` |
| Partial error | Sale loads, the others table fails | Header, summary and customer card render; the others card shows an inline Danger row with `Retry` | `Couldn't load this customer's earlier visits.` + `Retry` |
| Submitting | Void confirmed | The `⋯` becomes a spinner; the header dims to 60% | — |
| Success | Voided | Banner appears (200ms fade), badge added, amount struck through, toast | `DWS-000329 voided` |
| Read-only | Any sale not from today | `Edit` at 40% with its reason attached; everything else normal | see §5.4 |

### 5.6 Interactions

| Interaction | Behaviour |
|---|---|
| `Edit` | `/direct-sales/[id]/edit`, same-day only |
| `Void sale` | Opens the void dialog (§7) |
| `Print receipt` | Opens the browser print dialog against an A4 receipt layout: business name, `DWS-000329`, date and time, customer, product and litres, amount in figures and words, `Paid in cash`. Black on white, Inter 10pt, money in mono |
| Phone | `tel:` link on touch; on desktop a `Copy` icon button appears on hover, with a 4s `Phone number copied` toast |
| Others table row | Click opens that sale; the breadcrumb keeps `Direct Sales / DWS-000329` as the parent so back is predictable |
| Keyboard | `E` opens Edit when available and focus is not in a field; `Escape` closes any popover and restores focus to its trigger |
| Tab order | Back link → Edit → `⋯` → summary figures (only `AMOUNT PAID` and `PRODUCT` are links) → customer phone copy button → others table rows |

### 5.7 Responsive (below `md`)

- Header stacks: back link, code, badge on its own line, meta line, then `Edit` full width with `⋯` as a 44×44 button beside it.
- Summary card becomes a 2×2 grid, 16px padding, no vertical rules, values stay 20px mono 600.
- Customer and others cards stack full width, Customer first.
- The others table becomes four compact rows of `code · date` on line 1 and `litres · amount` on line 2, with the amount right-aligned; the totals row stays.

### 5.8 Dark mode

Page `#0B1220`; cards `#1E293B` / 1px `#334155`; summary card `#0F172A`. Title `#F1F5F9`, dropping to `#64748B` when voided. `Cash` badge Success-dark `#14532D` / `#BBF7D0`. The voided banner is `#1E293B` with a `#334155` border, `#94A3B8` label text and the quoted reason in `#F1F5F9`. Struck amounts `#64748B`. Others-table dividers `#334155`.

### 5.9 Stitch prompt

```text
Design a compact desktop detail page for a single cash walk-in sale in an internal
Indian water-plant admin tool. Inter for text, JetBrains Mono for numbers and codes.
Light theme: page #F8FAFC, white cards, 1px #E5E7EB borders, text #111827, muted
#4B5563, accent #2563EB. Keep the 240px sidebar and 64px topbar; breadcrumb reads
"Direct Sales / DWS-000329".

Header: a blue back link "‹ Direct Sales"; the code "DWS-000329" as the page title in
28px semibold monospace, with a green pill beside it reading "Cash" and a small
wallet icon; below it a 14px grey line "Jignesh Shah · 14 Aug 2026, 6:42 pm · 4th
visit". Right-aligned: a filled blue "Edit" button and a three-dot icon button.

Below, a full-width inset panel with #F3F4F6 background, 12px radius and 24px
padding, divided into four columns by thin vertical rules. Each column has a 12px
uppercase grey label, a 20px monospace semibold value and a 12px grey context line:
AMOUNT PAID ₹120.00 "cash, in full"; LITRES FILLED 40L "2 cans"; PRODUCT "20L Jar"
(this one in 18px semibold Inter, not monospace) "₹3.00 per litre"; RECORDED "14 Aug
2026, 6:42 pm" "by Admin".

Then two white cards side by side with a 24px gap. Left, "Customer" — a label/value
list with 100px labels: Name "Jignesh Shah", Phone "9825014477", Address "Nr. Kalupur
Gate, Ahmedabad 380002", Note "Filled 2 cans". Right, "This customer's other
walk-ins" with a 12px grey subheading "matched on 9825014477" and a compact table of
44px rows: DWS-000324 14 Aug 40L ₹120.00 shown at 60% opacity with a small ban icon;
DWS-000298 12 Aug 40L ₹120.00; DWS-000241 4 Aug 20L ₹60.00; then a line above a
totals row reading "3 earlier visits" on the left and ₹300.00 in semibold monospace
on the right. Codes are monospace blue, amounts right-aligned monospace with ₹ and
two decimals. Dense and utilitarian.
```

---

## 6. Edit sale — `/direct-sales/[id]/edit`

### 6.1 Purpose

Correct a counter mistake on the same day it was made — before the day's cash is tallied and the entry becomes untouchable.

### 6.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ‹ DWS-000329                                                            │
│  Edit sale                                                               │
│  Recorded today at 6:42 pm by Admin                                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠  Today's entries can be corrected freely. From tomorrow this one │  │
│  │    can only be voided, so the day's cash total stays auditable.    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  │  Customer name *              Amount paid *                        │  │
│  │  ┌──────────────────────────┐ ┌──────────────────┐                 │  │
│  │  │ Jignesh Shah             │ │ ₹        120.00  │                 │  │
│  │  └──────────────────────────┘ └──────────────────┘                 │  │
│  │                                                                    │  │
│  │  Phone                        Sale date *                          │  │
│  │  ┌──────────────────────────┐ ┌──────────────────┐                 │  │
│  │  │ 9825014477               │ │ 14 Aug 2026   📅 │                 │  │
│  │  └──────────────────────────┘ └──────────────────┘                 │  │
│  │                                                                    │  │
│  │  Address                                                           │  │
│  │  ┌────────────────────────────────────────────────────────────────┐│  │
│  │  │ Nr. Kalupur Gate, Ahmedabad 380002                             ││  │
│  │  └────────────────────────────────────────────────────────────────┘│  │
│  │                                                                    │  │
│  │  Product                      Litres filled                        │  │
│  │  ┌──────────────────────────┐ ┌──────────┐                         │  │
│  │  │ 20L Jar                ▾ │ │    40    │                         │  │
│  │  └──────────────────────────┘ └──────────┘                         │  │
│  │                                                                    │  │
│  │  Note                                                              │  │
│  │  ┌────────────────────────────────────────────────────────────────┐│  │
│  │  │ Filled 2 cans                                                  ││  │
│  │  └────────────────────────────────────────────────────────────────┘│  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │                                        [ Cancel ]   [ Save sale ]  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, mono for the code | `‹ DWS-000329` |
| Title / meta | H2 `Edit sale`; Body SM `#4B5563` meta line | `Recorded today at 6:42 pm by Admin` |
| Window banner | Warning tint `#FEF3C7`, 1px `#F97316`, 12px radius, 16px padding, 20px `AlertTriangle` `#B45309`, Body SM `#B45309`. **Not dismissible** — it explains why this page will stop existing | see §6.4 |
| Card | 24px padding, **max 720px**, 12px radius, 1px border, `shadow-sm` | — |
| Paired rows | Three two-column rows, 16px gap: name / amount, phone / date, product / litres. Everything else full width | — |
| Name | flex, 40px, any script | — |
| Amount | 200px, mono, right-aligned, `₹` prefix inside in `#4B5563` | — |
| Phone | 200px, mono, `inputmode="numeric"` | — |
| Sale date | 180px, `Calendar` icon right, **restricted to today** — see interactions | — |
| Address | full width, single-line input | — |
| Product | 240px search select, clearable | — |
| Litres | 120px, mono, right-aligned, up to 3 decimals | — |
| Note | full width, single-line input | — |
| Footer | Sticky in the card, 1px top border, 16px/24px padding, right-aligned | `[Cancel]` ghost · `[Save sale]` primary |

### 6.4 Content and copy

| Slot | Copy |
|---|---|
| Title / meta | `Edit sale` / `Recorded today at 6:42 pm by Admin` |
| Window banner | `Today's entries can be corrected freely. From tomorrow this one can only be voided, so the day's cash total stays auditable.` |
| Labels | `Customer name` · `Amount paid` · `Phone` · `Sale date` · `Address` · `Product` · `Litres filled` · `Note` |
| Helper — amount | `Cash only. Change it and today's total updates straight away.` |
| Helper — date | `Same-day entries only` |
| Placeholders | `e.g. Jignesh Shah` · `0.00` · `e.g. 9825014477` · `e.g. Nr. Kalupur Gate, Ahmedabad` · `Optional` · `0` · `Optional` |
| Buttons | `Cancel` · `Save sale` · while saving `Saving…` |
| Success toast | `DWS-000329 updated — ₹150.00` |
| Discard dialog | `Discard your changes?` / `Your changes to DWS-000329 haven't been saved.` / `[Keep editing]` · `[Discard changes]` |
| Window expired | `This sale can no longer be edited` / `The day has rolled over. Void DWS-000329 and record it again if it's wrong.` / `[Back to the sale]` · `[Void sale]` |
| Concurrent void | `This sale was voided while you were editing` / `Admin voided DWS-000329 at 6:58 pm. Your changes can't be saved.` / `[Back to the sale]` |
| Error | `Couldn't save your changes` / `The server didn't respond. Try again in a moment.` |

**Validation messages** — identical strings to §4.4 where the field is shared: `Enter a customer name`, `Enter the amount collected`, `Amount must be more than ₹0`, `Enter an amount like 120 or 120.50`, `Enter a 10-digit mobile number`, `Litres can't be negative`. Plus: `Sale date` changed away from today → `Same-day entries only — you can't move a sale to another date`.

### 6.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens | Labels and the card frame render immediately; each input shows a `#F3F4F6` shimmer at its own height so nothing reflows; the Warning banner renders straight away | — |
| Filled | Loaded | Every field pre-filled; form clean | — |
| Empty (optional fields) | No product, litres or note | Empty fields showing placeholders — never `null` or `N/A` | — |
| Field error | Blur on an invalid touched field | 1px `#EF4444` border, 16px `AlertCircle` inside right, Caption `#EF4444` message replacing the helper text in reserved space | see §6.4 |
| Amount changed | Value differs from stored | A Caption line appears under the field in `#4B5563` with reserved space, so nothing shifts | `Was ₹120.00 · today's total becomes ₹1,870.00` |
| Submitting | Valid submit | Primary shows a spinner, label `Saving…`, both buttons disabled, form body at 60% | `Saving…` |
| Success | Saved | Navigate to `/direct-sales/[id]`, 4s toast naming the new amount | `DWS-000329 updated — ₹150.00` |
| Window expired | Midnight passes while the page is open, or the URL is opened on an old sale | The form is replaced in place by a 320px centred block: 48px `Clock` `#F97316`, H4, Body SM, and two buttons. **Nothing typed is submitted, and the block says why** | `This sale can no longer be edited` / `The day has rolled over. Void DWS-000329 and record it again if it's wrong.` |
| Concurrent void | Voided elsewhere | Form-level Danger banner; the primary is removed, leaving `Back to the sale` | see §6.4 |
| Error | Save failed | Form-level Danger banner; form re-enabled with values intact | `Couldn't save your changes` |
| Read-only | Not reachable — a non-today sale redirects to the detail page with an Info toast | — | `Only today's entries can be edited` |
| Disabled | Never. The primary stays enabled so pressing it reveals the errors | — | — |

### 6.6 Interactions

| Interaction | Behaviour |
|---|---|
| Autofocus | **None** — focus lands on the card. Auto-selecting an existing name invites accidental overwrites |
| Tab order | Customer name → Amount paid → Phone → Sale date → Address → Product → Litres → Note → Cancel → Save sale |
| `Enter` | Submits from any single-line field; `⌘/Ctrl + Enter` submits from anywhere |
| `Escape` | Cancel, with the discard confirm when dirty |
| Validation timing | Never while typing. On blur if touched. On submit, all at once, then focus and scroll to the first error. Re-validates live once a field is in error |
| Sale date | The calendar allows only today; every other date is at 40% opacity and unselectable, with a Caption note inside the popover: `Same-day entries only`. Typing another date shows the error on blur |
| Amount impact line | Recalculates on every keystroke — feedback, not validation |
| Dirty tracking | Compared against loaded values; reverting a field makes the form clean and disarms the discard guard |
| Window expiry | A timer checks the date at each minute boundary; when the day rolls over the form swaps to the expired block without losing anything already typed, which stays visible above the block in a `#F3F4F6` read-only summary |
| Success navigation | `/direct-sales/[id]` |

### 6.7 Responsive (below `md`)

- Content padding 16px; the card sits flush on the page background with no border or radius.
- All three paired rows stack, but `Amount paid` keeps its 200px cap and `Litres filled` its 120px — a wide box for a three-digit number is an error magnet on any screen size.
- Inputs go to 48px tall; `inputmode` is declared on amount, phone and litres.
- The footer becomes a fixed bottom bar: 72px, 1px top border, `Save sale` 60% width right, `Cancel` 40% left, respecting `env(safe-area-inset-bottom)`.

### 6.8 Dark mode

Card `#1E293B` on `#0B1220`. The Warning banner becomes `#7C2D12` background, 1px `#F97316`, text `#FED7AA`, icon `#FDBA74`. Inputs `#0F172A` with 1px `#334155`, text `#F1F5F9`, placeholder `#64748B`, `₹` prefix `#94A3B8`. Focus `#3B82F6` with a 40%-opacity ring. Error border `#EF4444` with the message lifted to `#FCA5A5`. The expired-window block uses a `#F97316` icon on the `#1E293B` card.

### 6.9 Stitch prompt

```text
Design a desktop "Edit sale" form for a same-day cash walk-in in an internal Indian
water-plant admin tool. Inter for text, JetBrains Mono for numbers. Light theme: page
#F8FAFC, white card, 1px #E5E7EB borders, text #111827, muted #4B5563, accent
#2563EB. Keep the 240px sidebar and 64px topbar; breadcrumb "Direct Sales /
DWS-000329 / Edit".

Header: a blue back link "‹ DWS-000329" with the code in monospace, the title "Edit
sale" at 28px semibold, and a 14px grey meta line "Recorded today at 6:42 pm by
Admin".

At the top of the white card (max 720px, 24px padding, 12px radius), a
non-dismissible amber banner: #FEF3C7 background, 1px #F97316 border, 12px radius,
16px padding, a 20px warning triangle in #B45309, and 14px #B45309 text reading
"Today's entries can be corrected freely. From tomorrow this one can only be voided,
so the day's cash total stays auditable."

Below it, a form in three two-column rows plus three full-width fields, 16px gaps,
14px medium labels above each field with a blue asterisk on required ones, and 12px
grey helper lines below:
- "Customer name *" (flex input, "Jignesh Shah") and "Amount paid *" (200px
  right-aligned monospace input with a grey ₹ prefix, "120.00", helper "Cash only.
  Change it and today's total updates straight away.")
- "Phone" (200px monospace, "9825014477") and "Sale date *" (180px, "14 Aug 2026",
  calendar icon, helper "Same-day entries only")
- "Address" (full width, "Nr. Kalupur Gate, Ahmedabad 380002")
- "Product" (240px dropdown showing "20L Jar") and "Litres filled" (120px
  right-aligned monospace, "40")
- "Note" (full width, "Filled 2 cans")

Inputs are 40px tall, 4px radius, 1px #D1D5DB border. Show the amount field focused
with a 2px #2563EB border and a soft offset ring, and a small grey line beneath it
reading "Was ₹120.00 · today's total becomes ₹1,870.00".

Card footer: 1px top border, right-aligned ghost "Cancel" and filled blue "Save
sale". Compact and utilitarian.
```

---

## 7. Void dialog

### 7.1 Purpose

Cancel a wrong entry that is too old to edit, on the record, with a reason — so a day's cash total can never be quietly altered after it has been tallied.

### 7.2 Layout

```
┌────────────────────────────────────────────────────────┐
│  ⊘                                                  ✕  │
│  Void DWS-000324?                                      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Jignesh Shah · 14 Aug 2026, 3:10 pm             │  │
│  │  40L · 20L Jar                        ₹120.00    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  This stays in the list, struck through, and drops     │
│  out of every total. It can't be undone.               │
│                                                        │
│  Reason *                                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Customer paid by mistake, refunded at the counter │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│  Everyone who opens this sale will see this            │
│                                                        │
│  Today's total drops from ₹1,840.00 to ₹1,720.00       │
│                                                        │
│                         [ Cancel ]   [ Void sale ]     │
└────────────────────────────────────────────────────────┘
```

### 7.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Width | 480px — wider than a plain 420px confirm, because it carries a summary and a required field | — |
| Container | 12px radius, `shadow-xl`, 24px padding, surface background, overlay `rgba(15,23,42,0.5)` | — |
| Icon | 24px `Ban` `#EF4444`, above the title, 12px gap | — |
| Title | H4 18px/1.4 600 `#111827`. **Names the object** | `Void DWS-000324?` |
| Close | `X` 16px `#9CA3AF` top-right, 44×44 hit area | — |
| Summary panel | Inset `#F3F4F6`, 8px radius, 1px `#E5E7EB`, 12px padding, two lines. Line 1: customer and timestamp in Body SM `#111827`. Line 2: litres and product in Caption `#4B5563` left, amount in 16px mono 600 `#111827` right | — |
| Consequence | Body SM `#4B5563`, 16px above the field | `This stays in the list, struck through, and drops out of every total. It can't be undone.` |
| Reason label | Body SM 500 `#111827` with a `#2563EB` `*` | `Reason` |
| Reason field | Textarea, 2 rows, full width, 1px `#D1D5DB`, 4px radius, autofocused. Min 3 characters | — |
| Reason helper | Caption `#4B5563`, space reserved | `Everyone who opens this sale will see this` |
| Impact line | Body SM `#111827` with the figures in 14px mono 600, 16px above the footer. Recomputes live if the dialog is open while other sales land | `Today's total drops from ₹1,840.00 to ₹1,720.00` |
| Footer | 1px top border, 16px above, right-aligned, 8px gap | `[Cancel]` ghost · `[Void sale]` destructive `#EF4444` fill, white text. **The confirm repeats the verb** |
| Motion | Enter 200ms fade + scale from 0.96; exit 150ms. Focus traps inside and returns to the `⋯` trigger. `Escape` and overlay click cancel — **unless the reason field has text**, in which case a nested confirm appears | — |

### 7.4 Content and copy

| Slot | Copy |
|---|---|
| Title | `Void DWS-000324?` |
| Consequence | `This stays in the list, struck through, and drops out of every total. It can't be undone.` |
| Reason label / placeholder / helper | `Reason` / `e.g. Customer paid by mistake, refunded at the counter` / `Everyone who opens this sale will see this` |
| Impact | `Today's total drops from ₹1,840.00 to ₹1,720.00` |
| Impact, older day | `The total for 12 Aug 2026 drops from ₹1,554.00 to ₹1,434.00` |
| Buttons | `Cancel` · `Void sale` · while voiding `Voiding…` |
| Reason empty | `Say why this sale is being voided` |
| Reason too short | `Add a few more words — this is the only record of why` |
| Success toast | `DWS-000324 voided` — **no `Undo`.** The standards offer Undo on destructive successes *where technically possible*; here the whole point is that a voided entry cannot be quietly reversed |
| Error | `Couldn't void this sale` / `The server didn't respond. Nothing has changed. Try again.` |
| Already voided | `This sale is already voided` / `Admin voided it at 6:58 pm.` / `[Close]` |
| Nested discard | `Discard this reason?` / `What you typed won't be kept.` / `[Keep writing]` · `[Discard]` |

### 7.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading | Dialog opens while the sale summary loads | Opens immediately at final size; the summary panel shows two shimmer lines; the reason field is live and focused straight away, so typing can start before the summary arrives | — |
| Empty (default) | Just opened | Reason empty with its placeholder, focused. `Void sale` enabled — pressing it is how the missing reason gets surfaced | — |
| Filled | Reason typed | Impact line visible; footer active | — |
| Field error | Submit with an empty or 1–2 character reason | 1px `#EF4444` border on the textarea, message replacing the helper in Caption `#EF4444` with a 14px `AlertCircle`; focus returns to the field | `Say why this sale is being voided` / `Add a few more words — this is the only record of why` |
| Submitting | Valid submit | Destructive button shows a spinner, label `Voiding…`, both buttons disabled, dialog body at 60% | `Voiding…` |
| Success | Confirmed | Dialog closes over 150ms; the row updates in place — 60% opacity, struck amount, `Voided` badge — with no row animation; the day band total and the KPI cards recompute; toast, 4s | `DWS-000324 voided` |
| Error | Server rejects | Danger banner inside the dialog above the footer; the dialog stays open with the reason intact | `Couldn't void this sale` / `The server didn't respond. Nothing has changed. Try again.` |
| Already voided | Voided elsewhere first | Body replaced by a single Body SM line and the footer reduced to one `Close` button | `This sale is already voided` / `Admin voided it at 6:58 pm.` |
| Read-only | Not applicable | — | — |

### 7.6 Interactions

| Interaction | Behaviour |
|---|---|
| Open | From the row `⋯` menu or the detail page `⋯`. Focus moves to the reason textarea |
| Tab order | Reason → Cancel → Void sale → close `✕` (last, so it is never hit by accident) |
| `⌘/Ctrl + Enter` | Submits. Plain `Enter` inserts a newline, because the field is a textarea |
| `Escape` / overlay click | Cancels; with text in the reason field, a nested 420px confirm appears first |
| Focus trap | Focus cycles inside the dialog and returns to the triggering `⋯` button on close |
| Impact line | Recomputes if another sale is recorded while the dialog is open |
| Validation timing | On submit only. A reason is not validated on blur, because tabbing to the button is a normal path |

**Responsive:** below `md` the dialog becomes a bottom sheet — full width, 12px top corners, a 32×4px `#D1D5DB` drag handle, 16px padding, the reason textarea at 3 rows, and stacked full-width footer buttons with `Void sale` on top and 8px between them. Swipe-down follows the same rules as `Escape`.

**Dark mode:** dialog `#1E293B`, overlay `rgba(2,6,23,0.7)`. Summary panel `#0F172A` with a `#334155` border. Textarea `#0F172A` with a `#334155` border and `#F1F5F9` text. Destructive button stays `#EF4444` with a `#F87171` focus ring for separation from the fill. The impact line's figures are `#F1F5F9`.

### 7.9 Stitch prompt

```text
Design a modal dialog for voiding a cash sale in an internal Indian water-plant admin
tool, over a dimmed rgba(15,23,42,0.5) overlay above a data table. Inter for text,
JetBrains Mono for numbers. The dialog is white, 480px wide, 12px radius, 24px
padding, with a large soft shadow.

At the top, a 24px red "ban" circle icon and a small grey ✕ in the top-right corner.
Below the icon, an 18px semibold title "Void DWS-000324?".

Then an inset summary panel: #F3F4F6 background, 8px radius, 1px #E5E7EB border,
12px padding, two lines — "Jignesh Shah · 14 Aug 2026, 3:10 pm" in 14px #111827 on
the first line, and on the second line "40L · 20L Jar" in 12px grey on the left with
"₹120.00" in 16px semibold monospace right-aligned.

Below the panel, 14px #4B5563 body text: "This stays in the list, struck through, and
drops out of every total. It can't be undone."

Then a required field: a 14px medium label "Reason" with a blue asterisk, a two-row
textarea with a 1px #D1D5DB border and 4px radius containing "Customer paid by
mistake, refunded at the counter", and a 12px grey helper line "Everyone who opens
this sale will see this".

Below that, a single 14px line with monospace figures: "Today's total drops from
₹1,840.00 to ₹1,720.00".

Footer separated by a 1px #E5E7EB top border: right-aligned ghost "Cancel" button
and a filled red #EF4444 "Void sale" button.

Behind the overlay, hint at the table underneath with one row visible at 60% opacity
showing DWS-000324, 3:10 pm, Jignesh Shah, and ₹120.00 struck through with a grey
"Voided" pill. Businesslike and compact — no illustrations.
```

---

## Module design checklist

- [ ] All four screens have a title **and** a one-line subtitle
- [ ] The list has **no** `+ New sale` button — the create form is the always-focused inline row, and there is exactly one way to record a sale
- [ ] The entry row is 56px, sticky at `top: 44px` under the column header, and renders before any data loads
- [ ] The name field is autofocused on page load and after every successful save
- [ ] `Enter` in the name field **advances** to Amount; `Enter` in Amount **submits**. Two Enters, no Tab, no mouse
- [ ] Tab order, DOM order and visual order are identical in both collapsed and expanded states — which is why `Add sale` relocates into the band when it opens
- [ ] Saving is optimistic: the row inserts instantly, the entry row clears and refocuses in the same frame, and `Add sale` never disables or spins
- [ ] The new row does **not** animate in. Confirmation is a `#DBEAFE` → transparent background flash over 600ms, honouring the standards' ban on animating table rows
- [ ] The entry row never changes height on validation — errors appear in popovers below the field
- [ ] Validation in the entry row runs on submit only, never while typing and never on blur
- [ ] A failed optimistic row keeps its data, gains a red left border, and offers `Retry` and `Discard`
- [ ] `Escape` clears the row without a confirm dialog; nothing is saved yet
- [ ] The details expander opens on the chevron or `⌘/Ctrl + D`, moves focus to Phone, and collapses on save unless the sale date was changed
- [ ] A non-today sale date persists across saves, shows a Warning strip, and changes the marker cell to the date
- [ ] Autocomplete always ends with `↩ Use "…" as a new customer` — free text is never blocked, because there is no customer master
- [ ] A phone match auto-fills name and address **only into empty fields**, never over typed values
- [ ] All five core list states drawn — plus a **third empty variant**: no-data-ever, none-today, and no-results, each with a different icon, different copy and a different action
- [ ] Detail page draws loading, filled, no-product, first-visit, unmatchable, voided, error, 404 and partial-error
- [ ] Edit form draws loading, filled, field error, amount-impact, submitting, success, window-expired and concurrent-void
- [ ] Void dialog draws loading, empty, filled, field error, submitting, success, error and already-voided
- [ ] Table header 44px sticky, rows 48px, day bands 40px, cell padding 12/16, no zebra striping
- [ ] Every money figure: JetBrains Mono, right-aligned, `₹`, 2 decimals, `—` in `#D1D5DB` for zero
- [ ] Litres trim trailing zeros: `40L`, `20L`, `0.5L`
- [ ] Time renders 12-hour lower case (`6:42 pm`); the date lives in the group band and is never repeated per row
- [ ] Day bands exclude voided sales from their count and total, and say so
- [ ] Voided rows use the §7.2 Cancelled treatment: `Voided` Default badge with `Ban`, 60% row opacity, amount struck through
- [ ] `Edit` is disabled with its reason attached for non-today sales — never a bare grey menu item
- [ ] The void dialog requires a reason, states the exact effect on the day's total, and offers **no Undo**
- [ ] Every validation string is specific: `Amount must be more than ₹0`, not `Invalid input`
- [ ] Focus ring 2px `#2563EB` at 2px offset everywhere, including both entry-row inputs
- [ ] Every screen specified in light **and** dark, with the entry row inverting to `#0F172A` on dark so it still reads as a control strip
- [ ] Checked with `કલ્પેશ ભાઈ`, `વેચાણ ઉમેરો` and `વિગતો ઉમેરો`: the `Add sale` button sizes to content with a min-width, the customer column wraps rather than clipping matras, and the entry row's 56px height still clears Gujarati ascenders and descenders at line-height 1.6
- [ ] Digits stay Latin `0–9` in Gujarati mode; only the words translate
- [ ] Mobile layout defined below 768px: the entry row becomes a pinned two-line block (not a card, not a modal), `COLLECTED TODAY` is promoted to the first KPI, rows become cards, and the details expander becomes a bottom sheet
- [ ] `inputmode` declared on amount (decimal), phone (numeric) and litres (decimal) so the right keypad appears without a tap
- [ ] Icons drawn from the §17 map: `Droplet`, `Wallet`, `Package`, `Plus`, `Pencil`, `Ban`, `Search`, `SlidersHorizontal`, `Download`, `MoreHorizontal`
- [ ] With `prefers-reduced-motion`, the success flash and the band expansion fall back to instant
