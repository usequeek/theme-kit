'use client';

import type { FaqBlockData } from '../types/block';

/**
 * Framework-owned FAQ block. Renders an accessible, SSR-friendly accordion
 * using native <details>/<summary> — works with zero JS. Themes style via
 * `.core-block-faq` + sub-elements.
 */
export function CoreFaqBlock({ heading, items }: FaqBlockData): JSX.Element | null {
  const safeItems = Array.isArray(items) ? items.filter((item) => item && item.question) : [];

  if (safeItems.length === 0) return null;

  return (
    <section className="core-block core-block-faq">
      {heading ? <h2 className="core-block-faq__heading">{heading}</h2> : null}
      <div className="core-block-faq__list">
        {safeItems.map((item, index) => (
          <details key={index} className="core-block-faq__item">
            <summary className="core-block-faq__question">
              <span>{item.question}</span>
              <svg
                className="core-block-faq__chevron"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="core-block-faq__answer">{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
