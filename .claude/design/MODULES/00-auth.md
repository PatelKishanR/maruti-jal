# Module 0 — Authentication & Account · UI Design Spec

> Inherits [DESIGN-STANDARDS.md](../DESIGN-STANDARDS.md). Functional spec: [../../MODULES/00-auth.md](../../MODULES/00-auth.md)

---

## 1. Design context (for Stitch)

**Product.** Internal admin tool for an Indian mineral-water plant. One user. Dense, professional, data-focused — Linear or Stripe Dashboard, not a consumer app. No illustrations, no gradients, no marketing language.

**Colour**

| Token | Light | Dark |
|---|---|---|
| Primary | `#2563EB` | `#3B82F6` |
| Page background | `#F8FAFC` | `#0F172A` |
| Card surface | `#FFFFFF` | `#1E293B` |
| Text | `#111827` | `#F1F5F9` |
| Text muted | `#4B5563` | `#94A3B8` |
| Border | `#E5E7EB` | `#334155` |
| Input border | `#D1D5DB` | `#334155` |
| Danger | `#EF4444` | `#F87171` |
| Danger tint | `#FEE2E2` / text `#B91C1C` | `#7F1D1D` / text `#FECACA` |
| Success | `#22C55E` | `#4ADE80` |

**Type.** Inter throughout. Noto Sans Gujarati in the fallback stack — Inter has no Gujarati glyphs. H2 28px/1.3/600 · H4 18px/1.4/600 · Body 16px/1.6/400 · Body SM 14px/1.5/400 · Caption 12px/1.4/500.

**Metrics.** Spacing 4 · 8 · 12 · 16 · 24 · 32. Radius: inputs 4px, buttons 8px, cards 12px. Shadows: card `0 1px 2px rgba(0,0,0,0.05)`, elevated `0 10px 15px rgba(0,0,0,0.1)`.

**Controls.** Inputs on this module are **48px** tall, not the app's usual 40px — this is a focused single-task page and the fields deserve the weight. Focus is a 2px `#2563EB` border plus a 2px offset ring, never removed. Primary button `#2563EB`, white text, 48px, 8px radius. Errors show a 1px `#EF4444` border and a message below — never a red background fill.

**Principles that apply here.** Entry speed is a feature — autofocus, tab order, Enter submits. Never colour alone as a signal. Design light *and* dark. Check with Gujarati, which runs 20–40% longer and taller.

---

## 2. Screens in this module

| Screen | Route | Archetype | Purpose |
|---|---|---|---|
| Sign in | `/login` | C — Form (no app shell) | The only door into the app |
| Forgot password | Dialog on `/login` | Dialog | Explain recovery honestly |
| Session expired | Dialog, overlays any page | Dialog | Re-enter without losing your place |
| Profile & preferences | `/settings/account` | C — Form (in shell) | Name, email, language, theme |
| Change password | Modal | Modal form | Rotate the password |

---

## 3. Screen — Sign in `/login`

### 3.1 Purpose
Get one known person into the app in under five seconds, and say something useful when that fails.

### 3.2 Layout

```
                                                    [ EN | ગુ ]

              ┌────────────────────────────────────┐
              │                                    │
              │            ○ Maruti Jal            │
              │                                    │
              │  Sign in                           │
              │  Enter your details to continue    │
              │                                    │
              │  Email                             │
              │  ┌──────────────────────────────┐  │
              │  │ owner@marutijal.com          │  │
              │  └──────────────────────────────┘  │
              │                                    │
              │  Password                          │
              │  ┌──────────────────────────┬───┐  │
              │  │ ••••••••••               │ 👁 │  │
              │  └──────────────────────────┴───┘  │
              │                                    │
              │  ☐ Keep me signed in               │
              │                                    │
              │  ┌──────────────────────────────┐  │
              │  │          Sign in             │  │
              │  └──────────────────────────────┘  │
              │                                    │
              │        Forgot password?            │
              └────────────────────────────────────┘

                   Maruti Jal · Water Supply
```

