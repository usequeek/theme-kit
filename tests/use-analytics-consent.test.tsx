// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConsentPreferencesLink } from '../apps/consent-preferences-link';
import { consentPending, consentOffers } from '../apps/consent-offers';
import { ConsentRegimeProvider, readStoredMarketingConsent, useAnalyticsConsent } from '../apps/use-analytics-consent';
import { StorefrontProvider } from '../provider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'queek_consent';
const ANALYTICS = { ga_id: 'G-ABCD1234', meta_pixel_id: '123456789012' };

type Hook = ReturnType<typeof useAnalyticsConsent>;
let latest: Hook;

function Probe({ id }: { id: string }): null {
  latest = useAnalyticsConsent(id);
  return null;
}

function Store({ required, children }: { required?: boolean; children: ReactNode }) {
  const inner = (
    <StorefrontProvider vendor={{ id: 'v1', slug: 'v1', name: 'v1' } as never} config={{ apps: { analytics: ANALYTICS } } as never} menus={[]}>
      {children}
    </StorefrontProvider>
  );
  return required === undefined ? inner : <ConsentRegimeProvider required={required}>{inner}</ConsentRegimeProvider>;
}

function record(answers: { analytics?: boolean; marketing?: boolean }): void {
  const store = JSON.parse(window.localStorage.getItem(KEY) || '{}');
  store['v1'] = { ...answers, version: 1, decidedAt: '2026-11-16T10:00:00.000Z' };
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

const stored = (): Record<string, Record<string, unknown>> => JSON.parse(window.localStorage.getItem(KEY) || '{}');
const link = (): HTMLButtonElement | null => container.querySelector<HTMLButtonElement>('button.core-consent-link');

function setGpc(on: boolean): void {
  Object.defineProperty(window.navigator, 'globalPrivacyControl', { value: on, configurable: true });
}

let container: HTMLDivElement;
let root: Root;

async function mount(required?: boolean): Promise<void> {
  await act(async () => {
    root.render(<Store required={required}><Probe id="v1" /><ConsentPreferencesLink /></Store>);
  });
}

const pending = (): boolean => consentPending(consentOffers({ apps: { analytics: ANALYTICS } })!, latest.decision, latest.marketing);

beforeEach(() => {
  window.localStorage.clear();
  setGpc(false);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  // `reviewing` lives in module memory: end any review a test left open.
  await act(async () => latest?.decide({}));
  await act(async () => root.unmount());
  container.remove();
  Reflect.deleteProperty(window.navigator, 'globalPrivacyControl');
});

describe('consent required (no provider, or required)', () => {
  it('reads unanswered with no record, with or without a provider', async () => {
    await mount();
    expect([latest.decision, latest.marketing]).toEqual([null, null]);
    await mount(true);
    expect([latest.decision, latest.marketing]).toEqual([null, null]);
    expect(readStoredMarketingConsent('v1')).toBe(false);
  });

  it('reset deletes the stored record, as before', async () => {
    record({ analytics: true, marketing: true });
    await mount(true);
    expect(link()).not.toBeNull();

    await act(async () => link()?.click());
    expect(stored()['v1']).toBeUndefined();
    expect(pending()).toBe(true);
    expect(link()).toBeNull();
  });
});

describe('consent not required (outside the regions)', () => {
  it('reads a shopper with no record as granted for both categories and writes nothing', async () => {
    await mount(false);
    expect([latest.decision, latest.marketing]).toEqual([true, true]);
    expect(pending()).toBe(false);
    expect(stored()['v1']).toBeUndefined();
    expect(readStoredMarketingConsent('v1')).toBe(true);
  });

  it('a record that lacks a category falls through to granted for that category', async () => {
    record({ analytics: false });
    await mount(false);
    expect([latest.decision, latest.marketing]).toEqual([false, true]);
  });

  it('Global Privacy Control still reads declined and hides the link', async () => {
    setGpc(true);
    await mount(false);
    expect([latest.decision, latest.marketing]).toEqual([false, false]);
    expect(readStoredMarketingConsent('v1')).toBe(false);
    expect(link()).toBeNull();
  });

  it('a stored decline wins over the implied grant', async () => {
    record({ analytics: false, marketing: false });
    await mount(false);
    expect([latest.decision, latest.marketing]).toEqual([false, false]);
    expect(readStoredMarketingConsent('v1')).toBe(false);
  });

  it('the footer link shows with no record, and a click reopens the question without touching the stored answer', async () => {
    record({ analytics: false, marketing: false });
    await mount(false);
    expect(link()).not.toBeNull();

    await act(async () => link()?.click());
    expect([latest.decision, latest.marketing]).toEqual([null, null]);
    expect(pending()).toBe(true);
    expect(link()).toBeNull();
    expect(stored()['v1']).toMatchObject({ analytics: false, marketing: false });
    expect(readStoredMarketingConsent('v1')).toBe(false);
  });

  it('deciding ends the review and writes the choice', async () => {
    record({ analytics: false, marketing: false });
    await mount(false);
    await act(async () => link()?.click());

    await act(async () => latest.decide({ analytics: true, marketing: false }));
    expect([latest.decision, latest.marketing]).toEqual([true, false]);
    expect(pending()).toBe(false);
    expect(link()).not.toBeNull();
    expect(stored()['v1']).toMatchObject({ analytics: true, marketing: false });
  });

  it('a first-time visitor can decline from the footer and the decline is stored', async () => {
    await mount(false);
    await act(async () => link()?.click());
    await act(async () => latest.decide({ analytics: false, marketing: false }));

    expect([latest.decision, latest.marketing]).toEqual([false, false]);
    expect(stored()['v1']).toMatchObject({ analytics: false, marketing: false });
    expect(readStoredMarketingConsent('v1')).toBe(false);
  });

  it('the sync reader returns to "required" when the provider unmounts', async () => {
    await mount(false);
    expect(readStoredMarketingConsent('v1')).toBe(true);
    await act(async () => root.render(<div />));
    expect(readStoredMarketingConsent('v1')).toBe(false);
  });
});
