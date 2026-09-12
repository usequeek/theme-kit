'use client';

import type { JSX } from 'react';
import type { VideoBlockData } from '../types/block';
import { resolveVideoEmbedUrl } from '../utils/video-embed';

/**
 * Framework-owned video block. Detects YouTube, Vimeo, or direct video file
 * URLs and renders the appropriate embed. Themes style via `.core-block-video`.
 */
export function CoreVideoBlock({ url }: VideoBlockData): JSX.Element {
  if (!url) {
    return (
      <section className="core-block core-block-video">
        <div className="core-block-video__wrap core-block-video__wrap--empty">
          <div className="core-block-video__placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Add a video URL</span>
          </div>
        </div>
      </section>
    );
  }

  const embedUrl = resolveVideoEmbedUrl(url);

  if (embedUrl) {
    return (
      <section className="core-block core-block-video">
        <div className="core-block-video__wrap">
          <iframe
            className="core-block-video__frame"
            src={embedUrl}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </section>
    );
  }

  // Direct video file — use HTML5 <video>
  return (
    <section className="core-block core-block-video">
      <div className="core-block-video__wrap">
        <video
          className="core-block-video__el"
          src={url}
          controls
          preload="metadata"
          playsInline
        />
      </div>
    </section>
  );
}