**A centred card, not a split-screen brand panel.** A half-width marketing panel exists to sell a product to a stranger. This app has one user who already knows what it is — the panel would be decoration that has to be maintained, translated and made responsive. The centred card is faster to build, degrades to mobile with no work, and reads as a tool rather than a landing page.

### 3.3 Region-by-region spec

| Region | Element | Spec |
|---|---|---|
| **Page** | Background | `#F8FAFC`. Card vertically centred, min-height 100vh |
| | Language toggle | Fixed top-right, 24px inset. Segmented `EN | ગુ`, 32px tall, `#F3F4F6` track, active segment `#FFFFFF` with `shadow-sm` and `#111827` text; inactive `#4B5563` |
| **Card** | Container | 400px wide, `#FFFFFF`, 12px radius, 1px `#E5E7EB`, `shadow-lg`, 32px padding |
| **Brand** | Mark | 40px circular `#2563EB` with a white `Droplet` glyph, centred |
| | Wordmark | `Maruti Jal`, 18px/600, `#111827`, 12px below the mark, centred |
| | Spacing | 32px below the wordmark |
| **Heading** | Title | `Sign in` — H2 28px/1.3/600 `#111827`, left-aligned |
| | Subtitle | Body SM 14px `#4B5563`, 4px below |
| | Spacing | 24px below |
| **Fields** | Label | Body SM 14px/500 `#111827`, 6px above its input |
| | Input | Full width, **48px** tall, 1px `#D1D5DB`, 4px radius, 14px padding, 15px text |
| | Focus | 2px `#2563EB` border + 2px offset ring |
| | Field gap | 16px |
| | Password toggle | `Eye` / `EyeOff` 18px, `#9CA3AF` → `#4B5563` on hover, inset 14px right, 44×44 hit area |
| **Checkbox** | Control | 18px, 4px radius, 1px `#D1D5DB`; checked `#2563EB` with a white tick |
| | Label | Body SM `#4B5563`, 8px gap, whole row clickable. 20px above, 24px below |
| **Submit** | Button | Full width, 48px, `#2563EB`, white 15px/600, 8px radius. Hover 10% darker, active 20% darker |
| **Footer link** | `Forgot password?` | Body SM `#2563EB`, centred, 20px below the button. Underline on hover |
| **Page footer** | Caption | `Maruti Jal · Water Supply` — Caption 12px `#9CA3AF`, centred, 24px below the card |

### 3.4 Content and copy

| Element | English | Gujarati |
|---|---|---|
| Title | `Sign in` | `સાઇન ઇન કરો` |
| Subtitle | `Enter your details to continue` | `ચાલુ રાખવા માટે તમારી વિગતો દાખલ કરો` |
| Email label | `Email` | `ઈમેલ` |
| Email placeholder | `owner@marutijal.com` | same |
| Password label | `Password` | `પાસવર્ડ` |
| Checkbox | `Keep me signed in` | `મને સાઇન ઇન રાખો` |
| Button | `Sign in` | `સાઇન ઇન કરો` |
| Button, submitting | `Signing in…` | `સાઇન ઇન થઈ રહ્યું છે…` |
| Link | `Forgot password?` | `પાસવર્ડ ભૂલી ગયા?` |
| Footer | `Maruti Jal · Water Supply` | `મારુતિ જળ · વોટર સપ્લાય` |

**Error messages**

| Situation | Message |
|---|---|
| Wrong email **or** wrong password | `Email or password is incorrect.` |
| Email field empty | `Enter your email address` |
| Email malformed | `Enter a valid email address, like owner@marutijal.com` |
| Password field empty | `Enter your password` |
| Rate limited | `Too many failed attempts. Try again in 14 minutes.` |
| Account deactivated | `This account has been deactivated. Contact the account owner.` |
| Network / server down | `Can't reach the server. Check your connection and try again.` |

> **The first message is deliberately identical for both causes.** "No account with that email" tells an attacker which addresses are worth attacking. Same message, same response time, no information leaked.

### 3.5 States

