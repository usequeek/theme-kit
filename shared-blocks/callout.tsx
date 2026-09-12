'use client';

import type { JSX } from 'react';
import type { CalloutBlockData, CalloutTone } from '../types/block';
import { Markdown } from '../components/markdown';

/**
 * Framework-owned callout block. Renders `data.markdown` inside a toned box
 * (info / warn / success / note via `data.tone`). Themes tint via
 * `.core-block-callout[data-tone="…"]` scoped selectors — colours come from
 * brand CSS variables with sensible fallbacks in core-blocks.css.
 */
const TONE_ICON: Record<CalloutTone, string> = {
  info: 'ℹ',
  warn: '⚠',
  success: '✓',
  note: '✎',
};

export function CoreCalloutBlock({ markdown, tone = 'info', title }: CalloutBlockData): JSX.Element {
  const resolvedTone: CalloutTone = TONE_ICON[tone as CalloutTone] ? (tone as CalloutTone) : 'info';

  return (
    <section className="core-block core-block-callout" data-tone={resolvedTone}>
      <div className="core-block-callout__inner">
        <span className="core-block-callout__icon" aria-hidden="true">
          {TONE_ICON[resolvedTone]}
        </span>
        <div className="core-block-callout__content">
          {title ? <p className="core-block-callout__title">{title}</p> : null}
          <Markdown className="core-block-callout__body">{markdown ?? ''}</Markdown>
        </div>
      </div>
    </section>
  );
}
