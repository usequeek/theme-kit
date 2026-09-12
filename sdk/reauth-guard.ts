let suppressed = false;
let suppressTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Suppress the global "401 → log out + open login modal" handler (see error-handler.ts
 * triggerReauth) for a window of time. Exists for a real race: on page load, an already-present
 * (possibly stale/expired) token is still in localStorage while an auth exchange — a channel
 * magic-link resolve, an OAuth callback — is establishing a NEW session. Other components mounted
 * globally (e.g. useCartSync) fire their own authenticated requests independently and don't know
 * an exchange is in flight; if THEIR request 401s on the stale token and that response lands
 * AFTER the exchange has already applied the new session, the global handler would silently wipe
 * the brand-new login (logout() clears user/isAuthenticated, though not the token itself) and
 * reopen the login modal — the customer ends up looking logged out even though the exchange
 * actually succeeded. Call suppressReauth() before starting an exchange; the window covers both
 * the exchange itself and any stale in-flight request whose 401 arrives shortly after.
 */
export function suppressReauth(forMs = 8000): void {
  suppressed = true;
  if (suppressTimer) clearTimeout(suppressTimer);
  suppressTimer = setTimeout(() => {
    suppressed = false;
  }, forMs);
}

export function isReauthSuppressed(): boolean {
  return suppressed;
}
