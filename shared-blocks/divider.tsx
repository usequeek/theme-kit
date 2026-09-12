'use client';

import type { DividerBlockData } from '../types/block';

/**
 * Framework-owned divider block. Themes style via `.core-block-divider`
 * and the modifier classes in their theme.css.
 */
export function CoreDividerBlock({ style }: DividerBlockData): JSX.Element {
  const modifier = style === 'space' ? 'core-block-divider--space' : 'core-block-divider--line';

  return (
    <div className={`core-block-divider ${modifier}`} role="separator">
      {style !== 'space' ? <hr className="core-block-divider__line" /> : null}
    </div>
  );
}
