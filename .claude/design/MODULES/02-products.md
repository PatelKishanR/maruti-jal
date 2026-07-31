# Module 02 — Products · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/02-products.md](../../MODULES/02-products.md)
>
> Follows the list / detail / form pattern established in [01-staff.md](01-staff.md). Where this file is silent, Staff wins. Two things are genuinely new here: the **movement summary** on the detail page, and the **inline-editable lookup manager** used for tags and filter types.

---

## 1. Design context (for Stitch)

**Product:** Maruti Jal — internal admin tool for a mineral water plant in Gujarat, India. One user: the owner. Dense, fast, numeric. This module is the catalogue: every container the plant sells, and what it normally costs.

**Colour — light / dark**

| Token | Light | Dark | Use |
|---|---|---|---|
| Primary (Nova Blue) | `#2563EB` | `#3B82F6` | Primary buttons, links, active nav, focus ring |
| Surface (card) | `#FFFFFF` | `#1E293B` | Cards, table container |
| Surface subtle | `#F3F4F6` | `#0F172A` | Table header, summary band, row hover |
| Page background | `#F8FAFC` | `#0B1220` | Behind cards |
| Text primary | `#111827` | `#F1F5F9` | Values, headings |
| Text secondary | `#4B5563` | `#94A3B8` | Labels, captions, helper text |
| Border | `#E5E7EB` | `#334155` | Card borders, table rules |
| Input border | `#D1D5DB` | `#334155` | Field outlines |
| Success | `#22C55E` | same | Active, returnable, positive trend |
| Warning | `#F97316` | same | Discounting, attention, price drift |
| Danger | `#EF4444` | same | Destructive, negative trend |

**Type** — Inter everywhere; **JetBrains Mono** (`tabular-nums`) for every figure; **Noto Sans Gujarati** in the fallback stack, because product titles are routinely typed as `૨૦ લિટર જાર`.

| Role | Spec | Role | Spec |
|---|---|---|---|
| H2 page title | 28px / 1.3 / 600 | Body SM | 14px / 1.5 / 400 — table cells, labels |
| H3 card heading | 22px / 1.4 / 600 | Caption | 12px / 1.4 / 500 — metadata, badges, column headers |
| H4 section / modal | 18px / 1.4 / 600 | Table amount | 14px mono 500 right |
| Body | 16px / 1.6 / 400 | Emphasised amount | 14px mono **600** right `#111827` |
| KPI value | 28px mono 700 | Detail summary figure | 20px mono 600 |

**Spacing:** 4 · 8 · 12 · 16 · 24 · 32 only. **Radius:** input 4px · button/chip 8px · badge full · card 12px · modal 12px · dropdown 8px. **Shadow:** cards `0 1px 2px rgba(0,0,0,0.05)`; modals `0 20px 25px rgba(0,0,0,0.15)`. Cards never lift on hover.

**Table metrics — exact.** Header **44px** sticky, `#F3F4F6`, Caption 12px 600 UPPERCASE `0.04em` `#4B5563`. Body row **48px**, 1px `#E5E7EB` bottom border, Body SM. Cell padding 12px vertical / 16px horizontal. Row hover `#F3F4F6` 100ms, whole row navigates. No zebra striping. Text left · numbers and money **right** · badges and actions centre. Actions column 56px. Toolbar 56px, quick chips 44px, footer 56px.

**Badges** — 22px tall, 8px horizontal padding, full radius, Caption 12px 500, optional 12px leading icon at 4px gap.

| Variant | Light bg / text | Dark bg / text |
|---|---|---|
| Default | `#E5E7EB` / `#374151` | `#334155` / `#E2E8F0` |
| Primary | `#DBEAFE` / `#1D4ED8` | `#1E3A8A` / `#BFDBFE` |
| Success | `#DCFCE7` / `#15803D` | `#14532D` / `#BBF7D0` |
| Warning | `#FEF3C7` / `#B45309` | `#7C2D12` / `#FED7AA` |
| Danger | `#FEE2E2` / `#B91C1C` | `#7F1D1D` / `#FECACA` |

**Formats:** money `₹` + lakh grouping + 2 decimals → `₹12,34,567.00`; zero → `—` in `#D1D5DB`. **Litres up to 3 decimals with trailing zeros trimmed** → `20L`, `0.5L`, `0.375L` — this module is the one that exercises that rule. Quantities grouped, no decimals. Percentages 1 decimal, signed with an arrow → `▼ 8.6%`. Dates `14 Aug 2026`. Digits always Latin `0–9`, in both languages.

**Icons:** Lucide, 1.5px stroke, 16px dense / 20px inline / 24px standalone. Product `Package` · Delivery order `ClipboardList` · Party order `PartyPopper` · Direct sale `Droplet` · Add `Plus` · Edit `Pencil` · Search `Search` · Filter `SlidersHorizontal` · Export `Download` · More `MoreHorizontal` · Settings `Settings` · Return `RotateCcw` · Non-returnable `PackageX`.

**The five principles:** ① Density over whitespace. ② Numbers are the interface. ③ Status scannable without reading. ④ Every number is a door. ⑤ Entry speed is a feature.

**Module-specific rule that shapes every screen:** *a price change never rewrites history.* Every order line snapshots the product's title, litres, tag, filter type, base price and returnable flag at the moment the order was created. The UI must say this out loud on the edit form, so the owner raises prices without fear.

---

## 2. Screens in this module

| Screen | Route | Archetype | Purpose |
|---|---|---|---|
| Product list | `/products` | **A — List** | See the whole catalogue and what each item costs |
| Product detail | `/products/[id]` | **B — Detail** | One product's specs plus how much of it actually moves |
| Add product | `/products/new` | **C — Form** | Define a new container to sell |
| Edit product | `/products/[id]/edit` | **C — Form** | Change a price or spec, or deactivate |
| Manage tags | `/products/tags` | **A — List** (inline-editable) | Add "Chilled" without a developer |
| Manage filter types | `/products/filter-types` | **A — List** (inline-editable) | Same shape, different lookup |

---

## 3. Product list — `/products`

### 3.1 Purpose

The owner reviews the catalogue and confirms, in one glance, what is on sale and at what price.

### 3.2 Layout

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Products                                        [⚙ Tags]  [⚙ Filter types]  [+ Add product]   │
│  What you sell, and what it normally costs                                                     │
│                                                                                                │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐ ┌──────────────────┐               │
│  │ ▪ TOTAL PRODUCTS│ │ ✓ ACTIVE       │ │ ▲ TOP BY VOLUME  │ │ 💰 TOP BY REVENUE│               │
│  │                 │ │                │ │                  │ │                  │               │
│  │ 9               │ │ 7              │ │ 20L Jar          │ │ 20L Jar          │               │
│  │ 2 deactivated   │ │ 78% of catalog │ │ 8,420 units · Aug│ │ ₹2,94,700 · Aug  │               │
│  └────────────────┘ └────────────────┘ └──────────────────┘ └──────────────────┘               │
│                                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ [🔍 Search product title or description…      ]        [⚙ Filters (1)]   [⚙ Columns]     │  │ 56
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ ● All   ● Active   ● Cold   ● Returnable   ● Non-returnable   ● Inactive     Clear all   │  │ 44
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ CODE       TITLE ↑              LITRES ↕   TAG      FILTER TYPE   BASE PRICE ↕  RET.  STATUS ⋯│  │ 44
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ PRD-000001 20L Jar                   20L   Normal   Double Filtered   ₹35.00   ↩ Yes  🟢Active ⋯│  │ 48
│  │ PRD-000002 20L Jar (Cold)            20L   Cold     Double Filtered   ₹45.00   ↩ Yes  🟢Active ⋯│  │ 48
│  │ PRD-000003 ૨૦ લિટર જાર                20L   Normal   Filtered          ₹35.00   ↩ Yes  🟢Active ⋯│  │ 48
│  │ PRD-000004 5L Can                     5L   Normal   Filtered          ₹25.00   ↩ Yes  🟢Active ⋯│  │ 48
│  │ PRD-000005 1L Bottle                  1L   Normal   Filtered          ₹10.00   ✕ No   🟢Active ⋯│  │ 48
│  │ PRD-000006 500ml Cold Bottle        0.5L   Cold     Double Filtered   ₹12.00   ✕ No   🟢Active ⋯│  │ 48
│  │ PRD-000008 300ml Pouch            0.300L   Normal   Normal             ₹5.00   ✕ No   ⬚Inactive⋯│  │ 48
│  ├──────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │ Showing 1–9 of 9                    [25 ▾]                                    ‹  1  ›    │  │ 56
│  └──────────────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Region-by-region spec

**Page header**

| Element | Spec | Content |
|---|---|---|
| Title | H2 28px/1.3 600 `#111827` | `Products` |
| Subtitle | Body SM `#4B5563` | `What you sell, and what it normally costs` |
| Secondary actions | Two 40px outlined buttons, 1px `#2563EB`, `#2563EB` text, `Settings` 16px icon, 8px gap | `Tags` · `Filter types` |
| Primary | 40px `#2563EB` fill, white text, `Plus` 16px | `Add product` |
| Overflow | On `lg` and below, `Tags` and `Filter types` collapse into a `⋯` menu, leaving only the primary visible | — |

**KPI strip** — 4 across on `xl`, 2 on `md`, 1 below; 24px gap; equal heights; 20px padding; 12px radius; 1px border; whole card clickable.