| State | Trigger | Visual | Copy |
|---|---|---|---|
| **Default** | Page load | Email autofocused with its focus ring visible. Button enabled | — |
| **Typing** | User types | No validation runs. Nothing turns red mid-entry | — |
| **Field error** | Blur on an empty or malformed field | 1px `#EF4444` border, 16px `AlertCircle` inset right, Caption `#EF4444` message 4px below | Per §3.4 |
| **Submitting** | Button pressed | Button shows a 16px white spinner, label `Signing in…`, button and both fields disabled. Width held so nothing shifts | — |
| **Credentials rejected** | Server returns failure | Danger banner above the fields: `#FEE2E2` fill, 1px `#EF4444`, 12px radius, 12px/16px padding, 18px `AlertCircle` `#B91C1C`, text `#B91C1C` 14px. Both field borders turn `#EF4444`. Password clears, email is kept, **focus moves to password** | `Email or password is incorrect.` |
| **Rate limited** | 6th failure in 15 min | Same banner, plus the button disabled at 40% opacity with a live countdown in its label | `Too many failed attempts. Try again in 14 minutes.` |
| **Deactivated** | Inactive account | Same banner. Both fields cleared and disabled | `This account has been deactivated…` |
| **Network error** | Request fails | Same banner but with a `WifiOff` icon and a `Try again` text button on the right | `Can't reach the server…` |
| **Success** | Valid credentials | Button holds its spinner through the redirect — never flashes back to idle. No toast; arriving at the dashboard is the confirmation | — |
| **Redirected here** | Protected URL while signed out | An informational banner **above the card**: `#DBEAFE` fill, 1px `#2563EB`, `Info` icon, `#1D4ED8` text | `Sign in to continue to that page.` |

### 3.6 Interactions

| Interaction | Behaviour |
|---|---|
| Load | Email autofocused. Browser password managers work normally — standard autocomplete attributes, nothing custom |
| Tab order | Email → Password → show/hide toggle → checkbox → Sign in → Forgot password → language toggle |
| Enter | Submits from either field |
| Show/hide password | Toggles the field type. Icon swaps `Eye` ↔ `EyeOff`. Never reveals on hover — deliberate click only |
| Validation timing | On blur for touched fields; everything on submit. **Never while typing.** Once a field is in error it re-validates live so the error clears the moment it's fixed |
| Submit | Focus first error if invalid; otherwise disable and show the spinner |
| After failure | Password clears, email is kept, focus moves to password. Retyping the email you already got right is pure friction |
| Language toggle | Switches instantly. Any typed values are preserved. No page flash |
| Forgot password | Opens the §4 dialog |

### 3.7 Responsive

Below `md` (768px): card goes full-width minus 16px each side, max 400px, 24px padding, and sits 48px from the top rather than vertically centred — so it doesn't jump when the mobile keyboard opens.

Language toggle moves to 16px inset. Inputs stay 48px (comfortably above the 44px touch minimum). Page footer stays visible.

### 3.8 Dark mode

Page `#0F172A`. Card `#1E293B`, 1px `#334155`, shadow effectively invisible — separation comes from the background difference. Text `#F1F5F9`; muted `#94A3B8`. Input fill `#0F172A` with a 1px `#334155` border; focus `#3B82F6`. Button `#3B82F6` with `#0F172A` text. Brand mark stays `#3B82F6`. Error banner `#7F1D1D` fill, `#F87171` border, `#FECACA` text. Language toggle track `#0F172A`, active segment `#334155`.

### 3.9 Stitch prompt

