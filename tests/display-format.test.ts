import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISPLAY_LOCALE, DISPLAY_TIME_ZONE, formatCount, formatDisplayDate, formatMoney, formatRelativeTime, formatShopperDate, formatWireMoney } from '../utils/format';
import { ENGLISH_DISPLAY_LOCALE, ENGLISH_REGIONS, currencyRegion, resolveIntlLocale, resolveSupportedLocale, storeDisplayFormat, storeRegion, storeTimeZone } from '../utils/locale';
import { formatThemeDate, formatThemeMoney, formatThemeNumber, formatThemeRelativeTime } from '../strings/theme-strings';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorefrontProvider, useStoreDisplayFormat } from '../provider';
import { PostMeta } from '../components/blog/post-meta';

/**
 * Storefront pages render on the server first. A date formatted with the
 * runtime's default locale printed "Feb 14, 2026" on the server (Node: en-US,
 * UTC) and "14 Feb 2026" in a Nigerian browser; React then failed hydration
 * (#418) and re-rendered the whole page on the client. Every formatter takes an
 * explicit locale and zone instead: the store's (`storeDisplayFormat`), or the
 * neutral English/UTC fallback — never a fixed country.
 */
describe('display formatting is the same on the server and in the browser', () => {
  it('falls back to neutral English in UTC, never a fixed country', () => {
    expect(DISPLAY_LOCALE).toBe('en');
    expect(DISPLAY_TIME_ZONE).toBe('UTC');
  });

  it('formats dates in the zone it is given, UTC by default, whatever the machine is set to', () => {
    expect(formatDisplayDate('2026-02-14T10:00:00Z')).toBe('Feb 14, 2026');
    expect(formatDisplayDate('2026-02-14T23:30:00Z')).toBe('Feb 14, 2026');
    // 23:30 UTC is already the 15th in Lagos (UTC+1): the store's zone decides the day.
    expect(formatDisplayDate('2026-02-14T23:30:00Z', undefined, 'en-NG', 'Africa/Lagos')).toBe('15 Feb 2026');
    expect(formatDisplayDate('2026-02-14', {})).toBe('2/14/2026');
    expect(formatDisplayDate('2026-02-14', {}, 'en-GB')).toBe('14/02/2026');
    expect(formatDisplayDate('2026-02-14T23:30:00Z', { year: 'numeric', month: 'long', day: 'numeric' }, 'en-US')).toBe('February 14, 2026');
    // A zone this runtime does not know prints in UTC rather than throwing.
    expect(formatDisplayDate('2026-02-14T23:30:00Z', undefined, 'en', 'Mars/Base')).toBe('Feb 14, 2026');
    expect(formatDisplayDate('not a date')).toBe('');
  });

  it('formats counts and money with fixed grouping', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatMoney(12500)).toBe('₦12,500');
  });

  it('no kit source formats with the runtime default locale', () => {
    const ROOT = resolve(__dirname, '..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (entry === 'node_modules' || entry === 'tests' || entry.startsWith('.')) return [];
      if (statSync(path).isDirectory()) return walk(path);
      return /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
    const offenders = walk(ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return /\.toLocale(?:Date|Time)?String\(\s*(?:undefined\s*[,)]|\))/.test(source) ? [relative(ROOT, file)] : [];
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * Dates and numbers follow the SHOPPER's language; English reads in the
 * store's region (its country, else its currency's home), else neutral `en`.
 */
describe('canonical locale mapping (shopper locale + store region -> Intl locale)', () => {
  it('maps a missing/invalid code or bare English to neutral en without a region', () => {
    expect(ENGLISH_DISPLAY_LOCALE).toBe('en');
    expect(DISPLAY_LOCALE).toBe(ENGLISH_DISPLAY_LOCALE);
    for (const locale of [null, undefined, 'en', 'EN', 'not a locale!!', '']) {
      expect(resolveIntlLocale(locale), String(locale)).toBe('en');
    }
  });

  it('gives English the store region, unless the code names its own', () => {
    expect(resolveIntlLocale('en', 'US')).toBe('en-US');
    expect(resolveIntlLocale(null, 'ng')).toBe('en-NG');
    expect(resolveIntlLocale('en-GB', 'US')).toBe('en-GB');
    expect(resolveIntlLocale('en-Latn-US', 'NG')).toBe('en-US');
    expect(resolveIntlLocale('en', 'USA')).toBe('en');
    expect(resolveIntlLocale('en', '')).toBe('en');
  });

  it('a region English is not native in on both server and browser reads as neutral en (no hydration split)', () => {
    // Chrome formats en-FR natively ("14 Feb 2026"), Node 22 falls back to en ("Feb 14, 2026").
    expect(resolveIntlLocale('en', 'FR')).toBe('en');
    expect(resolveIntlLocale('en-FR')).toBe('en');
    // An unlisted reader region falls through to the store (or currency) region.
    expect(resolveIntlLocale('en-FR', 'NG')).toBe('en-NG');
    expect(formatMoney(5000, 'NGN', 'en-FR')).toBe('₦5,000');
    expect(resolveIntlLocale(null, 'JP')).toBe('en');
    expect(storeDisplayFormat(null, { country_code: 'FR', currency: 'EUR', timezone: 'Europe/Paris' })).toEqual({ locale: 'en', timeZone: 'Europe/Paris' });
    expect(ENGLISH_REGIONS.size).toBe(105);
    // Every listed region must be native on this runtime: an ICU upgrade that drops one fails here, not as a hydration split.
    for (const region of ENGLISH_REGIONS) {
      const tag = resolveIntlLocale('en', region);
      expect(tag).toBe(`en-${region}`);
      expect(new Intl.DateTimeFormat(tag).resolvedOptions().locale).toBe(tag);
    }
  });

  it('is idempotent, so a resolved tag can stand in for a storefront locale', () => {
    for (const [locale, region] of [['en', 'US'], [null, 'NG'], ['en-GB', 'US'], ['fr', 'NG'], [null, null]] as const) {
      const tag = resolveIntlLocale(locale, region);
      expect(resolveIntlLocale(tag, 'KE')).toBe(tag === 'en' ? 'en-KE' : tag);
    }
  });

  it('passes every other well-formed code through unchanged, whatever the region', () => {
    for (const code of ['fr', 'ar', 'pt-BR', 'zh-CN', 'yo', 'ha', 'sw', 'es', 'de', 'ig']) {
      expect(resolveIntlLocale(code)).toBe(code);
      expect(resolveIntlLocale(code, 'US')).toBe(code);
    }
  });

  it("a currency's home region is its code's first two letters, none for EUR and the X-codes", () => {
    expect(currencyRegion('USD')).toBe('US');
    expect(currencyRegion(' ngn ')).toBe('NG');
    expect(currencyRegion('GBP')).toBe('GB');
    for (const code of ['EUR', 'XOF', 'XAF', 'XXX', 'US', '', null, 7]) {
      expect(currencyRegion(code), String(code)).toBeNull();
    }
  });

  it("a store's region is its country, else its currency's home", () => {
    expect(storeRegion({ country_code: 'US', currency: 'NGN' })).toBe('US');
    expect(storeRegion({ country_code: 'gb', currency: 'GBP' })).toBe('GB');
    expect(storeRegion({ country_code: null, currency: 'NGN' })).toBe('NG');
    expect(storeRegion({ country_code: 'USA', currency: 'USD' })).toBe('US');
    expect(storeRegion({ currency: 'EUR' })).toBeNull();
    expect(storeRegion({})).toBeNull();
    expect(storeRegion(null)).toBeNull();
  });

  it("a store's zone is its own IANA zone, else UTC", () => {
    expect(storeTimeZone({ timezone: 'America/New_York' })).toBe('America/New_York');
    expect(storeTimeZone({ timezone: ' Africa/Lagos ' })).toBe('Africa/Lagos');
    for (const store of [{ timezone: '' }, { timezone: 'Mars/Base' }, { timezone: 7 }, {}, null, 'UTC']) {
      expect(storeTimeZone(store), JSON.stringify(store)).toBe('UTC');
    }
  });

  it('evidence: bare en cannot stand in for a region (NGN loses its sign, USD is disambiguated elsewhere)', () => {
    expect(new Intl.NumberFormat('en', { style: 'currency', currency: 'NGN' }).format(12500)).not.toBe('₦12,500.00');
    expect(new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(12500)).toBe('₦12,500.00');
    expect(new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'USD' }).format(5)).toBe('US$5.00');
    expect(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(5)).toBe('$5.00');
  });

  it('falls back to English in the given region when the runtime ICU lacks the locale, and never throws', () => {
    expect(resolveSupportedLocale('fr', (l) => Intl.DateTimeFormat.supportedLocalesOf(l))).toBe('fr');
    expect(resolveSupportedLocale('xx', (l) => Intl.DateTimeFormat.supportedLocalesOf(l))).toBe('en');
    expect(resolveSupportedLocale('xx', (l) => Intl.DateTimeFormat.supportedLocalesOf(l), 'en-NG')).toBe('en-NG');
    expect(resolveSupportedLocale('fr', () => { throw new Error('no ICU'); })).toBe('en');
  });
});

