/**
 * Which cookie-consent categories a store uses, resolved from its analytics app
 * config. Pure and server-safe: the banner, the footer preferences link and the
 * analytics loader all read the same answer, so they cannot drift.
 *
 * Every id is validated against a strict pattern before it can reach a script
 * URL or an inline snippet: an id that fails its pattern is treated as not set.
 */

/** Mirrors the backend rule on analytics.meta_pixel_id (digits only). */
export const META_PIXEL_ID_PATTERN = /^\d{8,20}$/;
/** Mirrors the backend rule on analytics.tiktok_pixel_id (uppercase alphanumerics). */
export const TIKTOK_PIXEL_ID_PATTERN = /^[A-Z0-9]{5,30}$/;
/** Mirrors the backend rule on analytics.pinterest_tag_id (digits only). */
export const PINTEREST_TAG_ID_PATTERN = /^\d{8,20}$/;
/** Mirrors the backend rule on analytics.ga_id: G-/GT- measurement ids or a UA- property id, nothing else. */
export const GA_ID_PATTERN = /^(?:(?:G|GT)-[A-Z0-9]{4,26}|UA-\d{4,10}-\d{1,4})$/;

/** The GA id when it has the documented shape, else null (GA absent): it is spliced into an inline script and a script URL, so nothing else may pass. */
export function resolveGaId(gaId: unknown): string | null {
  return typeof gaId === 'string' && GA_ID_PATTERN.test(gaId) ? gaId : null;
}

/** The validated ad-pixel ids; `null` for a provider the store does not use. */
export interface AdPixelIds {
  meta: string | null;
  tiktok: string | null;
  pinterest: string | null;
}

/** The ids `config.apps.analytics` carries; each is present only while its app is installed. */
export interface AnalyticsAppIds {
  ga_id?: unknown;
  meta_pixel_id?: unknown;
  tiktok_pixel_id?: unknown;
  pinterest_tag_id?: unknown;
}

/** An id that fails its pattern is treated as not set: it never reaches a script URL. */
export function resolveAdPixelIds(analytics: AnalyticsAppIds | undefined | null): AdPixelIds {
  const meta = analytics?.meta_pixel_id;
  const tiktok = analytics?.tiktok_pixel_id;
  const pinterest = analytics?.pinterest_tag_id;
  return {
    meta: typeof meta === 'string' && META_PIXEL_ID_PATTERN.test(meta) ? meta : null,
    tiktok: typeof tiktok === 'string' && TIKTOK_PIXEL_ID_PATTERN.test(tiktok) ? tiktok : null,
    pinterest: typeof pinterest === 'string' && PINTEREST_TAG_ID_PATTERN.test(pinterest) ? pinterest : null,
  };
}

/** Which consent categories this store actually uses; the banner asks only about those. */
export interface ConsentOffers {
  analytics: boolean;
  /** Ad pixels (Meta/TikTok/Pinterest). `marketingLabel` names them, e.g. "Meta, TikTok and Pinterest". */
  marketing: boolean;
  marketingLabel?: string;
}

/** "Meta", "Meta and TikTok", "Meta, TikTok and Pinterest". */
export function joinNames(names: Array<string | null>): string {
  const present = names.filter((name): name is string => Boolean(name));
  return present.length > 1 ? `${present.slice(0, -1).join(', ')} and ${present[present.length - 1]}` : present.join('');
}

/** The offers for already-resolved ids; `null` when the store has neither Google Analytics nor an ad pixel. */
export function buildConsentOffers(gaId: string | null, pixels: AdPixelIds): ConsentOffers | null {
  const hasPixels = pixels.meta !== null || pixels.tiktok !== null || pixels.pinterest !== null;
  if (gaId === null && !hasPixels) return null;
  return {
    analytics: gaId !== null,
    marketing: hasPixels,
    marketingLabel: joinNames([pixels.meta && 'Meta', pixels.tiktok && 'TikTok', pixels.pinterest && 'Pinterest']),
  };
}

/** The offers for a store's `config`, read from `config.apps.analytics`; `null` when the store uses no consent category. */
export function consentOffers(
  config: { apps?: { analytics?: AnalyticsAppIds | undefined } | undefined } | null | undefined,
): ConsentOffers | null {
  const analytics = config?.apps?.analytics;
  return buildConsentOffers(resolveGaId(analytics?.ga_id), resolveAdPixelIds(analytics));
}

/**
 * Whether the shopper still has a question to answer: a category the store
 * offers whose decision is `null`. The banner shows exactly while this is true,
 * and the footer preferences link shows only once it is false.
 */
export function consentPending(offers: ConsentOffers, decision: boolean | null, marketing: boolean | null): boolean {
  return (offers.analytics && decision === null) || (offers.marketing && marketing === null);
}
