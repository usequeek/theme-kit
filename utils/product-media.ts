import type { ImageVariants } from '../types/media';
import type { Product, ProductImage } from '../types/product';

export interface MediaFrame {
  id: string;
  url: string;
  alt: string;
  type: 'image' | 'video';
  /** Tier map for this frame, when the image is Media-backed. Consumed by
   *  ProductMediaFrame → <Image variants>. Absent for video frames and for
   *  non-Media-backed images. */
  variants?: ImageVariants | null;
}

/**
 * Picks the largest tier a PDP hero should ever request. `view` is capped at
 * 1600px (queek_backend config/media.php) which covers every theme's hero box
 * at DPR2 — the raw `original` is uncapped and unoptimized.
 */
function heroUrl(variants: ImageVariants | null | undefined): string | null {
  return variants?.view?.url ?? variants?.card2x?.url ?? null;
}

/**
 * The ordered `media.images` list with blanks dropped — the single source
 * for card hover/slideshow reads. Empty for products with no imagery at all.
 */
export function getSlideshowImages(product: Product): ProductImage[] {
  const images = product.media.images;
  if (!Array.isArray(images)) {
    return [];
  }

  return images.filter(
    (entry): entry is ProductImage =>
      !!entry && typeof entry.url === 'string' && entry.url !== '',
  );
}

/**
 * The card hover-swap source: the second ordered image. Null unless the
 * product carries at least two images — callers render the primary alone.
 */
export function getHoverImage(product: Product): string | null {
  return getSlideshowImages(product)[1]?.url ?? null;
}

/**
 * Builds the ordered list of PDP gallery frames for a product: main image,
 * then gallery images, then the product video (if any) appended last — was
 * duplicated verbatim as `buildFrames`/`buildGalleryFrames` in every theme's
 * pages/product.tsx; centralized here per the project's reuse-over-duplication
 * rule. Pair with `ProductMediaFrame` to render whatever comes back.
 *
 * Reads `media.images` (primary first) when present and falls back to the
 * legacy main+`gallery` pair for older payloads — same frames either way, so
 * no visual change, only the data source moves to the ONE ordered list.
 */
export function buildMediaFrames(product: Product): MediaFrame[] {
  const frames: MediaFrame[] = [];
  const images = getSlideshowImages(product);

  if (images.length > 0) {
    images.forEach((item, index) => {
      const itemVariants = item.variants ?? null;
      frames.push({
        id: index === 0 ? 'main' : String(item.id),
        // Same hero-tier preference as the legacy path below: the capped
        // `view` tier wins whenever the backend has one, and the raw
        // `original` survives as the primary's fallback for non-Media-backed
        // images where `variants` is null.
        url:
          heroUrl(itemVariants) ??
          (index === 0 ? (product.media.original ?? item.url) : item.url),
        alt: item.alt ?? product.title,
        type: 'image',
        variants: itemVariants,
      });
    });
  } else {
    const mainVariants = product.media.image_variants ?? null;

    if (product.media.image) {
      frames.push({
        id: 'main',
        // WAS: `product.media.original ?? product.media.image` — which shipped the
        // full raw original into every theme's PDP hero, unconditionally. Now the
        // capped `view` tier (<=1600px webp) wins whenever the backend has one,
        // and `original ?? image` survives untouched as the fallback for
        // non-Media-backed images (external url, SVG, legacy upload) where
        // image_variants is null. Themes that read `frame.url` directly get the
        // downgrade for free; those that render through ProductMediaFrame also
        // get a real srcset off `variants`.
        url: heroUrl(mainVariants) ?? product.media.original ?? product.media.image,
        alt: product.title,
        type: 'image',
        variants: mainVariants,
      });
    }

    if (product.media.gallery) {
      for (const item of product.media.gallery) {
        const itemVariants = item.variants ?? null;
        frames.push({
          id: String(item.id),
          // item.url is already the CARD url server-side (480px) — too small for a
          // main hero frame, which is why the `view` tier is preferred here too.
          url: heroUrl(itemVariants) ?? item.url,
          alt: item.alt ?? product.title,
          type: 'image',
          variants: itemVariants,
        });
      }
    }
  }

  if (frames.length === 0 && product.media.thumbnail) {
    frames.push({ id: 'thumb', url: product.media.thumbnail, alt: product.title, type: 'image' });
  }

  if (product.media.video_url) {
    frames.push({ id: 'video', url: product.media.video_url, alt: product.title, type: 'video' });
  }

  return frames;
}