/**
 * One store, one answer: a US store prints US dates and "$", a Nigerian store
 * Nigerian dates and "₦", a GBP store British dates and "£", each on its own
 * calendar — and a locale the runtime lacks still reads in the store's region.
 */
describe('stores read in their own region and zone', () => {
  const US = { country_code: 'US', currency: 'USD', timezone: 'America/New_York' };
  const NG = { country_code: null, currency: 'NGN', timezone: 'Africa/Lagos' };
  const GB = { country_code: 'GB', currency: 'GBP', timezone: 'Europe/London' };
  const shopperDate = (value: string, store: object, locale: string | null = null): string => {
    const display = storeDisplayFormat(locale, store);
    return formatShopperDate(value, display.locale, undefined, display.timeZone);
  };

  it('a US store: US order on New York time, the bare dollar sign', () => {
    expect(storeDisplayFormat(null, US)).toEqual({ locale: 'en-US', timeZone: 'America/New_York' });
    // 03:30 UTC on the 15th is still the 14th in New York.
    expect(shopperDate('2026-02-15T03:30:00Z', US)).toBe('Feb 14, 2026');
    expect(formatMoney(11.5, US.currency)).toBe('$11.50');
    expect(formatMoney(5, US.currency, 'en')).toBe('$5');
    expect(formatWireMoney('11.50', US.currency)).toBe('$11.50');
    expect(formatThemeMoney(5, US.currency, null)).toBe('$5.00');
  });

  it('a Nigerian store (no country sent): Nigerian order on Lagos time, the naira sign', () => {
    expect(storeDisplayFormat('en', NG)).toEqual({ locale: 'en-NG', timeZone: 'Africa/Lagos' });
    expect(shopperDate('2026-02-14T23:30:00Z', NG)).toBe('15 Feb 2026');
    expect(formatMoney(5000, NG.currency)).toBe('₦5,000');
    expect(formatMoney(0.28, NG.currency)).toBe('₦0.28');
    expect(formatWireMoney('4500.00', NG.currency)).toBe('₦4,500');
  });

  it('a GBP store: British order on London time, the pound sign', () => {
    expect(storeDisplayFormat(null, GB)).toEqual({ locale: 'en-GB', timeZone: 'Europe/London' });
    expect(shopperDate('2026-02-14T23:30:00Z', GB)).toBe('14 Feb 2026');
    expect(formatMoney(11.5, GB.currency)).toBe('£11.50');
    expect(formatThemeMoney(8, GB.currency, 'en')).toBe('£8.00');
  });

  it('an unknown locale reads as English in the store region, never Nigeria by default', () => {
    expect(storeDisplayFormat('xx', US).locale).toBe('en-US');
    expect(storeDisplayFormat('xx', NG).locale).toBe('en-NG');
    expect(storeDisplayFormat('xx', {})).toEqual({ locale: 'en', timeZone: 'UTC' });
    expect(shopperDate('2026-02-14T23:30:00Z', US, 'xx')).toBe('Feb 14, 2026');
    expect(formatMoney(12500, 'NGN', 'xx')).toBe('₦12,500');
    expect(formatMoney(11.5, 'USD', 'xx')).toBe('$11.50');
  });

  it("a reader whose code names a region sees another country's currency disambiguated", () => {
    expect(formatMoney(5, 'USD', 'en-GB')).toBe('US$5');
    expect(formatMoney(5, 'USD', 'en-NG')).toBe('US$5');
    expect(formatMoney(5, 'GBP', 'en-US')).toBe('£5');
  });

  it('a store in another language keeps its zone', () => {
    expect(storeDisplayFormat('fr', NG)).toEqual({ locale: 'fr', timeZone: 'Africa/Lagos' });
  });
});

