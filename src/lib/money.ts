import { defaultLocale, intlLocale, isLocale } from "@/i18n/config";

/**
 * Money and number formatting — the single choke point.
 *
 * **No component calls `Intl` directly.** Every figure in the app renders
 * through this file (or `lib/dates.ts`), because that is the only way nine
 * modules stay consistent. Otherwise one dashboard card eventually renders
 * `૧૨,૩૪,૫૬૭` and nobody notices for a month. See .claude/I18N.md §4.2
 *
 * Two rules that are easy to get wrong:
 *
 * 1. **Latin digits in BOTH languages.** Requesting plain `gu-IN` can produce
 *    Gujarati numerals depending on the runtime. `intlLocale()` appends the
 *    `-u-nu-latn` numbering-system extension so it cannot. Every figure here
 *    gets cross-checked against a register, a bank statement or a UPI app,
 *    all of which use 0–9. See .claude/I18N.md §4.1
 *
 * 2. **Never float-multiply money.** `parseFloat('1.005') * 100` is 100.49999…
 *    `parseRupees` therefore splits the string into rupees and paise and does
 *    integer arithmetic. Money is `numeric` end to end — parse strings, emit
 *    numbers, and let SQL do the arithmetic. See .claude/ARCHITECTURE.md
 */

/** Rendering for a figure that does not exist. DESIGN-STANDARDS §13. */
const DASH = "—";

/** Rupees above this are a typo, not an amount. Also keeps paise a safe integer. */
const MAX_WHOLE_DIGITS = 12;

const ONE_LAKH = 100_000;
const ONE_CRORE = 10_000_000;

// ─────────────────────────────────────────────────────────────────────────────
// Locale plumbing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accepts the app's `Locale` ('en' | 'gu') and returns the BCP-47 tag with the
 * Latin numbering system forced. Anything unrecognised falls back to the
 * default locale rather than throwing — a bad locale must never blank a figure.
 */
function numberLocale(locale: string): string {
  return intlLocale(isLocale(locale) ? locale : defaultLocale);
}

/**
 * Formatters are expensive to construct and a table renders hundreds of cells,
 * so they are built once per (locale + options) pair.
 */
const numberFormatters = new Map<string, Intl.NumberFormat>();

function numberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const tag = numberLocale(locale);
  const key = `${tag}|${JSON.stringify(options)}`;
  let cached = numberFormatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(tag, options);
    numberFormatters.set(key, cached);
  }
  return cached;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

const GUJARATI_ZERO = 0x0ae6;

/**
 * Maps Gujarati numerals (૦–૯) onto 0–9.
 *
 * The app renders Latin digits everywhere, but a Gujarati keyboard can still
 * produce Gujarati ones. Rejecting them would surface as "the app won't let me
 * save" rather than as a validation bug. See .claude/I18N.md §3.1
 */
function latiniseDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out +=
      code >= GUJARATI_ZERO && code <= GUJARATI_ZERO + 9
        ? String(code - GUJARATI_ZERO)
        : ch;
  }
  return out;
}

/** Strips everything that is decoration rather than value. */
function normaliseAmount(input: string): string {
  return latiniseDigits(input)
    .replace(/[\s   ]/g, "")
    .replace(/[₹]/g, "")
    .replace(/,/g, "");
}

/**
 * Parses a typed amount into rupees.
 *
 * Accepts `1250`, `1,250`, `1250.50`, `₹250`, `₹ 1,250.50`, `.50`, Gujarati
 * numerals, and a leading `-` when the caller allows it.
 *
 * Rejects (returns `NaN`) anything else — junk text, more than two decimal
 * places (rupees have exactly two; silently rounding money is worse than
 * refusing it), and absurdly long numbers.
 *
 * **Returns `NaN` for invalid input**, not `null` and not `0`, so a bad value
 * can never be mistaken for a real amount by arithmetic downstream. Use
 * `isValidRupees` when you only need the yes/no.
 *
 * The parse is string-based: the whole and fractional parts are turned into an
 * integer number of paise before a single division by 100. `parseFloat(x)*100`
 * would silently lose a paisa on values like `1.005`.
 */
