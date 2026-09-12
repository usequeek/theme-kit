import type { CSSProperties } from 'react';
import type {
  Brand,
  DesignBorderWeight,
  DesignDensity,
  DesignElevation,
  DesignHeadingCase,
  DesignImageFilter,
  DesignImageRadius,
  DesignMotion,
  DesignRadius,
  DesignTokenColor,
  DesignTokenImage,
  DesignTokenShape,
  DesignTokenSpace,
  DesignTokenType,
  DesignTokens,
  StorefrontConfig,
} from '../types/vendor';

/**
 * Storefront design-token injector — turns the resolved semantic `tokens`
 * object (design-token-contract.md, queek_backend `.agent/.tmp/`) into the
 * full CSS custom-property set every theme reads. Replaces the old
 * `getBrandCssVariables`, which only ever emitted ~12 of the 24 color roles
 * (the bug this fixes).
 *
 * `expandDesignTokens` is the pure, unit-tested core: given ANY partial (or
 * absent) token object it fills every gap with a sane default and always
 * emits every var — it can never crash and never omit a role.
 *
 * `getBrandCssVariables` is the compatible entry point still called from
 * `provider.tsx`. It resolves the effective tokens (new `config.tokens` ←
 * legacy `config.colors` / `brand.colors` / `brand.font` ← defaults) and
 * hands them to `expandDesignTokens`, then layers on the handful of
 * chrome vars (`--brand-footer-*`, explicit legacy button overrides) that
 * live outside the token contract so existing stores render identically.
 */

const DEFAULT_COLOR: Required<DesignTokenColor> = {
  scheme: 'light',
  bg: '#ffffff',
  surface: '#f9f9f9',
  surface_muted: '#f2f2f2',
  text: '#111111',
  text_muted: '#6b7280',
  primary: '#111111',
  accent: '#111111',
  on_accent: '#ffffff',
  border: '#e5e5e5',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
};

const DEFAULT_TYPE: Required<DesignTokenType> = {
  heading_font: 'Georgia',
  body_font: 'Helvetica Neue',
  scale_ratio: 1.25,
  heading_weight: 600,
  body_weight: 400,
  heading_case: 'none',
  heading_tracking: 0,
  body_tracking: 0,
};

const DEFAULT_SPACE: Required<DesignTokenSpace> = { density: 'cozy' };
const DEFAULT_SHAPE: Required<DesignTokenShape> = { radius: 'soft', border_weight: 'hairline' };
const DEFAULT_ELEVATION: DesignElevation = 'subtle';
const DEFAULT_MOTION: DesignMotion = 'subtle';
const DEFAULT_IMAGE: Required<DesignTokenImage> = { radius: 'soft', fit: 'cover', filter: 'none' };

const DENSITY_UNIT_REM: Record<DesignDensity, number> = {
  compact: 0.8,
  cozy: 1,
  comfortable: 1.25,
};

/** Fixed multiplier ladder for --space-1..--space-8, scaled by the density unit. */
const SPACE_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

const RADIUS_SCALE: Record<DesignRadius, { sm: string; md: string; lg: string }> = {
  sharp: { sm: '0px', md: '0px', lg: '0px' },
  soft: { sm: '6px', md: '10px', lg: '16px' },
  rounded: { sm: '12px', md: '20px', lg: '28px' },
  pill: { sm: '9999px', md: '9999px', lg: '9999px' },
};

const BORDER_WEIGHT_PX: Record<DesignBorderWeight, string> = {
  hairline: '1px',
  medium: '2px',
  bold: '3px',
};

const ELEVATION_SHADOWS: Record<DesignElevation, [string, string, string]> = {
  flat: ['none', 'none', 'none'],
  subtle: [
    '0 1px 2px rgba(15, 15, 15, 0.06)',
    '0 4px 10px rgba(15, 15, 15, 0.08)',
    '0 10px 24px rgba(15, 15, 15, 0.10)',
  ],
  lifted: [
    '0 2px 6px rgba(15, 15, 15, 0.10)',
    '0 8px 20px rgba(15, 15, 15, 0.14)',
    '0 20px 40px rgba(15, 15, 15, 0.18)',
  ],
};