```text
Design a clean, professional sign-in page for an internal business admin tool used by a water-supply company in India. Not a consumer app and not a marketing page — think Linear or Stripe Dashboard. No illustrations, no gradients, no hero imagery.

Light theme. Page background #F8FAFC filling the viewport, with a single white card centred both horizontally and vertically. The card is 400px wide, 12px corner radius, 1px #E5E7EB border, a soft shadow, and 32px of internal padding. Font is Inter throughout.

Inside the card, top to bottom, centred where noted:
- A 40px blue circle (#2563EB) containing a small white water-droplet icon, centred.
- The wordmark "Maruti Jal" in 18px semibold #111827, centred, 12px below the circle.
- 32px of space, then a left-aligned 28px semibold #111827 heading "Sign in".
- Directly beneath it, 14px grey #4B5563 text "Enter your details to continue".
- A field labelled "Email" — the label 14px medium #111827, and below it a full-width input 48px tall, 4px radius, 1px #D1D5DB border, containing the placeholder "owner@marutijal.com".
- A field labelled "Password" with the same input styling, showing masked dots and a small grey eye icon inset on the right.
- A checkbox row "Keep me signed in", 14px grey text, unchecked.
- A full-width primary button, 48px tall, solid #2563EB, white 15px semibold text "Sign in", 8px radius.
- Centred beneath it, a 14px blue link "Forgot password?".

Fixed in the top-right corner of the page, a small segmented language toggle showing "EN | ગુ", 32px tall, with EN selected on a white segment against a light grey track.

Below the card, centred, small grey 12px text "Maruti Jal · Water Supply".

Keep it calm, tight and functional. Generous internal spacing, but no wasted screen.
```

---

## 4. Dialog — Forgot password

### 4.1 Purpose
Tell the truth: there is no email reset yet, and here is exactly how to recover.

### 4.2 Layout

```
┌──────────────────────────────────────────────┐
│  🔑  Resetting your password             ✕   │
│                                              │
│  This app doesn't send password reset        │
│  emails yet. Because there's a single        │
│  owner account, a reset is done from the     │
│  server.                                     │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ npm run auth:reset-password        [⧉] │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Run that on the server and follow the       │
│  prompts. It asks for the email address      │
│  and a new password.                         │
│                                              │
│                              [ Got it ]      │
└──────────────────────────────────────────────┘
```

### 4.3 Region-by-region spec

| Element | Spec |
|---|---|
| Overlay | `rgba(15,23,42,0.5)` |
| Dialog | 440px, `#FFFFFF`, 12px radius, `shadow-xl`, 24px padding |
| Icon | 24px `KeyRound`, `#2563EB` |
| Title | H4 18px/600 `#111827`, 12px gap after the icon |
| Body | Body SM 14px/1.6 `#4B5563`, 16px below the title |
| Command block | `#F3F4F6` fill, 1px `#E5E7EB`, 8px radius, 12px/14px padding, JetBrains Mono 13px `#111827`. Copy button `Copy` 16px at right, 44×44 hit area |
| Close button | `Got it` — secondary, 40px, right-aligned |

### 4.4 Content and copy

Title: `Resetting your password`

Body: `This app doesn't send password reset emails yet. Because there's a single owner account, a reset is done from the server.`

After the command: `Run that on the server and follow the prompts. It asks for the email address and a new password.`

Button: `Got it`
Copy confirmation toast: `Command copied`

### 4.5 States

| State | Visual |
|---|---|
| Default | As drawn |
| Copy hover | Copy icon `#9CA3AF` → `#2563EB` |
| Copied | Icon swaps to a green `Check` for 2s, plus a toast |

### 4.6 Interactions
Escape and overlay click close it. Focus lands on `Got it`, and returns to the `Forgot password?` link on close.

### 4.7 Responsive
Full width minus 32px, max 440px. The command block scrolls horizontally rather than wrapping — a wrapped shell command invites mistyping.

### 4.8 Dark mode
Dialog `#1E293B`; command block `#0F172A` with a `#334155` border and `#F1F5F9` text. Icon `#3B82F6`.

### 4.9 Stitch prompt

```text
Design a small modal dialog for an internal business admin app, light theme, Inter font.

A 440px-wide white card, 12px radius, soft large shadow, 24px padding, sitting on a dark translucent overlay.

Top row: a 24px blue key icon (#2563EB) on the left, then an 18px semibold #111827 title "Resetting your password", with a small grey × close icon at the far right.

Below, 14px grey #4B5563 body text over three lines: "This app doesn't send password reset emails yet. Because there's a single owner account, a reset is done from the server."

Then a full-width code block: light grey #F3F4F6 background, 1px #E5E7EB border, 8px radius, 12px padding, containing the monospace text "npm run auth:reset-password" in 13px dark grey, with a small grey copy icon at the right edge.

Below that, another line of 14px grey text: "Run that on the server and follow the prompts. It asks for the email address and a new password."

At the bottom right, an outlined secondary button 40px tall reading "Got it".

Keep it plain and informative — no illustration, no warning colours, no alarm. This is guidance, not an error.
```

