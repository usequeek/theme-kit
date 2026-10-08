'use client';

import type { JSX } from 'react';
import type { Block } from './types/block';
import { useEditPreviewStore } from './stores/edit-preview-store';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toJpeg } from 'html-to-image';

const MESSAGE_SOURCE = 'queek-storefront';
const MESSAGE_SOURCE_PARENT = 'queek-merchant';

// Longest edge of the captured JPEG, in CSS px. Keeps the resulting
// data-URI small (~50-150KB) so it can ride a Qee chat request body inline
// instead of being uploaded and referenced by URL.
const CAPTURE_MAX_EDGE = 1000;

async function captureBlock(el: HTMLElement): Promise<string> {
  const rect = el.getBoundingClientRect();
  const longest = Math.max(rect.width, rect.height) || 1;
  const pixelRatio = Math.min(1, CAPTURE_MAX_EDGE / longest);
  return toJpeg(el, {
    quality: 0.85,
    pixelRatio,
    // Re-fetch cross-origin (CDN) images so html-to-image inlines them as
    // data-URLs before rasterising — media.usequeek.com sends
    // `access-control-allow-origin: *`, so the canvas stays untainted.
    cacheBust: true,
    fetchRequestInit: { mode: 'cors' },
  });
}

let selectedIndex: number | null = null;
const listeners = new Set<(idx: number | null) => void>();

function setSelectedIndex(next: number | null): void {
  selectedIndex = next;
  listeners.forEach((fn) => fn(next));
}