const MOTION_TIMING: Record<DesignMotion, { fast: string; base: string; slow: string; ease: string }> = {
  none: { fast: '0ms', base: '0ms', slow: '0ms', ease: 'linear' },
  subtle: { fast: '150ms', base: '250ms', slow: '400ms', ease: 'ease' },
  lively: { fast: '100ms', base: '180ms', slow: '280ms', ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
};

const CASE_MAP: Record<DesignHeadingCase, string> = {
  none: 'none',
  upper: 'uppercase',
  'small-caps': 'small-caps',
};

/**
 * Deliberately its OWN fixed scale, not a reference into RADIUS_SCALE/
 * shape.radius. Live-caught (15/8/26): when `--image-radius` pointed at
 * `var(--radius-sm/md/lg)`, a vendor on the (very common) 'sharp' global
 * Shape preset saw EVERY image-radius choice — sharp, soft, AND rounded —
 * collapse to the same 0px, since 'sharp' flattens the whole sm/md/lg
 * ladder to zero. A vendor's image-radius pick must always visibly do
 * something, independent of their unrelated global Shape choice.
 */
const IMAGE_RADIUS_MAP: Record<DesignImageRadius, string> = {
  sharp: '0px',
  soft: '10px',
  rounded: '20px',
};

const IMAGE_FILTER_MAP: Record<DesignImageFilter, string> = {
  none: 'none',
  mono: 'grayscale(1)',
  warm: 'sepia(0.35) saturate(1.1) contrast(0.98)',
};

/** n exponents for the --fs-xs..--fs-3xl ladder, base*ratio^n. */
const FONT_SIZE_STEPS: Array<[string, number]> = [
  ['xs', -2],
  ['sm', -1],
  ['base', 0],
  ['lg', 1],
  ['xl', 2],
  ['2xl', 3],
  ['3xl', 4],
];

const FONT_SIZE_BASE_PX = 16;

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace('#', '');
  if (cleaned.length !== 3 && cleaned.length !== 6) return null;

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

  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return [r, g, b];
}

/** Darken (positive `amount`) or lighten (negative) a hex color by `amount` (0..1). Returns the input unchanged if unparsable. */
function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
  const toHex = (value: number): string => clamp(value).toString(16).padStart(2, '0');

  const [r, g, b] = rgb;
  const delta = 255 * amount;
  return `#${toHex(r - delta)}${toHex(g - delta)}${toHex(b - delta)}`;
}

