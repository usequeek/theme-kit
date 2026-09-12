import type { StorefrontConfig } from '../types/vendor';
import type { PlaceholderPalette } from './placeholder-resolver';

const FALLBACK: PlaceholderPalette = {
  from: '#e8e4df',
  to: '#c9c3ba',
  text: '#1a1a1a',
};

/**
 * Build a two-stop gradient palette from the current storefront config.
 *
 * Reads in this order of preference:
 *   config.colors.surface / config.colors.background / config.colors.text
 *   → config.brand.colors.surface / ... / .text
 *   → neutral fallback
 */
export function resolveBrandPalette(config?: StorefrontConfig | null): PlaceholderPalette {
  if (!config) return FALLBACK;

  const override = config.colors ?? {};
  const brand = config.brand?.colors;

  const from = override.surface ?? brand?.surface ?? override.background ?? brand?.background ?? FALLBACK.from;
  const to = override.background ?? brand?.background ?? override.surface ?? brand?.surface ?? FALLBACK.to;
  const text = override.text ?? brand?.text ?? FALLBACK.text;

  // If surface and background resolve to the same value, shift the gradient
  // stops slightly so it doesn't look flat.
  if (from === to) {
    return { from, to: shade(to, -0.08), text };
  }

  return { from, to, text };
}

/**
 * Apply a lightness delta to a hex color. Negative darkens, positive lightens.
 * Returns a hex string. Internal helper.
 */
function shade(hex: string, delta: number): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 3 && cleaned.length !== 6) return hex;

  const expanded =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);

  const adjust = (value: number): number => {
    const next = Math.round(value + 255 * delta);
    return Math.max(0, Math.min(255, next));
  };

  const hex2 = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${hex2(adjust(r))}${hex2(adjust(g))}${hex2(adjust(b))}`;
}
