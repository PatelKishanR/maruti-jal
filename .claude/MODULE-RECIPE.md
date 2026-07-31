# Adding a module

The exact sequence, derived from building Staff (the reference module) and refined by Products, Coin Types and Expense Categories.

Follow it in order. Each step depends on the one before.

---

## 0. Read before writing

| Read | For |
|---|---|
| `.claude/MODULES/NN-name.md` | Business rules, user stories |
| `.claude/design/MODULES/NN-name.md` | Layout, states, **literal copy** |
| `src/lib/db/entities/<x>.entity.ts` | Which columns actually exist |
| `src/lib/repositories/<x>.repository.ts` | What queries already exist |

**Copy the design's English strings verbatim.** They were written to be read at speed by one person under time pressure; a paraphrase loses that.

**The design will describe figures that come from other modules.** Anything not backed by a column in *your* entity is a `// TODO(wave-N)` constant in the **service** — never a join bolted onto your repository. One repository per entity is not negotiable.

---

## 1. `src/lib/table/configs/<module>.ts`

**Write this first.** It is the single source of truth for the sort allowlist, and both the client table and the server repository import it.

```ts
export const STAFF_SORT_COLUMNS = {
  name: "s.name",
  code: "s.staffNo",     // the identity number, so STF-9 sorts before STF-10
} as const;

export type StaffSortKey = keyof typeof STAFF_SORT_COLUMNS;

export const staffTableConfig: TableConfig = {
  sortable: STAFF_SORT_COLUMNS,
  searchable: ["s.search_blob"],
  filters: { status: z.enum(["active", "inactive", "all"]).catch("active") },
  defaultSort: { key: "name", dir: "asc" },
};
```

Rules:
- **Keep it free of server imports.** Zod and types only — a client component imports it for column definitions.
- **Never duplicate the sort map in the repository.** Import `STAFF_SORT_COLUMNS` there. This is not hypothetical: Products shipped with six keys in the repository and four in the config, and a service was already sorting by `sortOrder` — a key the config had never heard of, so the allowlist that is supposed to own it was being bypassed.
- **The Zod `?sort=` enum in `validation/<module>.ts` is a third copy.** Derive it from the map (`keyof typeof`) so a key with no SQL column behind it is a compile error rather than a runtime throw.
- Only list a sort key whose SQL column exists *today*.

Every repository's `searchPaginated` must also:
- use **`skip`/`take`, never `offset`/`limit`** — with a to-many join, `LIMIT 10` limits *joined rows*, so page 1 can show 3 records
- append a **stable tiebreaker**. Without one, equal-valued rows reshuffle between pages: the user sees one record twice and never sees another. A generated identity column (`orderNo`, `issueNo`) is ideal, since it doubles as "newest first".

## 2. `src/lib/validation/<module>.ts`

- Build a plain field object first, then derive `createXSchema` and `updateXSchema` from it. `.refine()` returns a `ZodEffects` you cannot `.extend()`.
- **Messages are catalogue KEYS, not sentences** — the client renders them in the active language.
- **Length limits only on human text. Never `[A-Za-z]`** — it silently blocks Gujarati and presents as "the app won't let me save". Phone is the one exception.
- Optional text transforms `"" → null`.
- List-query params: `.optional().catch(undefined)` so a stale bookmarked URL degrades instead of 422-ing.
- Blank numerics need `z.preprocess`, not `z.coerce.number()` — coerce turns `""` into `0`, which saves an untouched price as free.

## 3. `src/lib/dto/<module>.dto.ts`

- Flat interfaces, `type`-only entity imports.
- Timestamps as ISO strings; business dates as `'YYYY-MM-DD'`.
- **Carry cross-module figures from day one**, even when they return zero. The UI is then written against the final shape and Wave N only changes the number.

## 4. `src/lib/services/<module>.service.ts`

