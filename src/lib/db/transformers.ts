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
export const money: ValueTransformer = {
  to: (v?: number | string | null) =>
    v === null || v === undefined ? null : typeof v === 'string' ? v : v.toFixed(2),
  from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)),
};

/** numeric(14,6) — per-coin prices, which divide and rarely land clean. */
export const rate6: ValueTransformer = {
  to: (v?: number | string | null) =>
    v === null || v === undefined ? null : typeof v === 'string' ? v : v.toFixed(6),
  from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)),
};

/** numeric(7,3) — litres. */
export const qty3: ValueTransformer = {
  to: (v?: number | string | null) =>
    v === null || v === undefined ? null : typeof v === 'string' ? v : v.toFixed(3),
  from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)),
};

/** bigint identity -> number. Safe: our document counters never approach 2^53. */
export const bigintToNumber: ValueTransformer = {
  to: (v?: number | null) => v,
  from: (v?: string | number | null) =>
    v === null || v === undefined ? null : Number(v),
};