/** Low-alpha tint of a hex color, e.g. for --brand-accent-soft. Returns the input unchanged if unparsable. */
function tint(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG relative luminance (0=black..1=white). Returns null if unparsable. */
function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1..21) between two hex colors. Returns null if either is unparsable. */
function contrastRatio(hexA: string, hexB: string): number | null {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  if (lumA === null || lumB === null) return null;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA body-text minimum. Below this, `accent`/`on_accent` reads as
 *  the same color rather than text-on-a-surface (the Taylor/glow incident:
 *  a vendor's legacy `colors.accent` override went to near-black while
 *  `on_accent` silently kept the theme's own default — also near-black,
 *  since it was tuned to pair with THAT theme's accent, not the vendor's). */
const MIN_ON_ACCENT_CONTRAST = 4.5;

/** Whichever of pure black/white reads better on `hex` — the standard
 *  "pick a readable label color" fallback used when a real design system
 *  value isn't available. */
function pickReadableTextColor(hex: string): string {
  const onBlack = contrastRatio(hex, '#000000') ?? 0;
  const onWhite = contrastRatio(hex, '#ffffff') ?? 0;
  return onWhite >= onBlack ? '#ffffff' : '#000000';
}

/**
 * Guards against `on_accent` silently pairing with an `accent` it was never
 * designed for. `accent` and `on_accent` are independent fields (see
 * `emitColorVars`) that can arrive from different layers of the merge in
 * `resolveEffectiveTokens` — a vendor's legacy `config.colors.accent`
 * override, for instance, has no `on_accent` counterpart in that legacy
 * shape at all, so `on_accent` falls through to the THEME's own default,
 * tuned for the theme's own accent color, not the vendor's. Only corrects
 * when the pairing actually fails contrast; a theme's own (already-tuned)
 * accent/on_accent pair is never touched. */
function ensureReadableOnAccent(color: DesignTokenColor & { accent: string; on_accent: string }): void {
  const ratio = contrastRatio(color.accent, color.on_accent);
  if (ratio !== null && ratio < MIN_ON_ACCENT_CONTRAST) {
    color.on_accent = pickReadableTextColor(color.accent);
  }
}

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

function rem(value: number): string {
  return `${Math.round(value * 1000) / 1000}rem`;
}

/**
 * Per-dimension emitters — the single source of truth for each enum→CSS-value
 * lookup. Each emitter only writes the vars derived from the keys actually
 * present (`!== undefined`) on the object it's given, so the SAME function
 * powers both:
 *  - `expandDesignTokens` (called with a group merged over its `DEFAULT_*`
 *    constant, so every key is always present → every var always emitted,
 *    identical to the pre-refactor behavior), and
 *  - `expandDesignTokensPartial` (called with the raw partial group, so only
 *    explicitly-set keys emit vars, nothing is filled from defaults).
 * A few vars are constants unrelated to any input key (`--leading-*`,
 * `--radius-pill`) — those stay inline in `expandDesignTokens` only, since a
 * partial override has nothing to derive them from.
 */
function emitColorVars(color: DesignTokenColor, vars: Record<string, string>): void {
  if (color.bg !== undefined) vars['--brand-bg'] = color.bg;
  if (color.surface !== undefined) vars['--brand-surface'] = color.surface;
  if (color.surface_muted !== undefined) vars['--brand-surface-muted'] = color.surface_muted;
  if (color.text !== undefined) vars['--brand-text'] = color.text;
  if (color.text_muted !== undefined) vars['--brand-text-muted'] = color.text_muted;
  if (color.primary !== undefined) {
    vars['--brand-primary'] = color.primary;
    vars['--brand-button-bg'] = color.primary;
    vars['--brand-button-hover-bg'] = shade(color.primary, 0.08);
  }
  if (color.accent !== undefined) {
    vars['--brand-accent'] = color.accent;
    vars['--brand-accent-soft'] = tint(color.accent, 0.12);
  }
  if (color.on_accent !== undefined) {
    vars['--brand-on-accent'] = color.on_accent;
    vars['--brand-button-text'] = color.on_accent;
  }
  if (color.border !== undefined) vars['--brand-border'] = color.border;
  if (color.success !== undefined) vars['--brand-success'] = color.success;
  if (color.warning !== undefined) vars['--brand-warning'] = color.warning;
  if (color.danger !== undefined) vars['--brand-danger'] = color.danger;
}

function emitTypeVars(type: DesignTokenType, vars: Record<string, string>): void {
  if (type.heading_font !== undefined) vars['--font-heading'] = type.heading_font;
  if (type.body_font !== undefined) vars['--font-body'] = type.body_font;
  if (type.scale_ratio !== undefined) {
    for (const [name, n] of FONT_SIZE_STEPS) {
      vars[`--fs-${name}`] = px(FONT_SIZE_BASE_PX * (type.scale_ratio as number) ** n);
    }
  }
  if (type.heading_weight !== undefined) vars['--fw-heading'] = String(type.heading_weight);
  if (type.body_weight !== undefined) vars['--fw-body'] = String(type.body_weight);
  if (type.heading_case !== undefined) vars['--case-heading'] = CASE_MAP[type.heading_case];
  if (type.heading_tracking !== undefined) vars['--tracking-heading'] = `${type.heading_tracking}em`;
  if (type.body_tracking !== undefined) vars['--tracking-body'] = `${type.body_tracking}em`;
}

function emitSpaceVars(space: DesignTokenSpace, vars: Record<string, string>): void {
  if (space.density === undefined) return;
  const unit = DENSITY_UNIT_REM[space.density];
  vars['--space-unit'] = rem(unit);
  SPACE_STEPS.forEach((multiplier, index) => {
    vars[`--space-${index + 1}`] = rem(unit * multiplier);
  });
}

function emitShapeVars(shape: DesignTokenShape, vars: Record<string, string>): void {
  if (shape.radius !== undefined) {
    const radiusScale = RADIUS_SCALE[shape.radius];
    vars['--radius-sm'] = radiusScale.sm;
    vars['--radius-md'] = radiusScale.md;
    vars['--radius-lg'] = radiusScale.lg;
  }
  if (shape.border_weight !== undefined) vars['--border-weight'] = BORDER_WEIGHT_PX[shape.border_weight];
}

function emitElevationVars(elevation: DesignElevation, vars: Record<string, string>): void {
  const [shadow1, shadow2, shadow3] = ELEVATION_SHADOWS[elevation];
  vars['--shadow-1'] = shadow1;
  vars['--shadow-2'] = shadow2;
  vars['--shadow-3'] = shadow3;
}

function emitMotionVars(motion: DesignMotion, vars: Record<string, string>): void {
  const timing = MOTION_TIMING[motion];
  vars['--duration-fast'] = timing.fast;
  vars['--duration-base'] = timing.base;
  vars['--duration-slow'] = timing.slow;
  vars['--ease'] = timing.ease;
}

/**
 * `includeRadius` defaults to true (section-scoped partial callers want it).
 * The GLOBAL expander (`expandDesignTokens`) explicitly passes `false`: emitting
 * `--image-radius` on the root/brand wrapper would flatten every themed image
 * to one radius site-wide, since a `var(--image-radius, <per-element-default>)`
 * fallback is only ever used when the property is unset ANYWHERE in the
 * cascade — once a root value exists, it wins for every descendant and the
 * element's own bespoke fallback (small pill thumb vs. full-bleed hero, etc.)
 * never applies. `--image-fit`/`--image-filter` have no such per-element
 * variance in this theme, so they stay uniform/global by design.
 */
function emitImageVars(
  image: DesignTokenImage,
  vars: Record<string, string>,
  { includeRadius = true }: { includeRadius?: boolean } = {},
): void {
  if (includeRadius && image.radius !== undefined) vars['--image-radius'] = IMAGE_RADIUS_MAP[image.radius];
  if (image.fit !== undefined) vars['--image-fit'] = image.fit;
  if (image.filter !== undefined) vars['--image-filter'] = IMAGE_FILTER_MAP[image.filter];
}

/**
 * Pure expander: resolved (possibly partial/absent) semantic tokens →
 * the full CSS custom-property set every theme reads. Every group is
 * merged over its defaults independently, so a token object missing
 * entire groups (or being `null`/`undefined` altogether) still produces
 * every var with a sane value — never throws, never omits a role.
 */
export function expandDesignTokens(tokens?: DesignTokens | null): Record<string, string> {
  const color = { ...DEFAULT_COLOR, ...tokens?.color };
  ensureReadableOnAccent(color);
  const type = { ...DEFAULT_TYPE, ...tokens?.type };
  const space = { ...DEFAULT_SPACE, ...tokens?.space };
  const shape = { ...DEFAULT_SHAPE, ...tokens?.shape };
  const elevation = tokens?.elevation ?? DEFAULT_ELEVATION;
  const motion = tokens?.motion ?? DEFAULT_MOTION;
  const image = { ...DEFAULT_IMAGE, ...tokens?.image };

  const vars: Record<string, string> = {};

  // COLOR — every role, fixing the missing-12 bug.
  emitColorVars(color, vars);

  // TYPE
  emitTypeVars(type, vars);
  vars['--leading-heading'] = '1.15';
  vars['--leading-body'] = '1.5';

  // SPACE
  emitSpaceVars(space, vars);

  // SHAPE
  emitShapeVars(shape, vars);
  vars['--radius-pill'] = '9999px';

  // ELEVATION
  emitElevationVars(elevation, vars);

  // MOTION
  emitMotionVars(motion, vars);

  // IMAGE — fit/filter only; radius is intentionally per-section-only (see
  // emitImageVars doc comment) so it never flattens every image site-wide.
  emitImageVars(image, vars, { includeRadius: false });

  return vars;
}

/**
 * Section-scoped partial expander: given ONLY the keys a single page section
 * overrides (e.g. `{ image: { radius: 'rounded' } }`), returns ONLY the
 * `--var` entries derived from those keys — no defaults are filled in for
 * anything else. Meant to be applied on a small wrapper around one section so
 * unset vars fall through the CSS cascade to the global `--var` map injected
 * by `getBrandCssVariables` on the brand-root wrapper (`provider.tsx`).
 *
 * Reuses the exact same `emit*Vars` enum→value lookups as `expandDesignTokens`
 * — no duplicated maps/switches.
 */
export function expandDesignTokensPartial(partial?: Partial<DesignTokens> | null): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!partial) return vars;

  if (partial.color) emitColorVars(partial.color, vars);
  if (partial.type) emitTypeVars(partial.type, vars);
  if (partial.space) emitSpaceVars(partial.space, vars);
  if (partial.shape) emitShapeVars(partial.shape, vars);
  if (partial.elevation !== undefined) emitElevationVars(partial.elevation, vars);
  if (partial.motion !== undefined) emitMotionVars(partial.motion, vars);
  if (partial.image) emitImageVars(partial.image, vars);

  return vars;
}

