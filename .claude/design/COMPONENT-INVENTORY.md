# Component Inventory

Every reusable component in the app, with its variants, sizes and states.

**Build these in Stitch first, before any screen.** A screen assembled from an agreed component set stays consistent; nine screens each inventing their own button do not. §14 has a ready-to-paste prompt for generating the whole sheet.

Inherits [DESIGN-STANDARDS.md](DESIGN-STANDARDS.md). Where this file and the standards disagree, the standards win.

---

## Token quick-reference

| | Light | Dark |
|---|---|---|
| Primary | `#2563EB` | `#3B82F6` |
| Surface | `#FFFFFF` | `#1E293B` |
| Page | `#F8FAFC` | `#0F172A` |
| Subtle | `#F3F4F6` | `#1E293B` |
| Text | `#111827` | `#F1F5F9` |
| Text muted | `#4B5563` | `#94A3B8` |
| Border | `#E5E7EB` | `#334155` |
| Input border | `#D1D5DB` | `#334155` |
| Success | `#22C55E` | `#4ADE80` |
| Warning | `#F97316` | `#FB923C` |
| Danger | `#EF4444` | `#F87171` |

Fonts: **Inter** (UI) · **JetBrains Mono** (all figures) · **Noto Sans Gujarati** (fallback).
Radius: 4 / 8 / 12 / 16 / full. Spacing: 4 · 8 · 12 · 16 · 24 · 32.

---

## 1. Button

| Variant | Fill | Text | Border |
|---|---|---|---|
| Primary | `#2563EB` | white | none |
| Secondary | transparent | `#2563EB` | 1px `#2563EB` |
| Ghost | transparent | `#4B5563` | none |
| Destructive | `#EF4444` | white | none |
| Link | transparent | `#2563EB` | none, underline on hover |

| Size | Height | Padding | Text |
|---|---|---|---|
| SM | 32px | 8/12 | 14px |
| MD | 40px | 10/16 | 15px |
| LG | 48px | 12/24 | 16px |

**States:** default → hover (10% darker) → active (20% darker) → focus (2px `#2563EB` ring, 2px offset) → disabled (40% opacity, `not-allowed`) → **loading** (spinner replaces the leading icon, label becomes present-tense — `Saving…`, `Recording…` — button disabled, width held so nothing jumps).

Radius 8px. Icon 16px (SM) or 20px, 8px gap. Icon-only buttons are square at the size height and carry an accessible name.

> Labels name the action: `Save order`, `Record payment`, `Issue coins`. Never `Submit`, `OK` or `Done`.

---

## 2. Input

40px tall (48px for the primary field on fast-entry forms), 1px `#D1D5DB`, radius 4px, 12px horizontal padding, 14px text.

| State | Treatment |
|---|---|
| Default | 1px `#D1D5DB` |
| Hover | 1px `#9CA3AF` |
| Focus | 2px `#2563EB` + 2px offset ring |
| Filled | Text `#111827` |
| Placeholder | `#9CA3AF` — an *example* (`e.g. 9876543210`), never a repeat of the label |
| Error | 1px `#EF4444`, 16px `AlertCircle` inside right, message below |
| Disabled | 40% opacity, `#F3F4F6` fill |
| Read-only | No border, `#F3F4F6` fill, text `#4B5563` |
| With prefix | `₹` or icon at 12px inset, `#4B5563` |
| Clearable | `×` at right, appears once non-empty |

### Specialised variants

| Variant | Width | Behaviour |
|---|---|---|
| **Money** | 200px | `₹` prefix inside, mono, right-aligned. Accepts `1250` / `1,250` / `1250.50`; formats to lakh grouping on blur |
| **Quantity** | 120px | Mono, right-aligned, integers, steppers on hover |
| **Date** | 180px | Calendar icon right, `DD MMM YYYY`, popover with `Today` / `Yesterday` chips |
| **Search** | up to 400px | `Search` icon left, clear `×`, 300ms debounce |
| **Textarea** | full | 3 rows, vertical resize only |

---

## 3. Select / Combobox

Trigger matches the input spec with a `ChevronDown` at right.

Popover: 8px radius, 1px border, `shadow-lg`, 8 options visible before scroll, 4px inner padding.

Option row 36px, 12px padding. **Two-line options where a secondary identifier helps** — `Ramesh Patel` on top, `9876543210` in 12px `#4B5563` below. Hover `#F3F4F6`; selected shows a `Check` at right in `#2563EB`.

Searchable variant: a search field pinned at the top of the popover, arrow-key navigation, Enter selects, Escape closes. A `+ Add new…` row pinned at the bottom where inline creation applies.

**States:** empty (`No products found`) · loading (3 shimmer rows) · error (`Couldn't load products` + `Retry`).

