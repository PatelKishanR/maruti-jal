import { addDays, eachDay } from "@/lib/dates";
import type { DayDeliveryStatus } from "@/lib/db/entities/enums";
import type { PartyOrderDayDto } from "@/lib/dto/party-order.dto";
import type { PartyPaymentMode } from "@/lib/validation/party-order";

/**
 * The schedule builder's shape and its pure functions.
 *
 * This file is deliberately NOT `"use client"`. `/party-orders/new` builds the
 * blank booking on the server, and a server component may not CALL an export of
 * a client module — it may only render it or pass it as a prop. Every builder
 * and every piece of date arithmetic therefore sits on this side of the
 * boundary. See .claude/MODULE-RECIPE.md §7
 *
 * **A party order is ONE ROW PER DATE, never a recurrence rule.** The generator
 * below produces dates and then gets out of the way: what it returns is an
 * ordinary list of days, indistinguishable afterwards from days added by hand.
 * That is the entire reason the model is a row per date — the owner cancels
 * Tuesday and doubles Wednesday. See .claude/DATA-MODEL.md §5.16
 *
 * **Every date is a `'YYYY-MM-DD'` string** and every step of arithmetic goes
 * through `addDays` / `eachDay`, which are pure string maths. A `Date` is an
 * instant: it shifts by a day across a timezone, and this module generates
 * dozens of dates at once, so one `new Date()` here would move a whole
 * schedule. See .claude/ARCHITECTURE.md §9.2
 */

/* ═══════════════════════════════════════════════════════════════════════
   Drafts — what the wizard and the modals hold before anything is saved
   ═══════════════════════════════════════════════════════════════════════ */

export interface ItemDraft {
  /** React key. Two lines of the same product at two rates are both legal. */
  key: string;
  productId: string;
  /** Snapshot for display while the row is still a draft. */
  productTitle: string;
  productBasePrice: number | null;
  quantity: number | null;
  /** Actuals. Null until someone reconciles on the day; 0 is a real answer. */
  deliveredQuantity: number | null;
  unitPrice: number | null;
}

export interface DayDraft {
  key: string;
  serviceDate: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  notes: string;
  items: ItemDraft[];
  /** Session-only marker for a day the repeat generator produced. §5.4 */
  generated: boolean;
}

export interface PartyDetailsDraft {
  partyName: string;
  phone: string;
  altPhone: string;
  deliveryAddress: string;
  notes: string;
}

export interface AdvanceDraft {
  enabled: boolean;
  paidOn: string;
  amount: number | null;
  mode: PartyPaymentMode;
  referenceNo: string;
  note: string;
}

/** One option in the product or staff picker, structurally `ComboboxOption`. */
export interface PartySelectOption {
  id: string;
  label: string;
  hint?: string;
}

let sequence = 0;

/** A stable React key for a row that does not exist in the database yet. */
export function draftKey(prefix = "row"): string {
  sequence += 1;
  return `${prefix}-${sequence}-${Math.random().toString(36).slice(2, 8)}`;
}

export function blankItem(): ItemDraft {
  return {
    key: draftKey("item"),
    productId: "",
    productTitle: "",
    productBasePrice: null,
    quantity: null,
    deliveredQuantity: null,
    unitPrice: null,
  };
}

export function blankDay(serviceDate: string, items?: ItemDraft[]): DayDraft {
  return {
    key: draftKey("day"),
    serviceDate,
    assignedStaffId: null,
    assignedStaffName: null,
    notes: "",
    items: items && items.length > 0 ? items : [blankItem()],
    generated: false,
  };
}

export function blankDetails(): PartyDetailsDraft {
  return {
    partyName: "",
    phone: "",
    altPhone: "",
    deliveryAddress: "",
    notes: "",
  };
}

/** Cash is what a deposit at the plant gate arrives as more often than not. */
export function blankAdvance(today: string): AdvanceDraft {
  return {
    enabled: false,
    paidOn: today,
    amount: null,
    mode: "CASH",
    referenceNo: "",
    note: "",
  };
}

/** Copies a day's lines onto a new draft — `Duplicate`, and the generator. */
export function copyItems(items: readonly ItemDraft[]): ItemDraft[] {
  return items.map((item) => ({ ...item, key: draftKey("item") }));
}

