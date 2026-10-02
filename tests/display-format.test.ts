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
    // Founder 2/10/26: English is British/Nigerian order, never US order — the
    // locale parameter is routed through resolveIntlLocale, so even an explicit
    // 'en'/'en-US' renders "15 February 2026" (was "February 15, 2026" before).
    expect(formatDisplayDate('2026-02-14T23:30:00Z', { year: 'numeric', month: 'long', day: 'numeric' }, 'en-US')).toBe('15 February 2026');
    expect(formatDisplayDate('2026-02-14T23:30:00Z', { year: 'numeric', month: 'long', day: 'numeric' }, 'en')).toBe('15 February 2026');
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

describe("no exported formatter lets an 'en*' tag reach Intl unmapped", () => {
  const LONG_LAGOS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos' };

  it("explicit 'en'/'en-US' renders British order through every formatter", () => {
    for (const locale of ['en', 'en-US'] as const) {
      expect(formatDisplayDate('2026-02-14T23:30:00Z', LONG_LAGOS, locale)).toBe('15 February 2026');
      expect(formatShopperDate('2026-02-14T23:30:00Z', locale, LONG_LAGOS)).toBe('15 February 2026');
      expect(formatCount(1234567, locale)).toBe('1,234,567');
      expect(formatMoney(12500, 'NGN', locale)).toBe('₦12,500');
      expect(formatRelativeTime(-1, 'day', locale)).toBe('yesterday');
      expect(formatThemeNumber(1234567, locale)).toBe('1,234,567');
      expect(formatThemeDate('2026-02-14T23:30:00Z', locale, LONG_LAGOS)).toBe('15 February 2026');
      expect(formatThemeMoney(5000, 'NGN', locale)).toBe('₦5,000.00');
      expect(formatThemeRelativeTime(-1, 'day', locale)).toBe('yesterday');
    }
  });

  it("constructor call sites receive the mapped tag, never bare 'en'/'en-US'", () => {
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
      box[kind] = function (this: unknown, ...args: unknown[]) {
        seen.push(typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]));
        return new Orig(...(args as never[]));
      };
    };
    wrap('DateTimeFormat', originals.DateTimeFormat as new (...args: never[]) => object);
    wrap('NumberFormat', originals.NumberFormat as new (...args: never[]) => object);
    wrap('RelativeTimeFormat', originals.RelativeTimeFormat as new (...args: never[]) => object);
    try {
      formatThemeNumber(1234567, 'en-US');
      formatThemeDate('2026-02-14T12:00:00Z', 'en-US');
      formatThemeMoney(5000, 'NGN', 'en-US');
      formatThemeRelativeTime(-1, 'day', 'en-US');
      formatMoney(5000, 'NGN', 'en-US');
      formatRelativeTime(-1, 'day', 'en-US');
    } finally {
      box.DateTimeFormat = originals.DateTimeFormat;
      box.NumberFormat = originals.NumberFormat;
      box.RelativeTimeFormat = originals.RelativeTimeFormat;
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).toEqual(seen.map(() => 'en-NG'));
  });

  it('formatDisplayDate routes its locale parameter through resolveIntlLocale', () => {
    const source = readFileSync(resolve(__dirname, '..', 'utils', 'format.ts'), 'utf8');
    expect(source).toContain('date.toLocaleDateString(resolveIntlLocale(locale)');
  });
});

describe('English money before/after (S7 table, measured on old vs new code)', () => {
  // BEFORE (f7ee395, scratch worktree run): formatMoney was hardcoded 'en-NG';
  // formatThemeMoney used bare 'en' via canonicalThemeLocale. AFTER: both use
  // en-NG. Decision: en-NG ('US$') wins because live English stores already
  // render formatMoney — the only money helper any theme imports (atelier
  // blocks/components import it; ZERO themes import formatThemeMoney, so the
  // old bare-'en' '$5,000.00' never reached a live store). GBP/EUR symbols are
  // identical under 'en' vs 'en-NG'; only the helper decimal contract differs
  // (formatMoney: decimals only when present; formatThemeMoney: K0 2-decimals).
  it.each([
    ['NGN', '₦5,000', '₦5,000.00'],
    ['USD', 'US$5,000', 'US$5,000.00'],
    ['GBP', '£5,000', '£5,000.00'],
    ['EUR', '€5,000', '€5,000.00'],
  ])('%s renders the live-store English output', (currency, money, themeMoney) => {
    expect(formatMoney(5000, currency)).toBe(money);
    expect(formatMoney(5000, currency, 'en')).toBe(money);
    expect(formatThemeMoney(5000, currency, 'en')).toBe(themeMoney);
    expect(formatThemeMoney(5000, currency, undefined)).toBe(themeMoney);
  });

  it('September abbreviates as Intl prints it', () => {
    expect(formatDisplayDate('2026-09-05T10:00:00Z')).toBe('5 Sept 2026');
    expect(formatDisplayDate('2026-09-05T10:00:00Z', { day: 'numeric', month: 'short', year: 'numeric' }, 'en-US')).toBe('5 Sept 2026');
  });
});

describe('malformed currency before/after (normalize-then-format is intended)', () => {
  // BEFORE (f7ee395): formatMoney passed the raw value to Intl — an invalid
  // code threw RangeError internally and the fallback echoed the RAW token
  // (' ngn  5,000', 'null 5,000'). AFTER: normalizeCurrencyCode runs first, so
  // fixable/invalid codes resolve to the platform default instead of echoing
  // raw input into shopper-facing money. Already-valid inputs are unchanged:
  // 'usd' (Intl is case-insensitive) and 'XXX' (real ISO 4217 code) render
  // byte-identical to before. formatThemeMoney already normalized at base —
  // its malformed handling is untouched by this slice.
  it.each([
    ['usd', 'US$5,000'],
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
  // canonicalThemeLocale returns bare 'en' (a US-order Intl tag). If a future
  // formatter routes through it, English stores regress to US order. t() is
  // its only legitimate caller: plural selection needs the bare language tag,
  // and Intl.PluralRules('en') vs ('en-NG') select identically for our rules.
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
    // The shared tag helper all four formatters use maps en* -> en-NG.
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
