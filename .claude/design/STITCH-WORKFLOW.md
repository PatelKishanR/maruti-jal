# Designing this app in Stitch — step by step

A working process for turning the specs in [MODULES/](MODULES/) into actual screens.

---

## The one thing to understand first

**Stitch has no memory between chats, and long documents make it worse, not better.**

Two consequences that shape everything below:

1. **Never paste [DESIGN-STANDARDS.md](DESIGN-STANDARDS.md) or [novaspark-design-system.md](novaspark-design-system.md) into Stitch.** They are 700+ lines each. A prompt that long gets diluted — the model averages across it and you lose the specific instruction you actually cared about. Those two files exist for *you* and for whoever writes the code later.

2. **Consistency does not come from telling Stitch the rules once.** It comes from three things, in this order of power:
   - **Image references** — feeding back a screen you already approved. Strongest by far.
   - **Staying in one chat** for related screens, so earlier output is in context.
   - **Self-contained prompts** — every `Stitch prompt` block in the module files restates the hex values, fonts and layout, so each one works standalone.

That is exactly why the module files have 63 short prompts instead of one long design brief.

---

## What to feed, and when

| Stage | What you paste | Where it comes from |
|---|---|---|
| 1 | Component sheet prompt | [COMPONENT-INVENTORY.md](COMPONENT-INVENTORY.md) §15 |
| 1.5 | Login screen prompt | [MODULES/00-auth.md](MODULES/00-auth.md) §3.9 |
| 2 | Staff list prompt | [MODULES/01-staff.md](MODULES/01-staff.md) §3.9 |
| 3 | Staff detail prompt | [MODULES/01-staff.md](MODULES/01-staff.md) §4.9 |
| 4 | Staff form prompt | [MODULES/01-staff.md](MODULES/01-staff.md) §5.9 |
| 5+ | Every other screen | The `N.9 Stitch prompt` block in each module file |

Every prompt block is fenced as ```text so you can copy it cleanly.

---

## Phase 0 — Before you open Stitch

- **Decide: light mode only, for now.** Do every screen in light first. Dark mode is a late pass (Phase 5) — generating both from the start doubles your spend and halves your consistency.
- **Desktop first.** Mobile is Phase 6.
- **Know your generation budget.** Stitch has monthly limits, and the higher-quality mode has a much smaller allowance than the standard one. Spend the expensive mode where it pays: the first screen of each *pattern*, not every screen.
- **Have a screenshot folder ready.** You will be feeding approved screens back in constantly.

---

## Phase 1 — The component sheet

**Goal:** get one artboard that establishes the visual language, so every screen after it is assembly rather than reinvention.

1. Start a **new Stitch project**. Name it `Maruti Jal — Components`.
2. Use the **higher-quality mode**. This is the single most valuable generation you will make.
3. Paste the prompt from [COMPONENT-INVENTORY.md](COMPONENT-INVENTORY.md) §15 verbatim.
4. Judge the result against exactly four things — ignore everything else on this pass:
   - Buttons are `#2563EB`, 40px tall, 8px radius
   - **All figures are monospace and right-aligned**
   - Table header row is grey and shorter than the body rows
   - Badges are pills in the five tints
5. Iterate with **short, single-issue corrections**. One fix per message:

   > Make all currency values monospace, right-aligned, with the ₹ symbol attached to the number.

   > Reduce the table row height so rows feel dense — about 48px — and remove the alternating row background.

   > The badges should be pill-shaped and smaller, about 22px tall with 12px text.

6. **Screenshot the approved sheet and save it.** This image is your style reference for every remaining phase.

> Do not move on until this looks right. Every screen inherits from it, so a wrong button here becomes a wrong button 40 times.

---

## Phase 1.5 — Login (warm-up)

**Goal:** one easy screen to confirm your component sheet actually transfers, before you spend the expensive mode on the archetypes.

Login is the ideal second generation: a single card, five elements, no table, no data. If it comes out on-brand, your reference image is working. If it doesn't, fix that now rather than discovering it three screens deeper.

1. New chat, `Maruti Jal — Auth`. **Standard mode** is fine.
2. Attach the component sheet screenshot, paste [00-auth.md](MODULES/00-auth.md) §3.9.
3. While you're in that chat, also generate the change-password modal (§7.9) — it establishes the modal look that Delivery Orders and Coins lean on heavily later.

---

## Phase 2 — The three archetypes (Staff)

**Goal:** lock the list, detail and form patterns. Seven of nine modules are variations on these three, so this is where consistency is won or lost.

Do all three **in the same chat**, in this order. Do not start a new chat between them — the shared context is what keeps them looking related.

### 2.1 Staff list

1. New chat: `Maruti Jal — Staff`. Higher-quality mode.
2. **Attach the component sheet screenshot** and paste [01-staff.md](MODULES/01-staff.md) §3.9, prefixed with:

   > Use the attached component sheet as the exact visual style — same colours, fonts, button style, badge style and table density.

3. Check against the [DESIGN-STANDARDS.md](DESIGN-STANDARDS.md) §20 checklist. The ones that matter most here:
   - Page header has a title **and** a one-line subtitle
   - Primary button top-right, named `+ New Staff`
   - Table header 44px, rows 48px
   - Money right-aligned and monospace
   - Search placeholder names what's searched, not just "Search"
4. Iterate until right. **Screenshot it.**

### 2.2 Staff detail

Same chat. Attach the approved list screenshot, then paste §4.9 prefixed with:

> Same app, same visual style as the previous screen. This is the detail page you reach by clicking a row.

### 2.3 Staff form

Same chat, same approach with §5.9.

**At the end of Phase 2 you have three reference screenshots.** Everything else in the project is now a variation on one of them, which is why the remaining eight modules go far faster than this one did.

