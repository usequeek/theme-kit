// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketSwitcher } from '../components/market-switcher';
import { useMarkets, type MarketsState } from '../hooks/use-markets';
import { StorefrontProvider } from '../provider';
import { getBrowserMarketId, setBrowserMarketId } from '../utils/market';
import { setActivePlatform } from '../sdk/platform';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MARKETS = [
  { id: 1000, name: 'Ghana', countries: ['GH'], currency: 'GHS' },
  { id: 1001, name: 'Kenya', countries: ['KE'], currency: 'KES' },
];

const CART_KEY = 'queek-storefront-cart';
const line = (id: string, shop: string) => ({ id, shop_id: shop, product_id: id, quantity: 1, unit_price: 100, addons: [] });

let container: HTMLDivElement;
let root: Root;
const reload = vi.fn();

function Provider({ markets, market, children }: { markets?: unknown[] | null; market?: number | string | null; children: ReactNode }) {
  return (
    <StorefrontProvider
      vendor={{ id: 'v1', slug: 'acme', name: 'Acme', currency: 'NGN' } as never}
      config={{} as never}
      menus={[]}
      basePath=""
      {...(markets !== undefined ? { markets } : {})}
      {...(market !== undefined ? { market } : {})}
    >
      {children}
    </StorefrontProvider>
  );
}

function mount(node: ReactNode, props: { markets?: unknown[] | null; market?: number | string | null } = {}): void {
  act(() => {
    root.render(<Provider {...props}>{node}</Provider>);
  });
}

function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
  reload.mockClear();
  localStorage.clear();
  clearCookies();
  setActivePlatform('storefront');
  setBrowserMarketId(null);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setBrowserMarketId(null);
});

describe('MarketSwitcher', () => {
  it('renders nothing on a store with no published market', () => {
    mount(<MarketSwitcher />, { markets: [] });
    expect(container.querySelector('[data-qn-market-switcher]')).toBeNull();
  });

  it('renders nothing when the host passed no market list', () => {
    mount(<MarketSwitcher />);
    expect(container.querySelector('[data-qn-market-switcher]')).toBeNull();
  });

  it('renders nothing outside a storefront provider', () => {
    act(() => root.render(<MarketSwitcher />));
    expect(container.innerHTML).toBe('');
  });

  it('lists the store currency first, then each market, and marks the chosen one', () => {
    mount(<MarketSwitcher />, { markets: MARKETS, market: 1001 });
    const select = container.querySelector('select') as HTMLSelectElement;
    const options = [...select.options].map((o) => [o.value, o.textContent]);

    expect(options).toEqual([
      ['', 'NGN'],
      ['1000', 'Ghana · GHS'],
      ['1001', 'Kenya · KES'],
    ]);
    expect(select.value).toBe('1001');
    expect(select.getAttribute('aria-label')).toBe('Currency: Kenya · KES');
  });

  it('ignores a chosen market the store does not publish', () => {
    mount(<MarketSwitcher />, { markets: MARKETS, market: 4242 });
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('');
    expect(getBrowserMarketId()).toBeNull();
  });

  it('choosing a market writes the store cookie, drops only this store\'s persisted lines and reloads', () => {
    localStorage.setItem(CART_KEY, JSON.stringify({ state: { items: [line('a', 'v1'), line('b', 'other')] }, version: 0 }));
    mount(<MarketSwitcher />, { markets: MARKETS });
    const select = container.querySelector('select') as HTMLSelectElement;

    act(() => {
      select.value = '1000';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(document.cookie).toContain('queek_market_acme=1000');
    const persisted = JSON.parse(localStorage.getItem(CART_KEY) as string);
    expect(persisted.state.items.map((i: { id: string }) => i.id)).toEqual(['b']);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('choosing the store currency clears the cookie', () => {
    document.cookie = 'queek_market_acme=1000; Path=/';
    mount(<MarketSwitcher />, { markets: MARKETS, market: 1000 });
    const select = container.querySelector('select') as HTMLSelectElement;

    act(() => {
      select.value = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(document.cookie).not.toContain('queek_market_acme=1000');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('hands a render-prop the state and renders nothing without markets', () => {
    let seen: MarketsState | null = null;
    mount(<MarketSwitcher>{(state) => { seen = state; return <b>custom</b>; }}</MarketSwitcher>, { markets: MARKETS, market: 1000 });
    expect(container.textContent).toBe('custom');
    expect(seen).not.toBeNull();
    expect((seen as unknown as MarketsState).displayCurrency).toBe('GHS');
  });
});

describe('Provider market state', () => {
  function Probe({ onState }: { onState: (s: MarketsState) => void }) {
    onState(useMarkets());
    return null;
  }

  it('reports the store currency when no market is chosen, the market currency when one is', () => {
    let state: MarketsState | null = null;
    mount(<Probe onState={(s) => { state = s; }} />, { markets: MARKETS });
    expect((state as unknown as MarketsState).displayCurrency).toBe('NGN');
    expect((state as unknown as MarketsState).active).toBeNull();

    mount(<Probe onState={(s) => { state = s; }} />, { markets: MARKETS, market: '1000' });
    expect((state as unknown as MarketsState).displayCurrency).toBe('GHS');
    expect((state as unknown as MarketsState).active?.id).toBe(1000);
    expect(getBrowserMarketId()).toBe(1000);
  });

  it('sets no browser market for the in-store QR channel', () => {
    setActivePlatform('instore_qr');
    mount(<MarketSwitcher />, { markets: MARKETS, market: 1000 });
    expect(getBrowserMarketId()).toBeNull();
  });

  it('drops a cookie that names an unpublished market, once, with its priced lines', () => {
    document.cookie = 'queek_market_acme=1000; Path=/';
    localStorage.setItem(CART_KEY, JSON.stringify({ state: { items: [line('a', 'v1')] }, version: 0 }));
    mount(<span />, { markets: [{ id: 1001, name: 'Kenya', countries: ['KE'], currency: 'KES' }], market: 1000 });

    expect(document.cookie).not.toContain('queek_market_acme=1000');
    expect(JSON.parse(localStorage.getItem(CART_KEY) as string).state.items).toEqual([]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the cookie when the host could not read the market list', () => {
    document.cookie = 'queek_market_acme=1000; Path=/';
    mount(<span />, { market: 1000 });
    expect(document.cookie).toContain('queek_market_acme=1000');
    expect(reload).not.toHaveBeenCalled();
  });

  it('touches nothing on a store with no market and no cookie (byte-identical)', () => {
    localStorage.setItem(CART_KEY, JSON.stringify({ state: { items: [line('a', 'v1')] }, version: 0 }));
    mount(<span />, { markets: [] });
    expect(reload).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(CART_KEY) as string).state.items).toHaveLength(1);
  });
});