describe('English output with no store region is neutral and identical with or without a locale', () => {
  const LONG_LAGOS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' };

  it('format.ts helpers render the same strings for null/en', () => {
    for (const locale of [undefined, null, 'en'] as const) {
      expect(formatShopperDate('2026-02-14T10:00:00Z', locale)).toBe('Feb 14, 2026');
      expect(formatShopperDate('2026-02-14T23:30:00Z', locale, LONG_LAGOS)).toBe('February 15, 2026');
      expect(formatCount(1234567, locale)).toBe('1,234,567');
      expect(formatMoney(12500, 'NGN', locale)).toBe('₦12,500');
      expect(formatMoney(0.28, 'NGN', locale)).toBe('₦0.28');
      expect(formatRelativeTime(-1, 'day', locale)).toBe('yesterday');
    }
    expect(formatRelativeTime(-3, 'day')).toBe('3 days ago');
  });

  it('formatTheme* helpers render the same strings for null/en', () => {
    for (const locale of [undefined, null, 'en'] as const) {
      expect(formatThemeNumber(1234567, locale)).toBe('1,234,567');
      expect(formatThemeDate('2026-02-14T23:30:00Z', locale, LONG_LAGOS)).toBe('February 15, 2026');
      expect(formatThemeMoney(5000, 'NGN', locale)).toBe('₦5,000.00');
      expect(formatThemeRelativeTime(-1, 'day', locale)).toBe('yesterday');
    }
  });
});