---

## 4. Badge

22px tall, 8px horizontal padding, full radius, 12px/500 text, optional 12px leading icon at 4px gap.

| Variant | Light bg / text | Dark bg / text |
|---|---|---|
| Default | `#E5E7EB` / `#374151` | `#334155` / `#E2E8F0` |
| Primary | `#DBEAFE` / `#1D4ED8` | `#1E3A8A` / `#BFDBFE` |
| Success | `#DCFCE7` / `#15803D` | `#14532D` / `#BBF7D0` |
| Warning | `#FEF3C7` / `#B45309` | `#7C2D12` / `#FED7AA` |
| Danger | `#FEE2E2` / `#B91C1C` | `#7F1D1D` / `#FECACA` |

Meaning map in [DESIGN-STANDARDS.md](DESIGN-STANDARDS.md) §7.2 — apply it verbatim. **Badges show numbers where a number exists** (`₹450 due`, `8 jars out`), because a number lets the owner triage without opening the record.

---

## 5. Chip

Filter and quick-filter pills. 28px tall, 10px padding, full radius, 13px text.

| State | Treatment |
|---|---|
| Inactive | `#F3F4F6` fill, `#4B5563` text, transparent border |
| Hover | `#E5E7EB` fill |
| Active | `#DBEAFE` fill, `#1D4ED8` text, 1px `#2563EB` border |
| Removable | `×` at right, `#9CA3AF` → `#EF4444` on hover |

---

## 6. Card

Surface fill, 1px border, 12px radius, `shadow-sm`, 24px padding.

**No hover lift** — a deviation from NovaSpark. Cards here are containers, not clickable tiles, and a page of shifting panels is distracting while reading figures. The exception is the KPI card (§7), whose border turns `#2563EB` at 40% on hover.

Optional header: H3/H4 title, optional subtitle, right-aligned actions, 1px bottom divider, 16px below.

---

## 7. KPI card

20px padding. Label 12px/600 uppercase `0.04em` `#4B5563` with a 16px `#9CA3AF` icon. Value **28px JetBrains Mono 700** `#111827`, 8px below. Trend line 12px with `TrendingUp`/`TrendingDown`.

> Trend colour inverts for expenses and outstanding balances — a rise there is bad news and must not be green.

Optional breakdown: one 12px `#4B5563` line, `·` separated.

**Alert variant:** 3px `#EF4444` left border, value in Danger.
**States:** loading (shimmer bar at the value, label already visible) · zero (`₹0` in `#9CA3AF` plus a context line — never a blank card) · error (`—` with a retry link).

Entire card is clickable and navigates to a filtered list.

---

## 8. Table

Full spec in [DESIGN-STANDARDS.md](DESIGN-STANDARDS.md) §5. Component pieces:

| Piece | Spec |
|---|---|
| Container | Card, `overflow: hidden` |
| Toolbar | 56px — search, `Filters (n)`, `⚙ Columns` |
| Quick chips | 44px strip below the toolbar |
| Header row | 44px, subtle fill, 12px/600 uppercase `#4B5563`, sticky |
| Body row | 48px, 1px bottom border, 14px text, hover `#F3F4F6` |
| Cell padding | 12px vertical / 16px horizontal |
| Sort control | Label + 14px `ArrowUpDown` at 40%; active is `#2563EB` full opacity |
| Actions cell | 56px fixed, `⋯` icon button, **always visible** — hover-only actions are undiscoverable and impossible on touch |
| Footer | 56px — `Showing 1–25 of 312`, page-size select, pager |

**Row states:** default · hover · selected (`#DBEAFE` tint) · cancelled (60% opacity) · needs-attention (2px `#EF4444` left border).

**Table states:** first load (8 shimmer rows) · refilter (**existing rows dim to 60%**, 2px indeterminate bar under the header — never swap real data for a skeleton) · empty-no-data · empty-no-results · error.

Below `md` each row becomes a card: identifier + status on line 1, context on line 2, figures right-aligned on the last.

---

## 9. Line-item editor

The repeatable-row pattern used by orders, coin issues and party days. Rows are **56px** — taller than table rows because they contain inputs.

| Piece | Spec |
|---|---|
| Header | 40px, 12px/600 uppercase labels |
| Row | 56px, 1px bottom border |
| Computed cell | Read-only, no border, subtle fill, updates live |
| Override row | 2px `#F97316` left border + a Warning chip on a second line showing the difference |
| Remove | `✕`, `#9CA3AF` → `#EF4444`. **Disabled when one row remains** |
| Add | Full-width dashed ghost button; appends and focuses the new row's first field |
| Totals | Right-aligned block; grand total 18px mono/600 above a 1px top rule |