export function parseRupees(input: string): number {
  if (typeof input !== "string") return NaN;

  let text = normaliseAmount(input);
  if (text === "") return NaN;

  let sign = 1;
  if (text.startsWith("-")) {
    sign = -1;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  const match = /^(\d*)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return NaN;

  const whole = match[1] ?? "";
  const fraction = match[2] ?? "";
  if (whole === "" && fraction === "") return NaN;
  if (whole.length > MAX_WHOLE_DIGITS) return NaN;

  // Integer paise, then one division. No float multiplication of a decimal.
  const paise =
    Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(paise)) return NaN;

  return (sign * paise) / 100;
}

/** True when `parseRupees` would accept this text. */
export function isValidRupees(input: string): boolean {
  return !Number.isNaN(parseRupees(input));
}

/**
 * Parses a typed quantity into a whole number.
 *
 * Accepts `40`, `1,240` and Gujarati numerals. Rejects decimals — jars, coins
 * and bottles are counted, not measured. Returns `NaN` for anything else.
 */
export function parseQuantity(input: string): number {
  if (typeof input !== "string") return NaN;

  const text = normaliseAmount(input);
  if (!/^[-+]?\d{1,9}$/.test(text)) return NaN;

  const value = Number(text);
  return Number.isSafeInteger(value) ? value : NaN;
}

/** True when `parseQuantity` would accept this text. */
export function isValidQuantity(input: string): boolean {
  return !Number.isNaN(parseQuantity(input));
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `₹12,34,567.00` — Indian lakh grouping, always two decimals, in both
 * languages. The default for tables, statements and detail pages.
 */
/**
 * `locale` is OPTIONAL on every money formatter, and that is deliberate.
 *
 * These functions force Latin digits and Indian lakh grouping in BOTH
 * languages — see the note at the top of this file — so `en` and `gu` produce
 * byte-identical output. Requiring the argument would mean threading a locale
 * through every presentational component to change nothing.
 *
 * Dates are the opposite case: month names really do differ, so lib/dates.ts
 * requires the locale.
 */
export function formatINR(value: number, locale: string = "en"): string {
  if (!Number.isFinite(value)) return DASH;

  return numberFormatter(locale, {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * The same grouped figure **without** the `₹` symbol.
 *
 * For editable money fields, where the rupee sign is a prefix adornment inside
 * the input rather than part of the text being edited. Exists here rather than
 * in the component so no component reaches for `Intl` itself.
 */
export function formatRupeesPlain(value: number, locale: string = "en"): string {
  if (!Number.isFinite(value)) return "";

  return numberFormatter(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Abbreviated money — **KPI cards only**. DESIGN-STANDARDS §13.
 *
 * | Range | Rendering |
 * |---|---|
 * | below ₹1,00,000 | full, lakh-grouped, paise dropped — `₹94,250` |
 * | ₹1 lakh and above | `₹1.85L` |
 * | ₹1 crore and above | `₹1.24Cr` |
 *
 * Tables and statements always show the full figure via `formatINR`, and the
 * exact value belongs in the KPI card's hover tooltip. The division below is
 * lossy by definition — that is what an abbreviation is — which is exactly why
 * it must never reach a figure someone will add up.
 */
export function formatINRCompact(value: number, locale: string = "en"): string {
  if (!Number.isFinite(value)) return DASH;

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs < ONE_LAKH) {
    const grouped = numberFormatter(locale, {
      maximumFractionDigits: 0,
    }).format(abs);
    return `${sign}₹${grouped}`;
  }

  const crore = abs >= ONE_CRORE;
  const scaled = abs / (crore ? ONE_CRORE : ONE_LAKH);
  const grouped = numberFormatter(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(scaled);

  return `${sign}₹${grouped}${crore ? "Cr" : "L"}`;
}

/** `1,240` — grouped, no decimals. Jars, coins, bottles. */
export function formatQuantity(value: number, locale: string = "en"): string {
  if (!Number.isFinite(value)) return DASH;

  return numberFormatter(locale, { maximumFractionDigits: 0 }).format(value);
}

/**
 * `20L`, `0.5L`, `1.375L` — up to three decimals with trailing zeros trimmed.
 *
 * Takes no locale on purpose: litres are built from plain digits, so they are
 * Latin in every language by construction and cannot drift.
 */
export function formatLitres(value: number): string {
  if (!Number.isFinite(value)) return DASH;

  const fixed = value.toFixed(3);
  const trimmed = fixed.includes(".")
    ? fixed.replace(/0+$/, "").replace(/\.$/, "")
    : fixed;

  return `${trimmed}L`;
}