| Card | Icon | Label | Value | Breakdown | Deep link |
|---|---|---|---|---|---|
| 1 | `Package` | `TOTAL PRODUCTS` | `9` — 28px mono 700 | `2 deactivated` | `/products?status=all` |
| 2 | `CheckCircle2` | `ACTIVE` | `7` | `78% of catalogue` | `/products?status=active` |
| 3 | `TrendingUp` | `TOP BY VOLUME` | `20L Jar` — **18px Inter 600, not mono**, because this value is a name | `8,420 units · August` | `/products/[id]` |
| 4 | `Wallet` | `TOP BY REVENUE` | `20L Jar` — 18px Inter 600 | `₹2,94,700 · August` | `/products/[id]` |

> Cards 3 and 4 break the 28px-mono rule deliberately: the value is a product title, which may be long and may be Gujarati. 18px Inter 600 wraps to two lines with `line-height: 1.4`; the mono treatment moves to the breakdown figure, which is the number that matters. No alert variant exists in this module — a catalogue has no problem state.

**Toolbar**

| Element | Spec | Content |
|---|---|---|
| Search | 40px, up to 400px wide, `Search` 16px left, 300ms debounce | Placeholder `Search product title or description…` |
| Filters | 40px secondary, `SlidersHorizontal` 16px, count when active | `Filters` → `Filters (1)` |
| Columns | 40px ghost icon, `Settings` 16px, 44×44 hit area | Tooltip `Choose columns` |

**Filter popover** — 320px, 16px padding, radius 8px, `shadow-lg`.

| Filter | Control | Options |
|---|---|---|
| Tag | Checkbox list, driven by the lookup table so new values appear automatically | `Normal` · `Cold` (+ whatever the owner has added) |
| Filter type | Checkbox list | `Normal` · `Filtered` · `Double Filtered` |
| Status | 3-segment | `Active` (default) · `Inactive` · `All` |
| Returnable | 3-segment | `Any` (default) · `Returnable` · `Non-returnable` |
| Footer | 1px top border | `[Reset]` · `[Apply filters]` |

**Quick chips:** `All` · `Active` · `Cold` · `Returnable` · `Non-returnable` · `Inactive` · `Clear all`.

**Table columns**

| # | Header | Width | Align | Sort | Cell spec |
|---|---|---|---|---|---|
| 1 | `CODE` | 112px | left | no | `PRD-000001` mono 13px 500 `#2563EB` |
| 2 | `TITLE` | flex, min 220px | left | ✅ default ↑ | Body SM 500 `#111827`, ICU-collated so `૨૦ લિટર જાર` interleaves with Latin titles. Description, when present, on a second line in Caption `#4B5563`, ellipsised |
| 3 | `LITRES` | 104px | **right** | ✅ | 14px mono 500. Trailing zeros trimmed: `20L`, `5L`, `0.5L`, `0.300L` |
| 4 | `TAG` | 120px | left | no | Default badge carrying the lookup's **label as stored** — so a renamed `Chilled` shows as `Chilled` everywhere with no code change |
| 5 | `FILTER TYPE` | 160px | left | no | Body SM `#4B5563`. `Double Filtered` must not truncate at this width in Gujarati — the column wraps to two lines in the header, never in the cell |
| 6 | `BASE PRICE` | 140px | **right** | ✅ | Emphasised money: 14px mono **600** `#111827`. `₹0.00` is a legal price and renders as `Free` in Caption `#4B5563` rather than as an em dash — zero here is meaningful, not missing |
| 7 | `RET.` | 96px | centre | no | Returnable → 16px `RotateCcw` `#15803D` + `Yes` Caption. Non-returnable → 16px `PackageX` `#9CA3AF` + `No` Caption. Icon **and** word, never colour alone |
| 8 | `STATUS` | 120px | left | no | `Active` Success · `Inactive` Default |
| 9 | actions | 56px | centre | no | `MoreHorizontal` 16px in a 44×44 target, always visible |

Inactive rows: title and description drop to `#6B7280`; the row is otherwise fully legible and clickable. No opacity dimming — a deactivated product is history, not a mistake.

**Row actions menu:** `View` (`Eye`) · `Edit` (`Pencil`) · `Duplicate` (`Copy`) · divider · `Deactivate` (`Ban`, `#B91C1C`) or `Reactivate` (`CheckCircle2`, `#15803D`).

**Pagination:** `Showing 1–9 of 9` Caption `#4B5563` left; page size `10 / 25 / 50 / 100` and `‹ 1 ›` right.

### 3.4 Content and copy

| Slot | English | Gujarati |
|---|---|---|
| Title / subtitle | `Products` / `What you sell, and what it normally costs` | `પ્રોડક્ટ્સ` / `તમે શું વેચો છો અને તેની સામાન્ય કિંમત શું છે` |
| Buttons | `Tags` · `Filter types` · `Add product` | `ટૅગ્સ` · `ફિલ્ટર પ્રકાર` · `પ્રોડક્ટ ઉમેરો` |
| Search placeholder | `Search product title or description…` | `પ્રોડક્ટનું નામ કે વર્ણન શોધો…` |
| KPI labels | `TOTAL PRODUCTS` · `ACTIVE` · `TOP BY VOLUME` · `TOP BY REVENUE` | `કુલ પ્રોડક્ટ્સ` · `સક્રિય` · `સૌથી વધુ જથ્થો` · `સૌથી વધુ આવક` |
| Columns | `CODE` `TITLE` `LITRES` `TAG` `FILTER TYPE` `BASE PRICE` `RET.` `STATUS` | `કોડ` `નામ` `લિટર` `ટૅગ` `ફિલ્ટર પ્રકાર` `કિંમત` `પરત` `સ્થિતિ` |
| Chips | `All` `Active` `Cold` `Returnable` `Non-returnable` `Inactive` | `બધા` `સક્રિય` `ઠંડું` `પરત થાય` `પરત ન થાય` `નિષ્ક્રિય` |
| Empty — no data | `No products yet` / `Add what you sell — a 20-litre jar, a 1-litre bottle — and orders can be raised against it. You can change prices later without touching past orders.` / `Add your first product` | `હજી કોઈ પ્રોડક્ટ નથી` |
| Empty — no results | `No products match your filters` / `Nothing matches "chilled" with Tag: Cold and Status: Inactive.` / `Clear filters` | `તમારા ફિલ્ટર સાથે કોઈ પ્રોડક્ટ મળી નહીં` |
| Error | `Couldn't load products` / `The server didn't respond. Check your connection and try again.` / `Try again` | `પ્રોડક્ટ્સ લોડ થઈ શકી નહીં` |
| Partial error | `Volume and revenue figures may be out of date. The last refresh was at 6:05 pm.` | — |
| Deactivate toast | `20L Jar (Cold) deactivated` + `Undo` | — |

### 3.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens cold | KPI labels visible with shimmer bars at the value position; toolbar and chips render normally; 8 skeleton rows, bars at 60% / 40% / 80% width, 1.5s shimmer | — |
| Loading (refilter) | Chip, search, sort or page change | Existing rows stay at 60% opacity, `pointer-events: none`, 2px indeterminate Nova Blue bar under the 44px header. Never a skeleton over loaded data | — |
| Empty — no data | Zero products exist | 320px centred block: 48px `Package` `#D1D5DB`, H4, Body SM (max 460px), primary CTA. KPI cards show `0` and `—` in `#9CA3AF` | `No products yet` / `Add what you sell — a 20-litre jar, a 1-litre bottle — and orders can be raised against it. You can change prices later without touching past orders.` / `Add your first product` |
| Empty — no results | Filters exclude everything | 320px block: 48px `SearchX` `#D1D5DB`, H4, a line naming the live filters verbatim, secondary `Clear filters`. Toolbar and chips stay active | `No products match your filters` / `Nothing matches "chilled" with Tag: Cold and Status: Inactive.` |
| Filled | Rows returned | As wireframe | — |
| Error | Fetch failed | 320px block: 48px `AlertTriangle` `#EF4444`, H4, plain-language cause, primary `Try again`. KPI cards show `—` with a `Retry` link | `Couldn't load products` / `The server didn't respond. Check your connection and try again.` |
| Partial error | Catalogue loads, movement aggregates fail | Table renders in full; KPI cards 3 and 4 show `—` with `Retry`; a Danger banner sits above the table | `Volume and revenue figures may be out of date. The last refresh was at 6:05 pm.` |
| Submitting | Deactivate confirmed | That row dims to 60%; its `⋯` becomes a 16px spinner; the rest of the table stays live | — |
| Success | Deactivated | Status badge swaps to `Inactive`; if the `Active` chip is on the row leaves without animation; toast bottom-right, 4s | `20L Jar (Cold) deactivated` + `Undo` (8s) |
| Disabled | A row for a product already used on orders | Nothing is disabled. `Deactivate` is always available — **deactivation is never blocked in this module**, unlike Staff, because a deactivated product breaks nothing: old orders read from their snapshot | — |
| Read-only | Not applicable | — | — |

### 3.6 Interactions

| Interaction | Behaviour |
|---|---|
| Row hover / click | `#F3F4F6` at 100ms; whole row navigates to `/products/[id]`; the actions cell stops propagation |
| Keyboard | Rows focusable; `Enter` opens; `↑`/`↓` move between rows; focus ring 2px `#2563EB` at 2px offset |
| Search | 300ms debounce, resets to page 1, `Escape` clears. **Script-literal** — a product stored as `૨૦ લિટર જાર` is not found by typing `20L`. The empty-no-results copy therefore quotes the exact query back |
| Sort | none → asc → desc → none, one column at a time. `TITLE` sorts by ICU collation; `LITRES` sorts numerically, so `0.5L` sits below `5L`, not beside it as a string sort would put it |
| Filters | Popover; `Apply filters` closes and refilters; applied filters become removable chips beneath the toolbar |
| Quick chips | Instant toggle, URL query updated so the view is shareable and back-safe |
| `Tags` / `Filter types` | Navigate to the lookup managers (§7) |
| `Duplicate` | Opens `/products/new` pre-filled from that row, with the title suffixed ` (copy)` and selected, so typing replaces it |
| Tab order | Sidebar → topbar → `Tags` → `Filter types` → `Add product` → 4 KPI cards → search → Filters → Columns → chips → rows → page size → pagination |

