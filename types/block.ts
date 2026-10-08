import type { DesignTokens } from './vendor';
import type { MetaobjectEntry, Product } from './product';

export type BlockType =
  | 'content'
  | 'image'
  | 'gallery'
  | 'video'
  | 'table'
  | 'button'
  | 'embed'
  | 'divider'
  | 'callout'
  | 'quote'
  | 'products'
  | 'categories'
  | 'contact'
  | 'reviews'
  | 'faq'
  | 'product_qa'
  | 'blog'
  | 'metaobjects';

export interface ContentBlockData {
  markdown: string;
  /** Marquee variant: explicit items list set in admin (preferred over markdown). */
  items?: string[];
  /** Optional per-block background colour (e.g. marquee, promo). */
  bg_color?: string;
  /** Optional per-block text colour. */
  text_color?: string;
}

export interface ImageBlockData {
  url: string;
  alt?: string | null;
  caption?: string | null;
}

export interface GalleryBlockData {
  /** Optional section copy (e.g. for the social-feed / insta-gallery variant). */
  heading?: string | null;
  description?: string | null;
  /** Block-level (not per-slide) hero display controls — currently only
   *  some themes' 'slider'/'thumb-rail' variants read these; harmless no-op
   *  elsewhere. */
  zoom_effect?: boolean | null;
  overlay?: 'none' | 'light' | 'medium' | 'strong' | null;
  content_position?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'center' | null;
  images: Array<{
    url: string;
    alt?: string | null;
    caption?: string | null;
    title?: string | null;
    subtitle?: string | null;
    link?: string | null;
    cta_label?: string | null;
    cta_url?: string | null;
    /** Product ids featured in this image — lets a theme's social/UGC gallery
     * variant open a shoppable modal on click instead of just linking out. */
    product_ids?: string[] | null;
    /** YouTube/Vimeo/direct file URL — takes over from `url` as the slide's
     * media when set, with `url` still used as the poster/fallback. Only
     * takes effect on themes/variants that render a single full-bleed slide
     * (e.g. a `slider`/`thumb-rail` variant with exactly 1 image) — a
     * multi-slide carousel would autoplay every slide's video concurrently
     * since inactive slides stay mounted, not unmounted. */
    video?: string | null;
  }>;
}

export interface VideoBlockData {
  url: string;
}

export interface TableBlockData {
  headers: string[];
  rows: string[][];
}

export interface ButtonBlockData {
  text: string;
  url: string;
  bg_color?: string;
  text_color?: string;
}

export interface EmbedBlockData {
  url: string;
  provider?: string | null;
}

export interface DividerBlockData {
  style?: 'line' | 'space';
}

export type CalloutTone = 'info' | 'warn' | 'success' | 'note';

export interface CalloutBlockData {
  markdown: string;
  tone?: CalloutTone;
  title?: string | null;
}

export interface QuoteBlockData {
  /** The quote body — plain text or short markdown. */
  markdown?: string;
  /** Legacy/alternate field name for the quote text. */
  text?: string;
  /** Attribution line (author, source). */
  cite?: string | null;
}

export interface ProductsBlockData {
  collection?: string | null;
  ids?: string[];
  sort?: 'latest' | 'popular' | 'price_low' | 'price_high';
  limit?: number;
  title?: string | null;
  /** Single-product spotlight only — merchant-authored supporting copy, never product facts. */
  description?: string | null;
  /** Single-product spotlight only — label for the derived product route. */
  cta_label?: string | null;
  /**
   * Single-product spotlight only — where the product image sits relative to
   * the copy. 'left'/'right' set them side-by-side (mirrored), 'top' stacks a
   * full-width image above centred copy. Same vocabulary as content/brand-story
   * so a repeated spotlight can alternate instead of rendering three identical
   * rows. Layout only — it never re-authors a derived product fact.
   */
  align?: 'left' | 'right' | 'top';
  layout?: 'grid' | 'carousel' | 'list' | 'featured';
  /** 'featured' variant only. Default true — hides the product excerpt/description. */
  show_description?: boolean;
  /** 'featured' variant only. Default 'top' — vertical alignment of the gallery/info columns. */
  content_align?: 'top' | 'center' | 'bottom';
}

export interface CategoriesBlockData {
  parent?: string | null;
  ids?: string[];
  limit?: number;
  title?: string | null;
  layout?: 'grid' | 'carousel';
}

export interface ContactSocialLink {
  label: string;
  url: string;
}

export interface ContactBlockData {
  heading?: string;
  info_heading?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  hours?: string;
  socials?: ContactSocialLink[];
  cta_label?: string;
  cta_url?: string;
  map_embed_url?: string;
  map_lat?: number | string | null;
  map_lng?: number | string | null;
}

