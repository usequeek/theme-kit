import { describe, expect, it } from 'vitest';
import {
  buildConsentOffers,
  consentOffers,
  consentPending,
  joinNames,
  resolveAdPixelIds,
  resolveGaId,
  type ConsentOffers,
} from '../apps/consent-offers';

const GA = 'G-ABCD1234';
const META = '123456789012';
const TIKTOK = 'C1ABCDEF123';
const PINTEREST = '987654321012';

describe('resolveGaId', () => {
  it('accepts G-, GT- and UA- ids and nothing else', () => {
    expect(resolveGaId(GA)).toBe(GA);
    expect(resolveGaId('GT-ABCD1234')).toBe('GT-ABCD1234');
    expect(resolveGaId('UA-123456-1')).toBe('UA-123456-1');
    expect(resolveGaId("G-ABCD1234'); alert(1);//")).toBeNull();
    expect(resolveGaId('g-abcd1234')).toBeNull();
    expect(resolveGaId(undefined)).toBeNull();
    expect(resolveGaId(42)).toBeNull();
  });
});

describe('resolveAdPixelIds', () => {
  it('keeps a well-formed id per provider and drops a malformed one', () => {
    expect(resolveAdPixelIds({ meta_pixel_id: META, tiktok_pixel_id: TIKTOK, pinterest_tag_id: PINTEREST })).toEqual({
      meta: META,
      tiktok: TIKTOK,
      pinterest: PINTEREST,
    });
    expect(resolveAdPixelIds({ meta_pixel_id: 'abc', tiktok_pixel_id: 'lower', pinterest_tag_id: '12' })).toEqual({
      meta: null,
      tiktok: null,
      pinterest: null,
    });
    expect(resolveAdPixelIds(undefined)).toEqual({ meta: null, tiktok: null, pinterest: null });
  });
});

describe('joinNames', () => {
  it('joins one, two and three names', () => {
    expect(joinNames(['Meta'])).toBe('Meta');
    expect(joinNames(['Meta', null, 'Pinterest'])).toBe('Meta and Pinterest');
    expect(joinNames(['Meta', 'TikTok', 'Pinterest'])).toBe('Meta, TikTok and Pinterest');
    expect(joinNames([null, null])).toBe('');
  });
});

describe('consentOffers', () => {
  it('is null when the store has no Google Analytics and no pixel', () => {
    expect(consentOffers(undefined)).toBeNull();
    expect(consentOffers({})).toBeNull();
    expect(consentOffers({ apps: {} })).toBeNull();
    expect(consentOffers({ apps: { analytics: {} } })).toBeNull();
    expect(consentOffers({ apps: { analytics: { ga_id: 'not-an-id', meta_pixel_id: 'x' } } })).toBeNull();
  });

  it('offers analytics only for a store with just Google Analytics', () => {
    expect(consentOffers({ apps: { analytics: { ga_id: GA } } })).toEqual({ analytics: true, marketing: false, marketingLabel: '' });
  });

  it('offers marketing only for a pixel-only store, naming the pixels', () => {
    expect(consentOffers({ apps: { analytics: { meta_pixel_id: META } } })).toEqual({
      analytics: false,
      marketing: true,
      marketingLabel: 'Meta',
    });
    expect(
      consentOffers({ apps: { analytics: { meta_pixel_id: META, tiktok_pixel_id: TIKTOK, pinterest_tag_id: PINTEREST } } })?.marketingLabel,
    ).toBe('Meta, TikTok and Pinterest');
  });

  it('offers both, and matches buildConsentOffers for the same ids', () => {
    const config = { apps: { analytics: { ga_id: GA, tiktok_pixel_id: TIKTOK } } };

    expect(consentOffers(config)).toEqual({ analytics: true, marketing: true, marketingLabel: 'TikTok' });
    expect(consentOffers(config)).toEqual(buildConsentOffers(GA, { meta: null, tiktok: TIKTOK, pinterest: null }));
  });
});

describe('consentPending', () => {
  const analytics: ConsentOffers = { analytics: true, marketing: false };
  const marketing: ConsentOffers = { analytics: false, marketing: true };
  const both: ConsentOffers = { analytics: true, marketing: true };

  it('truth table', () => {
    // [offers, decision, marketing, pending]
    const table: Array<[ConsentOffers, boolean | null, boolean | null, boolean]> = [
      [analytics, null, null, true],
      [analytics, true, null, false],
      [analytics, false, null, false],
      [marketing, null, null, true],
      [marketing, null, true, false],
      [marketing, null, false, false],
      [both, null, null, true],
      [both, true, null, true],
      [both, null, true, true],
      [both, true, false, false],
      [both, false, false, false],
    ];

    for (const [offers, decision, marketingDecision, expected] of table) {
      expect(consentPending(offers, decision, marketingDecision), JSON.stringify([offers, decision, marketingDecision])).toBe(expected);
    }
  });

  it('nothing is pending when the store offers nothing', () => {
    expect(consentPending({ analytics: false, marketing: false }, null, null)).toBe(false);
  });
});
