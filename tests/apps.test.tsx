import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as apps from '../apps';
import { AppBlocks, AppBlocksProvider } from '../apps';

describe('apps — the theme-facing app-block slot', () => {
  it('is exactly the provider, the slot, and the shared types', () => {
    expect(Object.keys(apps).sort()).toEqual(['AppBlocks', 'AppBlocksProvider']);
  });

  it('renders nothing without a host registration (SSR-safe)', () => {
    const html = renderToStaticMarkup(
      React.createElement(AppBlocks, { target: 'product', productId: 'p1' }),
    );

    expect(html).toBe('');
  });

  it('renders whatever the host registered, with the slot props', () => {
    function HostBlocks({ target, productId }: { target: 'product'; productId?: string }) {
      return <div data-host-blocks={`${target}:${productId ?? ''}`} />;
    }

    const html = renderToStaticMarkup(
      <AppBlocksProvider renderBlocks={HostBlocks}>
        <AppBlocks target="product" productId="p1" vendorSlug="glow" />
      </AppBlocksProvider>,
    );

    expect(html).toContain('data-host-blocks="product:p1"');
  });
});
