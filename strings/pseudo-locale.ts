/**
 * Pseudo-locale QA helper.
 *
 * PURE AND SERVER-SAFE: this module imports nothing from `next/*` and nothing
 * from React, so server components, Node tooling (such as the theme check), tests and the
 * browser all share it (precedent: `utils/locale.ts`, `strings/theme-strings.ts`).
 * Keep it that way.
 *
 * What it is: `pseudoLocalize(dictionary, options?)` returns a pseudo
 * dictionary with the SAME keys and the SAME plural-map shape, where every
 * string value is accent-mapped, ~30% longer, and wrapped in markers like
 * `[!! … !!]`. `{placeholders}` and `{{`/`}}` escapes pass through
 * untouched, keys are never touched.
 *
 * Two uses (both documented in the README):
 *  - Dev-only locale: mount the app with the pseudo dictionary as the
 *    `strings` prop. Every string that went through `t()` renders pseudo;
 *    any text that remains plain English next to pseudo text is a hard-coded
 *    (un-wrapped) string. Never ship pseudo to shoppers.
 *  - Tests: render a component with the pseudo dictionary, then run the
 *    English-leak scan (`findEnglishLeaks` / `assertNoEnglishLeak`) over the
 *    HTML. That scan is the reusable primitive theme tests import.
 *
 * English safety: this module never changes an English value — pseudo
 * dictionaries are built on demand in dev/test and never enter a bundle.
 */

import type { ThemeStringsDictionary, ThemeStringsValue } from './theme-strings';

export interface PseudoLocalizeOptions {
  /** Marker prepended to every value. Default `'[!! '`. */
  prefix?: string;
  /** Marker appended to every value. Default `' !!]'`. */
  suffix?: string;
  /** Fraction of extra padding appended inside the markers. Default `0.3`. */
  expansionRatio?: number;
  /** Padding character. Default `'~'`. */
  expansionChar?: string;
  /**
   * Wrap the core in U+202B … U+202C (RTL embedding) for a visual RTL check.
   * Default `false`. This is a spot-check aid, not bidi-correct output.
   */
  rtl?: boolean;
}

export const PSEUDO_PREFIX = '[!! ';
export const PSEUDO_SUFFIX = ' !!]';
export const PSEUDO_EXPANSION_RATIO = 0.3;
export const PSEUDO_EXPANSION_CHAR = '~';

const ACCENT_MAP: Record<string, string> = {
  a: 'à', A: 'À', b: 'ƀ', B: 'Ɓ', c: 'ç', C: 'Ç', d: 'ď', D: 'Ď',
  e: 'è', E: 'È', f: 'ƒ', F: 'Ƒ', g: 'ĝ', G: 'Ĝ', h: 'ĥ', H: 'Ĥ',
  i: 'ì', I: 'Ì', j: 'ĵ', J: 'Ĵ', k: 'ķ', K: 'Ķ', l: 'ŀ', L: 'Ŀ',
  m: 'ṁ', M: 'Ṁ', n: 'ñ', N: 'Ñ', o: 'ò', O: 'Ò', p: 'ṗ', P: 'Ṗ',
  q: 'ǫ', Q: 'Ǫ', r: 'ŕ', R: 'Ŕ', s: 'š', S: 'Š', t: 'ţ', T: 'Ţ',
  u: 'ù', U: 'Ù', v: 'ṽ', V: 'Ṽ', w: 'ŵ', W: 'Ŵ', x: 'ẋ', X: 'Ẋ',
  y: 'ÿ', Y: 'Ÿ', z: 'ž', Z: 'Ž',
};

const PLURAL_FORMS = ['one', 'two', 'few', 'many', 'other'];

/** Same leaf rule as `t()`'s runtime: all keys are plural forms, all values strings. */
function isPluralMapValue(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length > 0 &&
    keys.every((k) => PLURAL_FORMS.includes(k)) &&
    keys.every((k) => typeof (value as Record<string, unknown>)[k] === 'string')
  );
}

function isPlaceholderName(name: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(name);
}

/**
 * Pseudo-localize one string value. `{placeholder}` interpolations and
 * `{{`/`}}` escapes are preserved byte-for-byte; only plain-text letters are
 * accent-mapped. `''` stays `''` (an intentional empty renders nothing, so
 * there is no node to mark).
 */
export function pseudoLocalizeText(value: string, options?: PseudoLocalizeOptions): string {
  if (value === '') return '';
  const prefix = options?.prefix ?? PSEUDO_PREFIX;
  const suffix = options?.suffix ?? PSEUDO_SUFFIX;
  const ratio = options?.expansionRatio ?? PSEUDO_EXPANSION_RATIO;
  const expansionChar = options?.expansionChar ?? PSEUDO_EXPANSION_CHAR;
  const rtl = options?.rtl ?? false;

  let core = '';
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch === '{' && value[i + 1] === '{') {
      core += '{{';
      i += 2;
      continue;
    }
    if (ch === '}' && value[i + 1] === '}') {
      core += '}}';
      i += 2;
      continue;
    }
    if (ch === '{') {
      const close = value.indexOf('}', i + 1);
      const name = close === -1 ? '' : value.slice(i + 1, close);
      if (close !== -1 && isPlaceholderName(name)) {
        core += value.slice(i, close + 1);
        i = close + 1;
        continue;
      }
      core += ACCENT_MAP[ch] ?? ch;
      i += 1;
      continue;
    }
    core += /[A-Za-z]/.test(ch) ? (ACCENT_MAP[ch] ?? ch) : ch;
    i += 1;
  }

  const padLength = Math.max(0, Math.round(core.length * ratio));
  const expanded = core + expansionChar.repeat(padLength);
  const inner = rtl ? '\u202B' + expanded + '\u202C' : expanded;
  return `${prefix}${inner}${suffix}`;
}

