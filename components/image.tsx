'use client';

import { useContext, useState, type ImgHTMLAttributes } from 'react';
import { StorefrontContext } from '../provider';
import type { ImageVariants } from '../types/media';
import { resolveBrandPalette } from '../utils/brand-palette';
import { resolveImageSources, type ImageIntent } from '../utils/image-srcset';
import { resolvePlaceholder, type PlaceholderVariant } from '../utils/placeholder-resolver';

/**
 * Generic fallback used when the caller does not provide a `placeholder` prop.
 * Kept for backward compatibility with existing <Image> call sites that have not
 * yet been wired up to the Smart Placeholder system.
 */
const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#f0f0f0"/>
    <g transform="translate(150,150)" opacity="0.3">
      <rect x="0" y="10" width="100" height="80" rx="8" fill="none" stroke="#999" stroke-width="4"/>
      <circle cx="30" cy="35" r="10" fill="#999"/>
      <polyline points="10,75 40,50 60,65 90,40" fill="none" stroke="#999" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>`,
)}`;

export interface PlaceholderProp {
  label?: string;
  sublabel?: string;
  width: number;
  height: number;
  variant?: PlaceholderVariant;
}

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: string;
  placeholder?: PlaceholderProp;
  /**
   * The backend's srcset-ready tier map (product.media.image_variants,
   * vendor.logo_variants, collection.image_variants, mediaIndex[url], …).
   * Purely additive: when absent — as it is at every call site that hasn't been
   * migrated, and whenever the backend legitimately sends null (off-host image,
   * SVG, legacy upload) — this component behaves exactly as it did before.
   */
  variants?: ImageVariants | null;
  /**
   * What surface this image renders on. Drives which tier is preferred and what
   * `sizes` is emitted. Only meaningful alongside `variants`. Defaults to 'raw'
   * ("best available single url, no responsive selection") so passing `variants`
   * without an `intent` can never accidentally downgrade a hero.
   */
  intent?: ImageIntent;
};

/**
 * Where the <img> currently is in the fallback chain:
 *   'primary'  — the resolved/passed src
 *   'original' — retrying variants.original.url after the primary 404'd
 *   'failed'   — give up, render `fallback` or the Smart Placeholder
 */
type LoadStage = 'primary' | 'original' | 'failed';

export function Image({ fallback, placeholder, variants, intent = 'raw', onError, ...props }: ImageProps) {
  const [stage, setStage] = useState<LoadStage>('primary');
  // Read context directly — returns null outside a StorefrontProvider
  // (test environments, isolated captures) without throwing.
  const storefront = useContext(StorefrontContext);

  const resolved = resolveImageSources(variants, intent);

  // The resolved tier WINS over an explicitly-passed `src`. That's the whole
  // point of threading `variants` down: the collapsed `src` field is the thing
  // being downgraded away from. It's safe because resolveImageSources() enforces
  // the intent ceiling — a capped intent can never resolve to `original`, so the
  // result is always <= what `src` already implied. Call sites keep passing
  // `src` unchanged; it stays the fallback for null/partial maps.
  const primarySrc = resolved.src ?? (typeof props.src === 'string' ? props.src : undefined) ?? props.src;

  // Reset the fallback chain when the underlying image changes (a reused card in
  // a virtualized rail, a variant swap on the PDP) — without this, a component
  // that already fell back to the placeholder for image A stays stuck on the
  // placeholder forever even after being reused for a working image B. Render-
  // phase derived-state, per React's "adjusting state when props change" — no
  // extra commit, no effect.
  const [lastKey, setLastKey] = useState<typeof primarySrc>(primarySrc);
  if (primarySrc !== lastKey) {
    setLastKey(primarySrc);
    if (stage !== 'primary') setStage('primary');
  }

  const originalUrl = variants?.original?.url;
  // Only worth a retry if it's a genuinely different url from the one that failed.
  const canRetryOriginal = typeof originalUrl === 'string' && originalUrl !== '' && originalUrl !== primarySrc;

  const hasSrc = !!primarySrc;
  const needsPlaceholder = !hasSrc || stage === 'failed';

  let placeholderSrc = fallback ?? PLACEHOLDER_SVG;

  if (needsPlaceholder && placeholder) {
    const palette = resolveBrandPalette(storefront?.config ?? null);
    const font = storefront?.config?.brand?.font?.body ?? storefront?.config?.brand?.font?.heading;
    placeholderSrc = resolvePlaceholder({
      width: placeholder.width,
      height: placeholder.height,
      label: placeholder.label,
      sublabel: placeholder.sublabel,
      variant: placeholder.variant,
      palette,
      font,
    });
  }

  let effectiveSrc = primarySrc;
  // CRITICAL: srcSet/sizes must be dropped on every non-primary stage. A srcSet
  // OUTRANKS src in the browser's selection algorithm, so leaving it in place
  // while swapping src would make the browser re-pick the very candidate that
  // just failed — the fallback would never render and onError would loop.
  let effectiveSrcSet = resolved.srcSet;
  let effectiveSizes = resolved.sizes;

  if (stage === 'original') {
    effectiveSrc = originalUrl;
    effectiveSrcSet = undefined;
    effectiveSizes = undefined;
  }
  if (needsPlaceholder) {
    effectiveSrc = placeholderSrc;
    effectiveSrcSet = undefined;
    effectiveSizes = undefined;
  }

  // Cards sit in grids and rails, mostly below the fold — and a card's hover
  // image is invisible until hover. Eager, a server-rendered grid of 24 cards
  // made React preload the first ~10 (also into the 103 Early Hints header) and
  // fetch every image at once, racing the page's render-blocking CSS: /shop's
  // first paint went 1.8 s → 2.9 s on Slow 4G (24/9/26). Lazy is next/image's
  // default as well. A theme whose card IS the page's main image passes
  // loading="eager" or fetchPriority="high".
  const lazyByDefault = (intent === 'card' || intent === 'card2x') && props.fetchPriority !== 'high';
  const loading = props.loading ?? (lazyByDefault ? 'lazy' : undefined);

  return (
    <img
      {...props}
      loading={loading}
      src={effectiveSrc}
      srcSet={effectiveSrcSet}
      sizes={effectiveSizes}
      onError={(e) => {
        // 2-step chain: preferred tier → variants.original → placeholder.
        if (stage === 'primary') {
          setStage(canRetryOriginal ? 'original' : 'failed');
        } else if (stage === 'original') {
          setStage('failed');
        }
        onError?.(e);
      }}
    />
  );
}