/**
 * Back-compat bridge: maps the LEGACY `config.colors` / `brand.colors` /
 * `brand.font` (or `config.typography`) fields — the only source for the
 * ~100s of live stores with no `tokens` yet — onto the semantic token
 * shape so `expandDesignTokens` can fill the rest from its own defaults.
 * Only the groups legacy data can actually populate (color, type) are
 * returned; space/shape/elevation/motion/image always fall through to
 * the token defaults, matching current (untokenized) rendering.
 */
function legacyTokensFromConfig(brand?: Brand | null, config?: StorefrontConfig | null): DesignTokens {
  const overrides = config?.colors;
  const brandColors = brand?.colors;
  const pickColor = (key: keyof NonNullable<typeof brandColors>): string | undefined =>
    (overrides?.[key] as string | undefined) ?? brandColors?.[key];

  const color: DesignTokenColor | undefined =
    overrides || brandColors
      ? {
          bg: pickColor('background'),
          surface: pickColor('surface'),
          text: pickColor('text'),
          text_muted: pickColor('text_muted'),
          primary: pickColor('primary'),
          accent: pickColor('accent'),
          border: pickColor('border'),
        }
      : undefined;

  const headingFont = config?.typography?.heading ?? brand?.font?.heading;
  const bodyFont = config?.typography?.body ?? brand?.font?.body;
  const type: DesignTokenType | undefined =
    headingFont || bodyFont ? { heading_font: headingFont, body_font: bodyFont } : undefined;

  return { color, type };
}