### 3.7 Responsive (below `md`)

- Sidebar off-canvas behind a `Menu` button. Content padding 16px.
- Header stacks; `Add product` becomes full-width primary; `Tags` and `Filter types` move into the `⋯` menu.
- KPI cards 1 per row. Cards 3 and 4 keep the title at 18px and put the figure beneath it.
- Search full width; `Filters` full width opening a bottom sheet.
- Chips scroll horizontally with no wrap.
- **Rows become cards** — 16px padding, 12px radius, 1px border, 12px gap:

```
┌─────────────────────────────────────────┐
│ PRD-000002                    🟢 Active │
│ 20L Jar (Cold)                          │
│ 20L · Cold · Double Filtered            │
│ ↩ Returnable            ₹45.00          │
└─────────────────────────────────────────┘
```

Line 1: code left (mono 13px `#2563EB`), status right. Line 2: title 16px 500 `#111827`, wraps to two lines. Line 3: specs as one `·`-separated Caption line in `#4B5563`. Line 4: returnable marker left, base price right in 16px mono 600. The `⋯` sits bottom-right at 44×44.

### 3.8 Dark mode

Page `#0B1220`; card and table `#1E293B` with 1px `#334155`; header row `#0F172A`; row hover `#243347`. Text `#F1F5F9` / `#94A3B8`. Codes, sorted arrows and focus rings `#3B82F6`. Tag badge Default-dark `#334155` / `#E2E8F0`. Returnable icon `#4ADE80`; non-returnable `#64748B`. Skeleton bars `#334155`.

### 3.9 Stitch prompt

```text
Design a desktop catalogue list screen called "Products" for an internal Indian
water-plant admin tool. Inter for text, JetBrains Mono for all numbers. Light theme:
page #F8FAFC, white cards, 1px #E5E7EB borders, text #111827, muted #4B5563, accent
#2563EB. Keep a 240px left sidebar (Dashboard; OPERATIONS: Delivery Orders, Coin
Issues, Party Orders, Direct Sales; MASTERS: Staff, Products — active, Coin Types,
Expense Categories; MONEY; INSIGHTS) and a 64px sticky topbar with a search field,
an "EN | ગુ" toggle, a theme toggle and an avatar.

Content, 24px padding: title "Products" at 28px semibold with the 14px grey subtitle
"What you sell, and what it normally costs"; right-aligned two outlined buttons
"Tags" and "Filter types" plus a filled blue "+ Add product".

Four KPI cards, 24px gap, 20px padding, 12px radius: TOTAL PRODUCTS 9 "2
deactivated"; ACTIVE 7 "78% of catalogue"; TOP BY VOLUME "20L Jar" with "8,420
units · August"; TOP BY REVENUE "20L Jar" with "₹2,94,700 · August". The first two
values are 28px monospace bold; the last two are 18px semibold Inter.

Then a table card: 56px toolbar with a search field placeholder "Search product
title or description…", a "Filters (1)" button and a gear icon button; a 44px row of
pills — All, Active, Cold, Returnable, Non-returnable, Inactive; a 44px sticky
header in #F3F4F6 with 12px uppercase letter-spaced labels CODE, TITLE, LITRES, TAG,
FILTER TYPE, BASE PRICE, RET., STATUS; then 48px rows with 1px dividers and no zebra
stripes:

PRD-000001 | 20L Jar | 20L | grey pill "Normal" | Double Filtered | ₹35.00 | ↩ Yes |
green pill "Active". PRD-000002 | 20L Jar (Cold) | 20L | "Cold" | Double Filtered |
₹45.00 | ↩ Yes | Active. PRD-000003 | ૨૦ લિટર જાર | 20L | Normal | Filtered | ₹35.00 |
↩ Yes | Active. PRD-000005 | 1L Bottle | 1L | Normal | Filtered | ₹10.00 | ✕ No |
Active. PRD-000006 | 500ml Cold Bottle | 0.5L | Cold | Double Filtered | ₹12.00 |
✕ No | Active. PRD-000008 | 300ml Pouch | 0.300L | Normal | Normal | ₹5.00 | ✕ No |
grey pill "Inactive".

Codes are monospace blue; litres and prices are right-aligned monospace, prices with
₹ and two decimals. Footer: "Showing 1–9 of 9" left, page-size selector and
pagination right. Dense and utilitarian.
```

---

## 4. Product detail — `/products/[id]`

### 4.1 Purpose

Confirm a product's specs and current price, then see what it actually does in the field — how much moves, through which channel, and how far the real selling price has drifted below the base price.

### 4.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ‹ Products                                                                              │
│  20L Jar                                     🟢 Active    ↩ Returnable                   │
│  PRD-000001 · 20L · Normal · Double Filtered · Added 4 Jan 2025                          │
│                                                     [✎ Edit]  [ ⋯ ]                      │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  BASE PRICE          AVG REALISED        UNITS THIS MONTH     UNITS LIFETIME       │  │
│  │  ₹35.00              ₹32.18              8,420                1,42,860             │  │
│  │  set 12 Jun 2026     ▼ 8.1% below base   ▲ 6.2% vs July       since 4 Jan 2025     │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  ┌── Specification ──────────────────┐  ┌── Movement by channel · August 2026 ────────┐  │
│  │  Title       20L Jar              │  │  CHANNEL        UNITS      REVENUE   AVG ₹ │  │
│  │  Litres      20L                  │  │  Delivery       7,240   ₹2,32,900   ₹32.17 │  │
│  │  Tag         Normal               │  │  Party            860     ₹27,520   ₹32.00 │  │
│  │  Filter      Double Filtered      │  │  Walk-in          320     ₹11,200   ₹35.00 │  │
│  │  Returnable  Yes                  │  │  ─────────────────────────────────────────  │  │
│  │  Sort order  1                    │  │  Total          8,420   ₹2,71,620   ₹32.26 │  │
│  │  Description Standard blue jar,   │  │                                            │  │
│  │              double filtered      │  │  [ View in Reports › ]                     │  │
│  └───────────────────────────────────┘  └────────────────────────────────────────────┘  │
│                                                                                          │
│  ┌── Price history ────────────────────────────────────────────────────────────────────┐│
│  │ ● 12 Jun 2026 · 10:22        ₹32.00 → ₹35.00     Admin                              ││
│  │ ○ 4 Jan 2025 · 9:00          Set at ₹32.00       Admin                              ││
│  └─────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Region-by-region spec

**Header**

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB`, `ChevronLeft` 16px, 44px hit height | `‹ Products` |
| Title | H2 28px/1.3 600 `#111827`, sans not mono, wraps to two lines for a long or Gujarati title | `20L Jar` / `૨૦ લિટર જાર` |
| Badges | 12px gap after the title, 4px between: `Active` Success (or `Inactive` Default) and `Returnable` Primary with a `RotateCcw` 12px icon (or `Non-returnable` Default with `PackageX`) | — |
| Meta line | Body SM `#4B5563`, `·` separated, code in mono 13px | `PRD-000001 · 20L · Normal · Double Filtered · Added 4 Jan 2025` |
| Actions | `[Edit]` primary (`Pencil`) · `[⋯]` ghost icon | — |
| `⋯` menu | `Duplicate` (`Copy`) · `Export movement (CSV)` (`Download`) · divider · `Deactivate` (`Ban`, `#B91C1C`) | — |

**Summary card** — subtle `#F3F4F6` background, 12px radius, 1px border, 24px padding, 4 columns on `lg` with 1px vertical rules, 2 on `md`, 1 below.

| Column | Label | Value | Context line |
|---|---|---|---|
| 1 | `BASE PRICE` | `₹35.00` — 20px mono 600 `#111827` (the critical figure) | `set 12 Jun 2026` |
| 2 | `AVG REALISED` | `₹32.18` — 20px mono 600 `#374151` | `▼ 8.1% below base` with `TrendingDown` 12px in `#B45309` — **Warning, not Danger.** Discounting is attention, not failure |
| 3 | `UNITS THIS MONTH` | `8,420` — 20px mono 600 `#374151`, grouped, no decimals | `▲ 6.2% vs July` with `TrendingUp` 12px `#15803D` |
| 4 | `UNITS LIFETIME` | `1,42,860` — 20px mono 600 `#374151` | `since 4 Jan 2025` |

Each value is a door: 2 → Reports filtered to price overrides on this product · 3 → Reports, this product, this month · 4 → Reports, this product, all time. Hover underlines the value in `#2563EB`.

**Specification card** — 24px padding, 12px radius, 1px border. Label column fixed 120px, Body SM 500 `#4B5563`; value column Body 16px/1.6 `#111827`. 12px row gap. The `Description` value wraps to as many lines as needed and preserves line breaks — never truncated on a detail page. Absent description → `—` in `#D1D5DB`.

**Movement table** — a plain table inside a card, not the standard list container: header 44px `#F3F4F6`, rows 48px, three data rows plus a total row.

| Element | Spec |
|---|---|
| Channel cell | Body SM `#111827` with a 16px leading icon: Delivery `ClipboardList`, Party `PartyPopper`, Walk-in `Droplet`, all `#4B5563` |
| Units | 14px mono 500, right |
| Revenue | 14px mono 500, right, `₹` and 2 decimals — abbreviated only in KPI cards, never here |
| Avg ₹ | 14px mono 500, right. When a channel's average is more than 5% below base, the cell text turns `#B45309` and gains a `TrendingDown` 12px icon |
| Total row | 1px `#E5E7EB` top border, 48px, no bottom border, all figures 14px mono **600** `#111827`, label `Total` in Body SM 600 |
| Footer link | `View in Reports ›` — Body SM `#2563EB`, 16px above, left-aligned |
| Zero channel | A channel with no movement still renders its row, with `—` in `#D1D5DB` across all three figures. **Omitting the row would hide the fact that walk-ins never buy this** |

