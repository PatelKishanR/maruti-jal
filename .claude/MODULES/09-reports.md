# Module 9 — Reports & Exports

**Goal:** produce the documents that get printed, handed over, or checked against a register.

---

## 1. Reports

Each is a filtered view with a defined output. All seven are producible from the schema with no additional data capture.

| Report | Answers | Filters | Output |
|---|---|---|---|
| **Daily collection sheet** | What came in today, from whom, and in what form | Date | Screen · CSV · **PDF** |
| **Staff outstanding statement** | Everything one staff member owes: order balances, coin dues, jars out | Staff, date range | Screen · CSV · **PDF** |
| **Coin reconciliation** | Per coin type: opening, issued, returned, received, adjusted, closing | Coin type, date range | Screen · CSV |
| **Party order statement** | A client-facing statement of scheduled deliveries and payments received | Party order | Screen · **PDF** |
| **Product movement** | Units and litres sold per product, per channel | Date range, product | Screen · CSV |
| **Profit & loss summary** | Income by channel minus expenses by category | Date range | Screen · CSV |
| **Jar reconciliation** | Issued, returned empty, returned filled, lost, still out | Date range, staff, product | Screen · CSV |

---

## 2. The three that get printed

These are shown to other people, so they carry a header with the business name, the report title, the period covered, and the generation date.

### 2.1 Daily collection sheet

The end-of-day tally. Cash collected, coins collected (by type, with value), walk-in takings, party payments — and the total that should be in the drawer.

Used to check the physical cash against what the system says. If they disagree, this sheet shows exactly which line to look at.

### 2.2 Staff outstanding statement

Everything one staff member owes, in one document:

- Open delivery orders with balances
- Open coin issues with pending amounts
- Jars still out, by product, with the order each came from and how many days ago

Handed to the staff member during a settlement conversation.

### 2.3 Party order statement

A client-facing document: every scheduled delivery day with its items and totals, every payment received with its date, and the closing balance.

Given to the party at the end of an event, or during it if they ask what they owe.

---

## 3. Exports

### 3.1 CSV from any list

Every list page in the app has an **Export CSV** action that respects whatever filters are currently applied. Filter to "Ramesh, this month, payment pending", export, and that's exactly what you get.

**Encoding:** UTF-8 **with a byte-order mark**. Without the BOM, Excel on Windows renders Gujarati as mojibake while every other tool looks fine — so it gets reported as a broken export weeks later. See [I18N.md](../I18N.md) §6.2.

### 3.2 PDF

Generated server-side with a **Gujarati-capable font embedded**. Without it, Gujarati characters render as empty boxes.

Gujarati also requires correct **complex-script shaping** for conjuncts and matras. This must be verified in Phase 1 with a real Gujarati name and address — not at the end of the project. Discovering the PDF library cannot shape Gujarati during the final week means replacing the export layer.

---

## 4. Rules

| Rule | Detail |
|---|---|
| **Reports read, never write** | A report can never modify a record. It is a view over data captured elsewhere |
| **Headings and labels come from the message catalogues** | A statement generated in Gujarati is fully Gujarati apart from codes and figures |
| **Figures use Latin digits in both languages** | Consistent with the rest of the app — these documents get checked against bank statements and registers |
| **Every report states its period and generation time** | So a printed copy found later is not mistaken for current |
| **Reports use the same cached rollups as the lists** | So a report and the screen it came from can never disagree |

---

## 5. What is not included

- **Scheduled or emailed reports.** Generated on demand only. Adding scheduling is straightforward later; nobody has asked for it
- **A custom report builder.** Seven fixed reports covering the actual questions beats a builder that requires learning. If an eighth question turns up regularly, it becomes an eighth report
- **Accounting-format statements.** This is not a bookkeeping system — see [07-expenses.md](07-expenses.md) §7
