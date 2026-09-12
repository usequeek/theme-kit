'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { Page } from '../../types/page';
import { useHref } from '../../hooks/use-href';
import { usePolicyModalStore } from '../../stores/policy-modal-store';
import { PageRenderer } from '../../page-renderer';

/**
 * Checkout-footer policy links (refund, shipping, privacy, terms — whatever
 * the vendor has published). Clicking opens the policy content inline in a
 * modal instead of navigating away from checkout; the modal still links to
 * the real `/[vendor]/[slug]` page for the full read.
 */
// SSR-safe "has this hydrated on the client yet" check for the portal target
// (document.body doesn't exist during SSR) — no subscription needed, the
// snapshot just flips once from the server render to the client render.
function subscribeNoop(): () => void {
  return () => {};
}

export function PolicyLinks({ policies }: { policies: Page[] }): JSX.Element | null {
  const activeSlug = usePolicyModalStore((s) => s.activeSlug);
  const open = usePolicyModalStore((s) => s.open);
  const close = usePolicyModalStore((s) => s.close);
  const href = useHref();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const active = policies.find((p) => p.slug === activeSlug) ?? null;

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, close]);

  if (policies.length === 0) return null;

  // Portaled to document.body — this component renders inline among the
  // checkout form's sections (width-capped by `.core-checkout__page-form > *`),
  // and a plain nested overlay would inherit that constraint instead of
  // covering the viewport. A portal makes the modal immune to whatever
  // ancestor layout the page around it does, now or later.
  const modal = active && mounted
    ? createPortal(
      <div className="core-policy-modal__overlay" role="presentation" onClick={close}>
        <div
          className="core-policy-modal"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="core-policy-modal__head">
            <h2 className="core-policy-modal__title">{active.title}</h2>
            <button type="button" className="core-policy-modal__close" aria-label="Close" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="core-policy-modal__body">
            <PageRenderer blocks={active.content} />
          </div>
          <div className="core-policy-modal__foot">
            <Link href={href(`/${active.slug}`)} className="core-policy-modal__full-link" onClick={close}>
              View full page
            </Link>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <nav className="core-checkout-policies" aria-label="Store policies">
        {policies.map((policy) => (
          <button
            key={policy.id}
            type="button"
            className="core-checkout-policies__link"
            onClick={() => open(policy.slug)}
          >
            {policy.title}
          </button>
        ))}
      </nav>
      {modal}
    </>
  );
}
