import type { Menu } from './menu';
import type { ImageVariants } from './media';

export interface BrandFont {
  heading: string;
  body: string;
}

/**
 * Semantic design-token shapes — the FROZEN contract
 * (`.agent/.tmp/design-token-contract.md` in queek_backend). Backend resolves
 * theme defaults ← legacy vendor fields ← vendor `tokens` overrides and
 * returns this object under `StorefrontConfig.tokens`. Every field is
 * optional: during the transition many vendors have no `tokens` at all, and
 * the storefront injector (`lib/core/utils/brand.ts`) fills every gap with a
 * sane default so it can never crash or omit a CSS var.
 */
export type DesignColorScheme = 'light' | 'dark';
export type DesignScaleRatio = 1.125 | 1.2 | 1.25 | 1.333;
export type DesignHeadingCase = 'none' | 'upper' | 'small-caps';
export type DesignDensity = 'compact' | 'cozy' | 'comfortable';
export type DesignRadius = 'sharp' | 'soft' | 'rounded' | 'pill';
export type DesignBorderWeight = 'hairline' | 'medium' | 'bold';
export type DesignElevation = 'flat' | 'subtle' | 'lifted';
export type DesignMotion = 'none' | 'subtle' | 'lively';
export type DesignImageRadius = 'sharp' | 'soft' | 'rounded';
export type DesignImageFit = 'cover' | 'contain';
export type DesignImageFilter = 'none' | 'mono' | 'warm';

export interface DesignTokenColor {
  scheme?: DesignColorScheme;
  bg?: string;
  surface?: string;
  surface_muted?: string;
  text?: string;
  text_muted?: string;
  primary?: string;
  accent?: string;
  on_accent?: string;
  border?: string;
  success?: string;
  warning?: string;
  danger?: string;
}

export interface DesignTokenType {
  heading_font?: string;
  body_font?: string;
  scale_ratio?: DesignScaleRatio;
  heading_weight?: number;
  body_weight?: number;
  heading_case?: DesignHeadingCase;
  heading_tracking?: number;
  body_tracking?: number;
}

export interface DesignTokenSpace {
  density?: DesignDensity;
}

export interface DesignTokenShape {
  radius?: DesignRadius;
  border_weight?: DesignBorderWeight;
}

export interface DesignTokenImage {
  radius?: DesignImageRadius;
  fit?: DesignImageFit;
  filter?: DesignImageFilter;
}

export interface DesignTokens {
  color?: DesignTokenColor;
  type?: DesignTokenType;
  space?: DesignTokenSpace;
  shape?: DesignTokenShape;
  elevation?: DesignElevation;
  motion?: DesignMotion;
  image?: DesignTokenImage;
}

/**
 * One of the 7 top-level design-token dimensions.
 */
export type DesignTokenAxis = keyof DesignTokens;

/**
 * A single stylable LEAF inside those 7 dimensions. `ThemeManifestVariant.editable`
 * lists exactly which of these a variant's rendered markup/CSS actually consumes —
 * not just the parent dimension as a whole. A dimension with multiple UI sub-controls
 * (shape → radius + border_weight; image → radius + fit + filter; color → primary +
 * accent) can be live on ONE sub-control while hardcoded on another — e.g. a
 * variant's `<img>` genuinely reads `--image-fit`/`--image-filter` while its
 * container's radius is a hardcoded literal, or a button's border reads
 * `--border-weight` while its radius doesn't. Declaring only the dimension name
 * (e.g. `'shape'`) would show a dead sub-dial next to a live one — this is the
 * exact 2026-08-03 gap found in Allure's products/carousel section (Image radius
 * and Corner radius dead, Image fit/filter and Border weight live, all under the
 * same 'shape'/'image' bundle). `type`/`elevation`/`motion` have no UI sub-controls
 * today, so they stay bare (no `.field` suffix) — add one here the day a sub-dial
 * is added for them.
 */
