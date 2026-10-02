import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JSX } from 'react';
import enDefault from '../locales/en.default.json';
import {
  canonicalThemeLocale,
  createThemeStrings,
  defaultThemeStrings,
  formatThemeDate,
  formatThemeMoney,
  formatThemeNumber,
  interpolate,
  resetThemeStringsWarnings,
  t,
  themeLocaleDir,
  THEME_STRING_KEY_MAX_LENGTH,
  THEME_STRING_VALUE_MAX_LENGTH,
  type BoundThemeStrings,
  type ThemeStringsDictionary,
} from '../strings/theme-strings';

const ROOT = resolve(__dirname, '..');

beforeEach(() => {
  resetThemeStringsWarnings();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Partial French core pack — deliberately missing keys (fallback coverage). */
const FR_CORE: ThemeStringsDictionary = {
  cart: {
    title: 'Votre panier',
    empty: { message: 'Votre panier est vide.' },
  },
};

const FR_THEME = {
  'cart.empty.browse': 'Voir les produits',
} as unknown as ThemeStringsDictionary;

describe('t() fallback order (decision 3)', () => {
  it('returns the first hit across override, theme, core, default', async () => {
    const bound = await createThemeStrings({
      locale: 'fr',
      loaders: {
        override: async () => ({ cart: { title: 'Override title' } }),
        theme: async () => FR_THEME,
        core: async () => FR_CORE,
      },
    });
    // Override wins.
    expect(bound.t('cart.title')).toBe('Override title');
    // Theme fills what the override lacks (flat dotted key form).
    expect(bound.t('cart.empty.browse')).toBe('Voir les produits');
    // Core fills the rest.
    expect(bound.t('cart.empty.message')).toBe('Votre panier est vide.');
    // LAST fallback is the English default VALUE, never the raw key.
    expect(bound.t('cart.summary.title')).toBe('Order summary');
    expect(bound.dictionaries).toHaveLength(4);
  });

  it('a missing key is "" (never the dotted key, never "translation missing")', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t([defaultThemeStrings], 'no.such.key')).toBe('');
    expect(t([defaultThemeStrings], 'no.such.key')).toBe('');
    // Warned once per key in development, silent in production shape.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('no.such.key');
  });

  it('an empty-string value is a real hit (renders "", does not fall through)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t([{ hidden: { label: '' } }, defaultThemeStrings], 'hidden.label')).toBe('');
    expect(warn).not.toHaveBeenCalled();
  });

  it('a throwing loader drops out of the chain (missing locale file)', async () => {
    const bound = await createThemeStrings({
      locale: 'fr',
      loaders: {
        theme: async () => {
          throw new Error("Cannot find module './fr.json'");
        },
        core: async () => null,
      },
    });
    expect(bound.t('cart.title')).toBe('Your cart');
    expect(bound.locale).toBe('fr');
  });

  it('passes the validated locale code to loaders (host dynamic-imports it)', async () => {
    const seen: string[] = [];
    await createThemeStrings({
      locale: 'fr',
      loaders: { theme: async (locale) => { seen.push(locale); return null; } },
    });
    expect(seen).toEqual(['fr']);
  });

  it('an invalid locale code loads English', async () => {
    const seen: string[] = [];
    const bound = await createThemeStrings({
      locale: 'not a locale!!',
      loaders: { theme: async (locale) => { seen.push(locale); return null; } },
    });
    expect(seen).toEqual(['en']);
    expect(bound.locale).toBe('en');
  });
});

