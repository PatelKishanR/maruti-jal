# Maruti Jal — Design Standards

**The single source of truth for how this app looks and behaves.**

Every module design file in [MODULES/](MODULES/) inherits from this document. If a module file contradicts this one, this one wins. If a module needs a pattern that isn't here, add it here first so the other eight can use it.

Built on [NovaSpark](novaspark-design-system.md). That document defines the raw tokens; this one defines how they are applied to a data-heavy business application.

---

## 0. How to use this with Stitch

Each module file in `MODULES/` is written to be pasted into Stitch (or any AI design tool) as a self-contained brief. Each contains:

1. A **Design context block** — the tokens and rules Stitch needs, restated so the file works standalone
2. A **screen-by-screen spec** — layout, components, content, every state
3. A **ready-to-paste prompt** per screen

**Recommended order for building in Stitch:** Staff (01) → Products (02) → Delivery Orders (03) → Coins (04) → Party Orders (05) → Direct Sales (06) → Expenses (07) → Dashboards (08) → Reports (09).

Build Staff first. It establishes the list/detail/form pattern that seven other modules reuse — get it right once and the rest are variations.

---

## 1. What this product is, and what that means for design

An internal tool for **one person** — the owner of a water plant — used many times a day, often in a hurry, sometimes on a phone in a vehicle. Not a consumer app. Not a marketing site.

That leads to five principles that override generic "good design" instincts:

### 1.1 Density over whitespace

The owner needs to see 25 orders at once, not 8. Table rows are **48px**, not 72px. Cards are tight. Generous whitespace is for landing pages; here it means more scrolling, which means more time, which means the register wins.

### 1.2 Numbers are the interface

Money and quantities are the content. They get monospace figures, tabular alignment, right alignment, and more visual weight than the labels beside them. A label can be Gray 600; the number next to it is Gray 900 semibold.

### 1.3 Status is scannable without reading

The owner scans a list looking for problems. Colour and shape carry the signal before any text is read: red means money or jars outstanding, amber means partial, green means settled. Every list is designed so a problem row is visible at arm's length.

### 1.4 Every number is a door

A figure the owner can't click into is a dead end — it says something is wrong without saying where. KPI cards, badge counts and chart segments all navigate to a filtered list.

### 1.5 Entry speed is a feature

The daily order form and the walk-in row are used dozens of times a day. Tab order is deliberate, the first field is autofocused, Enter submits, and nothing requires a mouse. A form that takes 30 seconds instead of 10 doesn't get used — the owner writes it in a notebook instead.

---

## 2. Foundation

### 2.1 Colour

**Brand**

| Token | Light | Dark | Use |
|---|---|---|---|
| Primary (Nova Blue) | `#2563EB` | `#3B82F6` | Primary buttons, links, active nav, focus rings, key chart series |
| Surface | `#FFFFFF` | `#0F172A` | Page and card background |
| Surface subtle | `#F3F4F6` | `#1E293B` | Table headers, section bands, inset panels |
| Page background | `#F8FAFC` | `#0B1220` | Behind cards |
| Text primary | `#111827` | `#F1F5F9` | Values, headings |
| Text secondary | `#4B5563` | `#94A3B8` | Labels, captions, helper text |
| Border | `#E5E7EB` | `#334155` | Card borders, table rules |
| Input border | `#D1D5DB` | `#334155` | Field outlines |

**Semantic** — these carry meaning and are never used decoratively.

| Meaning | Colour | Where it appears |
|---|---|---|
| Success / settled / paid | Spark Green `#22C55E` | Paid badge, returns complete, positive trend |
| Warning / partial / attention | Spark Orange `#F97316` | Partial payment, partial return, overpaid, ageing 7+ days |
| Danger / unpaid / loss | Spark Red `#EF4444` | Unpaid, jars out, destructive actions, negative trend |
| Info / refund due | Nova Blue `#2563EB` | Refund due, advance payment, informational notices |

> **Rule:** colour is never the only signal. Every coloured badge also carries text, and every coloured chart series also carries a label. Roughly 1 in 12 men has a colour vision deficiency, and the owner may hand a printed report to anyone.

### 2.2 Typography

**Inter** for everything. **JetBrains Mono** for figures. **Noto Sans Gujarati** in the fallback stack — Inter has no Gujarati glyphs, and without this every Gujarati name renders as empty boxes.

| Role | Size | Line height | Weight | Used for |
|---|---|---|---|---|
| H1 | 36px | 1.2 | 700 | Reserved for the dashboard greeting |
| H2 | 28px | 1.3 | 600 | Page titles |
| H3 | 22px | 1.4 | 600 | Card and section headings |
| H4 | 18px | 1.4 | 600 | Sub-sections, modal titles |
| Body | 16px | 1.6 | 400 | Detail page content, form values |
| Body SM | 14px | 1.5 | 400 | **Table cells, form labels, most of the app** |
| Caption | 12px | 1.4 | 500 | Metadata, badge text, helper text, column headers |

**Figures** use JetBrains Mono with `tabular-nums`, so digits align vertically down a column and `₹1,240.00` sits directly under `₹980.00`.

