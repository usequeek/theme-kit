'use client';

import type { QuoteBlockData } from '../types/block';

/**
 * Framework-owned pull-quote block. Renders a blockquote with an optional
 * attribution line. Themes style via `.core-block-quote` scoped selectors.
 */
export function CoreQuoteBlock({ markdown, text, cite }: QuoteBlockData): JSX.Element {
  const body = (markdown ?? text ?? '').trim();

  return (
    <section className="core-block core-block-quote">
      <blockquote className="core-block-quote__inner">
        <p className="core-block-quote__text">{body}</p>
        {cite ? <cite className="core-block-quote__cite">{cite}</cite> : null}
      </blockquote>
    </section>
  );
}
