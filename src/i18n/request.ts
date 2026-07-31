import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, LOCALE_COOKIE } from './config';

/**
 * next-intl "without i18n routing": locale comes from a cookie, so URLs stay
 * clean (/orders, not /gu/orders).
 *
 * For an internal tool with one user there is no SEO case for locale-prefixed
 * routes, and skipping them avoids composing a second middleware with the auth
 * middleware — a known friction point. See .claude/I18N.md §5.1
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Business dates are 'YYYY-MM-DD' strings; only display is localised.
    timeZone: 'Asia/Kolkata',
  };
});