---

## 5. Dialog — Session expired

### 5.1 Purpose
Let the owner sign back in without losing the page they were on.

### 5.2 Layout

```
┌──────────────────────────────────────────────┐
│  🕐  Your session has expired                │
│                                              │
│  Sign in again to continue. You'll come      │
│  right back to this page.                    │
│                                              │
│  Password                                    │
│  ┌────────────────────────────────────────┐  │
│  │ ••••••••••                          👁 │  │
│  └────────────────────────────────────────┘  │
│  Signed in as owner@marutijal.com            │
│                                              │
│              [ Sign out ]  [ Continue ]      │
└──────────────────────────────────────────────┘
```

### 5.3 Region-by-region spec

| Element | Spec |
|---|---|
| Overlay | `rgba(15,23,42,0.5)`. **The page behind stays rendered** — its content is the reassurance that nothing was lost |
| Dialog | 440px, 12px radius, `shadow-xl`, 24px padding. Not dismissible by Escape or overlay click |
| Icon | 24px `Clock`, `#F97316` |
| Title | H4 `Your session has expired` |
| Body | Body SM `#4B5563` |
| Password field | 48px, autofocused. Email is **not** re-requested — it's shown as Caption `#4B5563` beneath |
| Actions | `Sign out` ghost · `Continue` primary, both 40px |

### 5.4 Content and copy

Title: `Your session has expired`
Body: `Sign in again to continue. You'll come right back to this page.`
Under the field: `Signed in as owner@marutijal.com`
Buttons: `Sign out` · `Continue`
Error: `Password is incorrect.`

### 5.5 States

| State | Visual |
|---|---|
| Default | Password autofocused, empty |
| Submitting | `Continue` spinner, label `Checking…` |
| Wrong password | 1px `#EF4444` field border, Caption error below. Field clears and refocuses |
| Success | Dialog fades out over 150ms. **No page reload** — the user is exactly where they were |
| Sign out | Clears the session, navigates to `/login` |

### 5.6 Interactions
Enter submits. Escape does nothing — dismissing this would leave a dead page behind it. Three wrong attempts here force a full sign-out and redirect to `/login`.

### 5.7 Responsive
Full width minus 32px, max 440px. Buttons become full-width and stack, `Continue` on top.

### 5.8 Dark mode
Dialog `#1E293B`; overlay `rgba(2,6,23,0.7)`. Clock icon `#FB923C`. Field fill `#0F172A`.

### 5.9 Stitch prompt

```text
Design a modal dialog for an internal business admin app, light theme, Inter font, shown over a blurred/darkened dashboard page behind it.

A 440px-wide white card, 12px radius, large soft shadow, 24px padding, on a dark translucent overlay. No close × icon — this dialog cannot be dismissed.

Top row: a 24px orange clock icon (#F97316) beside an 18px semibold #111827 title "Your session has expired".

Below it, 14px grey #4B5563 text: "Sign in again to continue. You'll come right back to this page."

Then a field labelled "Password" in 14px medium #111827, with a full-width input 48px tall, 4px radius, 1px #D1D5DB border, showing masked dots and a small grey eye icon inset right. The input has a visible blue focus ring (2px #2563EB with a 2px offset) because it is autofocused.

Directly beneath the input, small 12px grey text: "Signed in as owner@marutijal.com".

At the bottom right, two buttons 40px tall: a plain ghost button "Sign out" in grey text, then a solid blue #2563EB button "Continue" with white text and 8px radius.

Calm and reassuring, not alarming — this is a routine interruption, not an error.
```

---

## 6. Screen — Profile & preferences `/settings/account`

### 6.1 Purpose
The handful of account controls one admin actually needs.

### 6.2 Layout

