/**
 * Theme strings — the kit's Shopify-shaped UI-string mechanism (slice K0).
 *
 * PURE AND SERVER-SAFE: this module imports nothing from `next/*` and nothing
 * from React, so server components, Node tooling and the browser all share it
 * (precedent: `utils/locale.ts`). Keep it that way — `tests/theme-strings*`
 * fails a build that adds either import here.
 *
 * Two surfaces (plan decision 4):
 *  - Server: `createThemeStrings({ locale, loaders })` returns a bound `t`
 *    that a server component receives via props/closure. NO provider in the
 *    tree. The host supplies the loaders (per-locale dynamic imports) so the
 *    kit never bundles locale files.
 *  - Client: `StorefrontProvider` takes an optional `strings` prop and
 *    `useThemeStrings()` returns the same bound `t`. Absent prop = English
 *    defaults, byte-identical to the old hardcoded literals.
 *
 * Fallback (plan decision 3): the caller supplies an ordered list of
 * dictionaries (merchant override, theme locale, kit core locale) and `t`
 * returns the FIRST hit. The LAST entry is always the English default value —
 * never the raw dotted key, never "translation missing". A key absent
 * everywhere returns `''` (and warns once per key in development only).
 *
 * Key budget: dotted lowercase `scope.thing.state`, total length <= 40 chars.
 * The backend overlay stores `<theme-slug>.<key>` in a varchar(64), so 40 for
 * the key leaves 23 for the slug plus the dot separator. Values <= 1000 chars.
 */

import {
  ENGLISH_DISPLAY_LOCALE,
  parseLocaleCode,
  resolveIntlLocale,
  resolveSupportedLocale,
} from '../utils/locale';
import enDefault from '../locales/en.default.json';

/** Interpolation variables: `{name}` in a value. `count` drives plurals. */
export type ThemeStringsVars = Record<string, string | number | boolean | null | undefined>;

/**
 * CLDR plural variants for one key, using the `one/two/few/many/other`
 * suffix convention. `other` is required (the fallback form); the rest are
 * used only when `Intl.PluralRules` for the active locale selects them.
 */
