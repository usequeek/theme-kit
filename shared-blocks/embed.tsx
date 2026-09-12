'use client';

import type { JSX } from 'react';
import type { EmbedBlockData } from '../types/block';

/**
 * Framework-owned embed block. Renders an iframe for any external URL
 * (Instagram, Spotify, Twitter, custom). Themes style via `.core-block-embed`.
 */
export function CoreEmbedBlock({ url }: EmbedBlockData): JSX.Element {
  if (!url) {
    return (
      <section className="core-block core-block-embed">
        <div className="core-block-embed__wrap core-block-embed__wrap--empty">
          <div className="core-block-embed__placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>Paste an Instagram, Spotify, or iframe URL</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="core-block core-block-embed">
      <div className="core-block-embed__wrap">
        <iframe
          className="core-block-embed__frame"
          src={url}
          title="Embedded content"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
}