Keyboard: Tab across then down · Enter on the last field adds a row · `⌘/Ctrl+Enter` submits.

---

## 10. Modal / dialog / drawer

| Type | Width | Use |
|---|---|---|
| Dialog | 420px | Single confirmation |
| Modal form | 560px (720px with a table) | Record payment, record return |
| Drawer | 400px right / bottom sheet on mobile | Filters, contextual detail |

Overlay `rgba(15,23,42,0.5)`. 12px radius, `shadow-xl`, 24px padding. Header: H4 + optional subtitle + `✕`. Footer: 1px top border, right-aligned actions.

Enter 200ms fade + scale from 0.96; exit 150ms. Escape and overlay click close **unless the form is dirty**, which raises a confirm. Focus traps inside and returns to the trigger on close.

**Destructive confirm:** 24px `#EF4444` icon, title naming the object (`Cancel order ORD-000123?`), consequence sentence, `[Cancel]` ghost + `[Cancel order]` destructive. The confirm button repeats the verb — never `Yes`/`No`.

---

## 11. Feedback

**Toast** — bottom-right, 380px, 12px radius, `shadow-lg`, 4px semantic left border, slide-up 200ms. Success 4s, error until dismissed, info 5s. Max 3 stacked. Copy names the object: `Payment of ₹450 recorded`.

**Inline banner** — full content width, 12px radius, 16px padding, semantic tint, 1px border, 20px icon left. Dismissible only when informational; a coin reconciliation mismatch is not.

**Empty state** — centred in ≥320px: 48px `#D1D5DB` icon, H4 title, 14px `#4B5563` body, action button. Two distinct flavours:

| Flavour | Icon | Title | Action |
|---|---|---|---|
| No data yet | module icon | `No orders yet` | `+ New Order` primary |
| No results | `SearchX` | `No orders match your filters` | `Clear filters` secondary |

**Error state** — 48px `#EF4444` `AlertTriangle`, H4 `Couldn't load orders`, plain-language reason, `Try again` primary. No stack traces.

**Skeleton** — `#E5E7EB` bars (`#334155` dark), 4px radius, 1.5s shimmer, widths varied 40–80% so it reads as content rather than a grid.

---

## 12. Navigation

**Sidebar** 240px / 64px collapsed. Item 40px, 12/16 padding, 20px icon, 8px gap, 14px text. Active: 3px `#2563EB` left border + `#DBEAFE` fill + `#1D4ED8` text/500. Hover `#F3F4F6`. Group labels 12px uppercase `#9CA3AF`. Right-aligned Danger count badge, shown only when greater than zero.

**Topbar** 64px sticky, 1px bottom border. Breadcrumb left; search / language / theme / avatar right.

**Tabs** 44px, 2px `#2563EB` bottom indicator, active `#111827`/600, inactive `#4B5563`. **Counts in the label** (`Returns 3`) so nothing hides behind a tab.

**Pagination** — page buttons 32×32, current filled `#2563EB`, arrows disabled at 40% at the ends.

**Language toggle** — segmented `EN | ગુ`, 32px, active segment white on `#F3F4F6` with `shadow-sm`. Two-state control, not a dropdown.

---

## 13. Timeline

Used for returns, payments and activity history.

8px dot in the semantic colour, 1px connecting line in the border colour, most recent dot filled `#2563EB`. Entry: 14px/500 title, 12px `#4B5563` meta, optional note. Newest first, 16px between entries.

---

## 14. Module-specific components

These emerged while designing individual modules. They are listed here so a second module reuses them rather than reinventing them — each is defined in full in the file named.

