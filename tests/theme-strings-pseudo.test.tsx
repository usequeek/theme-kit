import { renderToStaticMarkup } from 'react-dom/server';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import enDefault from '../locales/en.default.json';
import { StorefrontProvider, useThemeStrings } from '../provider';
import { defaultThemeStrings, t, type ThemeStringsDictionary } from '../strings/theme-strings';
import {
  assertNoEnglishLeak,
  findEnglishLeaks,
  isPseudoLocalized,
  pseudoLocalize,
  pseudoLocalizeText,
} from '../strings/pseudo-locale';

const EN = enDefault as unknown as ThemeStringsDictionary;

function render(children: ReactNode, strings: ThemeStringsDictionary | null): string {
  return renderToStaticMarkup(
    <StorefrontProvider
      vendor={{ id: 'v1', slug: 'demo-store', name: 'Demo Store' } as never}
      config={{} as never}
      menus={[]}
      {...(strings ? { strings } : {})}
    >
      {children}
    </StorefrontProvider>,
  );
}

function Title(): JSX.Element {
  const t = useThemeStrings();
  return <h1>{t('cart.title')}</h1>;
}

describe('pseudoLocalize (pure dictionary transform)', () => {
  it('accent-maps, expands ~30% and wraps in markers', () => {
    expect(pseudoLocalizeText('Your cart')).toBe('[!! Ÿòùŕ çàŕţ~~~ !!]');
  });

  it('preserves {placeholders} byte-for-byte and still interpolates', () => {
    const pseudo = pseudoLocalizeText('{count} items');
    expect(pseudo).toBe('[!! {count} ìţèṁš~~~~ !!]');
    expect(pseudo).toContain('{count}');
    expect(t([{ v: pseudo }], 'v', { count: 3 }, 'en')).toBe('[!! 3 ìţèṁš~~~~ !!]');
  });

  it('preserves `{{` / `}}` escapes (structure survives, literal is pseudo)', () => {
    const pseudo = pseudoLocalizeText('a {{b}} c');
    expect(pseudo).toContain('{{');
    expect(pseudo).toContain('}}');
    // Same interpolation behaviour as the source: escapes still escape.
    expect(t([{ v: pseudo }], 'v', {}, 'en')).toBe('[!! à {ƀ} ç~~~ !!]');
  });

  it('keeps plural-map shape (one key, every form pseudo)', () => {
    const dict: ThemeStringsDictionary = {
      items: { count: { one: '{count} item', other: '{count} items' } },
    };
    const pseudo = pseudoLocalize(dict);
    expect(Object.keys((pseudo['items'] as Record<string, unknown>)['count'] as object)).toEqual([
      'one',
      'other',
    ]);
    const forms = (pseudo['items'] as { count: { one: string; other: string } }).count;
    expect(forms.one).toContain('{count}');
    expect(isPseudoLocalized(forms.one)).toBe(true);
    expect(isPseudoLocalized(forms.other)).toBe(true);
    // t() still selects forms from the pseudo dictionary.
    expect(t([pseudo], 'items.count', { count: 1 }, 'en')).toContain('1');
    expect(t([pseudo], 'items.count', { count: 5 }, 'en')).toContain('5');
  });

  it('recurses nested objects and never touches keys (incl. flat dotted keys)', () => {
    const dict = {
      cart: { title: 'Your cart', empty: { message: 'Your cart is empty.' } },
      'flat.key': 'Flat value',
    } as unknown as ThemeStringsDictionary;
    const pseudo = pseudoLocalize(dict);
    expect(Object.keys(pseudo).sort()).toEqual(['cart', 'flat.key']);
    expect(Object.keys(pseudo['cart'] as object).sort()).toEqual(['empty', 'title']);
    expect(t([pseudo], 'flat.key')).toBe(pseudoLocalizeText('Flat value'));
  });

  it('leaves empty values empty (an intentional empty renders no node)', () => {
    expect(pseudoLocalizeText('')).toBe('');
    const pseudo = pseudoLocalize({ hidden: { label: '' } });
    expect((pseudo['hidden'] as { label: string }).label).toBe('');
  });

  it('expands very long values by ~30% (1000-char budget value)', () => {
    const long = 'a'.repeat(1000);
    const pseudo = pseudoLocalizeText(long);
    const core = pseudo.slice('[!! '.length, -' !!]'.length);
    expect(core.length).toBe(1000 + Math.round(1000 * 0.3));
  });

  it('leaves unicode (non-Latin, emoji) intact, wrapped', () => {
    const pseudo = pseudoLocalizeText('こんにちは世界 🛒');
    expect(pseudo).toContain('こんにちは世界');
    expect(pseudo).toContain('🛒');
    expect(isPseudoLocalized(pseudo)).toBe(true);
  });

  it('rtl option wraps the core in U+202B … U+202C', () => {
    const pseudo = pseudoLocalizeText('Your cart', { rtl: true });
    expect(pseudo.includes('\u202B')).toBe(true);
    expect(pseudo.includes('\u202C')).toBe(true);
    expect(isPseudoLocalized(pseudo)).toBe(true);
  });

  it('custom markers are honoured by the scan', () => {
    const pseudo = pseudoLocalizeText('Your cart', { prefix: '‹', suffix: '›' });
    expect(pseudo.startsWith('‹')).toBe(true);
    expect(isPseudoLocalized(pseudo)).toBe(false);
    expect(isPseudoLocalized(pseudo, { prefix: '‹', suffix: '›' })).toBe(true);
    expect(findEnglishLeaks(`<h1>${pseudo}</h1>`, { pseudo: { prefix: '‹', suffix: '›' } })).toEqual(
      [],
    );
  });
});

