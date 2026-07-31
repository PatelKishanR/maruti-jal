# Module 1 — Staff Management

**Goal:** know who your delivery people are and, from one screen, everything each of them currently owes you.

---

## 1. In plain English

Add each delivery person once — name, phone, address, and any note ("morning route only", "brother of Ramesh"). After that, the staff record becomes the hub.

Open a staff member and you see every order they've taken, every coin packet issued to them, how much cash they still owe, and how many jars are still out with them. The list page shows those same numbers per row, so you can scan who to chase without opening anything.

---

## 2. User stories

| # | As the admin, I want to… | So that… |
|---|---|---|
| S1 | add a staff member with name, phone, address and an optional note | I can assign deliveries to them |
| S2 | search the list by name, phone or address | I find someone instantly without scrolling |
| S3 | sort, filter and page through the list | it stays usable as the team grows |
| S4 | open a staff detail page | I see their full history in one place |
| S5 | edit their details | I can fix a wrong phone number or a new address |
| S6 | deactivate someone who has left | they leave dropdowns but their history survives |
| S7 | see outstanding cash and jars out per staff, right on the list | I know who to chase at a glance |
| S8 | be stopped from deactivating someone who still owes me | nobody disappears from the system with money outstanding |

---

## 3. Screens

| Route | Screen | Notes |
|---|---|---|
| `/staff` | List | KPI strip + table |
| `/staff/new` | Create form | |
| `/staff/[id]` | Detail | Tabs: Overview · Delivery Orders · Coin Issues · Payments · Activity |
| `/staff/[id]/edit` | Edit form | |

### 3.1 Detail page tabs

| Tab | Contents |
|---|---|
| **Overview** | Contact details, note, joined date, plus four summary cards: cash outstanding, jars out, coin dues, lifetime revenue |
| **Delivery Orders** | Their orders, newest first, with payment and return badges. Filterable to "unsettled only" |
| **Coin Issues** | Their coin issue register rows — issued, returned, collected, pending |
| **Payments** | Every payment they've made, across orders and coin issues, as one timeline |
| **Activity** | Audit trail — what changed on this record, when, and by whom |

---

## 4. Form — Add / Edit Staff

| Field | Type | Required | Validation |
|---|---|---|---|
| Full name | text | ✅ | 1–120 characters. **No script restriction** — Gujarati or English |
| Phone | text | ✅ | Indian mobile format. Unique among active staff |
| Alternate phone | text | ✖ | Same format |
| Address | textarea | ✖ | Any script |
| Note | textarea | ✖ | Any script |
| Joined on | date | ✖ | Cannot be in the future |
| Active | toggle | — | Edit form only; defaults on |

---

## 5. Table — Staff list

**Columns:** Code · Name · Phone · Address · Outstanding Cash · Jars Out · Coin Dues · Status · Actions

| Behaviour | Detail |
|---|---|
| **Search** | Name, phone, alternate phone, address — combined into one indexed blob, so it is a single fast lookup rather than four separate comparisons |
| **Filters** | Status (Active / Inactive / All) · Has outstanding balance · Has jars out |
| **Sort** | Name · Outstanding cash · Jars out · Created date |
| **Row actions** | View · Edit · Deactivate / Reactivate |
| **Row click** | Opens the detail page |

### 5.1 KPI cards

Total staff · Active staff · Total cash outstanding across all staff · Total jars currently out

Each card deep-links into the list with the matching filter applied.

---

## 6. Business rules

| Rule | Reasoning |
|---|---|
| Phone is unique among non-deleted staff | Prevents duplicate records for the same person. The number frees up if someone is removed, so a returning worker can be re-added |
| A staff member with **any** outstanding balance cannot be deactivated | The UI blocks it and explains which balance is blocking. Otherwise dues quietly vanish from every "active staff" report |
| Deactivating never deletes | Historical orders keep pointing at the record and still render correctly |
| Hard deletion is impossible at the database level | Every reference uses a restrict constraint, so a staff row with orders cannot be removed even directly in the database console |
| Outstanding figures are cached, not computed on read | So the list can filter and sort on them at any data volume. They are recalculated inside the same transaction as any payment or return |

---

## 7. Notes for implementation

- This is the **reference module** — built in Phase 2 alongside the shared DataTable. When it is done, the table code must contain zero Staff-specific logic
- It is also the first real test of Gujarati input end to end: create a staff member with a Gujarati name and address, then find them by search, sort the list, and open the detail page
- The three outstanding figures on each row come from three different modules (orders, coin issues, returns). They are read from cached columns, never assembled by looping over related records