**Price history** — the §9 timeline, newest first, inside a card. 8px dot (`#2563EB` filled for the most recent, `#D1D5DB` hollow for older), 1px `#E5E7EB` connector. Each entry: timestamp Caption `#4B5563`, the change as `₹32.00 → ₹35.00` in 16px mono with the old value `#6B7280` and the new value 600 `#111827`, an `ArrowRight` 14px `#9CA3AF` between them, and the actor in Caption `#4B5563` right-aligned. A price **rise** shows a `TrendingUp` 14px `#15803D`; a **cut** shows `TrendingDown` `#B45309`.

### 4.4 Content and copy

| Slot | Copy |
|---|---|
| Back link | `‹ Products` |
| Actions | `Edit` · `Duplicate` · `Export movement (CSV)` · `Deactivate` / `Reactivate` |
| Summary labels | `BASE PRICE` · `AVG REALISED` · `UNITS THIS MONTH` · `UNITS LIFETIME` |
| Summary context | `set 12 Jun 2026` · `▼ 8.1% below base` · `▲ 6.2% vs July` · `since 4 Jan 2025` |
| Card headings | `Specification` · `Movement by channel · August 2026` · `Price history` |
| Spec labels | `Title` · `Litres` · `Tag` · `Filter` · `Returnable` · `Sort order` · `Description` |
| Returnable values | `Yes — containers must come back` / `No — sold outright, never tracked for return` |
| Movement headers | `CHANNEL` · `UNITS` · `REVENUE` · `AVG ₹` |
| Movement rows | `Delivery` · `Party` · `Walk-in` · `Total` |
| Movement link | `View in Reports ›` |
| Movement empty | `Nothing sold yet` / `Once this product appears on an order, its volume and revenue show up here.` |
| Movement no-data-this-month | `No movement in August 2026` / `This product last sold on 28 Jul 2026.` with a `View lifetime ›` link |
| Price history single entry | `Price hasn't changed since this product was added.` |
| Inactive banner | `This product is deactivated. It won't appear on new order forms. Every past order that used it still shows exactly as it was sold.` — Default tint, `Info` 20px icon, `Reactivate` link on the right |
| Not found | `That product doesn't exist` / `It may have been removed. Go back to the catalogue to find what you're looking for.` / `Back to products` |
| Error | `Couldn't load this product` / `The server didn't respond. Check your connection and try again.` / `Try again` |

### 4.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens | Back link renders immediately; title becomes a 200×28px shimmer; badges become two 90×22px shimmer pills; the summary card shows four shimmer bars with labels already legible; the spec card shows seven label/value shimmer rows; the movement table shows a real header with 4 skeleton rows | — |
| Loading (month change) | Month selector changed on the movement card | Only that card dims to 60% with a 2px Nova Blue bar under its heading. The rest of the page stays live | — |
| Empty — never sold | Product exists, no order lines | Movement card body replaced by a 200px centred block: 48px `Package` `#D1D5DB`, H4, Body SM. Summary columns 2–4 show `—` in `#9CA3AF` with the context line `no sales yet` | `Nothing sold yet` / `Once this product appears on an order, its volume and revenue show up here.` |
| Empty — nothing this month | Sold before, not this month | Movement card shows the same block with a `Calendar` icon and a `View lifetime ›` link — **a different message from "never sold"**; one means new, the other means stalled | `No movement in August 2026` / `This product last sold on 28 Jul 2026.` |
| Empty — no price change | Only the original price | Price history renders a single hollow-dot entry plus a Caption line | `Price hasn't changed since this product was added.` |
| Filled | Everything present | As wireframe | — |
| Error | Fetch fails | 320px centred block below the back link: 48px `AlertTriangle` `#EF4444`, H4, reason, `Try again` | `Couldn't load this product` |
| Not found | Bad id | Same block with 48px `SearchX` and a `Back to products` primary | `That product doesn't exist` |
| Partial error | Specs load, aggregates fail | Header, badges and spec card render; the movement card alone shows an inline Danger row with `Retry`; the summary card's columns 2–4 show `—` | `Couldn't load movement figures.` + `Retry` |
| Read-only / inactive | `is_active = false` | Default-tinted banner under the header; the `Active` badge becomes `Inactive`; `Edit` stays enabled — an inactive product can still be corrected | see §4.4 |
| Submitting | Deactivate confirmed | `⋯` button becomes a spinner; the header badge area dims to 60% | — |
| Success | Deactivated | Badge swaps to `Inactive`, banner slides in over 200ms, toast | `20L Jar deactivated` + `Undo` (8s) |

### 4.6 Interactions

| Interaction | Behaviour |
|---|---|
| Summary figure | Hover underlines in `#2563EB`; click navigates to the matching Reports view with the product pre-filtered |
| Movement month | The card heading carries an inline month selector (`August 2026 ▾`) opening a 12-month list plus `Lifetime`. Changing it refetches only that card |
| Movement row | Click drills into Reports filtered to that product **and** channel |
| `Edit` | `/products/[id]/edit` |
| `Duplicate` | `/products/new` pre-filled, title suffixed ` (copy)` and pre-selected |
| `Export movement (CSV)` | Spinner in the menu item, label `Preparing…`, then an Info toast `Movement export for 20L Jar is ready` + `Download` |
| Keyboard | `E` opens Edit when focus is not in a field; `Escape` from any popover returns focus to its trigger |
| Tab order | Back link → Edit → `⋯` → 4 summary figures → spec card (static, skipped) → month selector → movement rows → `View in Reports` → price history entries |
| Focus | 2px `#2563EB` ring at 2px offset everywhere, including the summary figures and movement rows |

### 4.7 Responsive (below `md`)

- Header stacks: back link, title (two lines allowed), badges on their own line, meta line, then `Edit` full-width with `⋯` as a 44×44 button beside it.
- Summary card: 2×2 grid, 16px padding, vertical rules removed, values stay 20px mono 600.
- Specification and Movement cards stack full width, Specification first.
- The movement table **stays a table** — it is only four columns of numbers, and card-ifying it would destroy the column comparison that is its whole purpose. It scrolls horizontally inside its card with the `CHANNEL` column pinned left and a 12px fade on the right edge.
- Price history: timestamps move above the change line; dot column narrows to 20px.

### 4.8 Dark mode

Page `#0B1220`; cards `#1E293B` / 1px `#334155`; the summary card's inset background becomes `#0F172A`. Movement table header `#0F172A`. Trend colours lift for contrast: down-arrow context `#FDBA74`, up-arrow `#4ADE80`. Price-history connector `#334155`; the newest dot `#3B82F6`; old struck values `#64748B`. The inactive banner is `#1E293B` with a `#334155` border and `#94A3B8` text.

### 4.9 Stitch prompt

```text
Design a desktop product detail page for an internal Indian water-plant admin tool.
Inter for text, JetBrains Mono for all numbers. Light theme: page #F8FAFC, white
cards, 1px #E5E7EB borders, text #111827, muted #4B5563, accent #2563EB. Same 240px
sidebar and 64px topbar as the rest of the app.

Header: a blue back link "‹ Products"; the title "20L Jar" at 28px semibold with two
pills beside it — a green "Active" pill and a blue "Returnable" pill with a small
rotate icon; below it a 14px grey line "PRD-000001 · 20L · Normal · Double Filtered ·
Added 4 Jan 2025". Right-aligned: a filled blue "Edit" button and a three-dot icon
button.

Below, a full-width inset panel with #F3F4F6 background, 12px radius and 24px
padding, split into four columns by thin vertical rules. Each column: a 12px
uppercase grey label, a 20px monospace semibold value, and a 12px context line.
BASE PRICE ₹35.00 "set 12 Jun 2026"; AVG REALISED ₹32.18 "▼ 8.1% below base" in
amber; UNITS THIS MONTH 8,420 "▲ 6.2% vs July" in green; UNITS LIFETIME 1,42,860
"since 4 Jan 2025".

Then two white cards side by side with a 24px gap. Left card, "Specification", is a
label/value list with 120px labels: Title 20L Jar, Litres 20L, Tag Normal, Filter
Double Filtered, Returnable Yes, Sort order 1, Description "Standard blue jar,
double filtered".

Right card, heading "Movement by channel · August 2026", contains a small table with
a 44px #F3F4F6 header reading CHANNEL, UNITS, REVENUE, AVG ₹ and 48px rows:
Delivery 7,240 ₹2,32,900 ₹32.17; Party 860 ₹27,520 ₹32.00; Walk-in 320 ₹11,200
₹35.00; then a total row above a 1px rule reading Total 8,420 ₹2,71,620 ₹32.26 in
semibold. All figures right-aligned monospace. A blue "View in Reports ›" link sits
below.

At the bottom, a full-width "Price history" card showing a vertical timeline: a
filled blue dot with "12 Jun 2026 · 10:22    ₹32.00 → ₹35.00    Admin" and a hollow
grey dot with "4 Jan 2025 · 9:00    Set at ₹32.00    Admin".
```

---

## 5. Add product — `/products/new`

### 5.1 Purpose

Define a new container to sell, with the price that every future order will start from.

