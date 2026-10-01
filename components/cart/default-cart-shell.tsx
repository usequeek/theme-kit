'use client';

import type { JSX } from 'react';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { CartShellProps } from '../../types/theme';
import { useHref } from '../../hooks/use-href';
import { useThemeStrings } from '../../provider';
import { useCheckoutStore } from '../../stores/checkout-store';
import { useRelatedProducts } from '../../hooks/use-related-products';
import { useCart } from '../../hooks/use-cart';
import { formatMoney } from '../../utils/format';
import { productRequiresVariant } from '../../utils/match-variant';
import { Image } from '../image';

/**
 * The cart page's shared, root design — every theme's shells/cart-shell.tsx
 * delegates to this (all thin passthroughs today) unless one chooses to
 * build its own; the override mechanism stays real, it's just unused today.
 */
export function DefaultCartShell({
  items,
  currency,
  total,
  empty,
  onIncrease,
  onDecrease,
  onRemove,
}: CartShellProps): JSX.Element {
  const href = useHref();
  const t = useThemeStrings();
  const { addProduct } = useCart();
  const vendorNote = useCheckoutStore((s) => s.vendorNote);
  const setVendorNote = useCheckoutStore((s) => s.setVendorNote);
  const [noteOpen, setNoteOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const relatedRef = useRef<HTMLDivElement>(null);

  const firstSlug = items.find((item) => item.slug)?.slug ?? '';
  const { products: related } = useRelatedProducts(firstSlug, 6);

  const scrollRelated = (dir: number): void => {
    const el = relatedRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('.core-cart-page__related-card');
    const amount = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  if (empty) {
    return (
      <div className="core-cart-page">
        <h1 className="core-cart-page__title">{t('cart.title')}</h1>
        <div className="core-cart-page__empty">
          <p>{t('cart.empty.message')}</p>
          <Link href={href('/')} className="core-checkout__back-link">{t('cart.empty.browse')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="core-cart-page">
      <h1 className="core-cart-page__title">{t('cart.title')}</h1>

      <div className="core-cart-page__grid">
        <div className="core-cart-page__main">
          <div className="core-cart-page__items-card">
            <ul className="core-cart-page__items">
              {items.map((item) => (
                <li key={`${item.shop_id}-${item.id}`} className="core-cart-page__item">
                  {item.image ? (
                    <Image src={item.image} alt={item.title} className="core-cart-page__item-img" />
                  ) : (
                    <div className="core-cart-page__item-img core-cart-page__item-img--placeholder" />
                  )}
                  <div className="core-cart-page__item-info">
                    <span className="core-cart-page__item-title">{item.title}</span>
                    <span className="core-cart-page__item-price">{t('cart.item.each', { price: formatMoney(item.unit_price, currency) })}</span>
                  </div>
                  <div className="core-cart-page__item-qty">
                    <button type="button" onClick={() => onDecrease(item.id, item.shop_id)} aria-label={t('cart.item.decrease', { title: item.title })}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => onIncrease(item.id, item.shop_id)} aria-label={t('cart.item.increase', { title: item.title })}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                  <span className="core-cart-page__item-total">{formatMoney(item.unit_price * item.quantity, currency)}</span>
                  <button type="button" className="core-cart-page__item-remove" onClick={() => onRemove(item.id, item.shop_id)} aria-label={t('cart.item.remove', { title: item.title })}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6 0v9.5A1.5 1.5 0 007.5 17h5a1.5 1.5 0 001.5-1.5V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {related.length > 0 ? (
            <section className="core-cart-page__related">
              <div className="core-cart-page__related-head">
                <h2>{t('cart.related.title')}</h2>
                <div className="core-cart-page__related-nav">
                  <button type="button" onClick={() => scrollRelated(-1)} aria-label={t('cart.related.prev')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 13L5 8l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <button type="button" onClick={() => scrollRelated(1)} aria-label={t('cart.related.next')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
              </div>
              <div className="core-cart-page__related-row" ref={relatedRef}>
                {related.map((product) => (
                  <div key={product.id} className="core-cart-page__related-card">
                    {product.media.thumbnail ? (
                      <Image
                        src={product.media.thumbnail}
                        alt={product.title}
                        className="core-cart-page__related-img"
                        variants={product.media.image_variants}
                        intent="avatar"
                      />
                    ) : (
                      <div className="core-cart-page__related-img core-cart-page__related-img--placeholder" />
                    )}
                    <div className="core-cart-page__related-info">
                      <span className="core-cart-page__related-title">{product.title}</span>
                      <span className="core-cart-page__related-price">{product.pricing.is_price_from ? t('cart.related.from', { price: formatMoney(product.pricing.sale_amount, currency) }) : formatMoney(product.pricing.sale_amount, currency)}</span>
                    </div>
                    {productRequiresVariant(product) ? (
                      <Link
                        className="core-cart-page__related-add"
                        href={href(`/products/${product.slug}`)}
                        aria-label={t('cart.related.choose', { title: product.title })}
                      >
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    ) : (
                    <button
                      type="button"
                      className="core-cart-page__related-add"
                      aria-label={t('cart.related.add', { title: product.title })}
                      onClick={() => addProduct(product)}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M2 3h2l2.4 9.6a1 1 0 001 .4H15a1 1 0 00.97-.76L17 7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="8" cy="17" r="1" fill="currentColor" />
                        <circle cx="14" cy="17" r="1" fill="currentColor" />
                      </svg>
                    </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="core-cart-page__summary">
          <div className="core-cart-page__summary-card">
            <h2 className="core-cart-page__summary-title">{t('cart.summary.title')}</h2>

            <button type="button" className="core-cart-page__note-toggle" onClick={() => setNoteOpen((v) => !v)}>
              {t('cart.note.toggle')}
              <span aria-hidden="true">{noteOpen ? '−' : '+'}</span>
            </button>
            {noteOpen ? (
              <textarea
                className="core-textarea core-cart-page__note-input"
                rows={3}
                value={vendorNote}
                onChange={(event) => setVendorNote(event.target.value)}
                placeholder={t('cart.note.placeholder')}
              />
            ) : null}

            <div className="core-cart-page__subtotal">
              <span>{t('cart.summary.subtotal')}</span>
              <strong>{formatMoney(total, currency)} {currency}</strong>
            </div>

            <label className="core-cart-page__terms">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
              <span>{t('cart.terms.agree')}<Link href={href('/policies')}>{t('cart.terms.policy')}</Link></span>
            </label>

            <Link
              href={href('/checkout')}
              className="core-cart-page__checkout-btn"
              aria-disabled={!agreed}
              onClick={(event) => { if (!agreed) event.preventDefault(); }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M2 3h2l2.4 9.6a1 1 0 001 .4H15a1 1 0 00.97-.76L17 7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="17" r="1" fill="currentColor" />
                <circle cx="14" cy="17" r="1" fill="currentColor" />
              </svg>
              {t('cart.checkout.action')}
            </Link>
            <Link href={href('/')} className="core-cart-page__continue-link">{t('cart.summary.continue')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
