'use client';

import { useEffect, useState } from 'react';

interface ShareButtonsProps {
  title: string;
  className?: string;
}

/**
 * Shared post share bar: native share (where supported), copy link, and
 * X / Facebook / WhatsApp intents. The URL is read on the client so it works
 * on custom domains and subdomains without server knowledge of the host.
 * Themes style via `.core-share*` selectors.
 */
export function ShareButtons({ title, className }: ShareButtonsProps): JSX.Element {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const nativeShare = async (): Promise<void> => {
    try {
      await navigator.share({ title, url });
    } catch {
      /* user dismissed — no-op */
    }
  };

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className={`core-share${className ? ` ${className}` : ''}`}>
      <span className="core-share__label">Share</span>
      <div className="core-share__actions">
        {canNativeShare ? (
          <button type="button" className="core-share__btn" onClick={nativeShare} aria-label="Share">
            Share
          </button>
        ) : null}
        <a
          className="core-share__btn"
          href={`https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
        >
          X
        </a>
        <a
          className="core-share__btn"
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Facebook"
        >
          Facebook
        </a>
        <a
          className="core-share__btn"
          href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
        >
          WhatsApp
        </a>
        <button type="button" className="core-share__btn" onClick={copyLink} aria-label="Copy link">
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
