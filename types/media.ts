/**
 * The srcset-ready tier map emitted by the API. Sits BESIDE the existing
 * collapsed url fields (media.image, vendor.logo, collection.image, …), which
 * are unchanged — this is purely additive.
 *
 * Contract (enforced API-side, relied on here):
 *  1. All 5 keys are ALWAYS present when the map itself is non-null.
 *  2. A tier that doesn't exist is the WHOLE VALUE null — never a partial
 *     object, never a fallback url. Skip it; never synthesize a filename.
 *  3. `original` is never null when the map is non-null. Modeled as
 *     `ImageVariantTier | null` anyway rather than a type-level invariant:
 *     making it non-nullable would buy zero runtime safety against an API
 *     regression while forcing every consumer through a `!` or a cast. The
 *     invariant is documented, not encoded.
 *  4. `w`/`h` are `min(tier_cap, original.width)` and the proportional height —
 *     so on a small original SEVERAL TIERS LEGITIMATELY SHARE A WIDTH. That is
 *     correct API behavior, and the reason resolveImageSources() dedupes
 *     srcset candidates by width (duplicate `w` descriptors make a srcset
 *     non-deterministic).
 *  5. `thumb` ALWAYS has `w: null, h: null` — it's a legacy 150→240px tier with
 *     a non-uniform crop history, so a computed width would misrepresent it.
 *     It must NEVER enter a srcset; it is a fixed `src` tier only.
 *  6. The WHOLE map is null when the image isn't Media-backed (external/off-host
 *     url, SVG, some legacy uploads). Consumers fall back to the existing
 *     collapsed field, exactly as today.
 *
 * Tier caps (px):
 *   thumb ~240 (uncapped/legacy) · card 480 · card2x 800 · view 1600 · original raw
 */
export interface ImageVariantTier {
  url: string;
  /** Rendered width in px. null on `thumb` (always) and when the original has no
   *  recorded dimensions. A tier with a null `w` cannot enter a srcset. */
  w: number | null;
  h: number | null;
}

export type ImageVariantTierName = 'thumb' | 'card' | 'card2x' | 'view' | 'original';

export type ImageVariants = {
  [K in ImageVariantTierName]: ImageVariantTier | null;
};

/**
 * The flat url→variants sidecar on a Page/Post response
 * (the `media_index` field). Keyed by the EXACT raw url
 * string as it appears in that same response's `content[]` block JSON —
 * block schemas were not changed, so a consumer looks up
 * `mediaIndex[url] ?? null` per raw url it finds in block content.
 *
 * Serialized as `(object)` server-side: always present, `{}` when empty,
 * NEVER null. Individual values can still be null (rule 6 above).
 */
export type MediaIndex = Record<string, ImageVariants | null>;
