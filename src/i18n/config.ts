export const locales = ['en', 'gu'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  gu: 'ગુજરાતી',
};

/** Short label for the topbar segmented toggle. */
export const localeShortNames: Record<Locale, string> = {
  en: 'EN',
  gu: 'ગુ',
};

export const LOCALE_COOKIE = 'mj_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/**
 * Number and date formatting locale.
 *
 * The `-u-nu-latn` extension forces LATIN digits. Plain 'gu-IN' can render
 * Gujarati numerals (૦૧૨૩) depending on the runtime, and every figure in this
 * app gets cross-checked against a register, a bank statement or a UPI app —
 * all of which use 0–9. See .claude/I18N.md §4.1
 */
export function intlLocale(locale: Locale): string {
  return locale === 'gu' ? 'gu-IN-u-nu-latn' : 'en-IN';
}