describe('t() plurals (CLDR via Intl.PluralRules)', () => {
  const dict: ThemeStringsDictionary = {
    items: {
      count: {
        one: '{count} item',
        other: '{count} items',
      },
    },
  };

  it('selects one/other in English', () => {
    expect(t([dict], 'items.count', { count: 1 }, 'en')).toBe('1 item');
    expect(t([dict], 'items.count', { count: 0 }, 'en')).toBe('0 items');
    expect(t([dict], 'items.count', { count: 2 }, 'en')).toBe('2 items');
  });

  it('follows French rules (0 and 1 are "one")', () => {
    expect(t([dict], 'items.count', { count: 0 }, 'fr')).toBe('0 item');
    expect(t([dict], 'items.count', { count: 1 }, 'fr')).toBe('1 item');
    expect(t([dict], 'items.count', { count: 2 }, 'fr')).toBe('2 items');
  });

  it('follows Arabic rules ("two" exists)', () => {
    const ar: ThemeStringsDictionary = {
      items: { count: { zero: 'x', one: 'y', two: '{count} items-ar-two', few: 'f', many: 'm', other: 'o' } as never },
    };
    expect(t([ar], 'items.count', { count: 2 }, 'ar')).toBe('2 items-ar-two');
  });

  it('supports the flat "key.one / key.other" suffix convention', () => {
    const flat = {
      'basket.lines.one': '{count} line',
      'basket.lines.other': '{count} lines',
    } as unknown as ThemeStringsDictionary;
    expect(t([flat], 'basket.lines', { count: 1 }, 'en')).toBe('1 line');
    expect(t([flat], 'basket.lines', { count: 5 }, 'en')).toBe('5 lines');
  });

  it('missing/non-numeric count falls back to "other"', () => {
    expect(t([dict], 'items.count', {}, 'en')).toBe('{count} items');
    // Plural selection needs a finite numeric count; interpolation still applies.
    expect(t([dict], 'items.count', { count: 'many' }, 'en')).toBe('many items');
  });
});

describe('t() interpolation edge cases', () => {
  it('keeps a missing var as its {placeholder}', () => {
    expect(t([{ hi: 'Hello {name}!' }], 'hi', {}, 'en')).toBe('Hello {name}!');
    expect(t([{ hi: 'Hello {name}!' }], 'hi', { name: null }, 'en')).toBe('Hello {name}!');
  });

  it('`{{` / `}}` escape to literal braces', () => {
    expect(interpolate('{{{x}}}', { x: 1 })).toBe('{1}');
    expect(interpolate('a {{b}} c', {})).toBe('a {b} c');
  });

  it('resolves nested keys by dot-path and flat dotted keys alike', () => {
    const nested = { a: { b: { c: 'deep' } } } as ThemeStringsDictionary;
    const flat = { 'a.b.c': 'flat' } as unknown as ThemeStringsDictionary;
    expect(t([nested], 'a.b.c')).toBe('deep');
    expect(t([flat], 'a.b.c')).toBe('flat');
  });

  it('stringifies numbers and booleans', () => {
    expect(t([{ v: '{n} / {b}' }], 'v', { n: 42, b: false })).toBe('42 / false');
  });

  it('reads the real default dictionary values used by the cart shell', () => {
    expect(t([defaultThemeStrings], 'cart.title')).toBe('Your cart');
    expect(t([defaultThemeStrings], 'cart.item.each', { price: '₦5,000' })).toBe('₦5,000 each');
    expect(t([defaultThemeStrings], 'cart.item.decrease', { title: 'Egusi' })).toBe('Decrease Egusi');
    expect(t([defaultThemeStrings], 'cart.terms.agree')).toBe('I agree to the ');
  });
});