```
Account                                                    
Your details and how the app behaves for you

┌─ Profile ───────────────────────────────────────────┐
│  Name                                               │
│  ┌───────────────────────────────────┐              │
│  │ Nishant Patel                     │              │
│  └───────────────────────────────────┘              │
│  Email                                              │
│  ┌───────────────────────────────────┐              │
│  │ owner@marutijal.com               │              │
│  └───────────────────────────────────┘              │
│  Changing your email requires your password         │
│                                                     │
│  Role      Owner                                    │
│  Last sign-in   Today, 6:05 am                      │
│                                     [ Save changes ]│
└─────────────────────────────────────────────────────┘

┌─ Preferences ───────────────────────────────────────┐
│  Language        [ English | ગુજરાતી ]              │
│  Theme           [ Light | Dark | System ]          │
└─────────────────────────────────────────────────────┘

┌─ Security ──────────────────────────────────────────┐
│  Password        Last changed 12 Jun 2026           │
│                                 [ Change password ] │
└─────────────────────────────────────────────────────┘
```

### 6.3 Region-by-region spec

| Region | Element | Spec |
|---|---|---|
| Page header | Title | H2 `Account`, subtitle Body SM `#4B5563` |
| Cards | Container | Max 720px, `#FFFFFF`, 12px radius, 1px `#E5E7EB`, 24px padding, 24px between cards |
| | Section title | H4 `#111827`, 1px `#E5E7EB` divider below, 16px gap |
| Fields | Input | 40px — the app standard, since this is a routine settings page, not the focused login |
| | Width | 320px, not full width. A name is not a paragraph |
| Read-only rows | Layout | Label Body SM `#4B5563` left, value Body SM/500 `#111827` right, 40px row, 1px divider between |
| Segmented | Control | 36px, `#F3F4F6` track, 4px radius, active segment `#FFFFFF` + `shadow-sm` + `#111827` |
| Actions | Save | Primary 40px, right-aligned in the card footer. **Disabled until something changes** |

### 6.4 Content and copy

| Element | Copy |
|---|---|
| Page title | `Account` |
| Page subtitle | `Your details and how the app behaves for you` |
| Sections | `Profile` · `Preferences` · `Security` |
| Email helper | `Changing your email requires your password` |
| Language options | `English` · `ગુજરાતી` |
| Theme options | `Light` · `Dark` · `System` |
| Password row | `Last changed 12 Jun 2026` |
| Button | `Change password` |
| Save | `Save changes` |
| Success toast | `Account updated` |
| Language toast | `Language changed to ગુજરાતી` |

### 6.5 States

| State | Visual |
|---|---|
| Loading | Skeleton bars at each field position; card frames and section titles already drawn |
| Pristine | `Save changes` disabled at 40% opacity |
| Dirty | Save enabled. A Caption `#4B5563` `Unsaved changes` appears to its left |
| Saving | Spinner, label `Saving…` |
| Saved | Toast `Account updated`; button returns to disabled |
| Email changed | A password confirmation dialog appears before saving |
| Validation error | Field border `#EF4444`, message below |
| Language switched | Applies **immediately**, no reload, no save needed — the whole page re-renders in the new language |
| Never changed password | Row reads `Never changed` in `#4B5563` |

### 6.6 Interactions
Language and theme apply instantly and persist on their own — they are preferences, not form data, and making someone press Save to see a theme change is needlessly indirect. Name and email are form data and require Save. Navigating away while dirty raises a confirm.

### 6.7 Responsive
Below `md`: cards full width, 16px padding, inputs full width. Segmented controls stay inline until 480px, then go full width. The Save button becomes full width in a sticky card footer.

### 6.8 Dark mode
Page `#0F172A`, cards `#1E293B`, borders `#334155`. Segmented track `#0F172A`, active segment `#334155` with `#F1F5F9` text. Read-only values `#F1F5F9`, labels `#94A3B8`.

### 6.9 Stitch prompt

