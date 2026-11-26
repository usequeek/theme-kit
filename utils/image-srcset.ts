import type { ImageVariantTier, ImageVariantTierName, ImageVariants } from '../types/media';

/**
 * What surface is this image being rendered on. Chosen by the CALL SITE, which
 * is the only thing that knows the CSS box — the helper never guesses.
 *
 * `card2x` is its own intent rather than just a rung on `card`'s ladder: the
 * tier names and the intent names are deliberately decoupled. `card` and
 * `card2x` build the SAME srcset ladder; they differ only in `sizes`, because
 * this codebase has two genuinely different card sizes — the grid card
 * (~320px CSS) and the featured/poster card (~620px CSS). Both would
 * otherwise get the identical 480px `card` url, visibly soft on the poster
 * ones.
 *
 * `section` is the intent of a merchant-uploaded section photo (a gallery or
 * banner slide, an image block) that may run full-bleed. The `<Image>` applies
 * it by itself when it finds its `src` in the page's media index and the call
 * site named no intent.
 */
export type ImageIntent = 'avatar' | 'card' | 'card2x' | 'modal' | 'hero' | 'section' | 'raw';

export interface ResolvedImageSources {
  src: string | undefined;
  srcSet: string | undefined;
  sizes: string | undefined;
}

const NONE: ResolvedImageSources = { src: undefined, srcSet: undefined, sizes: undefined };

/** Ascending by cap. `thumb` is excluded because it has no width; `original` is
 *  excluded on purpose — it is uncapped and unoptimized (raw jpg/png, possibly
 *  6000px), so letting a browser pick it off a srcset is the exact regression
 *  the tier map exists to prevent. The single exception is the `section` intent,
 *  which appends it as the top candidate only when it is wider than `view`. `original` survives only as a last-resort
 *  `src` for the `raw` intent and as the onError step-2 retry. */
const SRCSET_TIERS = ['card', 'card2x', 'view'] as const;
type SrcSetTier = (typeof SRCSET_TIERS)[number];

/**
 * DOWNGRADE-ONLY ENFORCEMENT. The largest tier an intent is ever allowed to
 * reach — for both `src` and `srcSet`. A capped intent can never resolve to
 * `original`, so wiring `intent="card"` onto a call site that today ships the
 * full original is guaranteed to be a downgrade or a no-op, never an upgrade.
 */
const INTENT_CEILING: Record<ImageIntent, SrcSetTier | null> = {
  avatar: null, // fixed src off `thumb`, no srcset (rule 5)
  card: 'card2x',
  card2x: 'view',
  modal: 'card2x',
  hero: 'view',
  section: 'view',
  raw: null, // "best single url, no responsive selection"
};

/**
 * `sizes` per intent, derived from a survey of the 9 themes' real CSS grid
 * breakpoints, validated against the real tier caps (480 / 800 / 1600):
 *
 *  card    @768px→384css: DPR1→card(480) · DPR2→768→card2x(800)
 *          @1100px→363css: DPR2→726→card2x · desktop 320css: DPR2→640→card2x
 *  card2x  @768px→768css: DPR2→1536→view(1600) · desktop 620css: DPR2→1240→view
 *  modal   420css: DPR1→420→card(480) · DPR2→840→card2x(800, the ceiling)
 *  hero    desktop 700css: DPR1→700→view · DPR2→1400→view(1600)
 *  section full-bleed `100vw`: phone 390css DPR2→780→card2x(800) · DPR3→1170→view ·
 *          1440css desktop DPR1→1440→view(1600). Never the 2 MB original on a
 *          phone or an ordinary desktop.
 *          `section` is the ONE intent whose srcset may end in `original`, and
 *          its srcset is `view` + `original` ONLY (see resolveImageSources): a
 *          section photo must never look softer than the raw upload it replaces.
 *          A cropped (`object-fit: cover`) tall hero on a phone is drawn WIDER
 *          than 100vw (a 16:9 photo in a 523px-tall box is drawn ~930px wide), so
 *          `sizes="100vw"` would under-measure it and the small tiers would be
 *          too soft: a phone gets `view` (WebP, at most 1600px, still about five
 *          times lighter than a 2 MB PNG) and only a screen wider than `view`
 *          picks the original, which is exactly what that screen is served today.
 *
 * `modal` is written as a media query (`(max-width: 456px) 92vw, 420px`,
 * arithmetically identical to `min(420px, 92vw)`: 420/0.92 = 456.5) rather
 * than relying on CSS math functions inside `sizes` — support for those is
 * uneven, and a `sizes` the parser rejects silently degrades to 100vw, i.e.
 * the browser picks the LARGEST candidate, the opposite of what we want.
 */
