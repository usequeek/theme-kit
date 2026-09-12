'use client';

import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { Image } from '../image';

/**
 * First section of the checkout form — shows who's checking out. Ordering
 * requires auth (`canCheckout` in checkout-controller.tsx), so unlike
 * Shopify's guest-friendly email field this is purely an identity
 * confirmation: avatar + email when signed in, a sign-in prompt otherwise.
 */
export function CheckoutContactSection(): JSX.Element {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  if (!isAuthenticated || !user) {
    return (
      <section className="core-checkout__section core-checkout-contact">
        <div className="core-checkout-contact__row">
          <span className="core-checkout-contact__label">Contact</span>
          <button
            type="button"
            className="core-checkout-contact__signin"
            onClick={() => openAuthModal('login')}
          >
            Sign in
          </button>
        </div>
      </section>
    );
  }

  const initial = (user.first_name || user.name || '?').charAt(0).toUpperCase();
  const contact = user.email || user.phone || '';

  return (
    <section className="core-checkout__section core-checkout-contact">
      <div className="core-checkout-contact__row" ref={menuRef}>
        <div className="core-checkout-contact__identity">
          {user.avatar ? (
            <Image src={user.avatar} alt={user.name} className="core-checkout-contact__avatar" />
          ) : (
            <span className="core-checkout-contact__avatar core-checkout-contact__avatar--initial">{initial}</span>
          )}
          <span className="core-checkout-contact__email">{contact}</span>
        </div>
        <div className="core-checkout-contact__menu-wrap">
          <button
            type="button"
            className="core-checkout-contact__menu-btn"
            aria-label="Account options"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <circle cx="10" cy="4" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="core-checkout-contact__menu">
              <button type="button" onClick={() => { setMenuOpen(false); logout(); }}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
