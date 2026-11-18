'use client';

import type { JSX } from 'react';
import { createContext, useContext, type ReactNode } from 'react';

const BlockPositionContext = createContext<number | null>(null);

/**
 * How many blocks open a page. A page's hero is its first block, or its second
 * after a short heading or banner, so only these may hold the image the page is
 * judged by (its LCP image).
 */
export const TOP_BLOCK_COUNT = 2;

/**
 * Tells every `<Image>` below it where its block sits on the page. `PageRenderer`
 * mounts one per block; a theme never needs to.
 */
export function BlockPositionProvider({ index, children }: { index: number; children: ReactNode }): JSX.Element {
  return <BlockPositionContext.Provider value={index}>{children}</BlockPositionContext.Provider>;
}

/** The index of the page block being rendered; null outside a `PageRenderer` block. */
export function useBlockPosition(): number | null {
  return useContext(BlockPositionContext);
}

/** Whether a block index is past the opening blocks of the page (never true outside a block). */
export function isBelowTopBlocks(position: number | null): boolean {
  return position !== null && position >= TOP_BLOCK_COUNT;
}