### 5.2 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ‹ Products                                                                │
│  Add product                                                               │
│  Define what you sell and the price orders start from                      │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Title *                                                             │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ 20L Jar                                                        │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │  English or ગુજરાતી — this is what staff see in the order form        │  │
│  │                                                                      │  │
│  │  Litres *              Base price *                                  │  │
│  │  ┌──────────────┐      ┌──────────────────┐                          │  │
│  │  │       20.000 │      │ ₹         35.00  │                          │  │
│  │  └──────────────┘      └──────────────────┘                          │  │
│  │  Up to 3 decimals      Staff can bargain below this on an order      │  │
│  │                                                                      │  │
│  │  Tag *                          Filter type *                        │  │
│  │  ┌──────────────────────────┐   ┌──────────────────────────────────┐ │  │
│  │  │ Normal                 ▾ │   │ Double Filtered                ▾ │ │  │
│  │  └──────────────────────────┘   └──────────────────────────────────┘ │  │
│  │                                                                      │  │
│  │  Description                                                         │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ e.g. Standard blue jar, double filtered                        │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │  ──────────────────────────────────────────────────────────────────  │  │
│  │  Handling                                                            │  │
│  │  ┌────┐                                                              │  │
│  │  │●───│  Returnable                                                  │  │
│  │  └────┘  Containers must come back — this product is counted in      │  │
│  │          jar-return tracking. Turn off for sealed bottles that are    │  │
│  │          sold outright.                                              │  │
│  │                                                                      │  │
│  │  Sort order                                                          │  │
│  │  ┌──────────┐                                                        │  │
│  │  │       1  │   Lower numbers appear first in the order form          │  │
│  │  └──────────┘                                                        │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                          [ Cancel ]  [ Save product ] │  │ sticky
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Card | 24px padding, **max 720px**, 12px radius, 1px `#E5E7EB`, `shadow-sm` | — |
| Field gap | 16px vertical; section gap 32px with an H4 heading and a 1px divider above it | — |
| Label | Body SM 14px 500 `#111827`, 6px above the field. Required marked with a `#2563EB` `*` | — |
| Helper | Caption 12px `#4B5563`, 4px below, **space always reserved** | — |
| Title input | **48px tall** — the primary field on this form. 1px `#D1D5DB`, 4px radius, 12px padding, Body SM `#111827`, no script restriction | `20L Jar` |
| Litres | **120px wide**, mono 14px, right-aligned, stepper arrows on hover, `inputmode="decimal"`, up to 3 decimals. Displays `20.000` while editing and `20L` once saved | — |
| Base price | **200px wide**, mono 14px, right-aligned, `₹` prefix inside the field in `#4B5563` at 12px inset. Accepts `35`, `35.00`, `1,250`; reformats with lakh grouping on blur | — |
| Litres / price row | Two columns, but sized to their content, not to 50% each. **A full-width box for a 3-digit quantity invites errors** | — |
| Tag select | Search select, 320px, keyboard navigable, 8 options visible before scrolling, each option showing its label. `+ Add new tag` pinned at the bottom in `#2563EB` | `Normal` / `Cold` |
| Filter select | Same, 320px | `Normal` / `Filtered` / `Double Filtered` |
| Description | Textarea, 3 rows, vertical resize only, line-height 1.6 | — |
| Handling section | 32px above, H4 `Handling`, 1px `#E5E7EB` divider under the heading | — |
| Returnable toggle | 44×24px track, `#2563EB` on / `#D1D5DB` off, 20px white knob, 200ms. **Defaults ON.** Label right in Body SM 500, helper below in Caption. Whole 44px row tappable | — |
| Sort order | **120px**, mono, right-aligned, integers, stepper arrows, defaults `100` | — |
| Footer | Sticky inside the card, 1px top border, 16px/24px padding, right-aligned, 8px gap | `[Cancel]` ghost · `[Save product]` primary |

### 5.4 Content and copy

| Slot | English | Gujarati |
|---|---|---|
| Title / subtitle | `Add product` / `Define what you sell and the price orders start from` | `પ્રોડક્ટ ઉમેરો` / `તમે શું વેચો છો અને ઓર્ડરમાં કઈ કિંમતથી શરૂઆત થાય તે નક્કી કરો` |
| Title field | `Title` / `e.g. 20L Jar` / `English or ગુજરાતી — this is what staff see in the order form` | `નામ` |
| Litres | `Litres` / `20.000` / `Up to 3 decimals — 0.500 for a pouch, 20.000 for a jar` | `લિટર` |
| Base price | `Base price` / `0.00` / `Staff can bargain below this on an order` | `મૂળ કિંમત` |
| Tag | `Tag` / `Select a tag` / `Not on the list? Add it — no developer needed` | `ટૅગ` |
| Filter type | `Filter type` / `Select a filter type` | `ફિલ્ટર પ્રકાર` |
| Description | `Description` / `e.g. Standard blue jar, double filtered` | `વર્ણન` |
| Handling heading | `Handling` | `હેન્ડલિંગ` |
| Returnable | `Returnable` / `Containers must come back — this product is counted in jar-return tracking. Turn off for sealed bottles that are sold outright.` | `પરત થાય તેવું` |
| Sort order | `Sort order` / `100` / `Lower numbers appear first in the order form` | `ક્રમ` |
| Buttons | `Cancel` · `Save product` · while saving `Saving…` | `રદ કરો` · `પ્રોડક્ટ સાચવો` |
| Success toast | `20L Jar added` | `20L Jar ઉમેરાયું` |

**Validation messages — literal strings**

| Field | Condition | Message |
|---|---|---|
| Title | empty | `Enter a product title` |
| Title | duplicate of an active product | `A product called "20L Jar" already exists (PRD-000001)` with `View` as an inline link. **A warning, not a block** — a plant may legitimately stock two similar jars |
| Litres | empty | `Enter how many litres this holds` |
| Litres | zero or negative | `Litres must be more than 0` |
| Litres | more than 3 decimals | `Litres can have at most 3 decimal places` |
| Base price | empty | `Enter a base price` |
| Base price | negative | `Base price can't be negative. Enter 0 if this product is free.` |
| Base price | non-numeric | `Enter an amount like 35 or 35.50` |
| Tag | not selected | `Choose a tag` |
| Filter type | not selected | `Choose a filter type` |
| Sort order | non-integer | `Sort order must be a whole number` |
| Form level | server rejects | `This product couldn't be saved` / `The tag "Chilled" was removed while you were typing. Choose another tag and try again.` |
| Form level | offline | `You're offline` / `Nothing was saved. Reconnect and press Save product again — your entries are still here.` |

**Inline `+ Add new tag`** — opens a 420px dialog: `Label` (autofocused, `e.g. Chilled`), helper `This is exactly what everyone will see — type it in Gujarati if you prefer`, `[Cancel]` · `[Add tag]`. On success the dialog closes, the new tag is selected in the parent field, and a 4s toast reads `Tag "Chilled" added`. Focus returns to the tag select.

### 5.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Form opens | Renders instantly. Only the two selects fetch: each shows a 16px spinner at its right edge and is disabled for that moment, with the placeholder reading `Loading…` | — |
| Empty (default) | Fresh form | All blank except: `Returnable` on, `Sort order` `100`, both selects showing their placeholder. Focus in `Title` | — |
| Filled | User typed | As wireframe | — |
| Field error | Blur on invalid touched field | 1px `#EF4444` border, background unchanged, 16px `AlertCircle` `#EF4444` inside right, message replacing the helper in Caption `#EF4444` with a 14px `AlertCircle` and 4px gap | see §5.4 |
| Warning | Duplicate title | 1px `#F97316` border, `AlertTriangle` inside right, Caption `#B45309` message with a `View` link. Submission still allowed | `A product called "20L Jar" already exists (PRD-000001)` |
| Form error | Server rejects | Danger banner above the footer: `#FEE2E2` bg, 1px `#EF4444`, 12px radius, 16px padding, 20px `AlertTriangle`, bold line then detail. Focus moves to it; announced by a live region | see §5.4 |
| Submitting | Valid submit | Primary shows a 16px spinner, label `Saving…`, both footer buttons disabled, form body at 60% opacity and non-interactive | `Saving…` |
| Success | Saved | Navigate to `/products/[id]`, 4s toast | `20L Jar added` |
| Error (offline) | Network fails | Form-level banner; form re-enables at full opacity with every value intact | see §5.4 |
| Lookup empty | The tags table has no active rows | The select's dropdown shows a 120px block: Caption `#4B5563` `No tags yet` and a prominent `+ Add new tag` row | `No tags yet — add the first one` |
| Disabled | Never. The primary stays enabled so pressing it reveals the errors | — | — |
| Dirty cancel | Cancel or back with changes | 420px confirm | `Discard this product?` / `"20L Jar" hasn't been saved. Everything you typed will be lost.` / `[Keep editing]` · `[Discard]` |

### 5.6 Interactions

| Interaction | Behaviour |
|---|---|
| Autofocus | `Title`, cursor at position 0 |
| Tab order | Title → Litres → Base price → Tag → Filter type → Description → Returnable toggle → Sort order → Cancel → Save product |
| `Enter` | Submits from any single-line field; inserts a newline in the textarea; `⌘/Ctrl + Enter` submits from anywhere |
| `Escape` | Cancel, with the discard confirm if dirty. Inside an open select it closes the select only |
| Validation timing | Never while typing. On blur if touched. On submit, all at once, then focus and scroll to the first error. Once in error, re-validates every keystroke so it clears the moment it's fixed |
| Litres formatting | Typing `20` shows `20`; on blur it becomes `20.000` in the field and will render as `20L` everywhere else. `.5` normalises to `0.500` |
| Price formatting | `1250` → `1,250.00` on blur; `35` → `35.00`; the `₹` prefix is never part of the editable value, so selecting all and retyping never has to fight it |
| Selects | Type to filter; `↓`/`↑` move; `Enter` selects; `Escape` closes; `+ Add new tag` is the last item and reachable by keyboard |
| Returnable toggle | `Space` toggles when focused. Switching it **off** expands the helper text to add a second line: `Sealed bottles are sold outright and never appear in jars-out figures.` — 200ms height transition |
| Stepper arrows | Appear on hover over Litres and Sort order; `↑`/`↓` also step when the field is focused; step 1 for sort order, 0.5 for litres |
| Success navigation | `/products/[id]` |