describe('English leak scan (reusable theme-test primitive)', () => {
  it('a fully pseudo render is clean', () => {
    const html = render(<Title />, pseudoLocalize(EN));
    expect(html).not.toContain('Your cart');
    expect(findEnglishLeaks(html)).toEqual([]);
    expect(() => assertNoEnglishLeak(html)).not.toThrow();
  });

  it('a hard-coded English string is reported (the control that proves the scan fails)', () => {
    function Leaky(): JSX.Element {
      const t = useThemeStrings();
      return (
        <main>
          <h1>{t('cart.title')}</h1>
          <p>Hard-coded checkout copy</p>
        </main>
      );
    }
    const html = render(<Leaky />, pseudoLocalize(EN));
    expect(findEnglishLeaks(html)).toEqual(['Hard-coded checkout copy']);
    expect(() => assertNoEnglishLeak(html)).toThrow(/Hard-coded checkout copy/);
  });

  it('flags hard-coded user-visible attributes (aria-label, placeholder)', () => {
    const html = `<button aria-label="Close dialog">×</button><input placeholder="Search products" />`;
    expect(findEnglishLeaks(html)).toEqual(['Close dialog', 'Search products']);
    expect(findEnglishLeaks(html, { includeAttributes: false })).toEqual([]);
  });

  it('ignores numbers, symbols and pseudo-wrapped attributes', () => {
    const html = render(<Title />, pseudoLocalize(EN));
    expect(findEnglishLeaks(`<span>₦5,000</span><span>2 / 5</span>${html}`)).toEqual([]);
  });

  it('allowlists brand names and codes', () => {
    const html = `<footer><span>${pseudoLocalizeText('Powered by')}</span><span>Queek</span></footer>`;
    expect(findEnglishLeaks(html)).toEqual(['Queek']);
    expect(findEnglishLeaks(html, { allowlist: ['Queek'] })).toEqual([]);
    expect(findEnglishLeaks(html, { allowlist: [/^Q/] })).toEqual([]);
  });

  it('pseudo of the real English default keeps every key (renamed-key drift fails here)', () => {
    const pseudo = pseudoLocalize(EN);
    expect(Object.keys(pseudo).sort()).toEqual(Object.keys(EN).sort());
    // Spot values still resolve through t() — a changed English default that
    // was not rebuilt into pseudo expectations fails loudly, never silently.
    expect(t([pseudo], 'cart.title')).toBe(pseudoLocalizeText('Your cart'));
    expect(t([defaultThemeStrings], 'cart.title')).toBe('Your cart');
  });
});