| Figure role | Style |
|---|---|
| Table amount | 14px mono, 500, right-aligned |
| Emphasised amount (balance, outstanding) | 14px mono, **600**, right-aligned, Gray 900 |
| KPI value | 28px mono, 700 |
| Form total | 18px mono, 600 |

### 2.3 Spacing

4px base. In practice this app uses six values, and only six:

| Token | Value | Where |
|---|---|---|
| `space-1` | 4px | Icon-to-text gap, badge padding |
| `space-2` | 8px | Between related controls, chip gaps |
| `space-3` | 12px | Table cell vertical padding, input padding |
| `space-4` | 16px | Table cell horizontal padding, form field gap |
| `space-6` | 24px | Card padding, gap between cards |
| `space-8` | 32px | Gap between page sections |

Anything larger belongs on a marketing page, not here.

### 2.4 Radius, elevation, borders

| Element | Radius | Border | Shadow |
|---|---|---|---|
| Input, small button | `4px` | 1px input border | none |
| Button, chip, badge | `8px` (badge: full) | per variant | none |
| Card, table container | `12px` | 1px border | `shadow-sm` |
| Modal, drawer | `12px` | none | `shadow-xl` |
| Dropdown, popover | `8px` | 1px border | `shadow-lg` |

**Cards in this app do not lift on hover.** The NovaSpark hover-lift is for clickable marketing cards; here cards are containers, and a page of shifting panels is distracting. Table *rows* get a background change on hover instead.

### 2.5 Layout grid

| Property | Value |
|---|---|
| Sidebar | 240px expanded, 64px collapsed |
| Topbar | 64px, sticky |
| Content max width | 1440px — wider than NovaSpark's 1280px, because tables need the room |
| Content padding | 24px, 16px below `md` |
| Section gap | 32px |
| Card grid gap | 24px |

Breakpoints: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536.

---

## 3. Application shell

Present on every screen except login.

```
┌────────────┬──────────────────────────────────────────────────────┐
│            │  Topbar 64px                                         │
│  Sidebar   │  Breadcrumb          [🔍] [EN|ગુ] [☀/🌙] [Avatar ▾]  │
│  240px     ├──────────────────────────────────────────────────────┤
│            │                                                      │
│  ● Nav     │   Page header                                        │
│    item    │   H2 title + subtitle          [Secondary] [Primary] │
│            │                                                      │
│            │   ── content, max 1440px, 24px padding ──            │
│            │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
```

### 3.1 Sidebar

- Background: page background (`#F8FAFC` light / `#0F172A` dark). Right border 1px
- Logo block at top, 64px tall, aligned with the topbar
- Nav item: 40px tall, 12px/16px padding, 20px Lucide icon, 8px gap, Body SM
- **Active state:** 3px Nova Blue left border + `#DBEAFE` background + `#1D4ED8` text, weight 500
- Hover (inactive): `#F3F4F6` background
- Grouped with 12px caption labels: **Operations** / **Masters** / **Insights**
- A badge on the right of a nav item shows an actionable count (e.g. Orders `12`) — Danger variant, only when the count is greater than zero
- Collapsed (64px): icons only, tooltip on hover, active state becomes a filled icon background

**Navigation structure**

| Group | Items |
|---|---|
| — | Dashboard |
| **Operations** | Delivery Orders · Coin Issues · Party Orders · Direct Sales |
| **Masters** | Staff · Products · Coin Types · Expense Categories |
| **Money** | Expenses · Payments |
| **Insights** | Reports · Coin Ledger |

### 3.2 Topbar

64px, sticky, 1px bottom border, surface background.

Left: breadcrumb — `Orders / ORD-000123`. Last crumb is Gray 900, others are Gray 600 links.

Right, in order: global search (`⌘K`) · language toggle `EN | ગુ` · theme toggle · user menu.

### 3.3 Page header

```
Delivery Orders                                [Export CSV]  [+ New Order]
Track jars issued, returned, and money collected
```

- Title H2, Gray 900
- Subtitle Body SM, Gray 600 — one line explaining what the page is for. Present on every page
- Actions right-aligned: at most one primary, up to two secondary, overflow into a `⋯` menu
- 24px bottom margin

---

## 4. Page archetypes

Five layouts cover the entire application. Every screen is one of these.

| Archetype | Structure | Used by |
|---|---|---|
| **A — List** | Page header → KPI strip → filter bar → table → pagination | Every module's index |
| **B — Detail** | Page header with status → summary card → tabs or stacked sections → related tables | Order, coin issue, party order, staff, product |
| **C — Form** | Page header → single or two-column card → sticky footer with actions | Create and edit everywhere |
| **D — Dashboard** | Page header → KPI rows → chart grid → operational tables | Executive dashboard |
| **E — Report** | Page header → filter panel → summary band → report table → export bar | The seven reports |

---

## 5. Tables — the most important component

Eight of nine modules are built around a table. This spec is exact.

### 5.1 Anatomy

