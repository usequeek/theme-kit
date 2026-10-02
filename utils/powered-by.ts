/**
 * The one place the "Powered by Queek" destination is built, so every theme's
 * footer link carries the same attribution and the affiliate/referral program
 * can trace a signup back to the store it came from.
 */
export const POWERED_BY_QUEEK_URL = 'https://usequeek.com/business';

export const POWERED_BY_UTM_SOURCE = 'powered_by';
export const POWERED_BY_UTM_MEDIUM = 'storefront';

/**
 * `campaign` is the store's public slug (never an internal UUID) so signups
 * are attributable per store. Existing query parameters on the base
 * URL are kept; the `utm_*` keys are always ours. A blank campaign omits
 * `utm_campaign` rather than sending an empty value.
 */
export function poweredByQueekUrl(campaign?: string | null, base: string = POWERED_BY_QUEEK_URL): string {
  const url = new URL(base);

  url.searchParams.set('utm_source', POWERED_BY_UTM_SOURCE);
  url.searchParams.set('utm_medium', POWERED_BY_UTM_MEDIUM);

  const trimmed = campaign?.trim();
  if (trimmed) {
    url.searchParams.set('utm_campaign', trimmed);
  } else {
    url.searchParams.delete('utm_campaign');
  }

  return url.toString();
}
