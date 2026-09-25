import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as navigation from '../navigation';
import { Link } from '../navigation';

describe('navigation — what a theme links and navigates with', () => {
  it('is exactly Link, useRouter and usePathname', () => {
    expect(Object.keys(navigation).sort()).toEqual(['Link', 'usePathname', 'useRouter']);
  });

  it('renders Link as a plain anchor carrying its href, class and children', () => {
    const html = renderToStaticMarkup(
      React.createElement(Link, { href: '/medley/shop', className: 'md-nav__link', 'aria-current': 'page' }, 'Shop'),
    );

    expect(html).toContain('<a');
    expect(html).toContain('href="/medley/shop"');
    expect(html).toContain('class="md-nav__link"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('>Shop</a>');
  });

  it('keeps a full URL as is', () => {
    const html = renderToStaticMarkup(React.createElement(Link, { href: 'https://usequeek.com/business', target: '_blank' }, 'Queek'));

    expect(html).toContain('href="https://usequeek.com/business"');
    expect(html).toContain('target="_blank"');
  });
});