describe('shopper locales format through real Intl output', () => {
  const LONG_LAGOS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' };
  const dateSupported = (code: string): boolean => {
    try {
      return Intl.DateTimeFormat.supportedLocalesOf([code]).length > 0;
    } catch {
      return false;
    }
  };
  const numberSupported = (code: string): boolean => {
    try {
      return Intl.NumberFormat.supportedLocalesOf([code]).length > 0;
    } catch {
      return false;
    }
  };
  const relativeSupported = (code: string): boolean => {
    try {
      return Intl.RelativeTimeFormat.supportedLocalesOf([code]).length > 0;
    } catch {
      return false;
    }
  };

  // Expected output on Node 22 with full ICU; each row falls back to neutral
  // English when the runtime's ICU lacks the locale.
  it.each([
    ['fr', '15 février 2026'],
    ['ar', '15 فبراير 2026'],
    ['pt-BR', '15 de fevereiro de 2026'],
    ['zh-CN', '2026年2月15日'],
    ['yo', '15 Oṣù Èrèlè 2026'],
    ['ha', '15 Faburairu, 2026'],
    ['sw', '15 Februari 2026'],
  ])('long date in %s (Lagos day boundary preserved)', (code, native) => {
    expect(formatThemeDate('2026-02-14T23:30:00Z', code, LONG_LAGOS)).toBe(
      dateSupported(code) ? native : 'February 15, 2026',
    );
    // Same through the explicit-zone display path post-meta uses.
    expect(formatShopperDate('2026-02-14T23:30:00Z', code, LONG_LAGOS)).toBe(
      dateSupported(code) ? native : 'February 15, 2026',
    );
  });

  it.each([
    ['fr', '14 févr. 2026'],
    ['ar', '14 فبراير 2026'],
    ['pt-BR', '14 de fev. de 2026'],
    ['zh-CN', '2026年2月14日'],
    ['yo', '14 Oṣù Èrèlè 2026'],
    ['ha', '14 Fab, 2026'],
    ['sw', '14 Feb 2026'],
  ])('short date in %s', (code, native) => {
    expect(formatShopperDate('2026-02-14T10:00:00Z', code)).toBe(
      dateSupported(code) ? native : 'Feb 14, 2026',
    );
  });

  it.each([
    ['fr', '1\u202f234\u202f567'],
    ['ar', '1,234,567'],
    ['pt-BR', '1.234.567'],
    ['zh-CN', '1,234,567'],
    ['yo', '1,234,567'],
    ['ha', '1,234,567'],
    ['sw', '1,234,567'],
  ])('grouped count in %s', (code, native) => {
    expect(formatThemeNumber(1234567, code)).toBe(numberSupported(code) ? native : '1,234,567');
    expect(formatCount(1234567, code)).toBe(numberSupported(code) ? native : '1,234,567');
  });

  it('money follows the shopper locale; English keeps the currency home sign', () => {
    expect(formatThemeMoney(12500, 'NGN', 'fr')).toBe(
      numberSupported('fr') ? '12\u202f500,00\u00a0NGN' : '₦12,500.00',
    );
    expect(formatMoney(12500, 'NGN', 'fr')).toBe(
      numberSupported('fr') ? '12\u202f500\u00a0NGN' : '₦12,500',
    );
  });

  it.each([
    ['fr', 'hier'],
    ['ar', 'أمس'],
    ['pt-BR', 'ontem'],
    ['zh-CN', '昨天'],
    ['yo', 'Àná'],
    ['ha', 'jiya'],
    ['sw', 'jana'],
  ])('relative yesterday in %s', (code, native) => {
    expect(formatThemeRelativeTime(-1, 'day', code)).toBe(
      relativeSupported(code) ? native : 'yesterday',
    );
    expect(formatRelativeTime(-1, 'day', code)).toBe(
      relativeSupported(code) ? native : 'yesterday',
    );
  });

  it('an unknown but well-formed locale renders English and never throws', () => {
    expect(formatThemeNumber(1234567, 'xx')).toBe('1,234,567');
    expect(formatThemeDate('2026-02-14T23:30:00Z', 'xx', LONG_LAGOS)).toBe('February 15, 2026');
    expect(formatThemeMoney(12500, 'NGN', 'xx')).toBe('₦12,500.00');
    expect(formatThemeRelativeTime(-1, 'day', 'xx')).toBe('yesterday');
    expect(formatCount(1234567, 'xx')).toBe('1,234,567');
    expect(formatShopperDate('2026-02-14T10:00:00Z', 'xx')).toBe('Feb 14, 2026');
    expect(formatMoney(12500, 'NGN', 'xx')).toBe('₦12,500');
    expect(formatRelativeTime(-1, 'day', 'xx')).toBe('yesterday');
  });

  it('invalid dates are handled as before in every locale', () => {
    expect(formatThemeDate('not a date', 'fr')).toBe('');
    expect(formatShopperDate('not a date', 'fr')).toBe('');
    expect(formatThemeDate('not a date', null)).toBe('');
  });
});

