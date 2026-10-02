import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISPLAY_LOCALE, DISPLAY_TIME_ZONE, formatCount, formatDisplayDate, formatMoney, formatRelativeTime, formatShopperDate } from '../utils/format';
import { ENGLISH_DISPLAY_LOCALE, resolveIntlLocale, resolveSupportedLocale } from '../utils/locale';
import { formatThemeDate, formatThemeMoney, formatThemeNumber, formatThemeRelativeTime } from '../strings/theme-strings';

/**
 * Storefront pages render on the server first. A date formatted with the
 * runtime's default locale printed "Feb 14, 2026" on the server (Node: en-US,
 * UTC) and "14 Feb 2026" in a Nigerian browser; React then failed hydration
 * (#418) and re-rendered the whole page on the client — seen live on every
 * store page with a reviews block. Everything the kit displays is formatted in
 * one fixed locale and zone instead.
 */
describe('display formatting is the same on the server and in the browser', () => {
  it('uses one fixed locale and zone', () => {
    expect(DISPLAY_LOCALE).toBe('en-NG');
    expect(DISPLAY_TIME_ZONE).toBe('Africa/Lagos');
  });

  it('formats dates in Lagos time, whatever the machine is set to', () => {
    expect(formatDisplayDate('2026-02-14T10:00:00Z')).toBe('14 Feb 2026');
    // 23:30 UTC is already the 15th in Lagos (UTC+1) — the server (UTC) and the
    // browser (Lagos) used to print different days for this review.
    expect(formatDisplayDate('2026-02-14T23:30:00Z')).toBe('15 Feb 2026');
    expect(formatDisplayDate('2026-02-14', {})).toBe('14/02/2026');
    expect(formatDisplayDate('2026-02-14T23:30:00Z', { year: 'numeric', month: 'long', day: 'numeric' }, 'en-US')).toBe('February 15, 2026');
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
 * Founder 2/10/26: dates and numbers follow the SHOPPER's locale, with
 * English in the British/Nigerian style so English stores do not change
 * visibly ("2 October 2026", never US "October 2, 2026").
 */
describe('canonical locale mapping (shopper locale -> Intl locale)', () => {
  const LONG_LAGOS = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' } as const;

  it('maps every English variant and every missing/invalid code to en-NG', () => {
    expect(ENGLISH_DISPLAY_LOCALE).toBe('en-NG');
    expect(DISPLAY_LOCALE).toBe(ENGLISH_DISPLAY_LOCALE);
    for (const locale of [null, undefined, 'en', 'en-GB', 'en-NG', 'en-US', 'not a locale!!', '']) {
      expect(resolveIntlLocale(locale), String(locale)).toBe('en-NG');
    }
  });

  it('passes every other well-formed code through unchanged', () => {
    for (const code of ['fr', 'ar', 'pt-BR', 'zh-CN', 'yo', 'ha', 'sw', 'es', 'de', 'ig']) {
      expect(resolveIntlLocale(code)).toBe(code);
    }
  });

  it('evidence: en-NG is the mapping that reproduces current English output byte for byte', () => {
    // Dates are identical under en-GB and en-NG …
    expect(new Date('2026-10-02T10:00:00Z').toLocaleDateString('en-GB', { ...LONG_LAGOS })).toBe('2 October 2026');
    expect(new Date('2026-10-02T10:00:00Z').toLocaleDateString('en-NG', { ...LONG_LAGOS })).toBe('2 October 2026');
    // … but money is NOT: only en-NG keeps the naira sign the stores show.
    expect(
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(12500),
    ).toBe('₦12,500');
    expect(
      new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(12500),
    ).not.toBe('₦12,500');
    // So the mapping pins the sign the pinned tests assert.
    expect(formatMoney(12500)).toBe('₦12,500');
  });

  it('falls back to English when the runtime ICU lacks the locale, and never throws', () => {
    expect(resolveSupportedLocale('fr', (l) => Intl.DateTimeFormat.supportedLocalesOf(l))).toBe('fr');
    expect(resolveSupportedLocale('xx', (l) => Intl.DateTimeFormat.supportedLocalesOf(l))).toBe('en-NG');
    expect(resolveSupportedLocale('fr', () => { throw new Error('no ICU'); })).toBe('en-NG');
  });
});

describe('English output is byte-identical with or without a locale', () => {
  const LONG_LAGOS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' };

  it('format.ts helpers render the pinned strings for null/en', () => {
    for (const locale of [undefined, null, 'en'] as const) {
      expect(formatShopperDate('2026-02-14T10:00:00Z', locale)).toBe('14 Feb 2026');
      expect(formatShopperDate('2026-02-14T23:30:00Z', locale, LONG_LAGOS)).toBe('15 February 2026');
      expect(formatCount(1234567, locale)).toBe('1,234,567');
      expect(formatMoney(12500, 'NGN', locale)).toBe('₦12,500');
      expect(formatMoney(0.28, 'NGN', locale)).toBe('₦0.28');
      expect(formatRelativeTime(-1, 'day', locale)).toBe('yesterday');
    }
    expect(formatRelativeTime(-3, 'day')).toBe('3 days ago');
  });

  it('formatTheme* helpers render English in the British/Nigerian style', () => {
    for (const locale of [undefined, null, 'en'] as const) {
      expect(formatThemeNumber(1234567, locale)).toBe('1,234,567');
      expect(formatThemeDate('2026-02-14T23:30:00Z', locale, LONG_LAGOS)).toBe('15 February 2026');
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

  // Observed on Node 22 (full ICU) 2/10/26; each row falls back to the
  // English style when the runtime's ICU lacks the locale.
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
      dateSupported(code) ? native : '15 February 2026',
    );
    // Same through the fixed-zone display path post-meta uses.
    expect(formatShopperDate('2026-02-14T23:30:00Z', code, LONG_LAGOS)).toBe(
      dateSupported(code) ? native : '15 February 2026',
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
      dateSupported(code) ? native : '14 Feb 2026',
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

  it('money follows the shopper locale, English keeps the naira sign', () => {
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
    expect(formatThemeDate('2026-02-14T23:30:00Z', 'xx', LONG_LAGOS)).toBe('15 February 2026');
    expect(formatThemeMoney(12500, 'NGN', 'xx')).toBe('₦12,500.00');
    expect(formatThemeRelativeTime(-1, 'day', 'xx')).toBe('yesterday');
    expect(formatCount(1234567, 'xx')).toBe('1,234,567');
    expect(formatShopperDate('2026-02-14T10:00:00Z', 'xx')).toBe('14 Feb 2026');
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