---

## Phase 3 — The remaining modules

Now use the **standard (faster) mode** for most screens — you have strong references, so the model has less to invent.

**Order, and why:**

| Order | Module | Why here |
|---|---|---|
| 1 | 02 Products | Nearly identical to Staff. Fast confidence-builder, and it proves your references work |
| 2 | 06 Direct Sales | Introduces the inline-entry row — one new pattern, on a simple screen |
| 3 | 07 Expenses | Introduces the file-upload dropzone |
| 4 | 03 Delivery Orders | Introduces line-item editing and the two big modals. **Hardest module — do it once you're fluent** |
| 5 | 04 Coins | Introduces the register/ledger look and expandable rows |
| 6 | 05 Party Orders | Introduces the wizard, day cards and calendar |
| 7 | 08 Dashboards | Charts and KPI grid — visually different, so do it after the CRUD screens are settled |
| 8 | 09 Reports | Reuses the table pattern; the print layouts are a separate look |

**Per module:**

1. **New chat per module**, named for it. Keeps context focused and makes screens easy to find later.
2. First screen: attach the matching archetype screenshot (list / detail / form) plus the component sheet.
3. Subsequent screens in that module: attach the previous screen from the same module.
4. Paste the `N.9 Stitch prompt` block.

---

## Phase 4 — States

Only after every module's main screens are approved.

For each list screen, generate three variants by attaching the approved screen and asking:

> Same screen, but showing the empty state: a centred 48px light grey users icon, the heading "No staff added yet", grey text "Add your delivery staff to start recording orders against them.", and a blue "+ New Staff" button. Keep the page header and toolbar exactly as they are.

> Same screen, but showing the no-results state: a centred magnifying glass icon with an X, the heading "No staff match your filters", grey text listing the active filters, and an outlined "Clear filters" button.

> Same screen, but loading: replace the table rows with 8 grey skeleton bars of varying widths. Keep the header and toolbar fully rendered.

The exact copy for each is in the module file's `N.5 States` table — use it verbatim rather than inventing new wording.

> **Don't skip this phase.** Empty and error states are where real apps feel unfinished, and they're the cheapest screens to generate.

---

## Phase 5 — Dark mode

One pass, at the end, across all approved screens:

> Convert this exact screen to dark mode. Page background #0F172A, cards #1E293B, borders #334155, primary text #F1F5F9, muted text #94A3B8, blue lifted to #3B82F6. Keep the layout, spacing and content identical — only the colours change.

Each module file's `N.8 Dark mode` section lists anything that differs beyond a straight swap.

---

## Phase 6 — Mobile

Only for the screens actually used on a phone: the **dashboard**, the **order list**, and the **direct-sales entry**. The owner is not creating a party order on a phone.

Each module's `N.7 Responsive` section describes the layout. The key transformation:

> Redesign this for a 390px-wide phone. Each table row becomes a card: identifier and status badges on the first line, staff name and date on the second, and the amounts right-aligned on the last line. Replace the toolbar with a full-width search field and a "Filters" button.

---

## Phase 7 — Export and hand-off

1. Export each approved screen to **Figma** for a tidy, layered file, or take the **HTML/CSS** if you want to hand real markup to whoever builds it.
2. Stitch output is a **visual reference, not production code**. The real app is Next.js + Tailwind + shadcn/ui per [../ARCHITECTURE.md](../ARCHITECTURE.md) §8. What you're producing here is the thing the developer builds *against*.
3. Keep the screenshots organised by module — they become the visual acceptance criteria for each build phase.

---

## When Stitch drifts

It will. These corrections work; vague ones don't.

| Problem | Say this |
|---|---|
| Rows too tall / airy | `Make the table denser — 48px rows, 12px vertical cell padding. This is an internal tool where many rows must be visible at once.` |
| Numbers not aligned | `All currency and quantity values must use a monospace font, right-aligned, with tabular figures so digits line up between rows.` |
| Wrong blue | `The primary blue must be exactly #2563EB. Replace every other blue with it.` |
| Too decorative | `Remove all gradients, illustrations and rounded card shadows. This is a dense professional admin tool — think Linear or Stripe Dashboard, not a consumer app.` |
| Lost the style | Re-attach the component sheet: `Match the attached component sheet exactly for colours, fonts, buttons, badges and table density.` |
| Invented content | `Use only the exact labels and data I specified. Do not add extra columns, cards or sections.` |
| Ignoring a rule after 3 tries | Start a fresh chat with the component sheet attached and the original prompt. Long chats accumulate drift — restarting is often faster than correcting |

---

## If your generation budget is tight

Generate these **nine screens** and nothing else. They cover every distinct pattern in the app, and the rest can be built by analogy:

1. Component sheet
2. Staff list — the list archetype
3. Staff form — the form archetype
4. Order detail — the detail archetype, with tabs and a timeline
5. Order create — line-item editing
6. Record Return modal — the modal archetype
7. Coin ledger — the register look, unlike anything else
8. Executive dashboard — KPI grid and charts
9. Staff outstanding statement, print layout — the document look

Everything else in the app is a variation on one of these nine.

---

## Checklist

- [ ] Component sheet approved and screenshotted before any screen
- [ ] Staff list, detail and form done in one chat, in the higher-quality mode
- [ ] Three archetype screenshots saved and reused
- [ ] One chat per module, previous screen attached each time
- [ ] Prompts pasted verbatim from the `N.9` blocks — not paraphrased
- [ ] Copy taken verbatim from the `N.4` and `N.5` sections
- [ ] All screens light mode desktop before any dark or mobile work
- [ ] Empty, no-results and loading states generated for every list
- [ ] Every screen checked against [DESIGN-STANDARDS.md](DESIGN-STANDARDS.md) §20
