'use client';

import { useContext, type JSX } from 'react';
import { StorefrontContext } from '../provider';
import { ConsentPreferencesLink } from '../apps/consent-preferences-link';
import { poweredByQueekUrl } from '../utils/powered-by';

/** Props for {@link PoweredByQueek}. */
export interface PoweredByQueekProps {
  /** Extra class so a footer can position the link — styling stays theme-owned. */
  className?: string;
  /**
   * Lets a caller hide the attribution link from a prop. Defaults to false. The
   * store's own switch (`config.display.show_powered_by`, on by default) hides it
   * the same way, so a theme passes nothing for it. Neither hides the cookie
   * preferences link, which is not attribution.
   */
  hidden?: boolean;
}

/**
 * The storefront attribution link, owned by the kit: themes import and place
 * it, and never re-implement it.
 *
 * A merchant may hide the credit (Display, "Show Powered by Queek"): it is on
 * unless `config.display.show_powered_by` is `false`, so a store that never
 * saved the setting, or a payload without it, shows the credit.
 *
 * Required on every footer variant of every theme (enforced by the
 * `theme/footer-shows-powered-by` rule of `npm run check`). The link
 * target (`https://usequeek.com/business`) and `rel` are the contract —
 * do not change them. The href is tagged `utm_source=powered_by`,
 * `utm_medium=storefront`, `utm_campaign=<store slug>` via `poweredByQueekUrl`
 * (read from the storefront context, so themes pass nothing; no provider means
 * no campaign, never an error). Markup carries `core-powered-by` classes so each theme
 * styles it in its own `theme.css`; `className` goes on the link itself.
 *
 * It also carries the shopper's cookie preferences link
 * ({@link ConsentPreferencesLink}), so the one footer slot every theme already
 * has is also where a shopper reopens their cookie choice. That is why the
 * output is one `core-powered-by-group` element holding both: a footer row
 * keeps its child count, and the preferences link sits directly before the
 * attribution. The link renders only when the store uses analytics or an ad
 * pixel and the shopper has chosen; otherwise the group holds just the
 * attribution. A footer needs no extra markup, and a theme may restyle
 * `core-consent-link` in its own `theme.css` (the kit gives it a neutral
 * look).
 */
export function PoweredByQueek({ className, hidden = false }: PoweredByQueekProps): JSX.Element | null {
  const store = useContext(StorefrontContext);
  const vendor = store?.vendor;

  if (hidden || store?.config?.display?.show_powered_by === false) return <ConsentPreferencesLink />;

  return (
    <span className="core-powered-by-group">
      <ConsentPreferencesLink />
      <a
        href={poweredByQueekUrl(vendor?.slug)}
        target="_blank"
        rel="noopener noreferrer"
        className={className ? `core-powered-by ${className}` : 'core-powered-by'}
      >
        Powered by <strong className="core-powered-by__brand">Queek</strong>
      </a>
    </span>
  );
}
