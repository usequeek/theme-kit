import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../utils/markdown';

/**
 * Backend CT16 (queek_backend/.agent/frontend-chat/sessions/storefront-contact-block/chat.json):
 * a heading immediately followed by other content, with no blank line between them, gets
 * swallowed whole into the heading — `utils/markdown.tsx` used to treat an entire
 * blank-line-delimited block as heading text the moment it matched a heading prefix. Real
 * merchant copy (Jhema Wears' short_description) writes "### Our Offerings\n- item\n- item"
 * with no blank line, which is common, valid markdown — the list must not disappear into the h3.
 */

function html(markdown: string): string {
  return renderToStaticMarkup(React.createElement(React.Fragment, null, ...renderMarkdown(markdown)));
}

describe('renderMarkdown heading + trailing-content handling', () => {
  it('a heading immediately followed by a list (no blank line) renders both, not one heading swallowing the list', () => {
    const out = html(
      '### Our Offerings\n- Latest fashion apparel for men, women, and children\n- Accessories to complement every outfit',
    );

    expect(out).toContain('<h3');
    expect(out).toContain('Our Offerings');
    expect(out).toContain('<ul');
    expect(out).toContain('<li>Latest fashion apparel for men, women, and children</li>');
    expect(out).toContain('<li>Accessories to complement every outfit</li>');
    expect(out).not.toMatch(/<h3[^>]*>[^<]*Latest fashion/);
  });

  it('a heading immediately followed by a paragraph (no blank line) renders both, not one heading swallowing the text', () => {
    const out = html('## Our Story\nWe hand-pick every piece.');

    expect(out).toBe('<h2>Our Story</h2><p>We hand-pick every piece.</p>');
  });

  it('a heading with nothing after it still renders alone (regression guard)', () => {
    expect(html('## Our Story')).toBe('<h2>Our Story</h2>');
  });

  it('a heading followed by a blank-line-separated paragraph still renders as two blocks (regression guard)', () => {
    const out = html('## Our Story\n\nWe hand-pick every piece.');
    expect(out).toBe('<h2>Our Story</h2><p>We hand-pick every piece.</p>');
  });
});