function pseudoLocalizeValue(value: ThemeStringsValue, options?: PseudoLocalizeOptions): ThemeStringsValue {
  if (typeof value === 'string') return pseudoLocalizeText(value, options);
  if (isPluralMapValue(value)) {
    const out: Record<string, string> = {};
    for (const [form, template] of Object.entries(value)) {
      out[form] = pseudoLocalizeText(template, options);
    }
    return out as ThemeStringsValue;
  }
  if (typeof value === 'object' && value !== null) {
    const out: ThemeStringsDictionary = {};
    for (const [k, v] of Object.entries(value as ThemeStringsDictionary)) {
      out[k] = pseudoLocalizeValue(v, options);
    }
    return out;
  }
  return value;
}

/**
 * Pseudo-localize a whole dictionary. Keys (including flat literal dotted
 * keys) are copied verbatim; nested objects recurse; plural maps keep their
 * exact form keys with each template pseudo-localized.
 */
export function pseudoLocalize(
  dictionary: ThemeStringsDictionary,
  options?: PseudoLocalizeOptions,
): ThemeStringsDictionary {
  const out: ThemeStringsDictionary = {};
  for (const [key, value] of Object.entries(dictionary)) {
    out[key] = pseudoLocalizeValue(value, options);
  }
  return out;
}

/** True when the rendered text carries this run's pseudo markers. */
export function isPseudoLocalized(text: string, options?: PseudoLocalizeOptions): boolean {
  const prefix = options?.prefix ?? PSEUDO_PREFIX;
  const suffix = options?.suffix ?? PSEUDO_SUFFIX;
  const trimmed = text.trim();
  return (
    trimmed.length >= prefix.length + suffix.length &&
    trimmed.startsWith(prefix) &&
    trimmed.endsWith(suffix)
  );
}

export interface EnglishLeakScanOptions {
  /**
   * Visible strings that are English by design (brand names, codes) and must
   * not be reported. Exact strings or patterns, matched against the trimmed
   * node text.
   */
  allowlist?: Array<string | RegExp>;
  /**
   * Also scan user-visible attributes (`aria-label`, `aria-valuetext`,
   * `placeholder`, `title`, `alt`). Default `true` — hard-coded aria copy is
   * the same bug class as hard-coded text nodes.
   */
  includeAttributes?: boolean;
  /** Marker options used for the pseudo run being scanned. */
  pseudo?: PseudoLocalizeOptions;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function visibleTexts(html: string, includeAttributes: boolean): string[] {
  const found: string[] = [];
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  if (includeAttributes) {
    for (const match of text.matchAll(
      /(?:aria-label|aria-valuetext|placeholder|title|alt)\s*=\s*"([^"]*)"/gi,
    )) {
      const attr = decodeEntities(match[1] ?? '').trim().replace(/\s+/g, ' ');
      if (attr) found.push(attr);
    }
    for (const match of text.matchAll(
      /(?:aria-label|aria-valuetext|placeholder|title|alt)\s*=\s*'([^']*)'/gi,
    )) {
      const attr = decodeEntities(match[1] ?? '').trim().replace(/\s+/g, ' ');
      if (attr) found.push(attr);
    }
  }
  const stripped = text.replace(/<[^>]*>/g, '\u0000');
  for (const part of stripped.split('\u0000')) {
    const node = decodeEntities(part).trim().replace(/\s+/g, ' ');
    if (node) found.push(node);
  }
  return found;
}

/**
 * The English-leak scan primitive: every visible text node of the rendered
 * HTML that is NOT pseudo-localized (and not allowlisted, and containing at
 * least one ASCII letter so numbers/symbols never report) is a hard-coded
 * English string. Returns the offending node texts (trimmed, in document
 * order). Pure — theme tests render with the pseudo dictionary, then call
 * this (or `assertNoEnglishLeak`).
 */
export function findEnglishLeaks(html: string, options?: EnglishLeakScanOptions): string[] {
  const allowlist = options?.allowlist ?? [];
  const includeAttributes = options?.includeAttributes ?? true;
  return visibleTexts(html, includeAttributes).filter((node) => {
    if (isPseudoLocalized(node, options?.pseudo)) return false;
    if (!/[A-Za-z]/.test(node)) return false;
    if (allowlist.some((rule) => (typeof rule === 'string' ? rule === node : rule.test(node)))) {
      return false;
    }
    return true;
  });
}

/** Throw listing every leaked node, or return silently when the render is clean. */
export function assertNoEnglishLeak(html: string, options?: EnglishLeakScanOptions): void {
  const leaks = findEnglishLeaks(html, options);
  if (leaks.length > 0) {
    throw new Error(
      `[theme-kit] English leak: ${leaks.length} visible string(s) are not pseudo-localized:\n` +
        leaks
          .slice(0, 20)
          .map((leak) => ` - ${JSON.stringify(leak)}`)
          .join('\n'),
    );
  }
}
