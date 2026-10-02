import { describe, expect, it } from 'vitest';
import { POWERED_BY_QUEEK_URL, poweredByQueekUrl } from '../utils/powered-by';

function params(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

describe('poweredByQueekUrl', () => {
  it('keeps the business-page destination and adds source, medium and campaign', () => {
    const url = poweredByQueekUrl('kili-foods');

    expect(url.startsWith(`${POWERED_BY_QUEEK_URL}?`)).toBe(true);
    expect(params(url)).toEqual({
      utm_source: 'powered_by',
      utm_medium: 'storefront',
      utm_campaign: 'kili-foods',
    });
  });

  it.each([undefined, null, '', '   '])('omits utm_campaign for a blank campaign (%j)', (campaign) => {
    expect(params(poweredByQueekUrl(campaign))).toEqual({
      utm_source: 'powered_by',
      utm_medium: 'storefront',
    });
  });

  it('preserves an existing query and overrides only its own utm keys', () => {
    const url = poweredByQueekUrl('shop-1', 'https://usequeek.com/business?plan=pro&utm_source=old&utm_campaign=stale');

    expect(params(url)).toEqual({
      plan: 'pro',
      utm_source: 'powered_by',
      utm_medium: 'storefront',
      utm_campaign: 'shop-1',
    });
  });

  it('drops a stale utm_campaign when the new campaign is blank', () => {
    expect(params(poweredByQueekUrl(null, 'https://usequeek.com/business?utm_campaign=stale'))).not.toHaveProperty('utm_campaign');
  });

  it('url-encodes the campaign and is deterministic (SSR-safe, no window/Date)', () => {
    const url = poweredByQueekUrl('a b&c');

    expect(url).toContain('utm_campaign=a+b%26c');
    expect(params(url).utm_campaign).toBe('a b&c');
    expect(poweredByQueekUrl('a b&c')).toBe(url);
  });
});
