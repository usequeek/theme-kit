'use client';

import { createContext, useContext, type ComponentType, type JSX, type ReactNode } from 'react';

/**
 * Where a theme renders installed app blocks. Themes import this module,
 * never app code — which framework and which storefront serves the blocks
 * is Queek's decision, and a theme written against this slot keeps working
 * when that changes. Only the host's registration does.
 *
 *   import { AppBlocks } from '@usequeek/theme-kit/apps';
 *   <AppBlocks target="product" productId={product.slug} />
 *
 * The slot is deliberately presentation-free: the host registers its real
 * placement component (fetch, loading shell, Queek-rendered blocks) through
 * `AppBlocksProvider`, and the slot renders whatever the host registered.
 * No provider (or none yet on the server) renders nothing — never an error,
 * never a shifted layout.
 */

export type AppBlocksTarget = 'product';

export interface AppBlocksRendererProps {
  target: AppBlocksTarget;
  productId?: string;
  vendorSlug?: string;
}

export type AppBlocksRenderer = ComponentType<AppBlocksRendererProps>;

const AppBlocksContext = createContext<AppBlocksRenderer | null>(null);

/** The host wraps the theme tree and registers its placement component. */
export function AppBlocksProvider({
  renderBlocks,
  children,
}: {
  renderBlocks: AppBlocksRenderer;
  children: ReactNode;
}): JSX.Element {
  return <AppBlocksContext.Provider value={renderBlocks}>{children}</AppBlocksContext.Provider>;
}

/** The theme-facing slot: renders the host's component, or nothing. */
export function AppBlocks({ target, productId, vendorSlug }: AppBlocksRendererProps): JSX.Element | null {
  const RenderBlocks = useContext(AppBlocksContext);
  if (RenderBlocks === null) return null;
  return <RenderBlocks target={target} productId={productId} vendorSlug={vendorSlug} />;
}