```
┌─────────────────────────────────────────────────────────────────┐
│  [🔍 Search orders, staff, phone…]      [Filters ▾]  [⚙ Columns]│  ← toolbar 56px
│  ● Today  ● Money pending  ● Jars out  ● Settled     [Clear]    │  ← quick chips 44px
├─────────────────────────────────────────────────────────────────┤
│  ORDER ↕   DATE ↕   STAFF ↕   ITEMS   TOTAL ↕  BAL ↕  STATUS    │  ← header 44px
├─────────────────────────────────────────────────────────────────┤
│  ORD-000123  14 Aug  Ramesh   3/62   ₹2,480  ₹450  🟠 🔴        │  ← row 48px
├─────────────────────────────────────────────────────────────────┤
│  Showing 1–25 of 312        [25 ▾]      ‹ 1 2 3 … 13 ›          │  ← footer 56px
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Exact specifications

| Element | Spec |
|---|---|
| Container | Card: 12px radius, 1px border, `shadow-sm`, surface background, `overflow: hidden` |
| Header row | 44px, subtle background, Caption 12px **600 uppercase** `0.04em` letter-spacing, Gray 600, sticky on scroll |
| Body row | 48px, 1px bottom border, Body SM |
| Cell padding | 12px vertical, 16px horizontal |
| Row hover | `#F3F4F6` background (`#1E293B` dark), 100ms |
| Row click | Navigates to detail. Cursor pointer. The whole row, not just a link |
| Zebra striping | **None** — borders are enough, and stripes fight the status colours |
| Column alignment | Text left · numbers and money **right** · badges and actions **centre** |
| Sortable header | Label + `ArrowUpDown` 14px at 40% opacity. Active: `ArrowUp`/`ArrowDown` at full opacity, Nova Blue, label Gray 900 |
| Sort cycle | none → ascending → descending → none |
| Actions column | Fixed 56px, right-aligned, `⋯` icon button revealing a menu. Always visible, not hover-only — hover-only actions are undiscoverable and impossible on touch |
| Selection | Only where bulk actions exist. 40px checkbox column, header selects the page |

### 5.3 Cell content patterns

| Type | Rendering |
|---|---|
| **Document code** | `ORD-000123` in mono 13px, Nova Blue, medium |
| **Date** | `14 Aug 2026` Body SM. Today shows as `Today`, yesterday as `Yesterday` |
| **Person** | Name Gray 900 medium, phone below in Caption Gray 600 — two lines inside the 48px row |
| **Money** | Mono, right-aligned, `₹` prefix, always 2 decimals. Zero renders as `—` in Gray 300, never `₹0.00` |
| **Emphasised money** (balance, outstanding) | Same, weight 600, Gray 900. Negative wrapped in Danger-tinted text |
| **Quantity** | Mono, right-aligned, no decimals |
| **Compound summary** | `3 items · 62 units` — a Default chip, Caption |
| **Status** | Badge, see §7 |
| **Empty value** | Em dash `—` in Gray 300. **Never** blank, never `null`, never `N/A` |
| **Long text** | Truncated with ellipsis at the column width, full text in a tooltip |

### 5.4 Toolbar

- **Search:** 40px input, `Search` icon left at 16px, full-width up to 400px. Placeholder names what is searched — `Search order no, staff name, phone…` — never just `Search`. Clear `×` appears once typed. Debounced 300ms
- **Filters:** button showing an active count — `Filters (2)` — opening a popover of that module's filters. Applied filters appear as removable chips below the toolbar
- **Quick chips:** one-tap presets. Inactive: Default badge style, clickable. Active: Primary badge + 1px Nova Blue border. `Clear all` appears in Gray 600 once anything is active
- **Columns:** `⚙` icon button toggling column visibility, persisted per user

### 5.5 Pagination

Left: `Showing 1–25 of 312` in Caption Gray 600.
Right: page-size select (10/25/50/100), then `‹ 1 2 3 … 13 ›`. Current page filled Nova Blue. Arrows disabled at the ends at 40% opacity.

### 5.6 Table states

| State | Presentation |
|---|---|
| **Loading (first load)** | Skeleton: 8 rows of grey bars at varied widths (60%/40%/80%), shimmering at 1.5s. Header and toolbar render normally |
| **Loading (refilter/repage)** | **The existing table stays on screen** at 60% opacity, pointer-events off, with a 2px indeterminate Nova Blue bar under the header. Never replace loaded data with a skeleton — it reads as slower than it is |
| **Empty (no records at all)** | Centred in 320px: 48px Gray 300 icon, H4 "No orders yet", Body SM Gray 600 explaining what happens next, primary CTA `+ New Order` |
| **Empty (no results for filters)** | 48px `SearchX` icon, H4 "No orders match your filters", Body SM listing the active filters, `Clear filters` secondary button. **Distinct from the above** — one means start here, the other means you've filtered too far |
| **Error** | 48px Danger `AlertTriangle`, H4 "Couldn't load orders", Body SM with the plain-language reason, `Try again` primary button. No stack traces |
| **Partial error** | Table renders with a Danger banner above: "Some figures may be out of date." |

### 5.7 Responsive

Below `md`, each row becomes a card:

```
┌───────────────────────────────────────┐
│ ORD-000123              🟠 🔴          │
│ Ramesh · 14 Aug 2026                  │
│ 3 items · 62 units                    │
│ Total ₹2,480      Balance ₹450        │
└───────────────────────────────────────┘
```

Primary identifier and status on line 1, context on line 2, figures on the last line right-aligned. Tapping opens the detail. The toolbar becomes a full-width search plus a `Filters` button opening a bottom sheet.

> **Exception — report tables never become cards.** A statement's value *is* its column alignment: the reader is scanning a column of figures for one that looks wrong. Report tables (archetype E) scroll horizontally below `md` with the first column pinned. See §19.

---

## 6. Forms

### 6.1 Layout

| Property | Spec |
|---|---|
| Container | Card, 24px padding, max 720px for single-column |
| Columns | Single column by default. Two columns only for short paired fields (phone / alt phone) |
| Field gap | 16px vertical |
| Section gap | 32px, with an H4 heading and a 1px divider |
| Label | Body SM 500 Gray 900, 6px above the field |
| Required | Nova Blue `*` after the label. **Mark required, not optional** — most fields here are required |
| Helper text | Caption Gray 600, 4px below the field. Reserve the space so nothing shifts when an error appears |
| Field width | Full width of its column, **except** money (200px), quantity (120px), date (180px). A full-width box for a 3-digit quantity invites errors |

### 6.2 Inputs

| Element | Spec |
|---|---|
| Height | 40px standard, 48px for the primary field on fast-entry forms |
| Border | 1px `#D1D5DB`, radius 4px |
| Padding | 12px horizontal |
| Text | Body SM Gray 900 |
| Placeholder | Gray 400, an *example* not a repeat of the label — `e.g. 9876543210`, not `Enter phone` |
| Focus | 2px Nova Blue border + 2px offset ring. Never remove the ring |
| Disabled | 40% opacity, `#F3F4F6` background, `not-allowed` cursor |
| Read-only | No border, subtle background, Gray 600 — clearly not editable |
| Error | 1px Spark Red border, message below |

**Specialised inputs**

| Type | Behaviour |
|---|---|
| **Money** | `₹` prefix inside the field in Gray 600. Mono, right-aligned. Accepts `1250`, `1,250`, `1250.50`. Formats with lakh grouping on blur |
| **Quantity** | Mono, right-aligned, 120px, integers only, with stepper arrows on hover |
| **Date** | 180px, calendar icon right, `DD MMM YYYY`, defaults to today, calendar popover. Quick chips inside the popover: `Today` `Yesterday` |
| **Search select** | Type to filter, keyboard navigable, shows secondary detail per option (`Ramesh · 9876543210`), 8 visible before scroll, `+ Add new` at the bottom where relevant |
| **Toggle** | 44×24px track. Label to the right, tappable |
| **Textarea** | 3 rows default, resizable vertically only |

### 6.3 Repeatable line items

Used by order lines, coin issue lines, party day items. **The hardest form pattern in the app.**

```
┌──────────────────────────────────────────────────────────────────┐
│  Items                                                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ PRODUCT           QTY   BASE     CHARGED    TOTAL          │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ [20L Jar     ▾]  [40]  ₹35.00   [₹32.00]   ₹1,280.00  [✕] │  │
│  │                                  ⚠ Rate overridden −₹3.00  │  │
│  │ [1L Bottle   ▾]  [24]  ₹10.00   [₹10.00]     ₹240.00  [✕] │  │
│  └────────────────────────────────────────────────────────────┘  │
│  [+ Add item]                                                    │
│                                        Subtotal      ₹1,520.00   │
│                                        Discount    [   ₹20.00 ]  │
│                                        ─────────────────────────  │
│                                        Total         ₹1,500.00   │
└──────────────────────────────────────────────────────────────────┘
```

| Rule | Detail |
|---|---|
| Row height | 56px — taller than a table row, because these contain inputs |
| Add | Full-width dashed-border ghost button. Appends a row, focuses its first field |
| Remove | `✕` icon button, Gray 400 → Spark Red on hover. **Disabled when only one row remains** |
| Computed cells | Read-only, no border, subtle background, update live as you type |
| Override indicator | When charged ≠ base: a Warning chip on the row's second line showing the difference. The row gets a 2px Spark Orange left border |
| Totals | Right-aligned block, 8px gap. Grand total 18px mono 600 with a 1px top border above it |
| Keyboard | Tab moves across then down. Enter on the last field adds a row. `⌘/Ctrl + Enter` submits |
| Mobile | Each line becomes its own card with stacked labelled fields |

### 6.4 Validation

**When to validate**

| Trigger | Behaviour |
|---|---|
| While typing | **Never** show an error. Interrupting someone mid-entry is hostile |
| On blur | Validate that field, if it has been touched |
| On submit | Validate everything, focus and scroll to the first error |
| After an error, while correcting | Re-validate live, so the error clears the moment it's fixed |

**How errors look**

