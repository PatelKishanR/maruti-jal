import type { ValueTransformer } from 'typeorm';

/**
 * numeric(12,2) <-> number.
 *
 * Writes as a string so JS float serialisation can never round a rupee value.
 * Reads back as a number for DISPLAY ONLY.
 *
 * RULE: never sum money in TypeScript. All monetary arithmetic happens in
 * PostgreSQL — generated columns, triggers, SQL aggregates. A
 * `reduce((a, b) => a + b)` over amounts is a code-review failure.
 * See .claude/DATA-MODEL.md D-4
 */
/**
 * `undefined` MUST pass through untouched; only an explicit `null` becomes NULL.
 *
 * Collapsing `undefined` to `null` makes TypeORM bind an explicit NULL rather
 * than omitting the column, so the column's `DEFAULT 0` never applies and the
 * insert dies on `null value in column "subtotal_amount" violates not-null`.
 *
 * Every trigger-maintained money rollup on delivery_orders, coin_issues and
 * party_orders is `NOT NULL DEFAULT 0` and is never supplied by the
 * application — so this single line decides whether those three modules can
 * create a record at all.
 */
export const money: ValueTransformer = {
  to: (v?: number | string | null) =>
    v === undefined ? undefined : v === null ? null : typeof v === 'string' ? v : v.toFixed(2),
  from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)),
};

/** numeric(14,6) — per-coin prices, which divide and rarely land clean. */
export const rate6: ValueTransformer = {
  to: (v?: number | string | null) =>
    v === undefined ? undefined : v === null ? null : typeof v === 'string' ? v : v.toFixed(6),
  from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)),
};

/** numeric(7,3) — litres. */
export const qty3: ValueTransformer = {
  to: (v?: number | string | null) =>
    v === undefined ? undefined : v === null ? null : typeof v === 'string' ? v : v.toFixed(3),
  from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)),
};

/** bigint identity -> number. Safe: our document counters never approach 2^53. */
export const bigintToNumber: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | number | null) =>
    v === null || v === undefined ? null : Number(v),
};