function useSelectedIndex(): number | null {
  const [value, setValue] = useState<number | null>(selectedIndex);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

// Which sidebar tab the merchant is on — streamed in from the parent so the
// per-block overlay can offer the *other* one ("Section" while on AI, "AI"
// everywhere else) without the storefront needing its own tab state.
let activeTabIsAi = false;
const tabListeners = new Set<(isAi: boolean) => void>();

function setActiveTabIsAi(next: boolean): void {
  activeTabIsAi = next;
  tabListeners.forEach((fn) => fn(next));
}

function useActiveTabIsAi(): boolean {
  const [value, setValue] = useState(activeTabIsAi);
  useEffect(() => {
    tabListeners.add(setValue);
    return () => {
      tabListeners.delete(setValue);
    };
  }, []);
  return value;
}

function postBlockMessage(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  // `window.parent !== window` is true for the web dashboard's real
  // `<iframe>` embed. The Queek mobile app instead loads the storefront as a
  // top-level document inside a WebView, so that check alone left it with no
  // way to receive block:click/block:add/block:delete — the storefront
  // simply never posted. Mobile appends `&host=native` to the preview URL to
  // opt in explicitly; the web embed doesn't set it and keeps working as
  // before either way.
  const isEmbedded = window.parent !== window || new URLSearchParams(location.search).get('host') === 'native';
  if (!isEmbedded) return;

  // Target origin '*' is fine — payload is non-sensitive block metadata;
  // the merchant filters by `source` on receive.
  window.parent.postMessage({ source: MESSAGE_SOURCE, ...payload }, '*');
}

let parentListenerInstalled = false;
function ensureParentListener(): void {
  if (parentListenerInstalled || typeof window === 'undefined') return;
  parentListenerInstalled = true;
  window.addEventListener('message', (e: MessageEvent) => {
    const data = e.data;
    if (!data || typeof data !== 'object' || data.source !== MESSAGE_SOURCE_PARENT) return;
    if (data.type === 'block:select') {
      setSelectedIndex(typeof data.index === 'number' ? data.index : null);
    } else if (data.type === 'tab:active') {
      setActiveTabIsAi(Boolean(data.isAi));
    } else if (data.type === 'blocks:set') {
      // The merchant's current draft sections, whole. One message covers a field
      // edit, a reorder, an insert and a delete — no index arithmetic to drift.
      if (Array.isArray(data.blocks)) useEditPreviewStore.getState().setBlocks(data.blocks as Block[]);
    }
  });
  // This whole module is a next/dynamic chunk, fetched separately from the
  // main storefront bundle — it can finish loading AFTER the merchant's
  // iframe `onLoad` (which fires on the MAIN document's load, unrelated to
  // this chunk) already broadcast block:select/tab:active once. A message
  // sent before this listener existed is just gone — postMessage doesn't
  // queue for a not-yet-registered listener. Announcing readiness here lets
  // the merchant re-send the current state on its own schedule instead of
  // guessing ours, closing that race instead of hoping onLoad wins it.
  postBlockMessage({ type: 'ready' });
}

export function ActiveBlock({
  index,
  type,
  variant,
  children,
}: {
  index: number;
  type: string;
  variant?: string;
  children: ReactNode;
}): JSX.Element {
  const elRef = useRef<HTMLDivElement>(null);
  const selected = useSelectedIndex();
  const isSelected = selected === index;
  const isAiTab = useActiveTabIsAi();
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    ensureParentListener();
  }, []);

  useEffect(() => {
    if (!isSelected || !elRef.current) return;
    elRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isSelected]);

  // Screenshot THIS section locally (edit mode only — the whole component tree
  // only renders inside the editor iframe) and hand the JPEG data-URI to the
  // merchant, which attaches it to a Qee chat message.
  const captureToQee = async (): Promise<void> => {
    const el = elRef.current;
    if (!el || capturing) return;
    setCapturing(true);
    try {
      const dataUrl = await captureBlock(el);
      postBlockMessage({ type: 'block:captured', index, dataUrl });
    } catch (err) {
      postBlockMessage({
        type: 'block:captured',
        index,
        error: err instanceof Error ? err.message : 'Capture failed',
      });
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div
      ref={elRef}
      data-qk-block-index={index}
      data-qk-block-type={type}
      data-qk-selected={isSelected ? '1' : undefined}
      className="qk-editable-block"
      onClick={(e) => {
        e.stopPropagation();
        postBlockMessage({ type: 'block:click', index, blockType: type, variant });
      }}
    >
      {children}
      <button
        type="button"
        className="qk-editable-capture"
        title="Send this section to qee"
        disabled={capturing}
        onClick={(e) => {
          e.stopPropagation();
          void captureToQee();
        }}
      >
        {capturing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
            </path>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.2a1.5 1.5 0 0 0 1.25-.67l.6-.9A1.5 1.5 0 0 1 10.8 4.8h2.4a1.5 1.5 0 0 1 1.25.67l.6.9A1.5 1.5 0 0 0 16.3 7h1.2A1.5 1.5 0 0 1 19 8.5v8A1.5 1.5 0 0 1 17.5 18h-11A1.5 1.5 0 0 1 5 16.5v-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="qk-editable-add"
        title="Add section below"
        onClick={(e) => {
          e.stopPropagation();
          postBlockMessage({ type: 'block:add', insertIndex: index + 1 });
        }}
      >
        +
      </button>
      <button
        type="button"
        className="qk-editable-delete"
        title="Delete this section"
        onClick={(e) => {
          e.stopPropagation();
          postBlockMessage({ type: 'block:delete', index });
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 7 7.2 18.2A1.5 1.5 0 0 0 8.7 19.6h6.6a1.5 1.5 0 0 0 1.5-1.4L17.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 10.5v6M14 10.5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {isAiTab ? (
        // Only shown on the AI tab: the reverse direction (Sections -> AI)
        // already exists as the capture button above, which does strictly
        // more (attaches a screenshot) — a second "go to AI" affordance here
        // would just be a redundant, confusing near-duplicate of it.
        <button
          type="button"
          className="qk-editable-editsection"
          title="Edit this section's settings"
          onClick={(e) => {
            e.stopPropagation();
            postBlockMessage({ type: 'block:editSection', index });
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="4" y="14" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function ActiveRegion({
  region,
  children,
}: {
  region: string;
  children: ReactNode;
}): JSX.Element {
  // `display: contents` (see storefront.css) — this wrapper draws no box, so it
  // never disturbs the theme's sticky header / flex footer layout. The click
  // still fires because the element stays in the DOM event path; hover outline
  // is applied to the wrapped child via CSS.
  return (
    <div
      data-qk-region={region}
      className="qk-editable-region"
      onClick={(e) => {
        e.stopPropagation();
        // The announcement bar lives inside the header region; every theme marks
        // its container with a `*-announcement` class, so a click there
        // deep-links straight to the Announcement editor. The `:not` excludes
        // the `*-nav--has-announcement` modifier the <header> itself carries
        // when the bar is enabled — otherwise plain nav clicks would match too.
        const target =
          region === 'header' &&
          (e.target as HTMLElement | null)?.closest?.(
            '[class*="announcement"]:not([class*="has-announcement"])',
          )
            ? 'announcement'
            : region;
        postBlockMessage({ type: 'region:click', region: target });
      }}
    >
      {children}
    </div>
  );
}

export function ActiveBridge(): null {
  const router = useRouter();

  useEffect(() => {
    // Suppress in-iframe navigation while editing — clicks on links and
    // form submits inside the preview should not navigate the frame away.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (a) e.preventDefault();
    };
    const onSubmit = (e: Event) => e.preventDefault();
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);

    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object' || data.source !== MESSAGE_SOURCE_PARENT) return;
      if (data.type === 'refresh') {
        useEditPreviewStore.getState().markRefreshRequested();
        router.refresh();
      }
    };
    window.addEventListener('message', onMessage);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('message', onMessage);
    };
  }, [router]);

  return null;
}
