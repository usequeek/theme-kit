'use client';

import type { JSX } from 'react';
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { Menu } from './types/menu';
import type { ReviewItem } from './types/block';
import type { Post } from './types/page';
import type { Product } from './types/product';
import type { StorefrontConfig, VendorProfile } from './types/vendor';
import { getBrandCssVariables } from './utils/brand';
import { parseLocaleCode } from './utils/locale';
import { DesignTokenPreviewListener } from './design-token-preview';

export interface StorefrontPreviewData {
  products?: Product[];
  /** Vendor-scope reviews for preview surfaces. `useReviews` reads these the
   *  same way `useProducts` reads `products` — without them a review-backed
   *  section renders nothing in the preview, style guide and section library,
   *  which is what a vendor browses before choosing it. */
  reviews?: ReviewItem[];
  categories?: Array<{
    id: string;
    slug: string;
    name: string;
    image?: string | null;
    products_count?: number;
  }>;
  posts?: Post[];
}

interface StorefrontContextValue {
  vendor: VendorProfile;
  config: StorefrontConfig;
  menus: Menu[];
  previewData?: StorefrontPreviewData;
  basePath: string;
  /** slug => 'full' | 'bare', for ShellInner to decide the CURRENT page's
   * header/footer without a per-navigation fetch. See VendorShell. */
  pagesChrome: Record<string, 'full' | 'bare'>;
  /** Validated request locale (null = primary). Browser hooks read it via
   * `useStorefrontLocale()` and send `?locale=` when it is set. */
  locale: string | null;
}

export const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function StorefrontProvider({
  vendor,
  config,
  menus,
  previewData,
  basePath,
  pagesChrome,
  locale,
  children,
}: {
  vendor: VendorProfile;
  config: StorefrontConfig;
  menus: Menu[];
  previewData?: StorefrontPreviewData;
  basePath?: string;
  pagesChrome?: Record<string, 'full' | 'bare'>;
  /**
   * Request locale for translated reads (the storefront host passes its
   * `x-queek-locale` request header through). Optional — absent/invalid
   * means the primary locale, exactly as before. Themes never set this;
   * the host owns it, like `basePath`.
   */
  locale?: string | null;
  children: ReactNode;
}): JSX.Element {
  const resolvedBasePath = basePath ?? `/${vendor.slug ?? ''}`;
  const resolvedLocale = parseLocaleCode(locale);
  const value = useMemo(
    () => ({
      vendor,
      config,
      menus,
      previewData,
      basePath: resolvedBasePath,
      pagesChrome: pagesChrome ?? {},
      locale: resolvedLocale,
    }),
    [config, menus, previewData, vendor, resolvedBasePath, pagesChrome, resolvedLocale],
  );
  const brandRootRef = useRef<HTMLDivElement>(null);

  return (
    <StorefrontContext.Provider value={value}>
      <div ref={brandRootRef} data-brand-root style={getBrandCssVariables(config.brand, config)}>
        <DesignTokenPreviewListener targetRef={brandRootRef} />
        {children}
      </div>
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): StorefrontContextValue {
  const context = useContext(StorefrontContext);

  if (!context) {
    throw new Error('useStorefront must be used within StorefrontProvider');
  }

  return context;
}

/**
 * Validated request locale for translated reads (`null` = primary).
 * Browser hooks send `?locale=` when this is set and key their client
 * caches by it, so two locales never share an entry. No provider prop →
 * null, and every hook behaves exactly as before.
 */
export function useStorefrontLocale(): string | null {
  const context = useContext(StorefrontContext);

  if (!context) {
    throw new Error('useStorefrontLocale must be used within StorefrontProvider');
  }

  return context.locale ?? null;
}