### 5.7 Responsive (below `md`)

- Content padding 16px; the card loses its border and radius and sits flush on the page background.
- The Litres / Base price row stacks; both keep their capped widths (120px and 200px) rather than stretching, because a wide box for a two-digit number is an error magnet even on mobile.
- The Tag / Filter type row stacks to full-width selects, each opening as a **bottom sheet** with a search field pinned at the top and 56px option rows.
- Inputs go to 48px tall.
- The footer becomes a fixed bottom bar: 72px, surface background, 1px top border, `Save product` 60% width right, `Cancel` 40% left, respecting `env(safe-area-inset-bottom)`.

### 5.8 Dark mode

Card `#1E293B` on `#0B1220`. Inputs `#0F172A` background, 1px `#334155`, text `#F1F5F9`, placeholder `#64748B`. The `₹` prefix is `#94A3B8`. Focus `#3B82F6` border with a 40%-opacity ring. Toggle off `#334155`, on `#3B82F6`. Select dropdown `#1E293B` with `#334155` borders and a `#243347` hover. Error border `#EF4444` with the message lifted to `#FCA5A5`; the form-level banner `#7F1D1D` / `#FECACA`.

### 5.9 Stitch prompt

```text
Design a desktop "Add product" form for an internal Indian water-plant admin tool.
Inter for text, JetBrains Mono for all numbers. Light theme: page #F8FAFC, white
card, 1px #E5E7EB borders, text #111827, muted #4B5563, accent #2563EB. Keep the
240px sidebar and 64px topbar; breadcrumb "Products / Add product".

Header: a blue back link "‹ Products", the title "Add product" at 28px semibold, and
a 14px grey subtitle "Define what you sell and the price orders start from".

One white card, max 720px wide, 24px padding, 12px radius, single column, 16px gaps.
Every field has a 14px medium label above and a 12px grey helper line below;
required labels carry a blue asterisk.

1. "Title *" — a 48px input containing "20L Jar", helper "English or ગુજરાતી — this
   is what staff see in the order form".
2. A row of two narrow fields, not stretched full width: "Litres *" — a 120px
   right-aligned monospace input showing "20.000", helper "Up to 3 decimals"; and
   "Base price *" — a 200px right-aligned monospace input with a grey ₹ prefix
   inside it showing "35.00", helper "Staff can bargain below this on an order".
3. A row of two 320px dropdowns: "Tag *" showing "Normal" and "Filter type *"
   showing "Double Filtered", each with a chevron.
4. "Description" — a three-row textarea with placeholder "e.g. Standard blue jar,
   double filtered".

Then a 32px gap, a 1px #E5E7EB divider and an 18px semibold section heading
"Handling", followed by a 44×24px toggle switched on in #2563EB with the label
"Returnable" to its right and a 12px grey two-line helper: "Containers must come
back — this product is counted in jar-return tracking. Turn off for sealed bottles
that are sold outright." Below it, "Sort order" — a 120px right-aligned monospace
input showing "1" with the helper "Lower numbers appear first in the order form".

Card footer: 1px top border, 16px vertical padding, right-aligned ghost "Cancel" and
filled blue "Save product". Show one field focused with a 2px blue border and a soft
offset ring. Compact and utilitarian.
```

---

## 6. Edit product — `/products/[id]/edit`

### 6.1 Purpose

Raise a price, fix a spec, or take a product off the order form — without the owner ever wondering whether an old invoice just changed.

### 6.2 Layout

Identical to §5.2, with four additions:

```
│  ‹ 20L Jar                                                                 │  ← back goes to the DETAIL page
│  Edit product                                                              │
│  PRD-000001 · Added 4 Jan 2025 · Used on 1,284 order lines                 │  ← meta line
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ ℹ  Changing this product never changes past orders. Every order      │  │  ← Primary-tinted info banner,
│  │    line keeps a copy of the title, litres, tag, filter type, price   │  │     always present, not dismissible
│  │    and returnable flag exactly as it was when the order was made.    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  … all fields from §5.2, pre-filled …                                      │
│                                                                            │
│  Base price *                                                              │
│  ┌──────────────────┐                                                      │
│  │ ₹         38.00  │   ⚠ Was ₹35.00 — a 8.6% rise                        │  ← live delta chip, Warning
│  └──────────────────┘                                                      │
│                                                                            │
│  ──────────────────────────────────────────────────────────────────────    │
│  Status                                                                    │
│  ┌────┐                                                                    │
│  │ ●──│  Active                                                            │
│  └────┘  Deactivated products leave new order forms. Past orders keep       │
│          showing them exactly as they were sold.                            │
│                                                                            │
│                                        [ Cancel ]   [ Save changes ]       │
```

### 6.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB` | `‹ 20L Jar` |
| Title | H2 | `Edit product` |
| Meta line | Body SM `#4B5563`, code in mono 13px, usage count in mono | `PRD-000001 · Added 4 Jan 2025 · Used on 1,284 order lines` |
| Snapshot banner | Primary tint `#DBEAFE`, 1px `#93C5FD`, 12px radius, 16px padding, 20px `Info` icon `#1D4ED8`, Body SM `#1E3A8A`. **Not dismissible.** Sits above the first field, 24px below the header | see §6.4 |
| Price delta chip | Appears to the right of the Base price field the moment the value differs from the stored one. Warning badge: `#FEF3C7` / `#B45309`, 22px, 12px `TrendingUp` or `TrendingDown` icon, Caption 12px 500 | `Was ₹35.00 — a 8.6% rise` / `Was ₹35.00 — a 14.3% cut` |
| Returnable change warning | Appears under the Returnable toggle when it is changed **and** the product has open order lines. Warning tint `#FEF3C7`, 1px `#F97316`, 12px radius, 12px padding, 16px `AlertTriangle` | see §6.4 |
| Status section | 32px gap, H4 `Status`, 1px divider, 44×24 toggle with label and helper to the right | — |
| Primary | Names the action | `Save changes` |

### 6.4 Content and copy

| Slot | Copy |
|---|---|
| Title | `Edit product` |
| Snapshot banner | `Changing this product never changes past orders. Every order line keeps a copy of the title, litres, tag, filter type, price and returnable flag exactly as it was when the order was made.` |
| Price rise chip | `Was ₹35.00 — a 8.6% rise` |
| Price cut chip | `Was ₹35.00 — a 14.3% cut` |
| Price to zero | `Was ₹35.00 — this product becomes free` |
| Returnable turned off | `47 jars from this product are still out with staff. Turning off returnable stops counting them — those 47 will disappear from jars-out figures.` |
| Returnable turned on | `Containers sold from now on will be tracked for return. Past sales are not affected.` |
| Status section | `Status` / `Active` / `Deactivated products leave new order forms. Past orders keep showing them exactly as they were sold.` |
| Buttons | `Cancel` · `Save changes` · `Saving…` |
| Success toast | `20L Jar updated` · when the price changed: `20L Jar updated — base price now ₹38.00` |
| Discard dialog | `Discard your changes?` / `Your changes to 20L Jar haven't been saved.` / `[Keep editing]` · `[Discard changes]` |
| Concurrent edit | `This product changed while you were editing` / `Someone updated 20L Jar at 6:05 pm. Reload to see the current details — your changes will be lost.` / `[Reload]` |
| No changes | Info toast on save with nothing changed: `No changes to save` |
| Deactivate confirm | `Deactivate 20L Jar?` / `It'll stop appearing on new order forms. Its 1,284 past order lines stay exactly as they are, and you can reactivate it any time.` / `[Cancel]` · `[Deactivate]` |

### 6.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens | Labels and card frame render immediately; each input shows a `#F3F4F6` shimmer block at its own height so nothing reflows; the snapshot banner renders straight away, since it does not depend on data | — |
| Filled | Record loaded | Every field pre-filled; form clean; `Save changes` enabled | — |
| Empty (optional fields) | No description | Empty textarea showing its placeholder — never `null` or `N/A` | — |
| Field error | Blur on invalid | As §5.5 | as §5.4 |
| Price changed | Base price differs from stored | Warning delta chip appears beside the field with a 100ms fade — **no layout shift**, because 200px of space to the right of the 200px field is permanently reserved for it | `Was ₹35.00 — a 8.6% rise` |
| Returnable changed with stock out | Toggle flipped off while jars are out | Warning banner under the toggle, 200ms height transition. **Submission still allowed** — this is a consequence, not an error | see §6.4 |
| Submitting | Valid submit | As §5.5 | `Saving…` |
| Success | Saved | Navigate to `/products/[id]`, 4s toast naming the new price when it changed | `20L Jar updated — base price now ₹38.00` |
| Conflict (409) | Changed elsewhere | Form-level Warning banner with `Reload`; fields stay editable so nothing typed is lost until Reload is pressed | see §6.4 |
| Error | Save failed | Form-level Danger banner; form re-enabled with values intact | `Couldn't save your changes` / `The server didn't respond. Try again in a moment.` |
| Deactivating | Status toggled off and saved | 420px confirm dialog first, then the standard submitting treatment | see §6.4 |
| Read-only | Not applicable | — | — |

### 6.6 Interactions

Everything in §5.6 applies. Additionally:

