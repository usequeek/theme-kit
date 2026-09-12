'use client';

import type { JSX } from 'react';
import type { ImageBlockData } from '../types/block';
import { Image } from '../components/image';

/**
 * Framework-owned image block. Wraps the core <Image> (with Smart Placeholder
 * support) and an optional caption. Themes style via `.core-block-image`.
 */
export function CoreImageBlock({ url, alt, caption }: ImageBlockData): JSX.Element {
  return (
    <section className="core-block core-block-image">
      <figure className="core-block-image__figure">
        <Image
          src={url || undefined}
          alt={alt ?? ''}
          className="core-block-image__img"
          placeholder={{
            label: alt ?? caption ?? undefined,
            width: 1200,
            height: 800,
            variant: 'photo',
          }}
        />
        {caption ? <figcaption className="core-block-image__caption">{caption}</figcaption> : null}
      </figure>
    </section>
  );
}