export type DesignTokenAxisPath =
  | 'color.primary'
  | 'color.accent'
  | 'type'
  | 'space.density'
  | 'shape.radius'
  | 'shape.border_weight'
  | 'elevation'
  | 'motion'
  | 'image.radius'
  | 'image.fit'
  | 'image.filter';

export interface BrandPalette {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  text_muted: string;
  border: string;
}

export interface Brand {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  font_key?: string;
  font?: BrandFont;
  colors: BrandPalette;
}

export interface VendorProfile {
  id: string;
  slug: string | null;
  name: string | null;
  logo: string | null;
  banner?: string | null;
  /** VendorResource:126-127. Sits beside the unchanged raw `logo`/`banner`
   *  urls; null when the file has no Media row (common on older vendors). */
  logo_variants?: ImageVariants | null;
  banner_variants?: ImageVariants | null;
  tagline?: string | null;
  address?: string | null;
  delivery_time?: string | null;
  currency?: string | null;
  rating_value?: number;
  rating_count?: number;
  rating_label?: string | null;
}

export interface StorefrontConfig {
  theme: string;
  brand: Brand;
  available_brands?: Array<{ id: string; name: string }>;
  header?: {
    variant?: string;
    logo_url?: string | null;
    announcement?: {
      enabled: boolean;
      text: string;
      link?: string | null;
    } | null;
    show_search?: boolean;
    show_cart?: boolean;
    show_account?: boolean;
    show_offers?: boolean;
  };
  footer?: {
    variant?: string;
    heading?: string | null;
    tagline?: string | null;
    columns?: Array<{ heading: string; content: string }>;
    socials?: Record<string, string>;
    copyright?: string | null;
    bg?: string | null;
    text?: string | null;
    muted?: string | null;
  };
  colors?: Partial<BrandPalette> & { button?: string; button_text?: string };
  typography?: {
    font?: string;
    heading?: string;
    body?: string;
  };
  /** Resolved semantic design tokens (see design-token-contract.md). Absent for stores not yet migrated. */
  tokens?: DesignTokens | null;
  menus?: {
    header?: Menu;
    footer?: Menu;
  };
  default_variants?: Record<string, string>;
  pages?: Record<string, {
    banner?: string;
    title?: string;
    subtitle?: string;
    /** QR-only header overrides, each falling back to the vendor's own
     * profile field when unset (see QrHeader). `phones` has NO vendor
     * fallback — the vendor's own support_phone is deliberately masked in
     * the public API (Customer\VendorResource — anti-scraping/privacy), so
     * a phone only ever shows on the QR page if explicitly published here. */
    address?: string;
    slogan?: string;
    phones?: string[];
    /** QR page footer (only emitted for `pages.qr` when in-store ordering is on). */
    footer?: {
      enabled?: boolean;
      text?: string;
      show_socials?: boolean;
    };
    /** QR product-row layout (only emitted for `pages.qr`). Defaults to 'row'. */
    listing_style?: 'row' | 'stacked';
    /** Darkening scrim over the QR home page's collection/category card
     * images (only emitted for `pages.qr`). Defaults to 'medium' — bright
     * vendor photos otherwise swallow the white card label. */
    tile_overlay?: 'none' | 'light' | 'medium' | 'strong';
    seo?: {
      title?: string;
      description?: string;
      og_image?: string;
      keywords?: string[];
      canonical_url?: string;
      noindex?: boolean;
    };
  }>;
  apps?: {
    whatsapp_chat?: { enabled?: boolean; number?: string; message?: string; position?: string; bottom_offset?: number };
    analytics?: { enabled?: boolean; ga_id?: string };
    follow_card?: { enabled?: boolean; display?: 'floating' | 'footer' | 'block'; position?: string };
    subscribe?: {
      enabled?: boolean;
      variant?: string;
      heading?: string;
      tagline?: string;
      cta?: string;
      /** `modal` variant only — when it should pop up. Backend field pending; defaults to 'scroll' when unset. */
      trigger?: 'immediate' | 'delay' | 'scroll';
    };
  };
  followers_count?: number;
}