| Interaction | Behaviour |
|---|---|
| Autofocus | **None** — focus lands on the card container. Auto-selecting an existing title invites accidental overwrites |
| Dirty tracking | Compared against loaded values, not against empty. Reverting a field to its original value makes the form clean again and disarms the discard guard |
| Price delta | Recalculates on every keystroke in the Base price field. This is not validation — it is feedback, so the "never validate while typing" rule does not apply |
| Status toggle off | Fires the confirm dialog on **save**, not on toggle, so the owner can flip it, keep editing, and only be asked once |
| Duplicate-title check | Excludes this record, so re-saving an unchanged title never warns |
| Tab order | Title → Litres → Base price → Tag → Filter type → Description → Returnable → Sort order → Active toggle → Cancel → Save changes |

### 6.7 Responsive (below `md`)

As §5.7. Two differences: the snapshot banner keeps full width but drops to 12px padding with the icon on its own line above the text; and the price delta chip moves **below** the Base price field rather than beside it, since there is no room to its right.

### 6.8 Dark mode

As §5.8. The snapshot banner becomes `#1E3A8A` background, 1px `#2563EB`, text `#BFDBFE`, icon `#93C5FD`. The price delta chip uses the Warning dark pair `#7C2D12` / `#FED7AA`. The returnable warning banner uses the same pair with a `#F97316` border.

### 6.9 Stitch prompt

```text
Design a desktop "Edit product" form for an internal Indian water-plant admin tool,
matching an existing "Add product" screen. Inter for text, JetBrains Mono for
numbers. Light theme: page #F8FAFC, white card, 1px #E5E7EB borders, text #111827,
muted #4B5563, accent #2563EB. Keep the 240px sidebar and 64px topbar.

Header: a blue back link "‹ 20L Jar", the title "Edit product" at 28px semibold, and
a 14px grey meta line "PRD-000001 · Added 4 Jan 2025 · Used on 1,284 order lines".

At the top of the white card (max 720px, 24px padding, 12px radius), place a
non-dismissible information banner: #DBEAFE background, 1px #93C5FD border, 12px
radius, 16px padding, a 20px info icon in #1D4ED8, and 14px #1E3A8A text reading
"Changing this product never changes past orders. Every order line keeps a copy of
the title, litres, tag, filter type, price and returnable flag exactly as it was
when the order was made."

Below it, a single-column form with 16px gaps, all pre-filled: "Title" (48px input,
"20L Jar"); a row with "Litres" (120px right-aligned monospace, "20.000") and "Base
price" (200px right-aligned monospace with a grey ₹ prefix, showing "38.00") — beside
the price field place a small amber pill with a rising-trend icon reading "Was ₹35.00
— a 8.6% rise"; a row of two 320px dropdowns "Tag: Normal" and "Filter type: Double
Filtered"; a "Description" textarea reading "Standard blue jar, double filtered".

Then a 32px gap, a divider, an 18px semibold heading "Handling", a toggle switched on
labelled "Returnable", and a 120px "Sort order" input showing "1". Then another 32px
gap, a divider, an 18px semibold heading "Status", and a 44×24px toggle switched on
in #2563EB labelled "Active" with a 12px grey helper: "Deactivated products leave new
order forms. Past orders keep showing them exactly as they were sold."

Footer: 1px top border, right-aligned ghost "Cancel" and filled blue "Save changes".
```

---

## 7. Manage tags — `/products/tags` · Manage filter types — `/products/filter-types`

### 7.1 Purpose

Let the owner add "Chilled", "RO" or "અલ્કલાઇન" without waiting on a developer — and rename any of the seeded values into Gujarati if that is what everyone at the plant actually says.

> **One design, two routes.** These screens are identical except for the noun. Everything below is written for Tags; substitute `filter type` / `Filter types` for the other route. Both are Archetype A with **inline editing** instead of a separate form, because the whole record is a label and a sort order.

### 7.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ‹ Products                                                              │
│  Product tags                                            [ + Add tag ]   │
│  How you group what you sell. Rename these into Gujarati if you like.    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ℹ  Renaming a tag renames it everywhere it already appears —       │  │
│  │    including on past orders, because tags are grouping labels,      │  │
│  │    not part of the order snapshot.                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  CODE        LABEL                 ORDER    PRODUCTS   STATUS     ⋯│  │ 44
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ ⠿ NORMAL     Normal                    1          6   🟢 Active   ⋯│  │ 48
│  │ ⠿ COLD       Cold                      2          3   🟢 Active   ⋯│  │ 48
│  │ ⠿ CHILLED    [ Chilled            ]    3          0   🟢 Active   ⋯│  │ 48  ← row in edit mode
│  │ ⠿ ALKALINE   Alkaline                  4          0   ⬚ Inactive ⋯│  │ 48
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Region-by-region spec

| Element | Spec | Content |
|---|---|---|
| Back link | Body SM `#2563EB` | `‹ Products` |
| Title / subtitle | H2 / Body SM `#4B5563` | `Product tags` / `How you group what you sell. Rename these into Gujarati if you like.` |
| Primary | 40px `#2563EB` fill, `Plus` 16px | `Add tag` |
| Info banner | Primary tint `#DBEAFE`, 1px `#93C5FD`, 12px radius, 16px padding, 20px `Info` `#1D4ED8`, Body SM `#1E3A8A`, not dismissible | see §7.4 |
| Table | Standard container: 12px radius, 1px border, `shadow-sm`. **No toolbar, no chips, no pagination** — a lookup with four rows does not need them. If the list ever exceeds 25 rows a search field appears above the header | — |
| Drag handle | 16px `GripVertical` `#9CA3AF` in a 32px leading column, cursor `grab` → `grabbing`. Keyboard: focus the handle, then `↑`/`↓` with `Space` held, announced live as `Cold moved to position 1 of 4` | — |
| `CODE` | 140px, mono 13px 500 `#6B7280`. **Read-only, always** — the code is a database key, and changing it would break foreign keys | `NORMAL` |
| `LABEL` | flex, min 240px. Body SM 500 `#111827` at rest; in edit mode it becomes a 32px inline input filling the cell with a 1px `#2563EB` border | `Normal` |
| `ORDER` | 96px, right, mono 14px 500. Reflects drag position; not directly typed | `1` |
| `PRODUCTS` | 120px, right, mono 14px 500 `#111827`. **A link** — clicking navigates to `/products?tag=NORMAL`. Zero renders `0` in `#9CA3AF`, not an em dash, because zero here is a count, not a missing value | `6` |
| `STATUS` | 120px, `Active` Success / `Inactive` Default | — |
| Actions | 56px, `MoreHorizontal` 16px in a 44×44 target | `Rename` (`Pencil`) · `Deactivate` (`Ban`) / `Reactivate` (`CheckCircle2`) |
| Row hover | `#F3F4F6`, plus a `Pencil` 14px `#9CA3AF` appearing at the right edge of the `LABEL` cell as an affordance | — |
| Row click | **Does not navigate.** This is the one table in the app whose rows are not links — double-click, or a click on the label cell, enters edit mode instead | — |

**Inline edit mode** — the label cell becomes a 32px input, pre-filled and fully selected, with a 1px `#2563EB` border and a 2px offset ring. `Enter` saves, `Escape` cancels, blur saves. While saving, a 14px spinner sits at the right of the cell and the row is non-interactive. On success the input reverts to text with no animation.

**Add tag** — the same 420px dialog described in §5.4, reachable both from here and from the product form.

### 7.4 Content and copy

| Slot | Tags route | Filter types route |
|---|---|---|
| Title | `Product tags` | `Filter types` |
| Subtitle | `How you group what you sell. Rename these into Gujarati if you like.` | `How thoroughly the water was filtered. Rename these into Gujarati if you like.` |
| Primary | `Add tag` | `Add filter type` |
| Info banner | `Renaming a tag renames it everywhere it already appears — including on past orders, because tags are grouping labels, not part of the order snapshot.` | `Renaming a filter type renames it everywhere it already appears.` |
| Columns | `CODE` `LABEL` `ORDER` `PRODUCTS` `STATUS` | same |
| Add dialog | `Add tag` / `Label` / `e.g. Chilled` / `This is exactly what everyone will see — type it in Gujarati if you prefer` / `[Cancel]` `[Add tag]` | `Add filter type` / … / `[Add filter type]` |
| Empty — no data | `No tags yet` / `Tags group what you sell — Normal, Cold, Chilled. Add the first one and it becomes available on every product form.` / `Add your first tag` | `No filter types yet` / `Filter types record how thoroughly the water was filtered — Normal, Filtered, Double Filtered.` / `Add your first filter type` |
| Empty — no results | `No tags match "chil"` / `Clear search` — only reachable once the search field appears above 25 rows | same |
| Error | `Couldn't load tags` / `The server didn't respond. Check your connection and try again.` / `Try again` | `Couldn't load filter types` |
| Rename success | `Renamed to "Chilled"` | same |
| Duplicate label | `A tag called "Cold" already exists` | `A filter type called "Filtered" already exists` |
| Empty label | `Enter a label` | same |
| Deactivate confirm | `Deactivate the tag "Chilled"?` / `It'll stop appearing on new product forms. The 0 products using it keep it.` / `[Cancel]` · `[Deactivate]` | same shape |
| Deactivate blocked | `"Normal" is in use` / `6 active products use this tag. Move them to another tag first, or leave this one active.` / `[Close]` · `[View those products]` | same shape |
| Reorder success | Silent — no toast. Reordering is continuous and a toast per drag would be noise | — |

### 7.5 States