const INTENT_SIZES: Record<ImageIntent, string | undefined> = {
  avatar: undefined,
  card: '(max-width: 768px) 50vw, (max-width: 1100px) 33vw, 320px',
  card2x: '(max-width: 768px) 100vw, (max-width: 1100px) 50vw, 620px',
  modal: '(max-width: 456px) 92vw, 420px',
  hero: '(max-width: 900px) calc(100vw - 32px), 700px',
  section: '100vw',
  raw: undefined,
};

/** Preference order for the plain `src`. Every list respects INTENT_CEILING —
 *  no capped intent can reach `original`. */
const INTENT_SRC_ORDER: Record<ImageIntent, ImageVariantTierName[]> = {
  avatar: ['thumb', 'card'],
  card: ['card', 'card2x'],
  card2x: ['card2x', 'view', 'card'],
  modal: ['card2x', 'card'],
  // Deliberately NO 'card' fallback: `hero` callers (buildMediaFrames'
  // heroUrl()) already fall back to the true raw original — a genuinely
  // sharper image — when view/card2x don't exist yet for a product. If this
  // list included 'card' here, resolveImageSources would silently win over
  // that caller-provided `src` with the much smaller 480px tier, undoing the
  // very fallback the caller carefully picked. Returning undefined instead
  // lets the Image component's `resolved.src ?? props.src` defer to it.
  hero: ['view', 'card2x'],
  section: ['view', 'card2x', 'card'],
  raw: ['original', 'view', 'card2x', 'card', 'thumb'],
};

function usableTier(tier: ImageVariantTier | null | undefined): tier is ImageVariantTier {
  return !!tier && typeof tier.url === 'string' && tier.url.trim() !== '';
}

/**
 * Resolves a tier map + a surface intent into the three <img> attributes.
 *
 * Guarantees:
 *  - null/undefined `variants` → every field undefined, so the caller's own
 *    `src` prop keeps winning and behavior is byte-identical to today.
 *  - never emits `thumb` in a srcset.
 *  - `original` enters a srcset only for the `section` intent, and only as the
 *    top candidate, when its real width is strictly wider than `view`; the
 *    `section` srcset holds nothing but `view` and `original`.
 *  - never invents a url; null tiers are simply skipped.
 *  - never exceeds the intent's ceiling (downgrade-only).
 *  - dedupes candidates that collapsed to the same width on a small original,
 *    and drops the srcset entirely if fewer than 2 distinct widths survive
 *    (a 1-candidate srcset is pure byte overhead).
 *  - only emits `sizes` alongside a real `srcSet`.
 */