/**
 * Resolution order per the contract: `config.tokens` (per-group) ←
 * legacy fields ← (handled by `expandDesignTokens`'s own defaults).
 */
function resolveEffectiveTokens(brand?: Brand | null, config?: StorefrontConfig | null): DesignTokens {
  const legacy = legacyTokensFromConfig(brand, config);
  const tokens = config?.tokens;

  if (!tokens) return legacy;

  return {
    color: { ...legacy.color, ...tokens.color },
    type: { ...legacy.type, ...tokens.type },
    space: tokens.space ?? legacy.space,
    shape: { ...legacy.shape, ...tokens.shape },
    elevation: tokens.elevation ?? legacy.elevation,
    motion: tokens.motion ?? legacy.motion,
    image: { ...legacy.image, ...tokens.image },
  };
}

/**
 * Resolve brand CSS variables for the `provider.tsx` wrapper. Emits the
 * full token-derived var set (see `expandDesignTokens`), then layers on
 * the legacy chrome/override vars that sit outside the token contract:
 * footer colors and an explicit `config.colors.button(_text)` override
 * (pre-tokens stores could set a button color independent of `primary`).
 */
export function getBrandCssVariables(
  brand?: Brand | null,
  config?: StorefrontConfig | null,
): CSSProperties {
  const tokens = resolveEffectiveTokens(brand, config);
  const vars = expandDesignTokens(tokens);

  if (config?.footer?.bg) vars['--brand-footer-bg'] = config.footer.bg;
  if (config?.footer?.text) vars['--brand-footer-text'] = config.footer.text;
  if (config?.footer?.muted) vars['--brand-footer-muted'] = config.footer.muted;
  if (config?.colors?.button) vars['--brand-button-bg'] = config.colors.button;
  if (config?.colors?.button_text) vars['--brand-button-text'] = config.colors.button_text;

  return vars as CSSProperties;
}