export interface ReviewMediaItem {
  type: 'image' | 'video';
  url: string;
}

export interface ReviewItem {
  id: string;
  rating: number;
  title?: string | null;
  description?: string | null;
  media?: ReviewMediaItem[];
  is_verified_purchase: boolean;
  created_at: string;
  edited_at?: string | null;
  vendor_response?: string | null;
  vendor_response_at?: string | null;
  user: { id: string; name: string; avatar?: string | null };
  product?: {
    id: string;
    slug: string;
    title: string;
    thumbnail?: string | null;
  } | null;
}

export interface ReviewsSummary {
  average_rating: number;
  total_reviews: number;
  rating_breakdown: Record<string, number>;
}

export interface ReviewsBlockData {
  scope?: 'vendor' | 'product' | 'ids';
  product_slug?: string | null;
  ids?: string[];
  min_rating?: 1 | 2 | 3 | 4 | 5;
  verified_only?: boolean;
  with_media?: boolean;
  limit?: number;
  sort?: 'newest' | 'highest' | 'featured';
  layout?: 'grid' | 'carousel' | 'wall' | 'compact' | 'spotlight' | 'minimal';
  title?: string | null;
  /** Optional inline preview data — used by theme preview / demo mode when backend is unavailable. */
  _preview?: { summary?: ReviewsSummary; reviews?: ReviewItem[] };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqBlockData {
  heading?: string | null;
  items: FaqItem[];
}

export interface ProductQuestionItem {
  id: string;
  question: string;
  answer: string | null;
  status: 'answered';
  created_at: string;
  answered_at: string | null;
  user: { id: string; name: string; avatar?: string | null };
}

export interface ProductQaBlockData {
  product_slug: string;
  limit?: number;
  title?: string | null;
  /** Optional inline preview data — used by theme preview / demo mode when backend is unavailable. */
  _preview?: { questions?: ProductQuestionItem[] };
}

export interface BlogBlockData {
  title?: string | null;
  /** Blog category slug. Blank/absent = every published post ("use all"). */
  category?: string | null;
  limit?: number;
}

export interface MetaobjectsBlockData {
  title?: string | null;
  /** Metaobject definition handle (`designer`, `ingredient`, …). */
  type: string;
  limit?: number;
  layout?: 'grid' | 'list';
}

/**
 * Server-seeded resolution for a `metaobjects` block — the entries of
 * `data.type` plus the definition meta needed to decide whether each card
 * links out (`definition.has_pages`). Mirrors `MetaobjectsResolved` shape
 * used by `hydrateProductBlocks` in the host app.
 */
export interface MetaobjectsResolved {
  entries: MetaobjectEntry[];
  definition: { type: string; name: string; has_pages: boolean };
}

export type BlockDataMap = {
  content: ContentBlockData;
  image: ImageBlockData;
  gallery: GalleryBlockData;
  video: VideoBlockData;
  table: TableBlockData;
  button: ButtonBlockData;
  embed: EmbedBlockData;
  divider: DividerBlockData;
  callout: CalloutBlockData;
  quote: QuoteBlockData;
  products: ProductsBlockData;
  categories: CategoriesBlockData;
  contact: ContactBlockData;
  reviews: ReviewsBlockData;
  faq: FaqBlockData;
  product_qa: ProductQaBlockData;
  blog: BlogBlockData;
  metaobjects: MetaobjectsBlockData;
};

export type Block<T extends BlockType = BlockType> = {
  type: T;
  data: BlockDataMap[T];
  variant?: string;
  /**
   * Section-scoped design-token overrides — only the keys set here are
   * applied; everything else inherits the global tokens via the CSS
   * cascade. See `expandDesignTokensPartial` in `utils/brand.ts`.
   */
  tokens?: Partial<DesignTokens>;
  /**
   * Stable in-page-scroll target — a menu item's `meta.anchor` links here.
   * Lowercase-kebab, enforced by the API.
   */
  anchor_id?: string;
  /**
   * Server-seeded product data for `products` blocks — set by
   * the host's `hydrateProductBlocks` before blocks reach
   * `PageRenderer`, which awaits it via `use()` inside a per-block
   * `<Suspense>` boundary. Lives on the block, not inside `data`, so it never
   * gets spread into theme components as a prop. Absent for every other
   * block type and for any route that hasn't been wired to hydrate.
   */
  productsPromise?: Promise<Product[]>;
  /**
   * Server-seeded entries + definition meta for `metaobjects` blocks — set
   * by the host's `hydrateProductBlocks` alongside `productsPromise`. Same rule:
   * absent for every other block type and for any route that hasn't been
   * wired to hydrate; the renderer falls back to rendering nothing (themes
   * never fetch metaobjects client-side).
   */
  metaobjectsPromise?: Promise<MetaobjectsResolved>;
};