| Component | Defined in | Spec summary |
|---|---|---|
| **Wizard step indicator** | [05-party-orders](MODULES/05-party-orders.md) | Numbered steps with a connecting rule; completed steps show a `Check`. Collapses to `Step 2 of 4` below `md` |
| **Day card + timeline rail** | [05-party-orders](MODULES/05-party-orders.md) | A dated card on a vertical rail, carrying its own item list, status badge and total |
| **No-delivery marker** | [05-party-orders](MODULES/05-party-orders.md) | 28px dashed row making a gap day visible. Runs of 4+ collapse to `4 days no delivery ⌄` |
| **Progress bar** | [05-party-orders](MODULES/05-party-orders.md) | 48×4px, full radius, for `3/5 days` |
| **Segmented control** | [05-party-orders](MODULES/05-party-orders.md) | 2–4 options, active segment white on `#F3F4F6` with `shadow-sm`. Also used by the language toggle |
| **Month calendar grid** | [05-party-orders](MODULES/05-party-orders.md) | Degrades to an agenda list below `md` |
| **Cross-order group band** | [03-delivery-orders](MODULES/03-delivery-orders.md) | 40px `#F8FAFC` sub-header grouping rows by source document, with code, date, ageing and badge |
| **Value-decreased affordance** | [03-delivery-orders](MODULES/03-delivery-orders.md) | Struck `was ₹1,400.00` sub-line with an `ⓘ` tooltip, plus a Primary-tint banner. Used wherever a total legitimately drops |
| **Register table** | [04-coins](MODULES/04-coins.md) | Ledger styling — vertical hairlines around In/Out/Balance, date-band rows, pinned opening balance, carried-forward row with a double rule. **The only place in the app with vertical rules** |
| **Expandable table row** | [04-coins](MODULES/04-coins.md) | 40px sub-rows, 36px sub-header. Chevron rotates 100ms; the panel appears instantly |
| **Drift banner** | [04-coins](MODULES/04-coins.md) | Non-dismissible Danger banner for a reconciliation mismatch |
| **Day-group band** | [06-direct-sales](MODULES/06-direct-sales.md) | 40px band with a running day total, for the cash-drawer tally |
| **Inline entry row** | [06-direct-sales](MODULES/06-direct-sales.md) | Create-in-place table row. Optimistic save, background flash confirmation, refocus in the same frame |
| **Price-history timeline** | [02-products](MODULES/02-products.md) | Struck old values against new, on the §13 timeline rail |
| **Receipt dropzone** | [07-expenses](MODULES/07-expenses.md) | Upload with preview, progress and failure states |

### Additional icons beyond §17

`Ban` (deactivate/void) · `CheckCircle2` (reactivate) · `GripVertical` (reorder) · `Copy` (duplicate) · `Repeat` (returning customer) · `ClipboardList` (order receipt in the ledger) · `Plus` / `PackageX` (adjustment in/out).

---

## 15. Stitch prompt — generate the component sheet

```text
Design a component library sheet for an internal business admin application.

Style: clean, dense, data-focused, professional. Not playful, no illustrations,
no gradients. Think Linear or Stripe Dashboard rather than a consumer app.

Colours — primary blue #2563EB; text #111827; muted text #4B5563; borders #E5E7EB;
input borders #D1D5DB; page background #F8FAFC; card surface #FFFFFF; success
#22C55E; warning #F97316; danger #EF4444.

Fonts — Inter for all UI text; JetBrains Mono for every number and currency value.
Radius 8px for buttons and inputs, 12px for cards. Spacing on a 4px scale.

Lay out these components on one artboard, grouped with small labels:

1. Buttons — primary, secondary, ghost, destructive, link; each in 32px, 40px and
   48px heights; and each showing default, hover, focused with a 2px blue ring,
   disabled at 40% opacity, and loading with a spinner.
2. Inputs — 40px tall, 1px #D1D5DB border, 4px radius; showing default, focused
   with a 2px blue border, filled, error with a red border and a red message below,
   and disabled. Include a currency input with a ₹ prefix and right-aligned
   monospace figures, and a date input reading "14 Aug 2026".
3. Badges — pill shaped, 22px tall, 12px text, in five tints: grey, blue, green,
   amber and red. Label them "Paid", "₹450 due", "Unpaid", "8 jars out", "Refund ₹500".
4. A data table — 44px header row in uppercase 12px grey on a #F3F4F6 fill, and
   48px body rows separated by 1px borders. Columns: order code in blue monospace,
   date, staff name with the phone number beneath it in small grey, a quantity chip,
   two right-aligned monospace currency columns, and two status badges. Show a
   hovered row with a #F3F4F6 background.
5. KPI cards — 4 across. Each has a small uppercase grey label with a 16px icon, a
   large 28px monospace value such as ₹18,450, and a green upward trend line below.
   Show one alert variant with a 3px red left border.
6. Empty state — a centred 48px light grey icon, a bold title, a grey explanatory
   line, and a blue button.
7. A modal — 560px wide, 12px radius, a title, form fields, and a footer with a
   ghost Cancel and a primary action button.

Present everything in light mode. Keep spacing tight and consistent — this is a
dense internal tool where an operator needs many rows visible at once.
```

---

## 16. Checklist

- [ ] Every button variant × size × state drawn
- [ ] Input error state shows red border **and** a message — never a red fill
- [ ] Focus rings visible on every interactive element
- [ ] Badge tints match §4 exactly, in both themes
- [ ] Table header 44px, body 48px, cells 12/16 padding
- [ ] All figures monospace, right-aligned, `—` for zero
- [ ] Empty-no-data and empty-no-results drawn as separate states
- [ ] Refilter loading dims existing rows rather than replacing them
- [ ] Dark variants drawn for every component
- [ ] Gujarati sample text checked — buttons and headers size to content, no truncation