describe('unknown locale = English', () => {
  it('canonicalises garbage to en', () => {
    expect(canonicalThemeLocale(null)).toBe('en');
    expect(canonicalThemeLocale(undefined)).toBe('en');
    expect(canonicalThemeLocale('not a locale!!')).toBe('en');
  });

  it('canonicalises well-formed-but-unknown codes to en', () => {
    expect(canonicalThemeLocale('xx')).toBe('en');
  });

  it('keeps known codes for plural/format selection', () => {
    for (const code of ['en', 'fr', 'ar']) {
      expect(canonicalThemeLocale(code)).toBe(code);
    }
  });

  it('t() still renders English for an unknown locale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t([defaultThemeStrings], 'cart.title', {}, 'xx')).toBe('Your cart');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('RTL dir (locale catalogue)', () => {
  it('marks Arabic-script locales rtl, everything else ltr', () => {
    expect(themeLocaleDir('ar')).toBe('rtl');
    expect(themeLocaleDir('ar-EG')).toBe('rtl');
    expect(themeLocaleDir('he')).toBe('rtl');
    for (const code of ['en', 'fr', 'es', 'pt', 'sw', 'ha', 'yo', 'ig', 'zh', 'de', 'pcm', null, 'bogus!!']) {
      expect(themeLocaleDir(code), String(code)).toBe('ltr');
    }
  });
});

describe('default English dictionary budget (backend varchar(64))', () => {
  function flatten(node: unknown, prefix: string, out: Array<[string, string]>): void {
    if (typeof node === 'string') {
      out.push([prefix, node]);
      return;
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        flatten(v, prefix ? `${prefix}.${k}` : k, out);
      }
    }
  }

  const pairs: Array<[string, string]> = [];
  flatten(enDefault, '', pairs);

  it('ships the ~107-string core dictionary (intentional growth, still budgeted)', () => {
    // Dictionary budget: the checkout/auth/blog shopper-chrome slice grew the
    // dictionary intentionally by 31 keys (76 -> 107, commit 5cb67dd) so French
    // and other packs stop rendering English on checkout, sign-in and blog.
    // The ceiling stays tight (+8 headroom): any further growth must bump it
    // here deliberately with its own justification, which keeps guarding
    // against uncontrolled growth (backend varchar(64) per-key budget below).
    expect(pairs.length).toBeGreaterThanOrEqual(70);
    expect(pairs.length).toBeLessThanOrEqual(115);
  });

  it('every key fits the dotted-lowercase grammar and the 40-char budget', () => {
    for (const [key] of pairs) {
      // Same grammar as the backend overlay (ThemeStringTranslatable::KEY_PATTERN suffix) and theme-check
      // `theme/locale-key-naming`: segments may start with a digit (e.g. `auth.2fa.code`).
      expect(key, `grammar: ${key}`).toMatch(/^[a-z0-9]+(\.[a-z0-9]+)*$/);
      expect(key.length, `budget: ${key}`).toBeLessThanOrEqual(THEME_STRING_KEY_MAX_LENGTH);
    }
    // `<theme-slug>.<key>` must fit varchar(64): 40 + 1 + 23.
    expect(Math.max(...pairs.map(([k]) => k.length))).toBeLessThanOrEqual(40);
  });

  it('every value fits the 1000-char budget', () => {
    for (const [key, value] of pairs) {
      expect(value.length, `value: ${key}`).toBeLessThanOrEqual(THEME_STRING_VALUE_MAX_LENGTH);
    }
  });

  it('matches the runtime default export', () => {
    expect(defaultThemeStrings).toEqual(enDefault);
  });
});