- Field: 1px Spark Red border, unchanged background
- Message: below the field, Caption Spark Red, with a 14px `AlertCircle` and 4px gap
- Icon inside the field on the right, Spark Red, 16px
- **Message text is specific and actionable.** `Enter a 10-digit mobile number` — not `Invalid input`, not `This field is required`
- Never a red background fill on the field — it destroys text contrast

**Form-level error** — a banner above the form actions:

```
┌─────────────────────────────────────────────────────┐
│ ⚠  This order couldn't be saved                     │
│    Only 240 Blue Tokens are in stock; you entered   │
│    300. Adjust the quantity or add stock first.     │
└─────────────────────────────────────────────────────┘
```

Danger tint background (`#FEE2E2` / `#7F1D1D`), 1px Spark Red border, 12px radius, 16px padding.

**Warnings** are not errors. Editing an order that already has payments shows an amber banner explaining the consequence — and still allows submission.

### 6.5 Form actions

Sticky footer inside the card, 1px top border, 16px/24px padding, right-aligned:

`[Cancel]` ghost · `[Save as draft]` secondary (only where drafts exist) · `[Save order]` primary

- The primary button **names the action** — `Save order`, `Record payment`, `Issue coins`. Never `Submit` or `OK`
- Submitting: button shows a spinner, label becomes `Saving…`, both buttons disable, the form dims to 60%
- Success: navigate to the detail page with a success toast. Never leave the user on a form wondering whether it worked
- `Cancel` with unsaved changes opens a confirm dialog

---

## 7. Status badges

One component, one meaning map, used identically in all nine modules.

### 7.1 Variants

| Variant | Background | Text | Dark bg | Dark text |
|---|---|---|---|---|
| Default | `#E5E7EB` | `#374151` | `#334155` | `#E2E8F0` |
| Primary | `#DBEAFE` | `#1D4ED8` | `#1E3A8A` | `#BFDBFE` |
| Success | `#DCFCE7` | `#15803D` | `#14532D` | `#BBF7D0` |
| Warning | `#FEF3C7` | `#B45309` | `#7C2D12` | `#FED7AA` |
| Danger | `#FEE2E2` | `#B91C1C` | `#7F1D1D` | `#FECACA` |

Spec: 22px tall, 8px horizontal padding, full radius, Caption 12px 500, optional 12px leading icon with a 4px gap.

### 7.2 The meaning map — apply exactly

| Domain status | Variant | Label | Icon |
|---|---|---|---|
| Unpaid | Danger | `Unpaid` | `Circle` |
| Partially paid | Warning | `₹450 due` — **show the number** | `CircleDashed` |
| Paid | Success | `Paid` | `CheckCircle2` |
| Overpaid | Warning | `Overpaid ₹60` | `AlertCircle` |
| Refund due | Primary | `Refund ₹500` | `RotateCcw` |
| Nothing returned | Danger | `40 jars out` — **show the number** | `PackageX` |
| Partially returned | Warning | `8 jars out` | `Package` |
| Fully returned | Success | `Settled` | `PackageCheck` |
| Not applicable | Default | `—` | none |
| Active | Success | `Active` | none |
| Inactive | Default | `Inactive` | none |
| Draft | Default | `Draft` | `FileEdit` |
| Cancelled | Default | `Cancelled` + 60% row opacity | `Ban` |
| Scheduled | Primary | `Scheduled` | `Calendar` |
| Delivered | Success | `Delivered` | `Check` |
| Skipped | Warning | `Skipped` | `SkipForward` |

> **A badge with a number beats a badge with a word.** `₹450 due` and `8 jars out` let the owner triage without opening anything. Reserve bare-word badges for terminal states where there is no number left to show.

### 7.3 Dual badges

Delivery orders carry two independent badges — payment and return — in one cell, 4px apart, payment first. They are genuinely independent: an order can be `Paid` and `12 jars out`.

---

## 8. KPI cards

```
┌──────────────────────────────┐
│ 💰  TODAY'S COLLECTION       │
│                              │
│ ₹18,450                      │
│ ▲ 12% vs yesterday           │
│ Cash ₹14,200 · Coins ₹4,250  │
└──────────────────────────────┘
```

| Element | Spec |
|---|---|
| Container | Card, 20px padding, 12px radius, 1px border, `shadow-sm` |
| Label | Caption 12px 600 uppercase, `0.04em` tracking, Gray 600 |
| Icon | 16px Lucide, Gray 400, before the label |
| Value | **28px JetBrains Mono 700**, Gray 900, 8px below the label |
| Trend | Caption with `TrendingUp`/`TrendingDown`. Green up, red down — **except** for expenses and outstanding, where up is bad and the colours invert |
| Breakdown | Caption Gray 600, a single line, `·` separated |
| Clickable | Entire card. Hover: border becomes Nova Blue at 40%, 100ms. Cursor pointer |
| Alert variant | When it needs attention, the left border becomes 3px Spark Red and the value turns Danger |

**Layout:** 4 across on `xl`, 2 on `md`, 1 below. Grid gap 24px, equal heights.

**States:** loading = shimmer bar at the value position, label already visible · zero = `₹0` in Gray 400 with a Caption context line, never an empty card · error = `—` with a small retry link.

