// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PoweredByQueek } from '../components/powered-by-queek';
import { StorefrontContext } from '../provider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BASE = 'https://usequeek.com/business?utm_source=powered_by&amp;utm_medium=storefront';

function render(
  props?: { className?: string; hidden?: boolean },
  vendor?: { id: string; slug: string | null },
  config?: Record<string, unknown>,
): string {
  const element = React.createElement(PoweredByQueek, props);

  if (!vendor) return renderToStaticMarkup(element);

  return renderToStaticMarkup(
    React.createElement(StorefrontContext.Provider, { value: { vendor, config } as never }, element),
  );
}

describe('PoweredByQueek', () => {
  it('links to the Queek business page with the attribution contract intact', () => {
    const html = render();

    expect(html).toContain('<a');
    expect(html).toContain(`href="${BASE}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('tags the link with the store slug as utm_campaign', () => {
    const html = render(undefined, { id: 'uuid-1', slug: 'demo-store' });

    expect(html).toContain(`href="${BASE}&amp;utm_campaign=demo-store"`);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('omits utm_campaign (never the internal UUID) when the store has no slug', () => {
    const html = render(undefined, { id: 'uuid-1', slug: null });

    expect(html).not.toContain('utm_campaign');
    expect(html).not.toContain('uuid-1');
  });

  it('omits utm_campaign (never errors) when no storefront provider is mounted', () => {
    expect(render()).not.toContain('utm_campaign');
  });

  it('renders "Powered by Queek" with the brand hook for theme styling', () => {
    const html = render();

    expect(html).toContain('core-powered-by');
    expect(html).toContain('Powered by');
    expect(html).toContain('<strong class="core-powered-by__brand">Queek</strong>');
  });

  it('passes a footer positioning class through alongside the core class', () => {
    const html = render({ className: 'qn-footer4__powered' });

    expect(html).toContain('class="core-powered-by qn-footer4__powered"');
  });

  it('renders nothing when hidden and no cookie preferences link is due', () => {
    expect(render({ hidden: true })).toBe('');
    expect(render({ hidden: true }, { id: 'uuid-1', slug: 'demo-store' })).toBe('');
  });

  it('shows the credit by default: no display block, an empty one, or show_powered_by true', () => {
    const vendor = { id: 'uuid-1', slug: 'demo-store' };

    for (const config of [undefined, {}, { display: {} }, { display: { show_product_counts: true } }, { display: { show_powered_by: true } }]) {
      expect(render(undefined, vendor, config)).toContain('Powered by');
    }
  });

  it('hides the credit when the store turns show_powered_by off, whatever the prop says', () => {
    const vendor = { id: 'uuid-1', slug: 'demo-store' };
    const config = { display: { show_powered_by: false } };

    expect(render(undefined, vendor, config)).toBe('');
    expect(render({ hidden: false }, vendor, config)).toBe('');
    expect(render({ className: 'qn-footer4__powered' }, vendor, config)).not.toContain('core-powered-by');
  });

  it('still hides from the prop when the store leaves the credit on', () => {
    const vendor = { id: 'uuid-1', slug: 'demo-store' };

    expect(render({ hidden: true }, vendor, { display: { show_powered_by: true } })).toBe('');
  });

  it('keeps the cookie preferences link when the store hides the credit, on a store where it is due (client render)', async () => {
    window.localStorage.setItem('queek_consent', JSON.stringify({ 'uuid-1': { analytics: true, version: 1, decidedAt: '2026-11-15T10:00:00.000Z' } }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const config = { apps: { analytics: { ga_id: 'G-ABCD1234' } }, display: { show_powered_by: false } };
    const store = { vendor: { id: 'uuid-1', slug: 'demo-store' }, config };

    await act(async () => {
      root.render(React.createElement(StorefrontContext.Provider, { value: store as never }, React.createElement(PoweredByQueek)));
    });

    expect(container.querySelectorAll('button.core-consent-link')).toHaveLength(1);
    expect(container.querySelectorAll('a.core-powered-by')).toHaveLength(0);

    config.display.show_powered_by = true;
    await act(async () => {
      root.render(
        React.createElement(StorefrontContext.Provider, { value: { ...store, config: { ...config } } as never }, React.createElement(PoweredByQueek)),
      );
    });
    expect(container.querySelectorAll('button.core-consent-link')).toHaveLength(1);
    expect(container.querySelectorAll('a.core-powered-by')).toHaveLength(1);

    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  it('keeps the cookie preferences link when hidden, on a store where it is due (client render)', async () => {
    window.localStorage.setItem('queek_consent', JSON.stringify({ 'uuid-1': { analytics: true, version: 1, decidedAt: '2026-11-15T10:00:00.000Z' } }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const store = { vendor: { id: 'uuid-1', slug: 'demo-store' }, config: { apps: { analytics: { ga_id: 'G-ABCD1234' } } } };

    await act(async () => {
      root.render(
        React.createElement(StorefrontContext.Provider, { value: store as never }, React.createElement(PoweredByQueek, { hidden: true })),
      );
    });

    expect(container.querySelectorAll('button.core-consent-link')).toHaveLength(1);
    expect(container.querySelector('button.core-consent-link')?.textContent).toBe('Cookie preferences');
    expect(container.querySelectorAll('a.core-powered-by')).toHaveLength(0);

    await act(async () => {
      root.render(
        React.createElement(StorefrontContext.Provider, { value: store as never }, React.createElement(PoweredByQueek)),
      );
    });
    expect(container.querySelectorAll('button.core-consent-link')).toHaveLength(1);
    expect(container.querySelectorAll('a.core-powered-by')).toHaveLength(1);

    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  it('renders one root element holding the attribution link, so a footer row keeps its child count', () => {
    const html = render({ className: 'td-footer__powered' }, { id: 'uuid-1', slug: 'demo-store' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const roots = doc.body.children;

    expect(roots).toHaveLength(1);
    expect(roots[0]?.tagName).toBe('SPAN');
    expect(roots[0]?.className).toBe('core-powered-by-group');
    expect(roots[0]?.children).toHaveLength(1);
    expect(roots[0]?.firstElementChild?.getAttribute('class')).toBe('core-powered-by td-footer__powered');
  });
});
