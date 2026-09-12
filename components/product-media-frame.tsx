'use client';

import type { JSX } from 'react';
import { Image, type PlaceholderProp } from './image';
import type { ImageIntent } from '../utils/image-srcset';
import type { MediaFrame } from '../utils/product-media';

interface ProductMediaFrameProps {
  frame: MediaFrame;
  className?: string;
  placeholder?: PlaceholderProp;
  /** 'main' (the selected/current frame) plays with controls. 'thumbnail'
   *  renders muted with no controls — `preload="metadata"` makes the browser
   *  show the video's first frame as a static image without playing it, the
   *  same trick a poster image would achieve, with no separate poster asset. */
  variant?: 'main' | 'thumbnail';
  /** Override the intent derived from `variant` (e.g. a theme rendering the
   *  main frame inside a narrow split-pane rather than a full-width hero). */
  intent?: ImageIntent;
}

export function ProductMediaFrame({
  frame,
  className,
  placeholder,
  variant = 'main',
  intent,
}: ProductMediaFrameProps): JSX.Element {
  if (frame.type === 'video') {
    return (
      <video
        className={className}
        src={frame.url}
        aria-label={frame.alt}
        controls={variant === 'main'}
        muted={variant === 'thumbnail'}
        playsInline
        preload="metadata"
      />
    );
  }

  // Thumbnail strips render at ~64-90px across every theme — the `thumb` tier
  // (a fixed-src, never-in-a-srcset tier by contract) is exactly right there.
  const resolvedIntent: ImageIntent = intent ?? (variant === 'thumbnail' ? 'avatar' : 'hero');

  return (
    <Image
      className={className}
      src={frame.url}
      alt={frame.alt}
      placeholder={placeholder}
      variants={frame.variants}
      intent={resolvedIntent}
    />
  );
}
