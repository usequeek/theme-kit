'use client';

import { useEffect, type RefObject } from 'react';
import { expandDesignTokens } from './utils/brand';
import type { DesignTokens } from './types/vendor';

interface DesignTokenPreviewMessage {
  __queekEditor: true;
  kind: 'design-tokens';
  tokens?: DesignTokens | null;
}

interface StylableTarget {
  style: {
    setProperty(name: string, value: string): void;
  };
}

/**
 * SECURITY: only the exact editor shape is accepted — everything else
 * (including other `postMessage` traffic already on this window, e.g. the
 * `edit-mode-active.tsx` block-select/refresh bridge) is ignored.
 */
export function isDesignTokenPreviewMessage(data: unknown): data is DesignTokenPreviewMessage {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Record<string, unknown>;
  return candidate.__queekEditor === true && candidate.kind === 'design-tokens';
}

/**
 * Wires a `message` listener that overlays live `--var` writes onto
 * `target.style` whenever a matching editor message arrives. Pure DOM
 * wiring (no React) so it is directly unit-testable without a browser
 * environment. Returns the disposer.
 */
export function attachDesignTokenPreviewListener(target: StylableTarget): () => void {
  const onMessage = (event: MessageEvent): void => {
    if (!isDesignTokenPreviewMessage(event.data)) return;

    const vars = expandDesignTokens(event.data.tokens);
    for (const [key, value] of Object.entries(vars)) {
      target.style.setProperty(key, value);
    }
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

/**
 * Ephemeral live-preview overlay for the merchant editor. Active ONLY when
 * embedded: the web dashboard's real preview iframe (`window.parent !==
 * window`), or the mobile app's top-level WebView, which opts in explicitly
 * via `?host=native` since it has no real parent frame to detect — real
 * public storefront visits set neither, so the listener never installs
 * (zero overhead). On a matching `{__queekEditor:true, kind:'design-tokens',
 * tokens}` message, expands the tokens and writes every `--var` straight
 * onto the brand-root element's inline style, overlaying (not replacing)
 * the SSR vars from `getBrandCssVariables`. Never persisted — a normal
 * navigation/refresh reloads the real config.
 *
 * Frozen protocol: queek_backend `.agent/.tmp/live-preview-protocol.md`.
 */
export function DesignTokenPreviewListener({
  targetRef,
}: {
  targetRef: RefObject<HTMLElement | null>;
}): null {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const isEmbedded = window.parent !== window || new URLSearchParams(location.search).get('host') === 'native';
    if (!isEmbedded) return undefined;

    const target = targetRef.current;
    if (!target) return undefined;

    return attachDesignTokenPreviewListener(target);
  }, [targetRef]);

  return null;
}