export interface ThemeStringsPluralMap {
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type ThemeStringsValue =
  | string
  | ThemeStringsPluralMap
  | { [key: string]: ThemeStringsValue };

/** One dictionary: nested objects traversed by dot-path, or flat dotted keys. */
export type ThemeStringsDictionary = { [key: string]: ThemeStringsValue };

/** The bound translator both surfaces hand out. */
export type ThemeStringsFn = (
  key: string,
  vars?: ThemeStringsVars,
  locale?: string | null,
) => string;

/** The kit's default English core dictionary (`locales/en.default.json`). */
export const defaultThemeStrings: ThemeStringsDictionary =
  enDefault as ThemeStringsDictionary;

/** Maximum total key length — see the module docblock for the budget. */
export const THEME_STRING_KEY_MAX_LENGTH = 40;

/** Maximum value length. */
export const THEME_STRING_VALUE_MAX_LENGTH = 1000;

const PLURAL_FORMS = ['one', 'two', 'few', 'many', 'other'] as const;

/**
 * Canonical locale for string selection. Unknown/unparseable codes become
 * English, mirroring `parseLocaleCode` (and the backend's unknown-locale
 * rule). A well-formed code the runtime's ICU does not know also becomes
 * English, so plural selection never silently follows the wrong language.
 */
export function canonicalThemeLocale(locale: string | null | undefined): string {
  const code = parseLocaleCode(locale) ?? 'en';
  try {
    return Intl.PluralRules.supportedLocalesOf([code]).length > 0 ? code : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Text direction for a locale (`dir` attribute). There is no locale catalogue
 * in the kit to read this from, so the base language decides: Arabic-script
 * languages render `rtl`, everything else (including unknown codes) `ltr`.
 */
export function themeLocaleDir(locale: string | null | undefined): 'rtl' | 'ltr' {
  const base = (parseLocaleCode(locale) ?? 'en').split('-')[0]?.toLowerCase() ?? 'en';
  return RTL_BASE_LANGUAGES.has(base) ? 'rtl' : 'ltr';
}

const RTL_BASE_LANGUAGES: ReadonlySet<string> = new Set([
  'ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'ug', 'dv', 'ku',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPluralMap(value: unknown): value is ThemeStringsPluralMap {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length > 0 &&
    keys.every((k) => (PLURAL_FORMS as readonly string[]).includes(k)) &&
    keys.every((k) => typeof value[k] === 'string')
  );
}

/** Dot-path lookup that also accepts a flat literal dotted key. */
function lookupValue(
  dictionary: ThemeStringsDictionary,
  key: string,
): ThemeStringsValue | undefined {
  if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
    return dictionary[key];
  }
  let node: ThemeStringsValue = dictionary;
  for (const part of key.split('.')) {
    if (!isRecord(node) || !Object.prototype.hasOwnProperty.call(node, part)) return undefined;
    node = node[part] as ThemeStringsValue;
  }
  return node;
}

function pluralCount(vars: ThemeStringsVars | undefined): number | null {
  const count = vars?.['count'];
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

function selectPluralForm(
  map: ThemeStringsPluralMap,
  vars: ThemeStringsVars | undefined,
  locale: string,
): string {
  const count = pluralCount(vars);
  if (count === null) return map.other;
  let form: string;
  try {
    form = new Intl.PluralRules(locale).select(count);
  } catch {
    form = new Intl.PluralRules('en').select(count);
  }
  return map[form as keyof ThemeStringsPluralMap] ?? map.other;
}

/** Suffix convention: `key.one` … `key.other` looked up as (flat or nested) keys. */
function lookupSuffixed(
  dictionary: ThemeStringsDictionary,
  key: string,
  vars: ThemeStringsVars | undefined,
  locale: string,
): string | undefined {
  const count = pluralCount(vars);
  let form = 'other';
  if (count !== null) {
    try {
      form = new Intl.PluralRules(locale).select(count);
    } catch {
      form = new Intl.PluralRules('en').select(count);
    }
  }
  for (const candidate of form === 'other' ? ['other'] : [form, 'other']) {
    const value = lookupValue(dictionary, `${key}.${candidate}`);
    if (typeof value === 'string') return interpolate(value, vars);
  }
  return undefined;
}

/**
 * `{var}` interpolation. A missing/nullish var keeps its `{placeholder}`
 * (visible, greppable, never a crash); `{{` / `}}` escape to literal braces.
 */
export function interpolate(
  template: string,
  vars: ThemeStringsVars | undefined,
): string {
  if (!template.includes('{') && !template.includes('}')) return template;
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === '{') {
      if (template[i + 1] === '{') {
        out += '{';
        i += 2;
        continue;
      }
      const close = template.indexOf('}', i + 1);
      const name = close === -1 ? '' : template.slice(i + 1, close);
      if (close !== -1 && /^[A-Za-z0-9_]+$/.test(name)) {
        const value = vars?.[name];
        out += value === undefined || value === null ? template.slice(i, close + 1) : String(value);
        i = close + 1;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '}' && template[i + 1] === '}') {
      out += '}';
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const warnedKeys = new Set<string>();

function warnMissingKey(key: string): void {
  if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production') return;
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[theme-kit] missing theme string: "${key}" (no dictionary has it; rendered "")`);
}

/** Test-only: reset the warn-once set between cases. */
export function resetThemeStringsWarnings(): void {
  warnedKeys.clear();
}

/**
 * Pure lookup: first hit across the ordered dictionaries wins
 * (override, theme locale, kit core locale — the caller appends
 * `defaultThemeStrings` LAST). Absent everywhere: `''` in production, plus a
 * once-per-key `console.warn` in development. Never the raw key.
 */
export function t(
  dictionaries: ThemeStringsDictionary | Array<ThemeStringsDictionary | null | undefined>,
  key: string,
  vars?: ThemeStringsVars,
  locale?: string | null,
): string {
  const list = Array.isArray(dictionaries) ? dictionaries : [dictionaries];
  const canonical = canonicalThemeLocale(locale);
  for (const dictionary of list) {
    if (!dictionary) continue;
    const value = lookupValue(dictionary, key);
    if (typeof value === 'string') return interpolate(value, vars);
    if (isPluralMap(value)) return interpolate(selectPluralForm(value, vars, canonical), vars);
    const suffixed = lookupSuffixed(dictionary, key, vars, canonical);
    if (suffixed !== undefined) return suffixed;
  }
  warnMissingKey(key);
  return '';
}

/** Per-locale loader the host supplies — usually a dynamic `import()`. */
export type ThemeStringsLoader = (
  locale: string,
) => Promise<ThemeStringsDictionary | null | undefined>;

export interface ThemeStringsLoaders {
  /** Merchant overrides for the active locale (highest precedence). */
  override?: ThemeStringsLoader;
  /** Active theme's `{locale}.json`. */
  theme?: ThemeStringsLoader;
  /** Kit core pack for the active locale. */
  core?: ThemeStringsLoader;
}

export interface BoundThemeStrings {
  /** Bound to the active locale's dictionaries (+ English default last). */
  t: ThemeStringsFn;
  /** Validated requested locale (`en` when unknown) — what loaders were read with. */
  locale: string;
  /** Ordered dictionaries the bound `t` reads (override, theme, core, default). */
  dictionaries: ThemeStringsDictionary[];
}

/**
 * Server-safe, provider-free loader contract. Reads ONLY the active locale
 * (one locale crosses to the client — never every `{lang}.json`), merges
 * override → theme → core → English default, and returns a bound `t` for
 * props/closure use. A loader that throws or returns null (e.g. a missing
 * locale file) simply drops out of the chain — never an error.
 */
export async function createThemeStrings(options?: {
  locale?: string | null;
  loaders?: ThemeStringsLoaders;
}): Promise<BoundThemeStrings> {
  const requested = parseLocaleCode(options?.locale) ?? 'en';
  const loaders = options?.loaders;
  const dictionaries: ThemeStringsDictionary[] = [];
  for (const load of [loaders?.override, loaders?.theme, loaders?.core]) {
    if (!load) continue;
    try {
      const dictionary = await load(requested);
      if (dictionary && isRecord(dictionary)) {
        dictionaries.push(dictionary as ThemeStringsDictionary);
      }
    } catch {
      // Missing locale file et al: fall through to the next dictionary.
    }
  }
  dictionaries.push(defaultThemeStrings);
  const active = requested;
  return {
    t: (key, vars, overrideLocale) =>
      t(dictionaries, key, vars, overrideLocale ?? active),
    locale: active,
    dictionaries,
  };
}

/**
 * Pick the Intl tag for one theme formatting call: the storefront locale
 * through the single canonical mapping (`resolveIntlLocale` — English lands
 * on `ENGLISH_DISPLAY_LOCALE`, never bare `en` with its US order), or
 * English when the runtime's ICU lacks the locale. Never throws.
 */
function themeFormatTag(
  locale: string | null | undefined,
  supportedLocalesOf: (locales: string[]) => readonly string[],
): string {
  return resolveSupportedLocale(resolveIntlLocale(locale), supportedLocalesOf);
}

/** Locale-aware number formatting keyed by the active locale (unknown → English). Never throws. */
export function formatThemeNumber(
  value: number,
  locale?: string | null,
  options?: Intl.NumberFormatOptions,
): string {
  const tag = themeFormatTag(locale, (l) => Intl.NumberFormat.supportedLocalesOf(l));
  try {
    return new Intl.NumberFormat(tag, options).format(value);
  } catch {
    try {
      return new Intl.NumberFormat(ENGLISH_DISPLAY_LOCALE, options).format(value);
    } catch {
      return String(value);
    }
  }
}

/**
 * Locale-aware date formatting keyed by the active locale (unknown →
 * English). `''` if unparseable. Never throws.
 *
 * THE helper themes call instead of hardcoding 'en-GB' in their own date
 * formatting: pass the storefront locale (client: `useStorefrontLocale()`; server: the
 * request locale the host already holds) and the same Intl options — English
 * shoppers see the unchanged British/Nigerian order ("2 October 2026"),
 * other shoppers see their own locale. A Node whose ICU lacks the locale
 * falls back to English, never an exception.
 */
export function formatThemeDate(
  value: string | number | Date,
  locale?: string | null,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tag = themeFormatTag(locale, (l) => Intl.DateTimeFormat.supportedLocalesOf(l));
  try {
    return new Intl.DateTimeFormat(tag, options).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat(ENGLISH_DISPLAY_LOCALE, options).format(date);
    } catch {
      return '';
    }
  }
}

function normalizeMoneyCurrency(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim())
    ? value.trim().toUpperCase()
    : 'NGN';
}

/** Locale-aware currency formatting keyed by the active locale (unknown → English). Never throws. */
export function formatThemeMoney(
  amount: number,
  currency: unknown,
  locale?: string | null,
  options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>,
): string {
  const code = normalizeMoneyCurrency(currency);
  const tag = themeFormatTag(locale, (l) => Intl.NumberFormat.supportedLocalesOf(l));
  try {
    return new Intl.NumberFormat(tag, {
      ...options,
      style: 'currency',
      currency: code,
    }).format(amount);
  } catch {
    try {
      return new Intl.NumberFormat(ENGLISH_DISPLAY_LOCALE, {
        ...options,
        style: 'currency',
        currency: code,
      }).format(amount);
    } catch {
      return `${code} ${amount}`;
    }
  }
}

/**
 * Locale-aware relative time keyed by the active locale (unknown → English):
 * `formatThemeRelativeTime(-1, 'day', 'fr')` → `"hier"`. `numeric: 'auto'`
 * by default so whole days read as words where the language has them. Never
 * throws — a missing ICU locale falls back to English, a bad unit to
 * `"<value> <unit>"`.
 */
export function formatThemeRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit = 'day',
  locale?: string | null,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  const tag = themeFormatTag(locale, (l) => Intl.RelativeTimeFormat.supportedLocalesOf(l));
  try {
    return new Intl.RelativeTimeFormat(tag, { numeric: 'auto', ...options }).format(value, unit);
  } catch {
    try {
      return new Intl.RelativeTimeFormat(ENGLISH_DISPLAY_LOCALE, {
        numeric: 'auto',
        ...options,
      }).format(value, unit);
    } catch {
      return `${value} ${unit}`;
    }
  }
}
