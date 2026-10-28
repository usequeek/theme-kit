'use client';

import type { JSX } from 'react';
import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import { useStorefront, useStorefrontLocale, useThemeStrings } from '../provider';
import { useUserStore } from '../stores/user-store';
import { useAuthModalStore } from '../stores/auth-modal-store';
import { getQueekClient } from '../sdk/queek-client';
import { formatCount } from '../utils/format';

interface FollowData {
  following: boolean;
  shared_contact: boolean;
  followers_count: number;
}

const DISMISS_KEY = 'queek_follow_card_dismissed';

function getDismissedVendors(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistDismiss(vendorId: string) {
  try {
    const list = getDismissedVendors();
    if (!list.includes(vendorId)) {
      list.push(vendorId);
      localStorage.setItem(DISMISS_KEY, JSON.stringify(list));
    }
  } catch { /* noop */ }
}

const POSITION_CLASS: Record<string, string> = {
  'bottom-right': 'core-follow-card--bottom-right',
  'bottom-left': 'core-follow-card--bottom-left',
  'center-right': 'core-follow-card--center-right',
  'center-left': 'core-follow-card--center-left',
};

/**
 * Where the merchant put the card: `footer` is the inline mount a theme places in its footer, anything else
 * (`floating`, and the retired `block`) is the floating mount the shell places.
 */
function settingFor(display: string | undefined): 'floating' | 'footer' {
  return display === 'footer' ? 'footer' : 'floating';
}

/**
 * The inline mounts currently rendered by a theme, so the floating mount can tell that a theme has no footer mount
 * and take the card itself: a card the merchant switched on is always reachable, and never shown twice.
 */
let inlineMounts = 0;
const mountListeners = new Set<() => void>();

function subscribeToMounts(listener: () => void): () => void {
  mountListeners.add(listener);
  return () => {
    mountListeners.delete(listener);
  };
}

function registerInlineMount(): () => void {
  inlineMounts += 1;
  mountListeners.forEach((notify) => notify());
  return () => {
    inlineMounts -= 1;
    mountListeners.forEach((notify) => notify());
  };
}

/**
 * The store's follow card, shown when the merchant has turned it on, in the one place they chose: the shell mounts
 * `display="floating"` and a theme's footer mounts `display="inline"`; each renders only when the merchant's setting
 * matches its mount, and a theme with no footer mount shows the floating card instead. Renders nothing when the app
 * is off.
 *
 * Sharing contact details is the shopper's own choice: the box starts unticked and nothing is sent unless it is ticked.
 * A shopper who follows sees a compact "Following · Unfollow" state instead of the prompt.
 */
export function FollowCard({ display }: { display?: 'floating' | 'inline' } = {}): JSX.Element | null {
  const { config, vendor } = useStorefront();
  const t = useThemeStrings();
  const locale = useStorefrontLocale();
  const followConfig = config.apps?.follow_card;
  const mount = display === 'inline' ? 'inline' : 'floating';
  const setting = settingFor(followConfig?.display);
  const registersInline = mount === 'inline' && setting === 'footer' && !!followConfig?.enabled;
  // The server answer is "a footer mount exists" so a footer-placed card is never painted floating before hydration.
  const footerMountExists = useSyncExternalStore(subscribeToMounts, () => inlineMounts > 0, () => true);
  const shows = mount === 'inline' ? setting === 'footer' : setting === 'floating' || !footerMountExists;
  const user = useUserStore((s) => s.user);
  const openAuth = useAuthModalStore((s) => s.open);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(config.followers_count ?? 0);
  const [shareContact, setShareContact] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => (registersInline ? registerInlineMount() : undefined), [registersInline]);

  // Check follow status when user is logged in
  useEffect(() => {
    if (!shows) return;
    if (!user || !vendor.slug) {
      setChecked(true);
      return;
    }
    const client = getQueekClient(vendor.slug);
    client.get<FollowData>('/client/store/follow/status')
      .then((res) => {
        setIsFollowing(res.data?.following ?? false);
        setFollowersCount(res.data?.followers_count ?? followersCount);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [user, vendor.slug, shows]);

  // Check persistent dismiss
  useEffect(() => {
    if (vendor.id && getDismissedVendors().includes(vendor.id)) {
      setDismissed(true);
    }
  }, [vendor.id]);

  const handleFollow = useCallback(async () => {
    if (!user) {
      openAuth('login');
      return;
    }

    setLoading(true);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      // `contact_opt_in` is the only consent the API reads; the older `share_contact` is ignored as not consent.
      const res = await client.post<FollowData>('/client/store/follow', {
        contact_opt_in: shareContact,
      });
      setIsFollowing(res.data?.following ?? true);
      setFollowersCount(res.data?.followers_count ?? followersCount + 1);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [user, vendor.slug, openAuth, shareContact]);

  const handleUnfollow = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      const res = await client.post<FollowData>('/client/store/follow?_method=DELETE', {});
      setIsFollowing(res.data?.following ?? false);
      setFollowersCount(res.data?.followers_count ?? Math.max(0, followersCount - 1));
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [user, vendor.slug]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (vendor.id) persistDismiss(vendor.id);
  }, [vendor.id]);

  if (!followConfig?.enabled || !shows || !checked) return null;

  const storeName = vendor.name ?? t('follow.thisstore');
  const isFloating = mount === 'floating';
  const posClass = isFloating
    ? POSITION_CLASS[followConfig.position ?? 'bottom-right'] ?? POSITION_CLASS['bottom-right']
    : '';
  const placement = isFloating ? `core-follow-card--floating ${posClass}` : 'core-follow-card--inline';

  // A shopper who follows still sees the card, compact, with the way out: Unfollow. Dismissing the prompt never hides it.
  if (isFollowing) {
    return (
      <div className={`core-follow-card core-follow-card--compact ${placement}`} role="complementary" aria-label={t('follow.following')}>
        <span className="core-follow-card__state">{t('follow.following')}</span>
        <button type="button" className="core-follow-card__unfollow" onClick={handleUnfollow} disabled={loading}>
          {loading ? t('follow.leaving') : t('follow.unfollow')}
        </button>
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div
      className={`core-follow-card ${placement}`}
      role="complementary"
      aria-label={t('follow.aria')}
    >
      {isFloating && (
        <button
          type="button"
          className="core-follow-card__dismiss"
          onClick={handleDismiss}
          aria-label={t('follow.dismiss')}
          title={t('follow.dismiss')}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      )}

      <div className="core-follow-card__body">
        {vendor.logo && (
          <img
            src={vendor.logo}
            alt={vendor.name ?? ''}
            className="core-follow-card__logo"
          />
        )}
        <div className="core-follow-card__text">
          <p className="core-follow-card__title">
            {t('follow.title', { name: storeName })}
          </p>
          <p className="core-follow-card__sub">
            {t('follow.tagline')}
          </p>
          {followersCount > 0 && (
            <p className="core-follow-card__count">
              {t('follow.count', { count: followersCount, n: formatCount(followersCount, locale) })}
            </p>
          )}
        </div>
      </div>

      <label className="core-follow-card__consent">
        <input
          type="checkbox"
          checked={shareContact}
          onChange={(e) => setShareContact(e.target.checked)}
          className="core-follow-card__checkbox"
        />
        <span>{t('follow.share', { name: storeName })}</span>
      </label>
      <button
        type="button"
        className="core-follow-card__btn"
        onClick={handleFollow}
        disabled={loading}
      >
        {loading ? t('follow.busy') : t('follow.action')}
      </button>
    </div>
  );
}