/** Ascending by date. `'YYYY-MM-DD'` sorts correctly as a plain string. */
export function sortDays<T extends { serviceDate: string }>(
  days: readonly T[],
): T[] {
  return [...days].sort((a, b) =>
    a.serviceDate < b.serviceDate ? -1 : a.serviceDate > b.serviceDate ? 1 : 0,
  );
}

/**
 * Where `+ Add a day` should start: the day AFTER the last scheduled one.
 *
 * An event runs forwards, so the next date the owner wants is almost never
 * today once a schedule exists. §5.8
 */
export function nextScheduleDate(
  days: readonly { serviceDate: string }[],
  today: string,
): string {
  if (days.length === 0) return today;
  const last = sortDays(days)[days.length - 1].serviceDate;
  return addDays(last, 1);
}

export function takenDates(days: readonly { serviceDate: string }[]): string[] {
  return days.map((day) => day.serviceDate);
}

/* ═══════════════════════════════════════════════════════════════════════
   Preview figures

   PREVIEW ONLY, and never sent to the server. `line_total` is a generated
   column, `day_total` and `total_amount` are trigger-maintained, and every
   figure the app STORES or DISPLAYS after a save comes from those.

   The wizard has no server rows to read yet, and the design requires the total
   to move on every keystroke (§5.8, §8.6) — so the arithmetic below exists to
   show the owner what he is about to book. It works in integer PAISE for the
   same reason the database uses `numeric`: `40.10 * 3` in binary floating point
   is not 120.30. See .claude/ARCHITECTURE.md §9.1
   ═══════════════════════════════════════════════════════════════════════ */

export function previewLineTotal(item: ItemDraft): number {
  const quantity = item.deliveredQuantity ?? item.quantity ?? 0;
  const paise = Math.round((item.unitPrice ?? 0) * 100) * quantity;
  return paise / 100;
}

export function previewDayTotal(day: DayDraft): number {
  const paise = day.items.reduce(
    (sum, item) => sum + Math.round(previewLineTotal(item) * 100),
    0,
  );
  return paise / 100;
}

export function previewScheduleTotal(days: readonly DayDraft[]): number {
  const paise = days.reduce(
    (sum, day) => sum + Math.round(previewDayTotal(day) * 100),
    0,
  );
  return paise / 100;
}

/** Jars, not rupees. A count is the one thing that may be added up freely. */
export function dayUnits(day: DayDraft): number {
  return day.items.reduce(
    (sum, item) => sum + (item.deliveredQuantity ?? item.quantity ?? 0),
    0,
  );
}

export function scheduleUnits(days: readonly DayDraft[]): number {
  return days.reduce((sum, day) => sum + dayUnits(day), 0);
}

/** A line the server will accept: a product, and a quantity above zero. */
export function isItemComplete(item: ItemDraft): boolean {
  return (
    item.productId !== "" &&
    item.quantity !== null &&
    item.quantity > 0 &&
    item.unitPrice !== null
  );
}

/** A day with nothing to deliver is the one thing `Next` refuses. §5.6 */
export function isDayComplete(day: DayDraft): boolean {
  return day.serviceDate !== "" && day.items.some(isItemComplete);
}

/** The rate differs from the list price — drives the override strip. §5.3 */
export function isRateOverridden(item: ItemDraft): boolean {
  return (
    item.productBasePrice !== null &&
    item.unitPrice !== null &&
    Math.round(item.unitPrice * 100) !== Math.round(item.productBasePrice * 100)
  );
}

/** Per-unit difference against the list price, in rupees. */
export function rateDifference(item: ItemDraft): number {
  const paise =
    Math.round((item.unitPrice ?? 0) * 100) -
    Math.round((item.productBasePrice ?? 0) * 100);
  return paise / 100;
}

/* ═══════════════════════════════════════════════════════════════════════
   API payloads
   ═══════════════════════════════════════════════════════════════════════ */

export interface DayPayload {
  serviceDate: string;
  assignedStaffId: string | null;
  notes: string | null;
  items: {
    productId: string;
    quantity: number | null;
    deliveredQuantity: number | null;
    unitPrice: number | null;
  }[];
}

/**
 * A draft as the API expects it.
 *
 * Blank numerics are sent RAW rather than coerced: the schema turns an empty
 * quantity into "enter a quantity" rather than into zero, which is the whole
 * point of `z.preprocess` over `z.coerce`.
 */
