import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The kit's own Link marks itself so a client-side link is told apart from a plain anchor.
vi.mock('../navigation', () => ({
  Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
    React.createElement('a', { href, 'data-client-nav': 'true' }, children),
}));

import { renderMarkdown } from '../utils/markdown';

function html(markdown: string, basePath?: string): string {
  return renderToStaticMarkup(React.createElement(React.Fragment, null, ...renderMarkdown(markdown, basePath)));
}

describe('renderMarkdown links', () => {
  it('moves an internal link with the kit Link (client navigation), no target', () => {
    expect(html('[About](/about)')).toBe('<p><a href="/about" data-client-nav="true">About</a></p>');
  });

  it('keeps basePath prefixing on internal links', () => {
    expect(html('[About](/about)', '/preview/medley')).toBe(
      '<p><a href="/preview/medley/about" data-client-nav="true">About</a></p>',
    );
  });

  it('opens an external link in a new tab with a plain anchor', () => {
    const out = html('[Queek](https://usequeek.com/x)', '/preview/medley');
    expect(out).toBe('<p><a href="https://usequeek.com/x" target="_blank" rel="noopener noreferrer">Queek</a></p>');
    expect(out).not.toContain('data-client-nav');
  });

  it('treats a protocol-relative URL as external-ish: plain anchor, never client nav, never basePath-prefixed', () => {
    const out = html('[CDN](//cdn.example.com/a)', '/preview/medley');
    expect(out).toBe('<p><a href="//cdn.example.com/a">CDN</a></p>');
  });

  it.each([
    ['mailto', 'mailto:hi@store.com'],
    ['tel', 'tel:+2348000000000'],
    ['anchor', '#faq'],
  ])('leaves a %s link a plain anchor, unprefixed', (_name, href) => {
    const out = html(`[x](${href})`, '/preview/medley');
    expect(out).toBe(`<p><a href="${href}">x</a></p>`);
  });

  it('applies to links inside lists and tables too (footer columns)', () => {
    const out = html('- [Shop](/shop)\n- [Hi](mailto:a@b.co)');
    expect(out).toContain('<li><a href="/shop" data-client-nav="true">Shop</a></li>');
    expect(out).toContain('<li><a href="mailto:a@b.co">Hi</a></li>');
  });
});
