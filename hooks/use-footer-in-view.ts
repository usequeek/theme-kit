'use client';

import { useEffect, useState } from 'react';

/** Ancestors that make a `<footer>` part of a content block rather than the page footer. */
const PAGE_FOOTER_EXCLUDE = 'main, article, section, aside, nav, header';

function pageFooters(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('footer')).filter((node) => !node.closest(PAGE_FOOTER_EXCLUDE));
}

/** A page that cannot scroll has no "end" to reach: a card on it never overlaps the footer by scrolling, so it is never hidden. */
function pageScrolls(): boolean {
  return document.documentElement.scrollHeight > window.innerHeight;
}

/**
 * True while the page's own footer is on screen and the page scrolls. A card pinned to the viewport bottom (the follow card, the
 * floating subscribe card) would sit on the footer's links once the shopper scrolls to the end, so it hides for as long as this is
 * true. Hide it with `visibility: hidden` and keep its box, so whatever is stacked above it does not jump. Only the shell's footer
 * counts: a `<footer>` inside `main`, an article, section, aside, nav or header (a product card, a blog post) is not the page footer.
 *
 * The footers are looked up again whenever the page's DOM changes, so a footer that mounts late (the editor's regions) or is
 * replaced (the footer variant switched) is watched too. Pass `active` false while the caller renders nothing: no observer is held
 * and the answer is false.
 */
export function useFooterInView(active = true): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!active || typeof IntersectionObserver === 'undefined') {
      setInView(false);
      return undefined;
    }
    const visible = new Set<Element>();
    let watched: HTMLElement[] = [];
    let observer: IntersectionObserver | null = null;
    let frame = 0;

    const watch = (): void => {
      const footers = pageFooters();
      if (footers.length === watched.length && footers.every((node, index) => node === watched[index])) return;
      observer?.disconnect();
      observer = null;
      visible.clear();
      watched = footers;
      if (footers.length === 0) {
        setInView(false);
        return;
      }
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
        setInView(visible.size > 0 && pageScrolls());
      });
      footers.forEach((node) => observer?.observe(node));
    };

    watch();
    const mutations = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(watch);
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      mutations.disconnect();
      observer?.disconnect();
      setInView(false);
    };
  }, [active]);

  return inView;
}
