import { useEffect, useState } from 'react';

/** Ancestors that make a `<footer>` part of a content block rather than the page footer. */
const PAGE_FOOTER_EXCLUDE = 'main, article, section, aside, nav, header';

/**
 * True while the page's own footer is on screen. A card pinned to the viewport bottom (the follow card, the floating subscribe
 * card) would sit on the footer's links once the shopper scrolls to the end, so it hides for as long as this is true. Hide it with
 * `visibility: hidden` and keep its box, so whatever is stacked above it does not jump. Only the shell's footer counts: a `<footer>`
 * inside `main`, an article, section, aside, nav or header (a product card, a blog post) is not the page footer.
 *
 * Pass `active` false while the caller renders nothing: no observer is held and the answer is false. The footers are read when
 * `active` turns true, which is after the page (footer included) has rendered.
 */
export function useFooterInView(active: boolean = true): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!active || typeof IntersectionObserver === 'undefined') {
      setInView(false);
      return undefined;
    }
    const footers = Array.from(document.querySelectorAll('footer')).filter((node) => !node.closest(PAGE_FOOTER_EXCLUDE));
    if (footers.length === 0) return undefined;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
      setInView(visible.size > 0);
    });
    footers.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      setInView(false);
    };
  }, [active]);

  return inView;
}
