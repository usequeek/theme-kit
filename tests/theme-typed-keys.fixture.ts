/**
 * Type-level test (tsd-style via tsc): a typo key FAILS and a valid key
 * PASSES. This file must stay green under `npm run typecheck` — every
 * `@ts-expect-error` below is consumed only if the marked line is a type
 * error, so deleting the error (or breaking the helper) fails the gate.
 *
 * NOTE: intentionally self-contained (no `locales/*.json` import) so the
 * per-locale bundle gate keeps counting exactly one static locale importer
 * (`strings/theme-strings.ts`).
 */
import {
  createThemeT,
  t,
  type ThemeStringKey,
  type ThemeStringsDictionary,
} from '../strings/theme-strings';

const strings = {
  cart: {
    title: 'Your cart',
    empty: { message: 'Your cart is empty.' },
  },
  items: {
    count: { one: '{count} item', other: '{count} items' },
  },
  'flat.key': 'Flat value',
} as const;

type K = ThemeStringKey<typeof strings>;

// The union is EXACTLY the flattened keys (mutual assignability proves it:
// adding or dropping a key on either side breaks this file).
type Expected = 'cart.title' | 'cart.empty.message' | 'items.count' | 'flat.key';
const exact1: Expected = null as unknown as K;
const exact2: K = null as unknown as Expected;
void exact1;
void exact2;

// Valid keys pass …
const okTitle: K = 'cart.title';
const okNested: K = 'cart.empty.message';
const okPlural: K = 'items.count';
const okFlat: K = 'flat.key';
void okTitle;
void okNested;
void okPlural;
void okFlat;

// … and plural sub-forms are NOT keys (the map is one key) …
 // @ts-expect-error - 'items.count.one' is a form, not a key
const badForm: K = 'items.count.one';
void badForm;

// … a typo key fails …
 // @ts-expect-error - typo: 'cart.titl' is not a key
const badTypo: K = 'cart.titl';
void badTypo;

// … and an unknown key fails.
 // @ts-expect-error - 'no.such.key' is not a key
const badUnknown: K = 'no.such.key';
void badUnknown;

// The typed binding enforces the same at the call site.
const dict = strings as unknown as ThemeStringsDictionary;
const tt = createThemeT<typeof strings>((key, vars, locale) => t([dict], key, vars, locale));
tt('cart.title');
tt('items.count', { count: 2 });
// @ts-expect-error - typo key fails through createThemeT too
tt('cart.titl');

// A broad dictionary stays untyped (existing dynamic-key callers compile).
declare const anyKey: string;
const loose = createThemeT<ThemeStringsDictionary>((key, vars, locale) => t([dict], key, vars, locale));
loose(anyKey);
t([dict], anyKey);