export function toDayPayload(day: DayDraft): DayPayload {
  return {
    serviceDate: day.serviceDate,
    assignedStaffId: day.assignedStaffId,
    notes: day.notes.trim() === "" ? null : day.notes.trim(),
    items: day.items.filter(isItemComplete).map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      deliveredQuantity: item.deliveredQuantity,
      unitPrice: item.unitPrice,
    })),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   The day-card view model

   ONE card component serves the wizard, the detail page and the edit screen —
   only the footer actions differ (§5, §7.1, checklist). The wizard holds
   drafts and the other two hold saved DTOs, so both are normalised to this
   shape rather than the card learning about either.
   ═══════════════════════════════════════════════════════════════════════ */

export interface DayCardItemView {
  key: string;
  title: string;
  quantity: number;
  /** Renders as `× 50 → 48` with the planned figure struck. §5.3 */
  deliveredQuantity: number | null;
  unitPrice: number;
  basePrice: number | null;
  lineTotal: number;
}

export interface DayCardView {
  key: string;
  /** Absent on an unsaved draft — the wizard addresses days by `key`. */
  id: string | null;
  serviceDate: string;
  status: DayDeliveryStatus;
  staffName: string | null;
  notes: string | null;
  /** Trigger-maintained on a saved day; a preview figure on a draft. */
  total: number;
  units: number;
  deliveredAt: string | null;
  generated: boolean;
  items: DayCardItemView[];
}

export function viewFromDraft(day: DayDraft): DayCardView {
  return {
    key: day.key,
    id: null,
    serviceDate: day.serviceDate,
    // A new day always starts as Scheduled. §8.4
    status: "SCHEDULED",
    staffName: day.assignedStaffName,
    notes: day.notes.trim() === "" ? null : day.notes.trim(),
    total: previewDayTotal(day),
    units: dayUnits(day),
    deliveredAt: null,
    generated: day.generated,
    items: day.items.filter(isItemComplete).map((item) => ({
      key: item.key,
      title: item.productTitle,
      quantity: item.quantity ?? 0,
      deliveredQuantity: item.deliveredQuantity,
      unitPrice: item.unitPrice ?? 0,
      basePrice: item.productBasePrice,
      lineTotal: previewLineTotal(item),
    })),
  };
}

export function viewFromDto(day: PartyOrderDayDto): DayCardView {
  return {
    key: day.id,
    id: day.id,
    serviceDate: day.serviceDate,
    status: day.deliveryStatus,
    staffName: day.assignedStaffName,
    notes: day.notes,
    // From the database: `day_total` is trigger-maintained and `line_total` is
    // a generated column. Nothing here recomputes them.
    total: day.dayTotal,
    units: day.totalUnits,
    deliveredAt: day.deliveredAt,
    generated: false,
    items: day.items.map((item) => ({
      key: item.id,
      title: item.productTitle,
      quantity: item.quantity,
      deliveredQuantity: item.deliveredQuantity,
      unitPrice: item.unitPrice,
      basePrice: item.productBasePrice,
      lineTotal: item.lineTotal,
    })),
  };
}

/** A saved day back into an editable draft — `Edit day`, `Duplicate`. */
export function draftFromDto(day: PartyOrderDayDto): DayDraft {
  return {
    key: day.id,
    serviceDate: day.serviceDate,
    assignedStaffId: day.assignedStaffId,
    assignedStaffName: day.assignedStaffName,
    notes: day.notes ?? "",
    generated: false,
    items: day.items.map((item) => ({
      key: item.id,
      productId: item.productId,
      productTitle: item.productTitle,
      productBasePrice: item.productBasePrice,
      quantity: item.quantity,
      deliveredQuantity: item.deliveredQuantity,
      unitPrice: item.unitPrice,
    })),
  };
}

/** The rate differs from the list price, for a rendered card line. §5.3 */
export function viewRateOverridden(item: DayCardItemView): boolean {
  return (
    item.basePrice !== null &&
    Math.round(item.unitPrice * 100) !== Math.round(item.basePrice * 100)
  );
}

