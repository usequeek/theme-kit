import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expandDesignTokens } from '../utils/brand';

const css = readFileSync(new URL('../apps/apps.css', import.meta.url), 'utf8');

function contrast(a: string, b: string): number {
  const lum = (hex: string): number => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [Math.max(lum(a), lum(b)), Math.min(lum(a), lum(b))];
  return (hi + 0.05) / (lo + 0.05);
}

/** The declarations of the last top-level rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const start = css.lastIndexOf(`\n${selector} {`);
  expect(start, `no rule for ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

/** Specificity as [classes, elements]: enough for the rules in this file (no ids, no pseudo-elements). */
function specificity(selector: string): [number, number] {
  const classes = (selector.match(/\.[\w-]+/g) ?? []).length + (selector.match(/:(?:hover|focus-visible|disabled|not)/g) ?? []).length;
  const elements = (selector.replace(/\.[\w-]+/g, '').match(/(?:^|[\s>+~])[a-z][a-z0-9]*/g) ?? []).length;
  return [classes, elements];
}

const THEME_BUTTON_RESET = '.theme-x button'; // [1 class, 1 element]: Beaurify's `.theme-beaurify button { color: inherit }`
const beats = (selector: string): boolean => {
  const [classes, elements] = specificity(selector);
  const [rc, re] = specificity(THEME_BUTTON_RESET);
  return classes > rc || (classes === rc && elements >= re);
};

describe('the label of a kit button survives a theme button reset, and reads on its fill', () => {
  it.each([
    ['.core-follow-card .core-follow-card__btn', '--brand-accent-fill', '--brand-on-accent'],
    ['.core-subscribe .core-subscribe__button', '--brand-button-bg', '--brand-on-primary'],
    ['.core-consent-banner .core-consent-banner__accept', '--brand-button-bg', '--brand-on-primary'],
  ])('%s: beats `.theme-x button`, and pairs %s with %s', (selector, fill, label) => {
    expect(beats(selector)).toBe(true);
    const block = rule(selector);
    expect(block).toContain(`background: var(${fill}`);
    expect(block).toContain(`color: var(${label}`);
  });

  it('the old one-class selectors are gone, so no reset can win again', () => {
    expect(css).not.toMatch(/\n\.core-follow-card__btn \{/);
    expect(css).not.toMatch(/\n\.core-subscribe__button \{/);
  });

  it.each([
    ['Beaurify crimson', '#c8164b', '#ffffff'],
    ['a pale yellow', '#f5d90a', '#ffffff'],
    ['the default green', '#229879', '#ffffff'],
    ['a dark ink', '#111111', '#ffffff'],
    ['a mid orange', '#e8731a', '#ffffff'],
  ])('the accent pair %s reads at 4.5:1 or more (fill --brand-accent-fill, else the accent, under --brand-on-accent)', (_name, accent, onAccent) => {
    const vars = expandDesignTokens({ color: { accent, on_accent: onAccent, primary: accent } });
    const fill = vars['--brand-accent-fill'] ?? vars['--brand-accent'];
    expect(contrast(fill, vars['--brand-on-accent'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars['--brand-button-bg'] ?? vars['--brand-primary'], vars['--brand-on-primary'])).toBeGreaterThanOrEqual(4.5);
  });

  // The label of a button on the PRIMARY is not the theme's on-accent (that is tuned for the accent): found on Glow (dark on dark, 1:1) and
  // Roast (black on brown, 2.2:1) when the kit buttons started reading the on-accent.
  it.each([
    ['Glow: light accent, dark on-accent, dark primary', { accent: '#d8c3a5', on_accent: '#1a1b18', primary: '#1a1b18' }, '#1a1b18'],
    ['Roast: black on-accent, brown primary', { accent: '#c9a36b', on_accent: '#000000', primary: '#643a1d' }, '#643a1d'],
    ['a pale primary under a white on-accent', { accent: '#229879', on_accent: '#ffffff', primary: '#f5d90a' }, '#f5d90a'],
    ['Beaurify crimson', { accent: '#c8164b', on_accent: '#ffffff', primary: '#c8164b' }, '#c8164b'],
  ])('%s: the primary button label reads at 4.5:1', (_name, palette, primary) => {
    const vars = expandDesignTokens({ color: palette });
    expect(contrast(vars['--brand-button-bg'] ?? vars['--brand-primary'], vars['--brand-on-primary'])).toBeGreaterThanOrEqual(4.5);
    expect(vars['--brand-primary']).toBe(primary);
  });

  it('keeps the theme\'s own on-accent when it already reads on the primary, and a merchant\'s explicit label always', () => {
    expect(expandDesignTokens({ color: { accent: '#c8164b', on_accent: '#ffffff', primary: '#c8164b' } })['--brand-on-primary']).toBe('#ffffff');
    expect(expandDesignTokens({ color: { accent: '#f5b0c8', on_accent: '#111111', primary: '#c8164b' } }, { explicitLabel: true })['--brand-on-primary']).toBe('#111111');
  });
});

describe('the cookie banner buttons on a phone', () => {
  it('stack full width in one column in markup order, with every label on one line', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 600px) {\n  .core-consent-banner {'));
    const block = phone.slice(0, phone.indexOf('/* ── Unsubscribe page'));
    expect(block).toMatch(/\.core-consent-banner__actions \{[^}]*flex-direction: column;/);
    expect(block).toMatch(/\.core-consent-banner \.core-consent-banner__accept \{[^}]*width: 100%/);
    expect(block).toMatch(/\.core-consent-banner \.core-consent-banner__decline,[^{]*\{[^}]*width: 100%/);
  });
});

describe('another prompt open', () => {
  it('hides the floating follow and subscribe cards under [data-overlay-held], and leaves the "Following" chip alone', () => {
    const block = rule('[data-overlay-held] .core-subscribe-floating');
    expect(block).toContain('display: none');
    expect(css).toContain('[data-overlay-held] .core-follow-card--floating:not(.core-follow-card--compact),');
  });
});
