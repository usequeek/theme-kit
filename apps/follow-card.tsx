'use client';

import type { JSX } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useStorefront } from '../provider';
import { useUserStore } from '../stores/user-store';
import { useAuthModalStore } from '../stores/auth-modal-store';
import { getQueekClient } from '../sdk/queek-client';

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

export function FollowCard({ display }: { display?: 'floating' | 'inline' } = {}): JSX.Element | null {
  const { config, vendor } = useStorefront();
  const followConfig = config.apps?.follow_card;
  const resolvedDisplay = display ?? followConfig?.display ?? 'floating';
  const user = useUserStore((s) => s.user);
  const openAuth = useAuthModalStore((s) => s.open);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(config.followers_count ?? 0);
  const [shareContact, setShareContact] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check follow status when user is logged in
  useEffect(() => {
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
  }, [user, vendor.slug]);

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
      const res = await client.post<FollowData>('/client/store/follow', {
        share_contact: shareContact,
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

  if (!followConfig?.enabled || dismissed || !checked) return null;
  // Don't show to users already following
  if (isFollowing) return null;

  const isFloating = resolvedDisplay === 'floating';
  const posClass = isFloating
    ? POSITION_CLASS[followConfig.position ?? 'bottom-right'] ?? POSITION_CLASS['bottom-right']
    : '';

  return (
    <div
      className={`core-follow-card ${isFloating ? `core-follow-card--floating ${posClass}` : 'core-follow-card--inline'}`}
      role="complementary"
      aria-label="Follow this store"
    >
      {isFloating && (
        <button
          type="button"
          className="core-follow-card__dismiss"
          onClick={handleDismiss}
          aria-label="Don't show again"
          title="Don't show again"
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
            Follow {vendor.name ?? 'this store'}
          </p>
          <p className="core-follow-card__sub">
            Get notified about new arrivals and exclusive offers.
          </p>
          {followersCount > 0 && (
            <p className="core-follow-card__count">
              {followersCount.toLocaleString()} {followersCount === 1 ? 'follower' : 'followers'}
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
        <span>Share my contact info with this store</span>
      </label>
      <button
        type="button"
        className="core-follow-card__btn"
        onClick={handleFollow}
        disabled={loading}
      >
        {loading ? 'Following...' : 'Follow'}
      </button>
    </div>
  );
}