```text
Design an account settings page for an internal business admin app, light theme, Inter font. It sits inside an app shell with a 240px left sidebar and a 64px top bar (show these lightly for context).

Page background #F8FAFC. Content area 24px padding, max width 720px.

Page header: a 28px semibold #111827 title "Account", with 14px grey #4B5563 subtitle "Your details and how the app behaves for you" beneath it.

Then three stacked white cards, each 12px radius, 1px #E5E7EB border, 24px padding, 24px apart.

Card 1 "Profile": an 18px semibold heading with a thin divider beneath. Then a field labelled "Name" containing a 320px-wide input, 40px tall, 4px radius, 1px #D1D5DB border, with the value "Nishant Patel". Below it a field labelled "Email" with the value "owner@marutijal.com" and small 12px grey helper text "Changing your email requires your password". Then two read-only rows separated by thin dividers, each with a grey label on the left and a dark value right-aligned: "Role — Owner" and "Last sign-in — Today, 6:05 am". At the bottom right, a blue "Save changes" button, 40px tall, shown greyed out and disabled.

Card 2 "Preferences": two rows, each with a grey label on the left and a segmented control on the right. First "Language" with segments "English" and "ગુજરાતી", English selected. Second "Theme" with segments "Light", "Dark", "System", Light selected. Segmented controls are 36px tall on a light grey track with the selected segment white with a subtle shadow.

Card 3 "Security": one row, grey label "Password" on the left with small grey text "Last changed 12 Jun 2026", and an outlined blue "Change password" button on the right.

Clean, calm and dense — a settings page, not a marketing page.
```

---

## 7. Modal — Change password

### 7.1 Purpose
Rotate the password, with the current one as proof.

### 7.2 Layout

```
┌──────────────────────────────────────────────┐
│  Change password                         ✕   │
│                                              │
│  Current password                            │
│  ┌────────────────────────────────────────┐  │
│  │ ••••••••••                          👁 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  New password                                │
│  ┌────────────────────────────────────────┐  │
│  │ ••••••••••••••                      👁 │  │
│  └────────────────────────────────────────┘  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  Strong                   │
│  At least 8 characters                       │
│                                              │
│  Confirm new password                        │
│  ┌────────────────────────────────────────┐  │
│  │ ••••••••••••••                      👁 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ⓘ  You'll stay signed in here. Any other    │
│     devices will be signed out.              │
│                                              │
│                  [ Cancel ]  [ Update ]      │
└──────────────────────────────────────────────┘
```

### 7.3 Region-by-region spec

| Element | Spec |
|---|---|
| Modal | 480px, 12px radius, `shadow-xl`, 24px padding |
| Fields | 40px, full width, 16px gap |
| Strength meter | 4px tall, full radius, `#E5E7EB` track. Fill: `#EF4444` weak (<8 chars) → `#F97316` fair → `#22C55E` strong (12+). Label Caption to the right |
| Helper | Caption `#4B5563` below the meter |
| Notice | `#DBEAFE` fill, 1px `#2563EB`, 8px radius, 12px padding, 16px `Info` `#1D4ED8`, Caption `#1D4ED8` |
| Footer | 1px `#E5E7EB` top border, right-aligned `Cancel` ghost + `Update password` primary |

### 7.4 Content and copy

Title: `Change password`
Labels: `Current password` · `New password` · `Confirm new password`
Helper: `At least 8 characters`
Strength: `Weak` · `Fair` · `Strong`
Notice: `You'll stay signed in here. Any other devices will be signed out.`
Buttons: `Cancel` · `Update password`
Success toast: `Password updated`

**Errors**

| Situation | Message |
|---|---|
| Current password wrong | `That's not your current password.` |
| New too short | `Use at least 8 characters` |
| Confirmation mismatch | `Passwords don't match` |
| Same as current | `Choose a password you haven't used here before` |

### 7.5 States

| State | Visual |
|---|---|
| Default | Current password autofocused. `Update password` disabled until all three are filled |
| Typing new | Strength meter updates live. **This is the one place live feedback is right** — it's guidance, not judgement, and it's the only way to know before submitting |
| Mismatch | Caught on blur of the confirm field, not while typing |
| Submitting | Spinner, label `Updating…`, all fields disabled |
| Current wrong | Danger banner at the top; the current-password field clears and refocuses. New and confirm are **kept** |
| Success | Modal closes, toast `Password updated`, and the `Last changed` row on the page behind updates |

