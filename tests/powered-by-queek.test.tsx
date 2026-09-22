import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PoweredByQueek } from '../components/powered-by-queek';

function render(props?: { className?: string; hidden?: boolean }): string {
  return renderToStaticMarkup(React.createElement(PoweredByQueek, props));
}

describe('PoweredByQueek', () => {
  it('links to the Queek business page with the attribution contract intact', () => {
    const html = render();

    expect(html).toContain('<a');
    expect(html).toContain('href="https://usequeek.com/business"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
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
  });
});