- `import "server-only"`.
- `parseListQuery(raw, config)` — this is the injection defence, do not hand-roll it.
- **Repositories only.** Never `getRepository`, never raw SQL in a service.
- `withTx` + `findByIdForUpdate` for every read-modify-write.
- Throw `NotFoundError` / `ConflictError` with a `messageKey` and rich `meta` for anything a form must explain.
- **Return DTOs, never entities.**
- **Never sum money in TypeScript.** If you need a total, add a SQL aggregate to the repository.

## 5. `src/app/api/<module>/**/route.ts`

`createApiHandler` only — no logic in the route:

```ts
export const GET = createApiHandler({
  name: "GET /api/staff",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  query: staffListQuerySchema,
  handler: ({ query }) => listStaff(query),
});
```

Convention: reads `OWNER/ADMIN/MANAGER/VIEWER`, writes `OWNER/ADMIN`. Add `runtime = "nodejs"`.

Every module ships an `options` route returning `ComboboxOption[]`, because later modules will pick from it.

## 6. `src/lib/api/routes.ts`

Add the module's paths. Both API paths and app paths, so KPI deep links and row `href`s are typed rather than string literals.

## 7. Pages

| File | Kind | Notes |
|---|---|---|
| `page.tsx` | server | `await searchParams` → `api.get` → `PageHeader` + `KpiRow` + table |
| `<module>-table.tsx` | client | columns, chips, filters, **both** empty states |
| `<module>-badges.tsx` | shared | status precedence; no `"use client"`, so server detail and client table share one implementation |
| `<module>-actions.tsx` | client | `⋯` menu + dialogs, used by row and detail header |
| `<module>-form.tsx` | client | **one file for create and edit** |
| `[id]/page.tsx` | server | header, badges, summary |
| `[id]/<module>-detail-tabs.tsx` | client | `?tab=` in the URL |
| `loading.tsx` | — | `DataTableSkeleton`, first load only |
| `error.tsx` | client | `ErrorState` + `reset` |

Gotchas learned the hard way:

- **The list response carries `{ result, stats }`** so the KPI strip is one round trip, not two.
- **Pass `totalCount` into the table.** `DataTable` only sees URL params, so a module with an implicit default filter (Staff defaults to Active) would otherwise show "no results" when it means "none yet".
- **Wrap the row `⋯` menu in `onClick={e => e.stopPropagation()}`** or the row navigates out from under the menu.
- **A `LucideIcon` cannot cross the server→client boundary as a prop** — it's a function. Pass a name, or make the strip a client island.
- Detail pages catch `ApiError.status === 404` and render the module's own not-found; rethrow everything else.

## 8. Message keys

**Do not edit `messages/*.json`.** List the keys you need. Then verify mechanically: extract every `t("…")`, enumerate template-literal families by hand, and diff against your list.

## 9. Gate

```bash
npx tsc --noEmit && node scripts/check-layering.mjs
```

Both clean, or it isn't done.

---

## If the kernel is missing something

**Report it. Do not patch it.** `src/components/{ui,form,common,data-table}` and `src/lib/table/{types,parse,apply}.ts` are shared by nine modules — a change that suits yours silently changes theirs. Every kernel gap found so far turned out to be worth fixing centrally:

| Found by | Gap | Fix |
|---|---|---|
| Products | `KpiCard` forced 28px mono, wrong for a card holding a product *name* | `valueTypography="name"` |
| Products, Staff | `FormActions` disabled the primary until dirty — wrong for **create**, where pressing it is how you learn what's required | `alwaysEnabled` |
| Products | `EmptyState` called a message with an unfilled `{filters}` placeholder → runtime throw | fixed the catalogue string |
| Products | `KpiCard` trend labels read a namespace the keys weren't in | moved the keys |
| Products, Coin Types, Staff | `common.status.*` missing entirely — **every `StatusBadge` in the app would throw** | added |
| Coin Types | no 6dp formatter for per-coin value | `formatPerCoinValue` |
| Staff | sort allowlist duplicated in config *and* repository | config is now the single source |
