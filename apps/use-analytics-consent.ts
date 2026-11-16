'use client';

import { createContext, createElement, useCallback, useContext, useLayoutEffect, useSyncExternalStore, type JSX, type ReactNode } from 'react';

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

/**
 * Whether the shopper must answer before anything non-essential runs. The storefront decides it per request
 * (the visitor's country, the store's own `show` setting) and tells the kit through `ConsentRegimeProvider`;
 * without a provider every visitor must answer, exactly as before.
 */
const ConsentRegimeContext = createContext<boolean>(true);

/** The React-free readers' copy of the regime (the ad-pixel event subscribers fire outside React). Set only in the browser. */
let regimeRequired = true;

/**
 * Stores whose shopper opened "Cookie preferences" while consent is not required. A reopened question must read
 * unanswered even though an earlier answer is still stored: the stored answer stays untouched until the shopper
 * decides again, so closing the tab mid-review loses nothing. In memory on purpose.
 */
const reviewing = new Set<string>();

/**
 * Tells the kit whether this visitor must answer before analytics or ad pixels run. `required={false}` means a
 * shopper with no stored answer reads as granted (never written to the record: only a click writes it), Global
 * Privacy Control still reads as declined, and "Cookie preferences" in the footer reopens the question so the
 * shopper can decline. Default (no provider) is `required`.
 */
export function ConsentRegimeProvider({ required, children }: { required: boolean; children: ReactNode }): JSX.Element {
  useLayoutEffect(() => {
    regimeRequired = required;
    return () => {
      regimeRequired = true;
    };
  }, [required]);

  return createElement(ConsentRegimeContext.Provider, { value: required }, children);
}

/**
 * One category's answer. Order matters: Global Privacy Control declines; a question the shopper reopened is
 * unanswered; a stored answer wins; with no answer, a region that does not require consent grants and the rest ask.
 */
function readDecision(vendorId: string, category: keyof ConsentChoice, required: boolean): boolean | null {
  if (hasGlobalPrivacyControl()) return false;
  if (reviewing.has(vendorId)) return null;
  const record = readStore()[vendorId];
  if (record && record.version === CONSENT_VERSION && typeof record[category] === 'boolean') return record[category];
  return required ? null : true;
}

/**
 * The STORED marketing decision, read synchronously (no React): true only for
 * an explicit accept (GPC counts as a decline). The ad-pixel event subscribers
 * use it so the first event on a page, which can fire before any hook has
 * re-rendered, is judged by what the shopper actually chose.
 */
export function readStoredMarketingConsent(vendorId: string | undefined): boolean {
  if (!vendorId || typeof window === 'undefined') return false;
  return readDecision(vendorId, 'marketing', regimeRequired) === true;
}

/**
 * Per-vendor consent in two independent categories. `decision` (analytics) and
 * `marketing` are each `null` until the visitor has chosen (or GPC decided for
 * them) — the banner and Consent Mode's default state both key off that.
 * Granting analytics never grants marketing. Where consent is required (the
 * default, no provider) marketing (ad pixels) is denied until an explicit accept
 * and `reset` forgets this vendor's record, which reopens the banner. Under
 * `ConsentRegimeProvider required={false}` a category with no stored answer reads
 * as granted (marketing included, nothing is written to the record), GPC still
 * declines, and `reset` leaves the stored record in place and marks the question
 * reopened (both read `null`) until `decide` runs.
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
  const required = useContext(ConsentRegimeContext);
  const decision = useSyncExternalStore(
    subscribe,
    () => (vendorId ? readDecision(vendorId, 'analytics', required) : null),
    () => null,
  );
  const marketing = useSyncExternalStore(
    subscribe,
    () => (vendorId ? readDecision(vendorId, 'marketing', required) : null),
    () => null,
  );

  const gpc = useSyncExternalStore(subscribe, hasGlobalPrivacyControl, () => false);

  const decide = useCallback(
    (choice: ConsentChoice) => {
      if (!vendorId) return;
      reviewing.delete(vendorId);
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
    if (required) {
      const store = readStore();
      delete store[vendorId];
      writeStore(store);
    } else {
      reviewing.add(vendorId);
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [vendorId, required]);

  return { decision, marketing, gpc, decide, reset };
}
