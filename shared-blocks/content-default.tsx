'use client';

import type { JSX } from 'react';
import type { ContentBlockData } from '../types/block';
import { Markdown } from '../components/markdown';

/**
 * Framework-owned default content block. Renders markdown into semantic
 * HTML via the core <Markdown> renderer (react-markdown + remark-gfm) —
 * headings, nested lists, code fences, tables, blockquotes, and inline
 * images (routed through the core <Image>). Themes style via
 * `.core-block-content` — typography, spacing, lists, headings.
 *
 * This block ONLY handles the default "plain markdown" content variant.
 * Structured variants (promo, brand-story, testimonials, marquee) remain
 * theme-owned and are routed separately in page-renderer.
 */
export function CoreContentDefaultBlock({ markdown }: ContentBlockData): JSX.Element {
  return (
    <section className="core-block core-block-content">
      <Markdown className="core-block-content__body">{markdown ?? ''}</Markdown>
    </section>
  );
}
