import type { ThemeManifestVariant } from '../types/theme';

/**
 * Framework-owned block manifest. These variants are available in EVERY
 * theme's Section Library drawer — themes don't implement them and can't
 * override their React logic, only their CSS styling via `.core-block-*`
 * scoped selectors.
 *
 * Keep in sync with FRAMEWORK_OWNED_TYPES in page-renderer.tsx and the
 * shared-blocks index export.
 */
export const FRAMEWORK_BLOCK_MANIFEST: Record<string, ThemeManifestVariant[]> = {
  divider: [
    { id: 'default', label: 'Divider', default: true, purpose: 'Visual separator between sections' },
  ],
  callout: [
    { id: 'default', label: 'Callout', default: true, purpose: 'Highlighted info/warn/success/note box for article emphasis' },
  ],
  quote: [
    { id: 'default', label: 'Quote', default: true, purpose: 'Pull-quote with optional attribution' },
  ],
  embed: [
    { id: 'default', label: 'Embed', default: true, purpose: 'Instagram, Spotify, Twitter, or any iframe URL' },
  ],
  video: [
    { id: 'default', label: 'Video', default: true, purpose: 'Embed a YouTube, Vimeo, or self-hosted video' },
  ],
  table: [
    { id: 'default', label: 'Table', default: true, purpose: 'Pricing, specs, or comparison tables' },
  ],
  button: [
    { id: 'default', label: 'Button', default: true, purpose: 'Standalone call-to-action link' },
  ],
  image: [
    { id: 'default', label: 'Image', default: true, purpose: 'A single standalone image with caption' },
  ],
  reviews: [
    { id: 'grid', label: 'Grid', default: true, purpose: 'Verified customer reviews in a responsive grid' },
    { id: 'carousel', label: 'Carousel', purpose: 'Verified customer reviews in a horizontal scroller' },
    { id: 'wall', label: 'Wall', purpose: 'Masonry-style wall of verified customer reviews' },
    { id: 'compact', label: 'Compact', purpose: 'Compact list with rating breakdown header' },
  ],
  faq: [
    { id: 'default', label: 'FAQ', default: true, purpose: 'Accordion of question/answer pairs' },
  ],
  product_qa: [
    { id: 'default', label: 'Product Q&A', default: true, purpose: 'Customer questions and vendor answers for this product' },
  ],
};

/**
 * Block types that are fully framework-owned (React logic + routing).
 * Themes can style these via `.core-block-*` CSS but do NOT implement the
 * React components. page-renderer.tsx routes these to core directly.
 */
export const FRAMEWORK_OWNED_TYPES = new Set<string>([
  'divider',
  'callout',
  'quote',
  'embed',
  'video',
  'table',
  'button',
  'image',
  'reviews',
  'faq',
  'product_qa',
]);

/**
 * `content/default` is a special case — the default content variant is
 * framework-owned (plain markdown rendering), but content variants with
 * specific IDs (promo, brand-story, testimonials, marquee, features-columns,
 * before-after) stay theme-owned. page-renderer.tsx handles this split.
 */
export const CONTENT_DEFAULT_IS_FRAMEWORK_OWNED = true;
