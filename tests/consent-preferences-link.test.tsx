// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConsentPreferencesLink } from '../apps/consent-preferences-link';
import { StorefrontProvider } from '../provider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'queek_consent';
const GA = { ga_id: 'G-ABCD1234' };
const PIXEL = { meta_pixel_id: '123456789012' };

type Analytics = Record<string, string>;

function Store({ id, analytics, children }: { id: string; analytics?: Analytics; children: ReactNode }) {
  return (
    <StorefrontProvider
      vendor={{ id, slug: id, name: id } as never}
      config={{ apps: analytics ? { analytics } : {} } as never}
      menus={[]}
    >
      {children}
    </StorefrontProvider>
  );
}

function record(vendorId: string, answers: { analytics?: boolean; marketing?: boolean }): void {
  const store = JSON.parse(window.localStorage.getItem(KEY) || '{}');
  store[vendorId] = { ...answers, version: 1, decidedAt: '2026-11-15T10:00:00.000Z' };
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

const stored = (): Record<string, unknown> => JSON.parse(window.localStorage.getItem(KEY) || '{}');

let container: HTMLDivElement;
let root: Root;

async function mount(nodes: ReactNode): Promise<void> {
  await act(async () => {
    root.render(nodes);
  });
}

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll<HTMLButtonElement>('button.core-consent-link')];

function setGpc(on: boolean): void {
  Object.defineProperty(window.navigator, 'globalPrivacyControl', { value: on, configurable: true });
}

beforeEach(() => {
  window.localStorage.clear();
  setGpc(false);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(window.navigator, 'globalPrivacyControl');
});

describe('ConsentPreferencesLink', () => {
  it('is hidden before the shopper has decided', async () => {
    await mount(<Store id="v1" analytics={GA}><ConsentPreferencesLink /></Store>);

    expect(buttons()).toHaveLength(0);
  });

  it('shows after a decision, with the kit default label and no strings prop', async () => {
    record('v1', { analytics: true });
    await mount(<Store id="v1" analytics={GA}><ConsentPreferencesLink /></Store>);

    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]?.getAttribute('type')).toBe('button');
    expect(buttons()[0]?.textContent).toBe('Cookie preferences');
  });

  it('appears when the decision is made while mounted, and goes when it is reset', async () => {
    await mount(<Store id="v1" analytics={GA}><ConsentPreferencesLink /></Store>);
    expect(buttons()).toHaveLength(0);

    await act(async () => {
      record('v1', { analytics: false });
      window.dispatchEvent(new Event('queek:consent-change'));
    });
    expect(buttons()).toHaveLength(1);

    await act(async () => {
      buttons()[0]?.click();
    });
    expect(buttons()).toHaveLength(0);
    expect(stored()['v1']).toBeUndefined();
  });

  it('stays hidden on a partial decision (analytics decided, marketing still pending)', async () => {
    record('v1', { analytics: true });
    await mount(<Store id="v1" analytics={{ ...GA, ...PIXEL }}><ConsentPreferencesLink /></Store>);

    expect(buttons()).toHaveLength(0);
  });

  it('shows once both categories of a store with both are decided', async () => {
    record('v1', { analytics: true, marketing: false });
    await mount(<Store id="v1" analytics={{ ...GA, ...PIXEL }}><ConsentPreferencesLink /></Store>);

    expect(buttons()).toHaveLength(1);
  });

  it('works for an analytics-only store', async () => {
    record('v1', { analytics: true });
    await mount(<Store id="v1" analytics={GA}><ConsentPreferencesLink /></Store>);

    expect(buttons()).toHaveLength(1);
  });

  it('works for a marketing-only store (a pixel and no Google Analytics)', async () => {
    record('v1', { marketing: true });
    await mount(<Store id="v1" analytics={PIXEL}><ConsentPreferencesLink /></Store>);

    expect(buttons()).toHaveLength(1);
  });

  it('is hidden under Global Privacy Control, even with a stored record', async () => {
    setGpc(true);
    record('v1', { analytics: true });
    await mount(<Store id="v1" analytics={GA}><ConsentPreferencesLink /></Store>);

    expect(buttons()).toHaveLength(0);
  });

  it('is hidden when the store has no Google Analytics and no pixel', async () => {
    record('v1', { analytics: true, marketing: true });
    await mount(<Store id="v1"><ConsentPreferencesLink /></Store>);
    expect(buttons()).toHaveLength(0);

    await mount(<Store id="v1" analytics={{ ga_id: 'bad-id' }}><ConsentPreferencesLink /></Store>);
    expect(buttons()).toHaveLength(0);
  });

  it('clears only the clicked store when two stores share the origin', async () => {
    record('v1', { analytics: true });
    record('v2', { analytics: false });
    await mount(
      <>
        <Store id="v1" analytics={GA}><ConsentPreferencesLink /></Store>
        <Store id="v2" analytics={GA}><ConsentPreferencesLink /></Store>
      </>,
    );
    expect(buttons()).toHaveLength(2);

    await act(async () => {
      buttons()[0]?.click();
    });

    expect(stored()['v1']).toBeUndefined();
    expect(stored()['v2']).toMatchObject({ analytics: false });
    expect(buttons()).toHaveLength(1);
  });

  it('renders nothing on the server, even with a stored decision', () => {
    record('v1', { analytics: true });
    const html = renderToStaticMarkup(<Store id="v1" analytics={GA}><ConsentPreferencesLink /></Store>);

    expect(html).not.toContain('<button');
    expect(html).not.toContain('core-consent-link');
    expect(html).not.toContain('Cookie preferences');
  });

  it('renders nothing, and does not throw, without a provider', async () => {
    expect(renderToStaticMarkup(<ConsentPreferencesLink />)).toBe('');

    await mount(<ConsentPreferencesLink />);
    expect(container.innerHTML).toBe('');
  });
});
