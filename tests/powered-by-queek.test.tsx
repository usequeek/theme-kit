import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PoweredByQueek } from '../components/powered-by-queek';
import { StorefrontContext } from '../provider';

const BASE = 'https://usequeek.com/business?utm_source=powered_by&amp;utm_medium=storefront';

function render(props?: { className?: string; hidden?: boolean }, vendor?: { id: string; slug: string | null }): string {
  const element = React.createElement(PoweredByQueek, props);

  if (!vendor) return renderToStaticMarkup(element);

  return renderToStaticMarkup(
    React.createElement(StorefrontContext.Provider, { value: { vendor } as never }, element),
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
    const html = render(undefined, { id: 'uuid-1', slug: 'kili-foods' });

    expect(html).toContain(`href="${BASE}&amp;utm_campaign=kili-foods"`);
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

  it('renders nothing when hidden', () => {
    expect(render({ hidden: true })).toBe('');
    expect(render({ hidden: true }, { id: 'uuid-1', slug: 'kili-foods' })).toBe('');
  });
});
