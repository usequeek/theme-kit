'use client';

import type { ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Image } from './image';

/**
 * Rich long-form markdown renderer for article bodies and callouts. Uses
 * `react-markdown` + `remark-gfm` so headings, nested lists, code fences,
 * tables, blockquotes, task lists, and inline formatting all render properly.
 *
 * Raw HTML is NOT enabled (react-markdown's default) — content is sanitized.
 *
 * Inline markdown images are routed through the core <Image> component so the
 * Smart Placeholder / fallback system applies (never a bare, unoptimized
 * <img>). Short-form snippets (footers, product blurbs) keep using the
 * lightweight `renderMarkdown` helper in `lib/core/utils/markdown`.
 */
function MarkdownImage({ src, alt }: ComponentPropsWithoutRef<'img'>): JSX.Element | null {
  if (!src || typeof src !== 'string') {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt ?? ''}
      className="core-markdown__img"
      loading="lazy"
      placeholder={{ label: alt || undefined, width: 1200, height: 800, variant: 'photo' }}
    />
  );
}

function MarkdownLink({ href, children, ...rest }: ComponentPropsWithoutRef<'a'>): JSX.Element {
  const isExternal = typeof href === 'string' && /^https?:\/\//.test(href);

  return (
    <a href={href} {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
      {children}
    </a>
  );
}

export function Markdown({ children, className }: { children: string; className?: string }): JSX.Element {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: MarkdownImage, a: MarkdownLink }}>
        {children ?? ''}
      </ReactMarkdown>
    </div>
  );
}
