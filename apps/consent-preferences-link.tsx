'use client';

import { useContext, type JSX } from 'react';
import { StorefrontContext, useThemeStrings } from '../provider';
import { consentOffers, consentPending } from './consent-offers';
import { useAnalyticsConsent } from './use-analytics-consent';

function ConsentPreferencesButton({ onReset }: { onReset: () => void }): JSX.Element {
  const t = useThemeStrings();

  return (
    <button type="button" className="core-consent-link" onClick={onReset}>
      {t('consent.preferences')}
    </button>
  );
}

/**
 * The shopper's way back into their cookie choice, rendered by
 * `PoweredByQueek` in every theme footer (withdrawing consent must be as easy
 * as giving it). A plain inline button, never a floating one.
 *
 * Shown only when the store uses analytics or an ad pixel, the shopper has
 * answered every question it asks, and the browser is not sending Global
 * Privacy Control (that is already a decline: there is nothing to reopen).
 * Clicking it brings the banner back for this store only: where consent is required it forgets the stored choice, and outside
 * those regions (`ConsentRegimeProvider required={false}`) it marks the question reopened and keeps the stored choice until the shopper decides.
 * Renders nothing on the server and while hydrating (the decision is read from
 * the browser), outside a `StorefrontProvider`, and for a store with no consent
 * category. Reads the context directly so it never throws without a provider.
 */
export function ConsentPreferencesLink(): JSX.Element | null {
  const context = useContext(StorefrontContext);
  const vendorId = context?.vendor?.id;
  const { decision, marketing, gpc, reset } = useAnalyticsConsent(vendorId);
  const offers = consentOffers(context?.config);

  if (!vendorId || !offers || gpc || consentPending(offers, decision, marketing)) return null;

  return <ConsentPreferencesButton onReset={reset} />;
}
