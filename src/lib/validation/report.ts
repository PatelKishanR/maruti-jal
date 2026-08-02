import { z } from "zod";
import { addDays, isBusinessDate, monthBounds, todayIST } from "@/lib/dates";

/**
 * Reports — slugs, filters and the range arithmetic behind them.
 *
 * CLIENT-SAFE ON PURPOSE. Zod and pure string arithmetic only, no `server-only`
 * import, so the filter panel and the service share ONE definition of what each
 * report is asked for. The alternative — a descriptor in the client and a
 * schema on the server — is two lists that drift, and the symptom is a filter
 * the URL carries and the query ignores.
 *
 * Spec: design/MODULES/09-reports.md §3, §4.3
 */

/* ── The seven reports ───────────────────────────────────────────────────── */

export const REPORT_SLUGS = [
  "daily-collection",
  "staff-outstanding",
  "coin-reconciliation",
  "party-statement",
  "product-movement",
  "profit-loss",
  "jar-reconciliation",
] as const;

export type ReportSlug = (typeof REPORT_SLUGS)[number];

export function isReportSlug(value: string): value is ReportSlug {
  return (REPORT_SLUGS as readonly string[]).includes(value);
}

/* ── Presets ─────────────────────────────────────────────────────────────── */

export const REPORT_PRESETS = [
  "today",
  "yesterday",
  "this-month",
  "last-month",
  "last-90",
  "this-year",
  "custom",
] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

/** Which fields a report asks for — drives the filter panel and the subtitle. */
export type ReportFilterField =
  | "date"
  | "range"
  | "staff"
  | "partyOrder"
  | "coinType"
  | "products";

export interface ReportDefinition {
  slug: ReportSlug;
  /** Lucide name from `src/components/common/icons.ts`. */
  icon:
    | "cash"
    | "staff"
    | "coin"
    | "party"
    | "product"
    | "trendUp"
    | "jarsOut";
  /** Handed over on paper — gets a `Print` button and an A4 layout. §12 */
  printable: boolean;
  fields: readonly ReportFilterField[];
  presets: readonly ReportPreset[];
  defaultPreset: ReportPreset;
  /**
   * The filter that must be set before anything can run. Until it is, the
   * screen shows the prompt state rather than an empty table. §4.5
   */
  requires: "staff" | "partyOrder" | null;
}

export const REPORT_DEFINITIONS: Record<ReportSlug, ReportDefinition> = {
  "daily-collection": {
    slug: "daily-collection",
    icon: "cash",
    printable: true,
    fields: ["date"],
    presets: ["today", "yesterday"],
    defaultPreset: "today",
    requires: null,
  },
  "staff-outstanding": {
    slug: "staff-outstanding",
    icon: "staff",
    printable: true,
    fields: ["staff", "range"],
    presets: ["this-month", "last-month", "last-90"],
    defaultPreset: "last-90",
    requires: "staff",
  },
  "coin-reconciliation": {
    slug: "coin-reconciliation",
    icon: "coin",
    printable: false,
    fields: ["coinType", "range"],
    presets: ["this-month", "last-month", "this-year"],
    defaultPreset: "this-month",
    requires: null,
  },
  "party-statement": {
    slug: "party-statement",
    icon: "party",
    printable: true,
    // No range: the party order defines its own period. §8.3
    fields: ["partyOrder"],
    presets: [],
    defaultPreset: "custom",
    requires: "partyOrder",
  },
  "product-movement": {
    slug: "product-movement",
    icon: "product",
    printable: false,
    fields: ["products", "range"],
    presets: ["this-month", "last-month", "last-90"],
    defaultPreset: "this-month",
    requires: null,
  },
  "profit-loss": {
    slug: "profit-loss",
    icon: "trendUp",
    printable: false,
    fields: ["range"],
    presets: ["this-month", "last-month", "this-year"],
    defaultPreset: "this-month",
    requires: null,
  },
  "jar-reconciliation": {
    slug: "jar-reconciliation",
    icon: "jarsOut",
    printable: false,
    fields: ["range", "staff", "products"],
    presets: ["this-month", "last-90", "this-year"],
    defaultPreset: "last-90",
    requires: null,
  },
};

/* ── Query schema ────────────────────────────────────────────────────────── */

/** `'YYYY-MM-DD'` — business dates are strings end to end (ARCHITECTURE §9.2). */
const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isBusinessDate(value));

const id = z.string().uuid();

export const reportSlugParamsSchema = z.object({
  slug: z.enum(REPORT_SLUGS, { message: "common.notFound" }),
});

/**
 * ONE schema for all seven reports, every member optional.
 *
 * A stale bookmark must degrade rather than 422 — `.catch(undefined)` on every
 * member means `?staffId=lol&preset=quarter` falls back to the report's own
 * defaults instead of throwing the screen away. MODULE-RECIPE §2.
 */
