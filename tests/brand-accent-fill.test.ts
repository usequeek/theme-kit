import { describe, expect, it } from 'vitest';
import { expandDesignTokens, getBrandCssVariables } from '../utils/brand';

function contrast(a: string, b: string): number {
  const lum = (hex: string): number => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [Math.max(lum(a), lum(b)), Math.min(lum(a), lum(b))];
  return (hi + 0.05) / (lo + 0.05);
}

describe('button label on the accent fill', () => {
  it('keeps the white label on the default theme green and deepens only the fill to 4.5:1', () => {
    const vars = expandDesignTokens({ color: { accent: '#229879', on_accent: '#ffffff' } });

    expect(vars['--brand-button-text']).toBe('#ffffff');
    expect(vars['--brand-on-accent']).toBe('#ffffff');
    // The accent itself is the vendor's colour everywhere else.
    expect(vars['--brand-accent']).toBe('#229879');
    expect(vars['--brand-accent-fill']).not.toBe('#229879');
    expect(contrast(vars['--brand-accent-fill'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('deepens by the smallest step that reads, not a fixed one', () => {
    const vars = expandDesignTokens({ color: { accent: '#229879', on_accent: '#ffffff' } });
    const fill = vars['--brand-accent-fill'];
    const channel = (hex: string, i: number): number => parseInt(hex.slice(i, i + 2), 16);
    // One step lighter would have failed.
    const lighter = `#${[1, 3, 5].map((i) => Math.min(255, channel(fill, i) + 3).toString(16).padStart(2, '0')).join('')}`;
    expect(contrast(lighter, '#ffffff')).toBeLessThan(4.5);
  });

  it('leaves a pairing that already reads untouched: no fill is emitted', () => {
    const vars = expandDesignTokens({ color: { accent: '#111111', on_accent: '#ffffff' } });

    expect(vars['--brand-accent-fill']).toBeUndefined();
    expect(vars['--brand-button-text']).toBe('#ffffff');
  });

  it('leaves a theme-tuned dark label on a light accent untouched', () => {
    const vars = expandDesignTokens({ color: { accent: '#D9B97A', on_accent: '#1A1B18' } });

    expect(vars['--brand-accent-fill']).toBeUndefined();
    expect(vars['--brand-button-text']).toBe('#1A1B18');
  });

  it('flips a pale accent to a black label when deepening would change the colour too much', () => {
    const vars = expandDesignTokens({ color: { accent: '#ffe066', on_accent: '#ffffff' } });

    expect(vars['--brand-button-text']).toBe('#000000');
    expect(vars['--brand-accent-fill']).toBeUndefined();
    expect(vars['--brand-accent']).toBe('#ffe066');
  });

  it('keeps the old flip for a dark label that fails on a dark accent', () => {
    const vars = expandDesignTokens({ color: { accent: '#000000', on_accent: '#1A1B18' } });

    expect(vars['--brand-button-text']).toBe('#ffffff');
    expect(vars['--brand-accent-fill']).toBeUndefined();
  });

  it('stays within the 25% bound on a deepened fill', () => {
    const vars = expandDesignTokens({ color: { accent: '#229879', on_accent: '#ffffff' } });
    const fill = vars['--brand-accent-fill'];
    const drop = [1, 3, 5].map((i) => parseInt('229879'.slice(i - 1, i + 1), 16) - parseInt(fill.slice(i, i + 2), 16));

    expect(Math.max(...drop)).toBeLessThanOrEqual(Math.round(255 * 0.25));
    expect(Math.min(...drop)).toBeGreaterThanOrEqual(0);
  });

  it('keeps the plain accent fill under a label the merchant chose (config.colors.button_text)', () => {
    const config = { colors: { accent: '#229879', button_text: '#000000' } } as Parameters<typeof getBrandCssVariables>[1];
    const vars = getBrandCssVariables(null, config) as Record<string, string>;

    expect(vars['--brand-button-text']).toBe('#000000');
    expect(vars['--brand-accent']).toBe('#229879');
    expect(vars['--brand-accent-fill']).toBeUndefined();
  });

  it('still deepens under a derived label when the merchant set no button_text', () => {
    const config = { colors: { accent: '#229879' } } as Parameters<typeof getBrandCssVariables>[1];
    const vars = getBrandCssVariables(null, config) as Record<string, string>;

    expect(vars['--brand-accent-fill']).toBeDefined();
    expect(vars['--brand-button-text']).toBe('#ffffff');
  });

  it('keeps the button bg/text pair readable too: the primary under the white label is deepened, hover follows it', () => {
    const vars = expandDesignTokens({ color: { primary: '#229879', accent: '#229879', on_accent: '#ffffff' } });

    expect(vars['--brand-button-text']).toBe('#ffffff');
    expect(vars['--brand-button-bg']).not.toBe('#229879');
    expect(contrast(vars['--brand-button-bg'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(vars['--brand-primary']).toBe('#229879');
    expect(vars['--brand-button-hover-bg']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--brand-button-hover-bg']).not.toBe(vars['--brand-button-bg']);
  });

  it('leaves a primary that already reads untouched, and an explicit button_text keeps the plain primary', () => {
    const plain = expandDesignTokens({ color: { primary: '#111111', accent: '#111111', on_accent: '#ffffff' } });
    expect(plain['--brand-button-bg']).toBe('#111111');

    const config = { colors: { primary: '#229879', accent: '#229879', button_text: '#000000' } } as Parameters<typeof getBrandCssVariables>[1];
    const vars = getBrandCssVariables(null, config) as Record<string, string>;
    expect(vars['--brand-button-bg']).toBe('#229879');
    expect(vars['--brand-accent-fill']).toBeUndefined();
  });
});
