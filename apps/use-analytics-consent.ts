'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Consent is keyed by vendor id inside one shared localStorage record — the
 * storefront is path-routed, so multiple vendors can share a single browser
 * origin. A flat per-origin flag would leak one vendor's consent choice onto
 * another's storefront. Mirrors FollowCard's DISMISS_KEY vendor-id-list
 * pattern (see follow-card.tsx) for the same reason.
 */
const STORAGE_KEY = 'queek_consent';

/**
 * Bump when the consent question itself changes shape — invalidates old records.
 * Adding the marketing category did NOT bump it: a record without a `marketing`
 * field reads as marketing "not asked yet" (never granted), so analytics-only
 * stores keep their shoppers' answers and only stores with an ad pixel re-ask.
 */
const CONSENT_VERSION = 1;

interface ConsentRecord {
  analytics?: boolean;
  marketing?: boolean;
  version: number;
  decidedAt: string;
}

/** Categories a decision can set; a category left out keeps its earlier answer. */
export interface ConsentChoice {
  analytics?: boolean;
  marketing?: boolean;
}

type ConsentStore = Record<string, ConsentRecord>;

function readStore(): ConsentStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStore(store: ConsentStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* noop */
  }
}

/**
 * CCPA/CPRA requires honoring this browser-level opt-out signal as a valid
 * "do not sell/share" request — treated as an immediate decline, no banner
 * and no preferences link, since there's nothing left to ask or withdraw.
 */
function hasGlobalPrivacyControl(): boolean {
  return (
    typeof navigator !== 'undefined'
    && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

/** Fired on every same-tab write, so each hook instance re-reads the one stored record. */
const CHANGE_EVENT = 'queek:consent-change';

/** Same-tab writes announce themselves; `storage` covers another tab deciding. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readDecision(vendorId: string, category: keyof ConsentChoice): boolean | null {
  if (hasGlobalPrivacyControl()) return false;
  const record = readStore()[vendorId];
  if (!record || record.version !== CONSENT_VERSION) return null;
  return typeof record[category] === 'boolean' ? record[category] : null;
}

/**
 * The STORED marketing decision, read synchronously (no React): true only for
 * an explicit accept (GPC counts as a decline). The ad-pixel event subscribers
 * use it so the first event on a page, which can fire before any hook has
 * re-rendered, is judged by what the shopper actually chose.
 */
export function readStoredMarketingConsent(vendorId: string | undefined): boolean {
  if (!vendorId || typeof window === 'undefined') return false;
  return readDecision(vendorId, 'marketing') === true;
}

/**
 * Per-vendor consent in two independent categories. `decision` (analytics) and
 * `marketing` are each `null` until the visitor has chosen (or GPC decided for
 * them) — the banner and Consent Mode's default state both key off that.
 * Granting analytics never grants marketing. Marketing (ad pixels) is denied by
 * default and stays denied until an explicit accept. `reset` forgets this
 * vendor's record only, which reopens the banner.
 */
export function useAnalyticsConsent(vendorId: string | undefined): {
  decision: boolean | null;
  marketing: boolean | null;
  /**
   * The browser sends Global Privacy Control. Both decisions then read `false`
   * (a decline), indistinguishable from a shopper's own "no", so a caller that
   * must tell the two apart (the footer preferences link) reads this. `false`
   * on the server and during hydration.
   */
  gpc: boolean;
  decide: (choice: ConsentChoice) => void;
  reset: () => void;
} {
  // localStorage IS the store; every consumer (banner, footer preferences
  // link, analytics loader) reads the same record and re-renders on the same
  // change event — a decision in the banner reaches the analytics loader
  // without a reload, which per-instance state never did. `null` on the
  // server and during hydration.
  const decision = useSyncExternalStore(
    subscribe,
    () => (vendorId ? readDecision(vendorId, 'analytics') : null),
    () => null,
  );
  const marketing = useSyncExternalStore(
    subscribe,
    () => (vendorId ? readDecision(vendorId, 'marketing') : null),
    () => null,
  );

  const gpc = useSyncExternalStore(subscribe, hasGlobalPrivacyControl, () => false);

  const decide = useCallback(
    (choice: ConsentChoice) => {
      if (!vendorId) return;
      const store = readStore();
      const previous = store[vendorId]?.version === CONSENT_VERSION ? store[vendorId] : undefined;
      store[vendorId] = {
        ...(previous?.analytics !== undefined ? { analytics: previous.analytics } : {}),
        ...(previous?.marketing !== undefined ? { marketing: previous.marketing } : {}),
        ...choice,
        version: CONSENT_VERSION,
        decidedAt: new Date().toISOString(),
      };
      writeStore(store);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [vendorId],
  );

  const reset = useCallback(() => {
    if (!vendorId) return;
    const store = readStore();
    delete store[vendorId];
    writeStore(store);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [vendorId]);

  return { decision, marketing, gpc, decide, reset };
}