| State | Trigger | Visual treatment | Copy |
|---|---|---|---|
| Loading (first) | Page opens | Header and info banner render immediately; the table shows a real 44px header and 4 skeleton rows | — |
| Loading (reorder) | A row is dropped | The row settles into its new position instantly and the `ORDER` figures recompute; a 2px indeterminate Nova Blue bar appears under the header until the server confirms. **The list does not re-sort itself under the cursor** | — |
| Empty — no data | Lookup is empty | 280px centred block: 48px `Tag` icon `#D1D5DB`, H4, Body SM, primary CTA | `No tags yet` / `Tags group what you sell — Normal, Cold, Chilled. Add the first one and it becomes available on every product form.` |
| Empty — no results | Search excludes all (only above 25 rows) | 280px block: 48px `SearchX`, H4 quoting the query, `Clear search` | `No tags match "chil"` |
| Filled | Rows present | As wireframe | — |
| Editing | A label cell entered | That cell is an input with a `#2563EB` border and offset ring; every other row stays fully interactive | — |
| Saving (inline) | `Enter` or blur on an edited label | 14px spinner at the right of the cell; the row is non-interactive; the rest of the table is live | — |
| Success (inline) | Server confirms | Input reverts to text, no animation, 4s toast | `Renamed to "Chilled"` |
| Field error (inline) | Blank or duplicate label | The input keeps focus, takes a 1px `#EF4444` border, and a Caption `#EF4444` message appears **below the row**, pushing the following rows down by 20px | `A tag called "Cold" already exists` |
| Error | Fetch failed | 280px block: 48px `AlertTriangle` `#EF4444`, H4, reason, `Try again` | `Couldn't load tags` |
| Partial error | Rows load, product counts fail | Table renders with `—` in the `PRODUCTS` column and a Danger banner above | `Product counts couldn't be loaded.` + `Retry` |
| Deactivate blocked | Tag is used by active products | 480px dialog listing the count with a `View those products` action | see §7.4 |
| Reorder failed | Server rejects the new order | Rows snap back to their previous positions and an error toast appears with `Retry` | `Couldn't save the new order` |
| Read-only | Not applicable | — | — |

### 7.6 Interactions

| Interaction | Behaviour |
|---|---|
| Enter edit | Click the label cell, double-click the row, press `Enter` on a focused row, or use `Rename` in the `⋯` menu. The text is pre-selected so typing replaces it |
| Save edit | `Enter` or blur. `Escape` cancels and restores the original text with no confirm — a single label is not worth a dialog |
| Tab from edit | `Tab` saves the current cell and opens the **next row's** label for editing, so four tags can be renamed without touching the mouse |
| Drag reorder | Pointer drag on the handle, with a 2px `#2563EB` insertion line between rows and the dragged row at 80% opacity with `shadow-lg`. Keyboard reorder via the handle with `Space` + arrows |
| `PRODUCTS` count | Click navigates to the filtered catalogue; `stopPropagation` so it never enters edit mode |
| Add | `Add tag` opens the dialog with `Label` autofocused; `Enter` submits; on success the new row appends at the bottom with the next sort order and its label enters edit mode ready to be corrected |
| Deactivate | Confirm dialog, or the blocked dialog when active products use it |
| Tab order | Back link → `Add tag` → info banner (skipped, static) → drag handle → label cell → products link → `⋯` for each row in order |
| Focus | 2px `#2563EB` ring at 2px offset on handles, cells, links and menus |

### 7.7 Responsive (below `md`)

- Header stacks; `Add tag` full-width primary.
- The table keeps its table shape — five short columns fit within 360px once `CODE` is hidden, and card-ifying four one-word rows would triple the page height for nothing. `CODE` is hidden below `md`; `PRODUCTS` narrows to 64px.
- Rows go to 56px for touch. Tapping the label opens the input directly with the keyboard raised.
- Drag reordering is replaced by `Move up` / `Move down` items in the `⋯` menu — dragging inside a scrolling page on touch is unreliable.

### 7.8 Dark mode

Table `#1E293B` on `#0B1220`; header `#0F172A`. Info banner `#1E3A8A` / 1px `#2563EB` / `#BFDBFE`. `CODE` column `#64748B`. The inline edit input is `#0F172A` with a `#3B82F6` border. The drag insertion line is `#3B82F6`; the dragged row keeps its `#1E293B` background with a `#020617`-based shadow so it still reads as lifted.

### 7.9 Stitch prompt

```text
Design a compact desktop settings screen called "Product tags" for an internal
Indian water-plant admin tool. Inter for text, JetBrains Mono for numbers and codes.
Light theme: page #F8FAFC, white cards, 1px #E5E7EB borders, text #111827, muted
#4B5563, accent #2563EB. Keep the 240px sidebar and 64px topbar; breadcrumb reads
"Products / Tags".

Header: a blue back link "‹ Products", the title "Product tags" at 28px semibold, a
14px grey subtitle "How you group what you sell. Rename these into Gujarati if you
like.", and a right-aligned filled blue "+ Add tag" button.

Below, a non-dismissible information banner: #DBEAFE background, 1px #93C5FD border,
12px radius, 16px padding, 20px info icon in #1D4ED8, 14px #1E3A8A text reading
"Renaming a tag renames it everywhere it already appears — including on past orders,
because tags are grouping labels, not part of the order snapshot."

Then a white table card with 12px radius. A 44px header row in #F3F4F6 with 12px
uppercase letter-spaced grey labels: (blank narrow column), CODE, LABEL, ORDER,
PRODUCTS, STATUS, and a narrow actions column. Four 48px rows separated by 1px
#E5E7EB dividers, each starting with a small grey six-dot drag handle:

NORMAL | Normal | 1 | 6 | green "Active" pill
COLD | Cold | 2 | 3 | green "Active" pill
CHILLED | (this row is in edit mode: the label cell is a 32px text input containing
"Chilled" with a 2px #2563EB border and a soft offset ring) | 3 | 0 | "Active"
ALKALINE | Alkaline | 4 | 0 | grey "Inactive" pill

Codes are monospace uppercase in grey. ORDER and PRODUCTS are right-aligned
monospace; the PRODUCTS numbers are blue links. Each row ends with a three-dot icon
button. No search bar, no pagination — this is a short settings list. Dense,
functional, no decoration.
```

---

## Module design checklist

- [ ] All six screens have a title **and** a one-line subtitle
- [ ] `+ Add product` is the only primary on the list; `Tags` and `Filter types` are secondaries that collapse into `⋯` below `lg`
- [ ] All five core states drawn for the list: loading-first, loading-refilter, empty-no-data, empty-no-results, error — with different icons and different copy for the two empties
- [ ] Detail page draws loading, filled, never-sold, nothing-this-month, no-price-change, error, 404, partial-error and inactive
- [ ] Both forms draw default, field error, warning, form-level error, submitting, success and discard-confirm
- [ ] Lookup manager draws loading, empty, filled, editing, inline-saving, inline-error, reorder-in-flight, reorder-failed and deactivate-blocked
- [ ] Table header 44px sticky, rows 48px, cell padding 12/16, no zebra striping
- [ ] `BASE PRICE` and every money figure: JetBrains Mono, right-aligned, `₹`, 2 decimals
- [ ] `₹0.00` renders as `Free`, not as an em dash — zero is a legal price here, and the em-dash rule is for missing values
- [ ] Litres trim trailing zeros: `20L`, `5L`, `0.5L`, `0.300L`; the column sorts numerically, not as strings
- [ ] `RET.` carries an icon **and** a word, never colour alone
- [ ] Tag cell renders the lookup's stored label, so a rename to Gujarati propagates with no code change
- [ ] Badge variants and icons taken verbatim from the §7.2 meaning map
- [ ] KPI cards 3 and 4 use 18px Inter 600 for their product-name value, with the mono treatment on the figure below — documented as a deliberate exception
- [ ] Every summary figure and every movement row on the detail page navigates into Reports
- [ ] The zero-movement channel row is rendered, not omitted
- [ ] The edit form carries the non-dismissible snapshot banner, and the price delta chip appears in reserved space so nothing shifts
- [ ] Turning `Returnable` off with stock out shows a consequence warning and still allows submission
- [ ] Deactivation is never blocked for a product; it **is** blocked for an in-use tag or filter type, with an itemised explanation
- [ ] Validation fires on blur, never while typing, and clears live once corrected. The price delta is feedback, not validation, so it updates on every keystroke
- [ ] Every validation string is specific: `Litres must be more than 0`, not `Invalid input`
- [ ] `+ Add new tag` is reachable from inside the product form, keyboard-included, and returns focus to the select
- [ ] Focus ring 2px `#2563EB` at 2px offset everywhere, including drag handles and inline edit cells
- [ ] Every screen specified in light **and** dark, with dark badge pairs and `#3B82F6` for blue text
- [ ] Checked with `૨૦ લિટર જાર`, `ડબલ ફિલ્ટર્ડ` and `પ્રોડક્ટ ઉમેરો`: the `FILTER TYPE` header wraps to two lines rather than truncating, buttons size to content with a min-width, and titles wrap to two lines at 1.4 rather than clipping matras
- [ ] Digits stay Latin `0–9` in Gujarati mode; only the words translate
- [ ] Mobile layout defined below 768px for list (row-cards), detail (movement table stays a scrolling table with a pinned first column), forms (stacked but width-capped numeric fields, fixed footer bar) and lookups (table retained, drag replaced by menu items)
- [ ] Icons drawn from the §17 map: `Package`, `ClipboardList`, `PartyPopper`, `Droplet`, `RotateCcw`, `PackageX`, `Pencil`, `Plus`, `Search`, `SlidersHorizontal`, `Download`, `Settings`, `MoreHorizontal`
- [ ] Nothing animates when rows or figures change — only overlays, banners, delta chips and toasts move
