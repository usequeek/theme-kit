/**
 * Smart placeholder resolver — generates theme-aware SVG data URIs
 * for empty image slots. Keeps vendor stores looking intentional, never broken.
 *
 * Purely visual. Text fallbacks for block content live in the block components.
 */

export type PlaceholderVariant = 'photo' | 'banner' | 'card' | 'square';

export interface PlaceholderPalette {
  from: string;
  to: string;
  text: string;
}

export interface PlaceholderContext {
  width: number;
  height: number;
  label?: string;
  sublabel?: string;
  palette?: PlaceholderPalette;
  font?: string;
  variant?: PlaceholderVariant;
}

const NEUTRAL_PALETTE: PlaceholderPalette = {
  from: '#e8e4df',
  to: '#c9c3ba',
  text: '#1a1a1a',
};

const MAX_LABEL_LENGTH = 40;
const MIN_LABEL_DIMENSION = 200;

/**
 * Escape a string for safe insertion inside an SVG text node.
 */
function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Truncate a label if it exceeds the max display length.
 */
function truncateLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_LABEL_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`;
}

/**
 * Compute relative luminance of a hex color (sRGB → linear → relative luminance).
 * Returns 0..1. Used to decide whether text should be white or black over a gradient.
 */
function relativeLuminance(hex: string): number {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 3 && cleaned.length !== 6) return 0.5;
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;

  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;

  const channel = (c: number): number => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Compute contrast ratio between two colors per WCAG 2.1.
 * Returns a number >= 1. 4.5 is the AA threshold for normal text.
 */
function contrastRatio(fg: string, bg: string): number {
  const fgLum = relativeLuminance(fg);
  const bgLum = relativeLuminance(bg);
  const brighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (brighter + 0.05) / (darker + 0.05);
}

/**
 * Pick a readable text color over a given gradient. Flips to black/white
 * when contrast is insufficient.
 */
function readableText(requestedText: string, gradientFrom: string, gradientTo: string): string {
  // Average the two gradient stops as the effective background luminance.
  const effectiveBg = relativeLuminance(gradientFrom) * 0.5 + relativeLuminance(gradientTo) * 0.5;

  // Contrast against the effective background midpoint.
  const midLum = effectiveBg;
  const requestedLum = relativeLuminance(requestedText);
  const ratio = (Math.max(midLum, requestedLum) + 0.05) / (Math.min(midLum, requestedLum) + 0.05);

  if (ratio >= 4.5) return requestedText;

  // Pick the color with the highest contrast against the midpoint.
  return midLum > 0.5 ? '#0a0a0a' : '#ffffff';
}

/**
 * Generate a theme-aware SVG placeholder and return it as a data URI.
 * Safe to embed inline as an <img src> — no network request, no cache concerns.
 */
export function resolvePlaceholder(ctx: PlaceholderContext): string {
  const width = Math.max(1, Math.round(ctx.width));
  const height = Math.max(1, Math.round(ctx.height));
  const palette = ctx.palette ?? NEUTRAL_PALETTE;
  const font = ctx.font ?? 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const textColor = readableText(palette.text, palette.from, palette.to);

  const minDim = Math.min(width, height);
  const showLabel = minDim >= MIN_LABEL_DIMENSION && !!ctx.label;
  const labelText = ctx.label ? escapeSvgText(truncateLabel(ctx.label)) : '';
  const sublabelText = ctx.sublabel && showLabel ? escapeSvgText(truncateLabel(ctx.sublabel)) : '';

  // Font size scales with the smaller dimension, capped sensibly.
  const fontSize = Math.round(Math.max(14, Math.min(minDim / 12, 48)));
  const sublabelSize = Math.round(fontSize * 0.55);

  // Gradient angle varies by variant for subtle visual difference.
  const variant = ctx.variant ?? 'photo';
  const gradientAngle =
    variant === 'banner' ? '90 0 0' : variant === 'card' ? '135 0 0' : variant === 'square' ? '45 0 0' : '120 0 0';

  // Subtle noise overlay — low opacity, decorative.
  const noiseId = `n${variant}${width}${height}`.replace(/[^a-z0-9]/gi, '');
  const gradientId = `g${noiseId}`;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push('<defs>');
  parts.push(
    `<linearGradient id="${gradientId}" gradientTransform="rotate(${gradientAngle})"><stop offset="0%" stop-color="${palette.from}"/><stop offset="100%" stop-color="${palette.to}"/></linearGradient>`,
  );
  parts.push(
    `<filter id="${noiseId}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0"/></filter>`,
  );
  parts.push('</defs>');
  parts.push(`<rect width="${width}" height="${height}" fill="url(#${gradientId})"/>`);
  parts.push(`<rect width="${width}" height="${height}" filter="url(#${noiseId})"/>`);

  if (showLabel) {
    const cx = width / 2;
    const cy = sublabelText ? height / 2 - sublabelSize / 2 : height / 2;
    parts.push(
      `<text x="${cx}" y="${cy}" font-family="${escapeSvgText(font)}" font-size="${fontSize}" font-weight="500" fill="${textColor}" text-anchor="middle" dominant-baseline="middle" letter-spacing="0.02em">${labelText}</text>`,
    );
    if (sublabelText) {
      parts.push(
        `<text x="${cx}" y="${cy + fontSize * 0.9}" font-family="${escapeSvgText(font)}" font-size="${sublabelSize}" font-weight="400" fill="${textColor}" fill-opacity="0.65" text-anchor="middle" dominant-baseline="middle">${sublabelText}</text>`,
      );
    }
  }

  parts.push('</svg>');

  const svg = parts.join('');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Exposed for tests. Not part of the public API.
 */
export const __internal = {
  escapeSvgText,
  truncateLabel,
  relativeLuminance,
  contrastRatio,
  readableText,
  NEUTRAL_PALETTE,
  MAX_LABEL_LENGTH,
  MIN_LABEL_DIMENSION,
};
