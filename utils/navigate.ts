/**
 * A full document navigation (never a client-side route change): the page that asked for it is replaced, so nothing of it
 * survives into the next document. One call site per flow, so a test can observe where a flow sends the browser (a real
 * `window.location` cannot be stubbed in jsdom).
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