describe('per-locale loading gate (decision 5)', () => {
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(full, out);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  /** Import specifiers only (static `from`/`import` and dynamic `import()`). */
  function importSpecifiers(source: string): string[] {
    const out: string[] = [];
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) out.push(match[1]);
    for (const match of source.matchAll(/import\s*\(\s*['"`]([^'"`]+)['"`]/g)) out.push(match[1]);
    return out;
  }

  it('no client-reachable module statically imports a non-default locale file', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      const source = readFileSync(file, 'utf-8');
      for (const spec of importSpecifiers(source)) {
        if (spec.includes('locales/') && !spec.endsWith('locales/en.default.json')) {
          offenders.push(`${file}: ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the kit never dynamic-imports the locales dir (only the host does, per locale)', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      const source = readFileSync(file, 'utf-8');
      if (/import\s*\(\s*[`'"][^`'"]*locales\//.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('only the English default may be statically imported (exactly one locale ships)', () => {
    const importers: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      const source = readFileSync(file, 'utf-8');
      if (source.includes('locales/en.default.json')) importers.push(file);
    }
    expect(importers).toEqual([join(ROOT, 'strings', 'theme-strings.ts')]);
  });

  it('the pure/server-safe module imports neither next/* nor React', () => {
    const source = readFileSync(join(ROOT, 'strings', 'theme-strings.ts'), 'utf-8');
    expect(source).not.toMatch(/from ['"]next\//);
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toContain("'use client'");
    expect(existsSync(join(ROOT, 'locales', 'en.default.json'))).toBe(true);
  });
});

describe('server surface: bound t with NO provider (decision 4a)', () => {
  function Greeting({ bound, name }: { bound: BoundThemeStrings; name: string }): JSX.Element {
    return (
      <main>
        <h1>{bound.t('cart.title')}</h1>
        <p>{bound.t('cart.empty.message')}</p>
        <p>{bound.t('cart.item.each', { price: name })}</p>
      </main>
    );
  }

  async function renderFor(locale: string | null): Promise<{ bound: BoundThemeStrings; html: string }> {
    const bound = await createThemeStrings({
      locale,
      loaders: {
        theme: async (active) => (active === 'fr' ? FR_CORE : null),
      },
    });
    return { bound, html: renderToStaticMarkup(<Greeting bound={bound} name="5 000 F" />) };
  }

  it('renders EN from defaults with no provider in the tree', async () => {
    const { html } = await renderFor(null);
    expect(html).toContain('<h1>Your cart</h1>');
    expect(html).toContain('Your cart is empty.');
  });

  it('renders FR from the active locale only', async () => {
    const { bound, html } = await renderFor('fr');
    expect(bound.locale).toBe('fr');
    expect(html).toContain('<h1>Votre panier</h1>');
    expect(html).toContain('Votre panier est vide.');
    // Key missing from the FR pack falls back to the English VALUE.
    expect(html).toContain('5 000 F each');
  });

  it('renders AR with English values and an rtl dir', async () => {
    const { bound, html } = await renderFor('ar');
    expect(bound.locale).toBe('ar');
    expect(html).toContain('<h1>Your cart</h1>');
    expect(themeLocaleDir(bound.locale)).toBe('rtl');
  });
});

describe('Intl probe (report only — en fr es pt ar sw ha yo ig zh de pcm)', () => {
  const LOCALES = ['en', 'fr', 'es', 'pt', 'ar', 'sw', 'ha', 'yo', 'ig', 'zh', 'de', 'pcm'];

  it('records native support vs silent fallback on this Node runtime', () => {
    const rows = LOCALES.map((locale) => ({
      locale,
      plural: Intl.PluralRules.supportedLocalesOf([locale]).length > 0 ? 'native' : 'FALLBACK',
      number: Intl.NumberFormat.supportedLocalesOf([locale]).length > 0 ? 'native' : 'FALLBACK',
      date: Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0 ? 'native' : 'FALLBACK',
    }));
    // eslint-disable-next-line no-console
    console.log(`[intl-probe] node ${process.version}\n${rows.map((r) => `${r.locale}: plural=${r.plural} number=${r.number} date=${r.date}`).join('\n')}`);

    // Every locale still formats without throwing (helpers fall back to English).
    for (const locale of LOCALES) {
      expect(() => formatThemeNumber(1234.5, locale)).not.toThrow();
      expect(() => formatThemeDate('2026-02-14', locale)).not.toThrow();
      expect(() => formatThemeMoney(5000, 'NGN', locale)).not.toThrow();
      expect(t([defaultThemeStrings], 'cart.title', {}, locale)).toBe('Your cart');
    }
    expect(rows).toHaveLength(12);
  });
});