describe('no kit source hardcodes an English locale into a formatter', () => {
  it('every date/number/relative call goes through the canonical mapping', () => {
    const ROOT = resolve(__dirname, '..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (entry === 'node_modules' || entry === 'tests' || entry.startsWith('.')) return [];
      if (statSync(path).isDirectory()) return walk(path);
      return /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
    const offenders = walk(ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const hits: string[] = [];
      // A literal English tag handed straight to a formatter bypasses the
      // shopper locale — use resolveIntlLocale (or a resolved tag) instead.
      if (/\.toLocale(?:Date|Time)?String\(\s*['"]en(-[A-Za-z]+)?['"]/.test(source)) hits.push('toLocale*');
      if (/new Intl\.(?:DateTimeFormat|NumberFormat|RelativeTimeFormat)\(\s*['"]en(-[A-Za-z]+)?['"]/.test(source)) hits.push('new Intl*');
      return hits.length > 0 ? [`${relative(ROOT, file)}: ${hits.join(',')}`] : [];
    });
    expect(offenders).toEqual([]);
  });
});

describe('an English tag that names a region is honoured by every formatter', () => {
  const LONG_LAGOS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' };

  it.each([
    ['en-US', 'February 15, 2026', 'NGN\u00a012,500', 'NGN\u00a05,000.00'],
    ['en-GB', '15 February 2026', 'NGN\u00a012,500', 'NGN\u00a05,000.00'],
    ['en-NG', '15 February 2026', '₦12,500', '₦5,000.00'],
  ])('%s', (locale, longDate, money, themeMoney) => {
    expect(formatDisplayDate('2026-02-14T23:30:00Z', LONG_LAGOS, locale)).toBe(longDate);
    expect(formatShopperDate('2026-02-14T23:30:00Z', locale, LONG_LAGOS)).toBe(longDate);
    expect(formatThemeDate('2026-02-14T23:30:00Z', locale, LONG_LAGOS)).toBe(longDate);
    expect(formatMoney(12500, 'NGN', locale)).toBe(money);
    expect(formatThemeMoney(5000, 'NGN', locale)).toBe(themeMoney);
    expect(formatCount(1234567, locale)).toBe('1,234,567');
    expect(formatThemeNumber(1234567, locale)).toBe('1,234,567');
    expect(formatRelativeTime(-1, 'day', locale)).toBe('yesterday');
    expect(formatThemeRelativeTime(-1, 'day', locale)).toBe('yesterday');
  });

  it('constructor call sites receive the resolved tag: the reader region, else the currency home', () => {
    // Date/Number.prototype.toLocale* use V8 intrinsics and bypass a patched
    // global (verified live on this Node), so this spy covers only the
    // `new Intl.*` call sites; the toLocale* sites are pinned behaviorally above.
    const seen: string[] = [];
    const originals = {
      DateTimeFormat: Intl.DateTimeFormat,
      NumberFormat: Intl.NumberFormat,
      RelativeTimeFormat: Intl.RelativeTimeFormat,
    };
    const box = Intl as unknown as Record<string, unknown>;
    const wrap = (kind: string, Orig: new (...args: never[]) => object) => {
      box[kind] = Object.assign(
        function (this: unknown, ...args: unknown[]) {
          seen.push(typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]));
          return new Orig(...(args as never[]));
        },
        { supportedLocalesOf: (Orig as unknown as { supportedLocalesOf: unknown }).supportedLocalesOf },
      );
    };
    wrap('DateTimeFormat', originals.DateTimeFormat as new (...args: never[]) => object);
    wrap('NumberFormat', originals.NumberFormat as new (...args: never[]) => object);
    wrap('RelativeTimeFormat', originals.RelativeTimeFormat as new (...args: never[]) => object);
    try {
      formatThemeNumber(1234567, 'en-US');
      formatThemeDate('2026-02-14T12:00:00Z', 'en-US');
      formatThemeMoney(5000, 'NGN', 'en-US');
      formatThemeRelativeTime(-1, 'day', 'en-US');
      formatThemeMoney(5000, 'KES', null);
    } finally {
      box.DateTimeFormat = originals.DateTimeFormat;
      box.NumberFormat = originals.NumberFormat;
      box.RelativeTimeFormat = originals.RelativeTimeFormat;
    }
    expect(seen).toEqual(['en-US', 'en-US', 'en-US', 'en-US', 'en-KE']);
  });

  it('formatDisplayDate routes its locale parameter through resolveIntlLocale', () => {
    const source = readFileSync(resolve(__dirname, '..', 'utils', 'format.ts'), 'utf8');
    expect(source).toContain('const tag = resolveIntlLocale(locale);');
  });
});

describe('English money output', () => {
  // formatMoney and formatThemeMoney both render English in the currency's home
  // region, so every currency prints its bare local sign. The helpers differ only
  // in decimals (formatMoney: none for a whole amount, all of them otherwise;
  // formatThemeMoney: always the currency's default decimals).
  it.each([
    ['NGN', '₦5,000', '₦5,000.00'],
    ['USD', '$5,000', '$5,000.00'],
    ['GBP', '£5,000', '£5,000.00'],
    ['EUR', '€5,000', '€5,000.00'],
  ])('%s renders the live-store English output', (currency, money, themeMoney) => {
    expect(formatMoney(5000, currency)).toBe(money);
    expect(formatMoney(5000, currency, 'en')).toBe(money);
    expect(formatThemeMoney(5000, currency, 'en')).toBe(themeMoney);
    expect(formatThemeMoney(5000, currency, undefined)).toBe(themeMoney);
  });

  it('September abbreviates as Intl prints it', () => {
    expect(formatDisplayDate('2026-09-05T10:00:00Z')).toBe('Sep 5, 2026');
    expect(formatDisplayDate('2026-09-05T10:00:00Z', { day: 'numeric', month: 'short', year: 'numeric' }, 'en-GB')).toBe('5 Sept 2026');
  });
});

describe('money shows the currency\'s full minor units or none', () => {
  // A whole amount drops its decimals; any other amount keeps every minor-unit
  // digit, so a fractional price never reads "$11.5". The digits come from the
  // currency (USD/EUR/NGN 2, JPY 0, KWD 3), never a fixed 2.
  it.each([
    [11.5, 'USD', '$11.50'],
    [5, 'USD', '$5'],
    [2800, 'NGN', '₦2,800'],
    [1234.5, 'EUR', '€1,234.50'],
    [0.28, 'NGN', '₦0.28'],
    [11.999, 'USD', '$12'],
    [1235, 'JPY', '¥1,235'],
    [1234.6, 'JPY', '¥1,235'],
    [-11.5, 'USD', '-$11.50'],
    [-0, 'NGN', '₦0'],
    [-0.001, 'NGN', '₦0'],
    [-0.005, 'NGN', '-₦0.01'],
  ])('%p %s prints %s', (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected);
  });

  it('a three-digit currency keeps all three digits', () => {
    expect(formatMoney(1.25, 'KWD').replace(/\u00a0/g, ' ')).toBe('KWD 1.250');
    expect(formatMoney(1.235, 'KWD').replace(/\u00a0/g, ' ')).toBe('KWD 1.235');
    expect(formatMoney(3, 'KWD').replace(/\u00a0/g, ' ')).toBe('KWD 3');
  });

  it.each(['fr', 'ar', 'pt'])('the rule holds in the %s storefront locale, whatever its digits and separator', (locale) => {
    const fractional = formatMoney(11.5, 'USD', locale);
    const whole = formatMoney(5, 'USD', locale);
    const reference = new Intl.NumberFormat(resolveIntlLocale(locale), { style: 'currency', currency: 'USD' });

    expect(fractional).toBe(reference.format(11.5));
    expect(whole).not.toBe(reference.format(5));
    expect(reference.formatToParts(5).some((part) => part.type === 'fraction')).toBe(true);
    expect(new Intl.NumberFormat(resolveIntlLocale(locale), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(5)).toBe(whole);
  });

  it('the same amount prints the same text on every call (cached formatters stay per locale and currency)', () => {
    expect(formatMoney(11.5, 'USD')).toBe('$11.50');
    expect(formatMoney(11.5, 'EUR')).toBe('€11.50');
    expect(formatMoney(11.5, 'USD', 'fr')).not.toBe(formatMoney(11.5, 'USD'));
    expect(formatMoney(11.5, 'USD', 'en-GB')).toBe('US$11.50');
    expect(formatMoney(11.5, 'USD')).toBe('$11.50');
  });
});

describe('malformed currency (normalize-then-format)', () => {
  // normalizeCurrencyCode runs first, so fixable/invalid codes resolve to the
  // platform default instead of echoing raw input (' ngn  5,000', 'null 5,000')
  // into shopper-facing money. Already-valid inputs render as Intl prints them:
  // 'usd' (Intl is case-insensitive) and 'XXX' (a real ISO 4217 code).
  // formatThemeMoney normalizes at its base as well.
  it.each([
    ['usd', '$5,000'],
    [' ngn ', '₦5,000'],
    ['', '₦5,000'],
    ['XXX', '¤5,000'],
    ['NGN ', '₦5,000'],
  ])('%s normalizes before formatting', (input, expected) => {
    expect(formatMoney(5000, input)).toBe(expected);
  });

  it('null resolves to the platform default instead of echoing', () => {
    expect(formatMoney(5000, null as unknown as string)).toBe('₦5,000');
  });
});

describe('canonicalThemeLocale is plural-selection only', () => {
  // canonicalThemeLocale returns bare 'en' with no region. If a future
  // formatter routes through it, stores lose their own region. t() is its only
  // legitimate caller: plural selection needs the bare language tag.
  it('t() still selects plurals through it', () => {
    const source = readFileSync(resolve(__dirname, '..', 'strings', 'theme-strings.ts'), 'utf8');
    expect(source).toContain('canonicalThemeLocale(locale)');
  });

  it('no date/number/money/relative-time formatter calls it', () => {
    // Static source scan: every formatter body lives in its own
    // `export function <name>` segment, so a future edit that routes a
    // formatter through canonicalThemeLocale trips this test even though the
    // compiled function source would not reveal the call.
    const formatSource = readFileSync(resolve(__dirname, '..', 'utils', 'format.ts'), 'utf8');
    expect(formatSource).not.toContain('canonicalThemeLocale');
    const themeSource = readFileSync(resolve(__dirname, '..', 'strings', 'theme-strings.ts'), 'utf8');
    const segments = themeSource.split(/\n(?:export )?function /);
    const bodyOf = (name: string): string => {
      const segment = segments.find((s) => s.startsWith(`${name}(`));
      expect(segment, `${name} formatter source found`).toBeDefined();
      return segment as string;
    };
    for (const name of ['formatThemeNumber', 'formatThemeDate', 'formatThemeMoney', 'formatThemeRelativeTime']) {
      expect(bodyOf(name)).not.toContain('canonicalThemeLocale');
    }
    // The shared tag helper all four formatters use is the canonical mapping.
    expect(bodyOf('themeFormatTag')).toContain('resolveIntlLocale');
    expect(bodyOf('themeFormatTag')).not.toContain('canonicalThemeLocale');
  });

  it('the guard fires when a formatter body is mutated to call it', () => {
    const mutated = `\nexport function formatThemeDate(\n  const tag = canonicalThemeLocale(locale);\n}`;
    const segments = mutated.split(/\n(?:export )?function /);
    const body = segments.find((s) => s.startsWith('formatThemeDate(')) as string;
    expect(body).toContain('canonicalThemeLocale');
  });
});

describe('the provider hands every block the store format', () => {
  const render = (vendor: object, child: ReturnType<typeof createElement>, locale: string | null = null): string =>
    renderToStaticMarkup(
      createElement(StorefrontProvider, { vendor: { id: 'v1', slug: 's', name: 'Store', ...vendor } as never, config: {} as never, menus: [], locale, children: child }),
    );
  const Probe = (): ReturnType<typeof createElement> => {
    const { locale, timeZone } = useStoreDisplayFormat();
    return createElement('i', null, `${locale}|${timeZone}`);
  };
  const post = { title: 'P', published_at: '2026-09-15T02:00:00.000Z', reading_time: 0, author: null } as never;

  it.each([
    [{ country_code: 'US', currency: 'USD', timezone: 'America/New_York' }, null, 'en-US|America/New_York', 'September 14, 2026'],
    [{ currency: 'NGN', timezone: 'Africa/Lagos' }, null, 'en-NG|Africa/Lagos', '15 September 2026'],
    [{ country_code: 'GB', currency: 'GBP', timezone: 'Europe/London' }, 'en', 'en-GB|Europe/London', '15 September 2026'],
    [{}, 'xx', 'en|UTC', 'September 15, 2026'],
  ])('%j (locale %s)', (vendor, locale, format, byline) => {
    expect(render(vendor, createElement(Probe), locale)).toContain(`<i>${format}</i>`);
    expect(render(vendor, createElement(PostMeta, { post }), locale)).toContain(`>${byline}</time>`);
  });
});
