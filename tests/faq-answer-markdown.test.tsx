import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../navigation', () => ({
  Link: ({ href, children }: { href: string; children?: React.ReactNode }) => React.createElement('a', { href }, children),
}));

import { CoreFaqBlock } from '../shared-blocks/faq';

function answerHtml(answer: string): string {
  const html = renderToStaticMarkup(React.createElement(CoreFaqBlock, { items: [{ question: 'Q?', answer }] }));
  const match = html.match(/<div class="core-block-faq__answer">([\s\S]*?)<\/div><\/details>/);

  return match ? match[1] : '';
}

describe('FAQ answer formatting', () => {
  it('keeps a plain answer as the bare text it always rendered', () => {
    expect(answerHtml('Yes. The minimum order is ₦7,500.')).toBe('Yes. The minimum order is ₦7,500.');
  });

  it('renders paragraphs and bold for a formatted answer, without showing the asterisks', () => {
    const html = answerHtml(
      'Browse our menu and check out online.\n\n**Ordering made easier: Add JODIS to your Home Screen!** Tap the Share icon in Safari.',
    );

    expect(html).toBe(
      '<p>Browse our menu and check out online.</p><p><strong>Ordering made easier: Add JODIS to your Home Screen!</strong> Tap the Share icon in Safari.</p>',
    );
    expect(html).not.toContain('**');
  });

  it('never renders raw HTML from an answer', () => {
    const html = answerHtml('Hi\n\n<script>alert(1)</script> **x**');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
