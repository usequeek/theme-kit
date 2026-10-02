'use client';

import { useContext, type JSX } from 'react';
import { StorefrontContext } from '../provider';
import { poweredByQueekUrl } from '../utils/powered-by';

export interface PoweredByQueekProps {
  /** Extra class so a footer can position the link — styling stays theme-owned. */
  className?: string;
  /**
   * Reserved for a future plan perk (paid removal). Defaults to false and is
   * always rendered in v1 — there is no merchant-facing toggle for it.
   */
  hidden?: boolean;
}

/**
 * Core-owned storefront attribution — the `ProductMetafields` pattern: themes
 * import-and-place it, never re-implement it.
 *
 * Required on every footer variant of every theme (enforced by `theme-check`
 * rule `theme/footer-shows-powered-by` in the storefront repo). The link
 * target (`https://usequeek.com/business`) and `rel` are the contract —
 * do not change them. The href is tagged `utm_source=powered_by`,
 * `utm_medium=storefront`, `utm_campaign=<store slug>` via `poweredByQueekUrl`
 * (read from the storefront context, so themes pass nothing; no provider means
 * no campaign, never an error). Markup carries `core-powered-by` classes so each theme
 * styles it in its own `theme.css`; no kit CSS ships for it.
 */
export function PoweredByQueek({ className, hidden = false }: PoweredByQueekProps): JSX.Element | null {
  const vendor = useContext(StorefrontContext)?.vendor;

  if (hidden) return null;

  return (
    <a
      href={poweredByQueekUrl(vendor?.slug)}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `core-powered-by ${className}` : 'core-powered-by'}
    >
      Powered by <strong className="core-powered-by__brand">Queek</strong>
    </a>
  );
}