### 7.6 Interactions
Tab runs current → new → confirm → Update. Enter submits from any field. Escape closes, with a confirm if anything is typed. Each field has its own independent show/hide toggle.

### 7.7 Responsive
Full width minus 32px, max 480px. Buttons full-width and stacked, `Update password` on top.

### 7.8 Dark mode
Modal `#1E293B`, field fill `#0F172A`, borders `#334155`. Strength track `#334155`; fills lift to `#F87171` / `#FB923C` / `#4ADE80`. Notice `#1E3A8A` fill, `#3B82F6` border, `#BFDBFE` text.

### 7.9 Stitch prompt

```text
Design a modal dialog for changing a password, in an internal business admin app. Light theme, Inter font.

A 480px-wide white card, 12px radius, large soft shadow, 24px padding, on a dark translucent overlay.

Header: an 18px semibold #111827 title "Change password" on the left, a small grey × close icon on the right.

Three stacked fields, each with a 14px medium #111827 label above a full-width input 40px tall, 4px radius, 1px #D1D5DB border, showing masked dots and a small grey eye icon inset on the right:
1. "Current password"
2. "New password"
3. "Confirm new password"

Directly below the second field, a password strength bar: 4px tall, fully rounded, light grey #E5E7EB track filled about 70% in green #22C55E, with the small 12px green label "Strong" to its right. Beneath the bar, 12px grey helper text "At least 8 characters".

Below the third field, a light blue info panel: #DBEAFE background, 1px #2563EB border, 8px radius, 12px padding, a small blue info icon on the left, and 12px blue #1D4ED8 text "You'll stay signed in here. Any other devices will be signed out."

Footer: a thin top divider, then two right-aligned buttons 40px tall — a grey ghost "Cancel" and a solid blue #2563EB "Update password" with white text and 8px radius.

Clean and functional, generous field spacing, no decoration.
```

---

## 8. The user menu (shell component)

Lives in the topbar and is owned by this module.

**Trigger:** 32px circular avatar with the user's initials in white on `#2563EB`, plus a 16px `ChevronDown` in `#4B5563`.

**Menu:** 240px popover, 8px radius, 1px border, `shadow-lg`, 4px padding.

```
┌────────────────────────────┐
│  Nishant Patel             │
│  owner@marutijal.com       │
├────────────────────────────┤
│  ⚙  Account settings       │
│  🌐  Language      EN ›    │
│  🌙  Theme       System ›  │
├────────────────────────────┤
│  ⏻  Sign out               │
└────────────────────────────┘
```

| Element | Spec |
|---|---|
| Header block | Name Body SM/500 `#111827`; email Caption `#4B5563`. 12px padding, 1px divider below |
| Item | 36px, 12px padding, 16px icon, 8px gap, Body SM `#111827`. Hover `#F3F4F6` |
| Value item | Current value right-aligned in Caption `#4B5563` with a `ChevronRight`; opens a submenu |
| Sign out | `#EF4444` text and icon, above a 1px divider |

Sign out shows a confirm dialog only if a form is currently dirty; otherwise it goes immediately.

---

## 9. Module design checklist

- [ ] Card is 400px, centred, on `#F8FAFC` — no split brand panel
- [ ] Login inputs are 48px; settings inputs are 40px
- [ ] Email autofocused on load, with a visible focus ring
- [ ] **Wrong email and wrong password produce the identical message**
- [ ] After a failed attempt the email is kept, the password clears, focus moves to password
- [ ] Password fields have a click-to-reveal toggle, never reveal on hover
- [ ] Rate-limit state shows a live countdown in the disabled button
- [ ] Language toggle present **on the login page**, not only inside the app
- [ ] All copy written in both English and Gujarati, with layout checked at the longer length
- [ ] Session-expired dialog cannot be dismissed and does not reload the page behind it
- [ ] Forgot-password dialog is informational — no alarm colours
- [ ] Strength meter is the only live-while-typing feedback in the module
- [ ] Language and theme apply instantly; name and email require Save
- [ ] Every screen designed in light and dark
- [ ] Mobile: card top-aligned at 48px so it doesn't jump when the keyboard opens
