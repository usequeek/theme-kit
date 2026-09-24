import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StorefrontContext } from '../provider';
import { ThemeProvider } from '../theme-context';
import { PageRenderer } from '../page-renderer';
import type { Block } from '../types/block';
import type { ThemeModule } from '../types/theme';

/**
 * The storefront attaches streamed `productsPromise` / `metaobjectsPromise` to
 * page blocks. On the server they arrive as React Flight thenables that point
 * back at the whole RSC response. PageRenderer's change-detection signature
 * JSON-stringified the blocks, and that threw "Converting circular structure to
 * JSON" during server rendering — every real store with a products block fell
 * back to client-only rendering in `next dev`.
 */

function circularThenable(): unknown {
  const response: Record<string, unknown> = { _chunks: new Map() };
  response._weakResponse = { response };
  return { status: 'pending', value: null, reason: response, then: () => undefined };
}

describe('PageRenderer', () => {
  it('server-renders blocks that carry a streamed (circular) promise', () => {
    const blocks = [
      { type: 'content', data: { markdown: 'Fresh meals, delivered' }, productsPromise: circularThenable(), metaobjectsPromise: circularThenable() },
    ] as unknown as Block[];
    const theme = { getBlock: () => () => null } as unknown as ThemeModule;
    const store = { vendor: { id: 'v1', slug: 'kili-foods' }, config: {}, menus: [], basePath: '', pagesChrome: {} };

    const html = renderToStaticMarkup(
      <StorefrontContext.Provider value={store as never}>
        <ThemeProvider theme={theme}>
          <PageRenderer blocks={blocks} />
        </ThemeProvider>
      </StorefrontContext.Provider>,
    );

    expect(html).toContain('Fresh meals, delivered');
  });
});