---

## 9. Detail pages

```
┌──────────────────────────────────────────────────────────────────┐
│  ‹ Orders                                                        │
│  ORD-000123                    🟠 ₹450 due   🔴 8 jars out       │
│  Ramesh · 14 Aug 2026 · Edited 2 times                           │
│                    [Record Return] [Record Payment] [Edit] [⋯]   │
├──────────────────────────────────────────────────────────────────┤
│  ┌── Summary ──────────────────────────────────────────────────┐ │
│  │  Order total    Collected      Balance        Jars out      │ │
│  │  ₹2,480.00      ₹2,030.00      ₹450.00        8 of 62       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [ Items ] [ Returns 3 ] [ Payments 2 ] [ Activity ]             │
│  ──────────────────────────────────────────────────────────────  │
│  … tab content …                                                 │
└──────────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Back link | `‹ Orders` — Body SM Nova Blue, 8px above the title |
| Title | H2 mono for document codes, plus status badges inline at 12px gap |
| Meta line | Body SM Gray 600, `·` separated |
| Actions | Contextual primaries first (`Record Payment`), then `Edit`, then `⋯` for destructive |
| Summary card | Subtle background, 4 columns on `lg`, 2 on `md`. Label Caption Gray 600 above, value 20px mono 600 below. The critical figure (balance) is Gray 900 600; others Gray 700 |
| Tabs | 44px, 2px bottom indicator in Nova Blue, active label Gray 900 600, inactive Gray 600. **Counts in the tab label** — `Returns 3` — so nothing hides |
| Section spacing | 32px between blocks |

**Timeline** — used for returns, payments and activity:

```
│ ● 16 Aug 2026 · 11:40         Recorded by Admin
│ │  Returned 8 empty · 2 filled
│ │  Note: "Sharma ji's jars"
│ ○ 14 Aug 2026 · 18:05
│    Returned 22 empty
```

Newest first. 8px dot in the semantic colour, 1px connecting line in the border colour, most recent dot filled and Nova Blue.

---

## 10. Modals and drawers

| Type | When | Width |
|---|---|---|
| **Dialog** | Confirmation, single decision | 420px |
| **Modal form** | Recording a payment or return — a focused task | 560px, 720px if it contains a table |
| **Drawer** | Filters on mobile, contextual detail | 400px right, or a bottom sheet on mobile |

Overlay `rgba(15, 23, 42, 0.5)`, 12px radius, `shadow-xl`, 24px padding.

Header: H4 title, optional Body SM subtitle, `✕` top-right. Footer: 1px top border, right-aligned actions.

Enter: 200ms fade + scale from 0.96. Exit: 150ms. Escape and overlay click close — **unless** the form is dirty, in which case a confirm appears. Focus traps inside; on close it returns to the trigger.

**Confirm dialog for destructive actions:** 24px Spark Red icon, H4 title naming the object (`Cancel order ORD-000123?`), Body SM consequence, `[Cancel]` ghost + `[Cancel order]` destructive. **The confirm button repeats the verb.** Never `Yes`/`No`.

---

## 11. Feedback

### 11.1 Toasts

Bottom-right, 380px, 12px radius, `shadow-lg`, 4px semantic left border. Slide up + fade over 200ms.

| Type | Duration | Example |
|---|---|---|
| Success | 4s | `Payment of ₹450 recorded` — always name the amount or object |
| Error | Manual dismiss | `Couldn't record payment` + reason + `Retry` |
| Info | 5s | `Export ready` + `Download` |

Stacked max 3; older ones collapse. Every destructive success offers `Undo` for 8 seconds where technically possible.

### 11.2 Inline banners

Full-width inside the content area, 12px radius, 16px padding, semantic tint, 1px border, 20px icon left. Dismissible only when informational — a coin reconciliation mismatch is not dismissible.

### 11.3 Loading

| Context | Pattern |
|---|---|
| Page navigation | 2px Nova Blue bar at the top of the viewport, indeterminate |
| First table load | Skeleton rows (§5.6) |
| Refilter | Dim existing content, do not replace |
| Button action | Inline spinner replacing the icon, label becomes present-tense |
| Card / KPI | Shimmer bar at the value position |
| Chart | Skeleton with axes drawn, plot area shimmering |

**Rule:** never show a full-page spinner. Something recognisable stays on screen at all times.

---

## 12. Charts

Recharts, styled to the system.

### 12.1 Palette — computed, not judged

**Three categorical hues. Not five.**

| | Light (on `#FFFFFF`) | Dark (on `#1E293B`) |
|---|---|---|
| 1 | Nova Blue `#2563EB` | `#3B82F6` |
| 2 | Spark Orange `#F97316` | `#EA580C` |
| 3 | Teal `#14B8A6` | `#0D9488` |

Both sets **pass every check across ALL pairs**, not merely adjacent ones:
lightness band, chroma floor, CVD separation under protanopia and deuteranopia,
the normal-vision floor, and contrast against the surface.

#### Why three, and why these

