'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import type { ButtonBlockData } from '../types/block';

/**
 * Framework-owned button block. Respects per-block bg_color/text_color
 * overrides from vendor data. Everything else is styled via the theme's
 * `.core-block-button` CSS.
 */
export function CoreButtonBlock({ text, url, bg_color, text_color }: ButtonBlockData): JSX.Element | null {
  const label = text ?? '';
  if (!label) return null;

  const style: React.CSSProperties = {};
  if (bg_color) style.backgroundColor = bg_color;
  if (text_color) style.color = text_color;
  const hasCustomStyle = Object.keys(style).length > 0;

  return (
    <section className="core-block core-block-button-wrap">
      {url ? (
        <Link
          href={url}
          className="core-block-button"
          style={hasCustomStyle ? style : undefined}
        >
          {label}
        </Link>
      ) : (
        <button
          type="button"
          className="core-block-button"
          style={hasCustomStyle ? style : undefined}
        >
          {label}
        </button>
      )}
    </section>
  );
}