export function resolveImageSources(
  variants: ImageVariants | null | undefined,
  intent: ImageIntent,
): ResolvedImageSources {
  if (!variants) {
    return NONE;
  }

  let src: string | undefined;
  for (const name of INTENT_SRC_ORDER[intent]) {
    const tier = variants[name];
    if (usableTier(tier)) {
      src = tier.url;
      break;
    }
  }

  const ceiling = INTENT_CEILING[intent];
  if (ceiling === null) {
    return { src, srcSet: undefined, sizes: undefined };
  }

  const limit = SRCSET_TIERS.indexOf(ceiling);
  const byWidth = new Map<number, string>();
  // `section` starts at `view`: card and card2x are too small for a box that can be drawn wider than the viewport.
  for (let i = intent === 'section' ? limit : 0; i <= limit; i += 1) {
    const tier = variants[SRCSET_TIERS[i]];
    // A tier with no usable width can't carry a `w` descriptor, and mixing
    // `w` and bare descriptors in one srcset makes the whole attribute invalid.
    if (!usableTier(tier) || typeof tier.w !== 'number' || !Number.isFinite(tier.w) || tier.w <= 0) {
      continue;
    }
    // First writer wins: SRCSET_TIERS is ascending by cap, so at a collapsed
    // width the lower-cap encode (the smaller file) is the one we keep.
    if (!byWidth.has(tier.w)) {
      byWidth.set(tier.w, tier.url);
    }
  }

  if (intent === 'section') {
    const original = variants.original;
    if (
      usableTier(original) &&
      typeof original.w === 'number' &&
      Number.isFinite(original.w) &&
      original.w > Math.max(0, ...byWidth.keys())
    ) {
      byWidth.set(original.w, original.url);
    }
  }

  if (byWidth.size < 2) {
    return { src, srcSet: undefined, sizes: undefined };
  }

  const srcSet = [...byWidth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([w, url]) => `${url} ${w}w`)
    .join(', ');

  return { src, srcSet, sizes: INTENT_SIZES[intent] };
}

/**
 * The tallest box any theme draws a store logo in, in CSS px: Deluxr's merchant
 * logo height (`header.logo_height`, 16..120). Every other header and footer logo
 * box is 26..72 px tall, and every one is bounded by its height (a wide wordmark
 * grows sideways, never taller). A theme that draws a logo taller than this must
 * raise it, or `logoSrc` hands it a copy softer than the upload.
 */
export const LOGO_MAX_CSS_HEIGHT = 120;

/** The densest screen a logo copy is sized for (a 3x phone). */
const LOGO_MAX_DPR = 3;

/** Smallest first: the first copy tall enough wins. */
const LOGO_TIERS = ['card', 'card2x', 'view'] as const;

/**
 * The one url a store logo renders from. A logo reaches a theme as a plain string
 * (`HeaderProps.logo`), so it has no srcset: the url is the smallest copy that still
 * holds every pixel the logo can show, i.e. at least as tall as the upload or as
 * {@link LOGO_MAX_CSS_HEIGHT} x 3 (360 px), whichever is less. A copy keeps the
 * upload's shape, so one tall enough is wide enough for a wordmark of any width: a
 * square 1024 px JPG of 118 KB renders its 480 px `card` (23 KB), a 4:1 wordmark its
 * `view`. Never softer than the upload. When the API did not measure the upload, the
 * `view` copy (at most 1600 px), as before. The raw `url` when no copy is tall enough,
 * there are no copies at all (an SVG, an off-host file) or copies of a different
 * file, and when the upload is already a WebP no wider than the copy: the copy is
 * then the same picture re-encoded, and often heavier (an 8 KB wordmark's `view` is
 * 9.6 KB).
 */
export function logoSrc(url: string | null | undefined, variants: ImageVariants | null | undefined): string | null {
  if (!url) {
    return null;
  }
  const original = variants?.original;
  if (!variants || !original || original.url !== url) {
    return url;
  }
  const copy = smallestLogoCopy(variants, original);
  if (!copy) {
    return url;
  }
  const samePixels = typeof copy.w === 'number' && typeof original.w === 'number' && copy.w >= original.w;
  return samePixels && /\.webp(?:[?#]|$)/i.test(url) ? url : copy.url;
}

function smallestLogoCopy(variants: ImageVariants, original: ImageVariantTier): ImageVariantTier | null {
  const measured = typeof original.h === 'number' && Number.isFinite(original.h) && original.h > 0;
  if (!measured) {
    return usableTier(variants.view) ? variants.view : null;
  }
  const needed = Math.min(original.h as number, LOGO_MAX_CSS_HEIGHT * LOGO_MAX_DPR);
  for (const name of LOGO_TIERS) {
    const tier = variants[name];
    if (usableTier(tier) && typeof tier.h === 'number' && tier.h >= needed) {
      return tier;
    }
  }

  return null;
}