The earlier five-hue palette in this document was described as validated. It
was not — it had been reasoned about, not computed. Running the validator over
all pairs fails it twice, and neither failure can be fixed by reordering:

| Pair | ΔE | Verdict |
|---|---|---|
| Purple `#8B5CF6` ↔ Blue `#2563EB` | **2.3** protan, 12.7 normal | Indistinguishable. Purple is unusable alongside blue at any position |
| Green `#22C55E` ↔ Teal `#14B8A6` | 10.4 deutan, **11.3 normal** | Below the 15 floor — hard to tell apart *with full colour vision* |

A five-hue categorical set cannot be built from this brand's hues. Rather than
ship one that fails, the set is three — which is **all this app ever needs**:

| Chart | Series |
|---|---|
| Revenue by channel | 3 — delivery, party, walk-in |
| Revenue vs expenses | 2, plus a profit line |
| Collection mix | 2 — cash, coins |
| Top 5 products | **1** — a ranked bar, single hue |

**Green is semantic only** — profit, success, settled. It is never a categorical
slot, which is precisely what put it next to teal and broke the palette.

**A fourth concurrent series is not a new hue.** Facet into small multiples, or
fold the tail into "Other". Generating a fourth colour is how a palette that
passed becomes one that does not.

#### Contrast: a WARN that is not dismissable

On light, orange and teal fall below 3:1 against white. The validator warns
rather than fails, but relief is **obligatory**, not optional:

- **direct labels** on the series wherever they fit
- a **legend** whenever they do not
- a **`View as table` toggle on every chart** — the guaranteed-accessible
  fallback, and genuinely useful when the owner wants the exact figure
- **2px surface-coloured gaps** between adjacent bars and stacked segments, so
  shape separates what colour does not

#### Semantic assignments override the sequence

Revenue and cash are always blue, expenses and party always orange, coins
always teal, profit always green, outstanding always red — whatever position
they occupy in a given chart. A colour that means one thing on the dashboard
must not mean something else in a report.

#### Re-validate before changing any of this

```
node scripts/validate_palette.js "#2563EB,#F97316,#14B8A6" --mode light --pairs all
node scripts/validate_palette.js "#3B82F6,#EA580C,#0D9488" --mode dark --surface "#1E293B" --pairs all
```

Do not reason about ΔE. Run it.

### 12.3 Chart styling
| Grid | 1px horizontal only, border colour, no vertical lines |
| Axis | Caption Gray 600, no axis lines, ticks only |
| Y-axis money | Abbreviated — `₹12L`, `₹1.2Cr` — full value in the tooltip |
| Tooltip | Card style, `shadow-lg`, series dot + label + right-aligned mono value |
| Legend | Below the chart, 12px dots, Caption, clickable to toggle |
| Height | 280px standard, 320px with a legend |
| Empty | Axes drawn, centred Caption Gray 600 `No data for this period` |

Bars: 4px top radius, 60% category width. Lines: 2px, no dots until hover. Areas: 12% opacity fill.

---

## 13. Money, numbers and dates

Non-negotiable, and applied identically in both languages.

| Type | Format | Example |
|---|---|---|
| Money | `₹` + Indian lakh grouping + 2 decimals | `₹12,34,567.00` |
| Money, zero | Em dash, Gray 300 | `—` |
| Money, negative — a **loss or shortfall** | Parentheses, Danger text | `(₹500.00)` |
| Money, negative — a **refund owed** | Parentheses, **Nova Blue** text | `(₹500.00)` |
| Large money in KPIs | Abbreviated, full value in tooltip | `₹12.3L` |
| Quantity | Grouped, no decimals | `1,240` |
| Litres | Up to 3 decimals, trailing zeros trimmed | `20L` · `0.5L` |
| Percentage | 1 decimal, signed with an arrow | `▲ 12.4%` |
| Date | `DD MMM YYYY` | `14 Aug 2026` |
| Date, recent | Relative | `Today` · `Yesterday` |
| Date range | Shared parts collapsed | `14–16 Aug 2026` |
| Time | 12-hour lower-case | `6:05 pm` |
| Timestamp | Combined | `14 Aug 2026, 6:05 pm` |
| Ageing | Plain days | `8 days ago` — turns Spark Orange past 7 days, Spark Red past 15 |

> **On the two negative styles.** A refund the company owes a staff member is not a loss — it is money pointing the other way. Rendering it red makes a routine coin return look like a problem. The parentheses carry the sign in both cases, so colour is never the only signal and the distinction costs nothing in legibility.

**Abbreviation thresholds** — KPI cards only; tables always show the full figure.

| Range | Rendering |
|---|---|
| Below ₹1,00,000 | Full, lakh-grouped — `₹94,250` |
| ₹1 lakh and above | `₹1.85L` |
| ₹1 crore and above | `₹1.24Cr` |

KPI values **drop the paise**; tables and statements keep them. The full exact value always appears in the hover tooltip.

**Digits are always Latin `0–9`, in both languages.** These figures get checked against registers, bank statements and UPI apps, all of which use Latin digits.

---

## 14. Bilingual layout

Full rules in [../I18N.md](../I18N.md). What matters for design:

| Rule | Consequence |
|---|---|
| Gujarati runs **20–40% longer** than English | Never fix a button or column width to its English content. Buttons size to content with a min-width; table headers wrap to two lines rather than truncate |
| Gujarati is **taller** — matras sit above and below | Line height 1.6 minimum for body text. Never set a fixed 20px line box |
| Names and addresses may be in either script | Never restrict a text field to Latin characters. Sort order is handled by the database, not the UI |
| Figures stay Latin | So a money column looks identical in both languages |
| The language toggle is `EN | ગુ` in the topbar | Two-state segmented control, not a dropdown. Instant switch, no page flash |

**Design every screen twice.** A layout that only works in English is not finished.

---

## 15. Dark mode

Not a preference here — the plant runs early mornings and late evenings.

Apply the NovaSpark mapping, with three adjustments this app requires:

1. **Nova Blue lifts to `#3B82F6`** for text and borders on dark, to hold 4.5:1 contrast
2. **Badge pairs use dedicated dark values** (§7.1) — simply darkening the light tints destroys legibility
3. **Cards are `#1E293B` on a `#0F172A` page** — the separation is background difference, not shadow, since shadows are nearly invisible on dark

Every screen in every module design file must specify both.

---

## 16. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| Fast | 100ms | ease-out | Hover, focus, colour changes |
| Base | 200ms | ease-in-out | Dropdowns, tabs, toasts, modal enter |
| Slow | 350ms | ease-in-out | Drawers, sidebar collapse |
| Spring | 400ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Success confirmations only |

**Never animate:** table rows appearing, number changes, or page content on load. Data should feel instant. Animation on a list of 25 orders reads as slowness.

All motion respects `prefers-reduced-motion`, falling back to instant transitions.

---

## 17. Iconography

Lucide. 16px in dense contexts, 20px inline, 24px standalone. Stroke 1.5px. Colour inherits from text.

**Consistent mapping — the same icon means the same thing everywhere:**

| Concept | Icon | Concept | Icon |
|---|---|---|---|
| Dashboard | `LayoutDashboard` | Staff | `Users` |
| Delivery order | `ClipboardList` | Product | `Package` |
| Coin | `Coins` | Coin ledger | `BookOpen` |
| Party order | `PartyPopper` | Direct sale | `Droplet` |
| Expense | `Receipt` | Report | `FileBarChart` |
| Payment | `Banknote` | Cash | `Wallet` |
| Return | `RotateCcw` | Jar out | `PackageX` |
| Add | `Plus` | Edit | `Pencil` |
| Delete | `Trash2` | Search | `Search` |
| Filter | `SlidersHorizontal` | Export | `Download` |
| Settings | `Settings` | More | `MoreHorizontal` |

---

## 18. Accessibility

| Requirement | Standard |
|---|---|
| Contrast | 4.5:1 body, 3:1 for 18px+ and UI borders. Verified in both themes |
| Focus | Always visible: 2px Nova Blue ring at 2px offset. **Never** `outline: none` without a replacement |
| Touch targets | 44×44px minimum. Table `⋯` buttons get padding to reach it |
| Keyboard | Everything reachable by Tab. Modals trap and restore focus. Escape closes. Enter submits |
| Labels | Every input has a real `<label>`. Icon-only buttons carry an accessible name |
| Tables | Proper header cells with scope, and a caption naming the table |
| Live regions | Toasts and validation summaries announce to screen readers |
| Colour | Never the sole carrier of meaning (§2.1) |

---

## 19. Print and PDF

The three printed documents (staff statement, party statement, daily collection sheet) are designed, not screenshotted.

| Property | Value |
|---|---|
| Page | A4 portrait, 20mm margins |
| Type | Inter 10pt body, 8pt caption. Money stays mono |
| Colour | Black on white. Status shown as text, not colour — a printed badge tint is invisible in mono |
| Header | Business name, document title, period, generated timestamp |
| Table | 1px rules, subtle header fill, no zebra |
| Footer | Page `n of m`, document code |
| Gujarati | Embedded font, verified for conjunct and matra shaping |

---

## 20. Consistency checklist

Every screen, before it is considered finished:

- [ ] Page header has a title **and** a one-line subtitle
- [ ] Primary action is top-right and named for what it does
- [ ] All five states designed: loading, empty, no-results, filled, error
- [ ] Money right-aligned, mono, `₹`, 2 decimals, `—` for zero, refunds blue rather than red
- [ ] Charts use the §12.1 validated palette; orange/green/teal pairings carry gaps, labels and a table fallback
- [ ] Status badges use the §7.2 map exactly, with numbers where available
- [ ] Every figure that could be drilled into is clickable
- [ ] Table rows 48px, headers 44px, sticky
- [ ] Search placeholder names what is searched
- [ ] Validation errors specific and actionable, shown on blur not while typing
- [ ] Focus rings visible on every interactive element
- [ ] Designed in both light and dark
- [ ] Checked with Gujarati content at realistic length
- [ ] Mobile layout defined below `md`
- [ ] Icons drawn from the §17 map