export function viewRateDifference(item: DayCardItemView): number {
  return (
    (Math.round(item.unitPrice * 100) -
      Math.round((item.basePrice ?? 0) * 100)) /
    100
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   The repeat-pattern generator — design §5.4
   ═══════════════════════════════════════════════════════════════════════ */

export const REPEAT_MODES = ["daily", "alternate", "custom"] as const;
export type RepeatMode = (typeof REPEAT_MODES)[number];

/** `Every N days` below 3 is `Every day` or `Alternate days` under a new name. */
export const MIN_CUSTOM_GAP = 3;

export interface RepeatPattern {
  from: string;
  to: string;
  mode: RepeatMode;
  /** Only read when `mode` is `custom`. */
  gap: number;
}

export function repeatStep(pattern: RepeatPattern): number {
  if (pattern.mode === "daily") return 1;
  if (pattern.mode === "alternate") return 2;
  return Math.max(MIN_CUSTOM_GAP, Math.trunc(pattern.gap));
}

/**
 * Every date the pattern produces, inclusive of both bounds.
 *
 * `eachDay` walks the range by string arithmetic, so a range crossing a month
 * boundary, a year boundary or 29 February is the same walk as any other — the
 * month lengths live in one leap-aware table in `lib/dates.ts` and nothing here
 * knows or cares. An empty array is the honest answer to "end before start";
 * the form reports that as a field error rather than generating nothing
 * silently.
 */
export function generateDates(pattern: RepeatPattern): string[] {
  if (pattern.from === "" || pattern.to === "") return [];
  if (pattern.from > pattern.to) return [];

  const step = repeatStep(pattern);
  return eachDay(pattern.from, pattern.to).filter((_, index) => index % step === 0);
}

export interface PreviewDate {
  date: string;
  /** Already in the schedule — rendered struck through and unticked. §5.4 */
  conflict: boolean;
  selected: boolean;
}

export function buildPreview(
  pattern: RepeatPattern,
  existing: readonly string[],
  deselected: ReadonlySet<string>,
): PreviewDate[] {
  const taken = new Set(existing);
  return generateDates(pattern).map((date) => {
    const conflict = taken.has(date);
    return {
      date,
      conflict,
      // A conflicting date can never be selected; everything else is on by
      // default, because the owner asked for this pattern.
      selected: !conflict && !deselected.has(date),
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Gaps — the pattern that makes a missing day visible. Design §5.3
   ═══════════════════════════════════════════════════════════════════════ */

/** Runs of this many empty days or more collapse to one marker. §5.3 */
export const GAP_COLLAPSE_THRESHOLD = 4;

export type ScheduleEntry<T> =
  | { kind: "day"; key: string; day: T }
  | {
      kind: "gap";
      key: string;
      from: string;
      to: string;
      /** How many dates the run covers. 1 renders as a single-day marker. */
      count: number;
      /** 4 or more — the marker renders collapsed with a `Show days` link. */
      collapsible: boolean;
      /** Every date in the run, so an expanded marker can list them. */
      dates: string[];
    };

/**
 * Days and the gaps between them, in calendar order.
 *
 * A missing date is INFORMATION — it is the day the wedding didn't need water —
 * and a timeline that jumps from the 14th to the 16th hides a mistake exactly as
 * well as it hides an intention. So the empty dates render as thin dashed
 * markers.
 *
 * Markers appear only BETWEEN the first and last scheduled day: a schedule does
 * not have infinite empty days on either side of itself. §5.3
 */
export function buildScheduleEntries<T extends { serviceDate: string }>(
  days: readonly T[],
): ScheduleEntry<T>[] {
  const ordered = sortDays(days);
  const entries: ScheduleEntry<T>[] = [];

  ordered.forEach((day, index) => {
    if (index > 0) {
      const previous = ordered[index - 1].serviceDate;
      // Two days on the same date cannot happen — the unique index forbids it —
      // but a defensive `from > to` here would simply produce no dates.
      const dates = eachDay(addDays(previous, 1), addDays(day.serviceDate, -1));

      if (dates.length > 0) {
        entries.push({
          kind: "gap",
          key: `gap-${dates[0]}`,
          from: dates[0],
          to: dates[dates.length - 1],
          count: dates.length,
          collapsible: dates.length >= GAP_COLLAPSE_THRESHOLD,
          dates,
        });
      }
    }

    entries.push({
      kind: "day",
      key: `day-${day.serviceDate}`,
      day,
    });
  });

  return entries;
}
