'use client';
import type { JSX } from 'react';
import Link from 'next/link';
import type { CheckoutShellProps } from '../../types/theme';
import { formatMoney } from '../../utils/format';
import { useHref } from '../../hooks/use-href';
import { CheckoutContactSection } from './checkout-contact';
import { PolicyLinks } from './policy-links';

export function DefaultCheckoutShell({
  cartItems,
  deliveryModes,
  addressPicker,
  deliverySourcePicker,
  shippingZonePicker,
  schedulePicker,
  paymentPicker,
  promoInput,
  noteInputs,
  feesBreakdown,
  deliveryMessage,
  submitButton,
  activeTab,
  onTabChange,
  totalCount,
  subtotal,
  currency,
  mode = 'panel',
  policies,
}: CheckoutShellProps): JSX.Element {
  const href = useHref();

  if (mode === 'page') {
    if (totalCount === 0) {
      return (
        <div className="core-checkout core-checkout--page">
          <div className="core-checkout__empty">
            <p>Your cart is empty.</p>
            <Link href={href('/')} className="core-checkout__back-link">Browse products</Link>
          </div>
        </div>
      );
    }

    return (
      <div className="core-checkout core-checkout--page">
        <div className="core-checkout__page-grid">
          {/* Left pane: white — form */}
          <div className="core-checkout__page-form">
            <div className="core-checkout__page-header">
              <Link href={href('/')} className="core-checkout__back">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="14" height="14">
                  <path d="M10 13L5 8l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Continue shopping
              </Link>
            </div>
            <CheckoutContactSection />
            <section className="core-checkout__section">
              <h3 className="core-checkout__section-title">How you&apos;ll get it</h3>
              {deliveryModes}
            </section>
            {shippingZonePicker ? (
              <section className="core-checkout__section">
                <h3 className="core-checkout__section-title">Shipping zone</h3>
                {shippingZonePicker}
              </section>
            ) : null}
            {addressPicker ? (
              <section className="core-checkout__section">
                <h3 className="core-checkout__section-title">Delivery address</h3>
                {addressPicker}
              </section>
            ) : null}
            {deliverySourcePicker ? (
              <section className="core-checkout__section">
                {deliverySourcePicker}
              </section>
            ) : null}
            {schedulePicker ? (
              <section className="core-checkout__section">
                <h3 className="core-checkout__section-title">Schedule</h3>
                {schedulePicker}
              </section>
            ) : null}
            <section className="core-checkout__section">
              <h3 className="core-checkout__payment-title">Payment</h3>
              <p className="core-checkout__payment-subtitle">All transactions are secure and encrypted.</p>
              {paymentPicker}
            </section>
            <section className="core-checkout__section">
              {noteInputs}
            </section>
            <PolicyLinks policies={policies} />
          </div>

          {/* Right pane: off-white — order summary */}
          <div className="core-checkout__page-summary">
            <div className="core-checkout__summary-card">
              <h3 className="core-checkout__section-title">Order summary</h3>
              {cartItems}
              <div className="core-checkout__summary-promo">{promoInput}</div>
              <div className="core-checkout__summary-fees">{feesBreakdown}</div>
              {deliveryMessage ? (
                <div className={`core-checkout__delivery-message core-checkout__delivery-message--${deliveryMessage.type}`}>
                  {deliveryMessage.message}
                </div>
              ) : null}
              <div className="core-checkout__actions">{submitButton}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Panel / modal mode (original tab behavior)
  return (
    <div className="core-checkout">
      <div className="core-checkout__tabs">
        <button
          type="button"
          className={`core-checkout__tab${activeTab === 'summary' ? ' is-active' : ''}`}
          onClick={() => onTabChange('summary')}
        >
          Summary {totalCount > 0 ? `(${totalCount})` : ''}
        </button>
        <button
          type="button"
          className={`core-checkout__tab${activeTab === 'checkout' ? ' is-active' : ''}`}
          onClick={() => onTabChange('checkout')}
          disabled={totalCount === 0}
        >
          Checkout
        </button>
      </div>

      {activeTab === 'summary' ? (
        <div className="core-checkout__summary">
          {totalCount === 0 ? (
            <div className="core-checkout__empty"><p>Your cart is empty</p></div>
          ) : (
            <>
              {cartItems}
              <div className="core-checkout__summary-footer">
                <div className="core-checkout__subtotal">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal, currency)}</span>
                </div>
                <button type="button" className="core-submit-btn" onClick={() => onTabChange('checkout')}>
                  Proceed to checkout
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="core-checkout__form">
          <section className="core-checkout__section">{deliveryModes}</section>
          {shippingZonePicker ? <section className="core-checkout__section">{shippingZonePicker}</section> : null}
          {addressPicker ? <section className="core-checkout__section">{addressPicker}</section> : null}
          {deliverySourcePicker ? <section className="core-checkout__section">{deliverySourcePicker}</section> : null}
          {schedulePicker ? <section className="core-checkout__section">{schedulePicker}</section> : null}
          <section className="core-checkout__section">{paymentPicker}</section>
          <section className="core-checkout__section">{noteInputs}</section>
          <section className="core-checkout__section">{promoInput}</section>
          <section className="core-checkout__section">{feesBreakdown}</section>
          {deliveryMessage ? (
            <div className={`core-checkout__delivery-message core-checkout__delivery-message--${deliveryMessage.type}`}>
              {deliveryMessage.message}
            </div>
          ) : null}
          <div className="core-checkout__actions">{submitButton}</div>
        </div>
      )}
    </div>
  );
}