export const reportQuerySchema = z.object({
  preset: z.enum(REPORT_PRESETS).optional().catch(undefined),
  date: businessDate.optional().catch(undefined),
  from: businessDate.optional().catch(undefined),
  to: businessDate.optional().catch(undefined),
  staffId: id.optional().catch(undefined),
  partyOrderId: id.optional().catch(undefined),
  coinTypeId: id.optional().catch(undefined),
  /** Comma-separated product ids. Empty or malformed → all products. */
  productIds: z
    .string()
    .max(1000)
    .optional()
    .catch(undefined),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

/** The CSV export takes the same filters plus the format it is asked for. */
export const reportExportQuerySchema = reportQuerySchema.extend({
  format: z.enum(["csv"]).default("csv").catch("csv"),
});

export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;

/* ── Resolution ──────────────────────────────────────────────────────────── */

/** A range longer than this is a mis-typed URL, not a question. */
const MAX_RANGE_DAYS = 400;

export interface ReportFilters {
  slug: ReportSlug;
  preset: ReportPreset;
  /** Inclusive bounds. Single-date reports set both to `date`. */
  from: string;
  to: string;
  /** The one date single-day reports care about. */
  date: string;
  staffId: string | null;
  partyOrderId: string | null;
  coinTypeId: string | null;
  productIds: string[];
  /** True when the report cannot run until a subject is chosen. §4.5 */
  awaitingSubject: boolean;
}

/**
 * `?preset=…&from=…` → concrete bounds, resolved identically on both sides of
 * the API so the URL and the figures cannot disagree.
 *
 * Pure string arithmetic through `lib/dates`, so a client component can call it
 * to label the panel without a second round trip.
 *
 * Future dates are CLAMPED rather than rejected everywhere except the daily
 * collection sheet, which needs to say "that date hasn't happened yet". §5.5
 */
export function resolveReportFilters(
  slug: ReportSlug,
  query: ReportQuery,
  today: string = todayIST(),
): ReportFilters {
  const definition = REPORT_DEFINITIONS[slug];
  const preset = pickPreset(definition, query);
  const window = resolveWindow(preset, query, today);

  const date =
    definition.fields.includes("date")
      ? (query.date ?? (preset === "yesterday" ? addDays(today, -1) : today))
      : window.to;

  const productIds = (query.productIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => id.safeParse(value).success);

  const staffId = query.staffId ?? null;
  const partyOrderId = query.partyOrderId ?? null;

  return {
    slug,
    preset,
    from: definition.fields.includes("date") ? date : window.from,
    to: definition.fields.includes("date") ? date : window.to,
    date,
    staffId,
    partyOrderId,
    coinTypeId: query.coinTypeId ?? null,
    productIds,
    awaitingSubject:
      (definition.requires === "staff" && !staffId) ||
      (definition.requires === "partyOrder" && !partyOrderId),
  };
}

function pickPreset(
  definition: ReportDefinition,
  query: ReportQuery,
): ReportPreset {
  if (query.preset === "custom") return "custom";
  if (query.preset && definition.presets.includes(query.preset)) {
    return query.preset;
  }
  // Explicit bounds without a named preset ARE a custom range.
  if (query.from || query.to || (definition.fields.includes("date") && query.date)) {
    return definition.fields.includes("date") ? "custom" : "custom";
  }
  return definition.defaultPreset;
}

function resolveWindow(
  preset: ReportPreset,
  query: ReportQuery,
  today: string,
): { from: string; to: string } {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const day = addDays(today, -1);
      return { from: day, to: day };
    }
    case "this-month":
      return { from: monthBounds(today).from, to: today };
    case "last-month": {
      const bounds = monthBounds(addDays(monthBounds(today).from, -1));
      return bounds;
    }
    case "last-90":
      return { from: addDays(today, -89), to: today };
    case "this-year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "custom":
    default: {
      const from = query.from ?? query.date ?? monthBounds(today).from;
      const to = query.to ?? query.date ?? today;
      if (from > to) return { from: to, to: from };
      if (spanDays(from, to) > MAX_RANGE_DAYS) {
        return { from: addDays(to, -(MAX_RANGE_DAYS - 1)), to };
      }
      return { from, to };
    }
  }
}

function spanDays(from: string, to: string): number {
  const ms =
    Date.UTC(...split(to)) - Date.UTC(...split(from));
  return Math.round(ms / 86_400_000) + 1;
}

function split(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

/**
 * Filters back into a query string — the shareable URL every report screen
 * pushes, and the href the export bar hangs its CSV download on. §4.3
 */
export function reportSearchParams(filters: ReportFilters): URLSearchParams {
  const definition = REPORT_DEFINITIONS[filters.slug];
  const params = new URLSearchParams();

  if (filters.preset !== definition.defaultPreset) {
    params.set("preset", filters.preset);
  }
  if (definition.fields.includes("date")) {
    params.set("date", filters.date);
  }
  if (definition.fields.includes("range")) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }
  if (filters.staffId) params.set("staffId", filters.staffId);
  if (filters.partyOrderId) params.set("partyOrderId", filters.partyOrderId);
  if (filters.coinTypeId) params.set("coinTypeId", filters.coinTypeId);
  if (filters.productIds.length > 0) {
    params.set("productIds", filters.productIds.join(","));
  }

  return params;
}
