'use client';

import { QueekSdkError } from '@queekai/client-sdk';
import { useAuthModalStore } from '../stores/auth-modal-store';
import { useUserStore } from '../stores/user-store';
import { isReauthSuppressed } from './reauth-guard';

/**
 * Returns true if the caught error is an unauthenticated (401) error
 * from the backend or SDK token layer.
 */
export function isUnauthenticatedError(err: unknown): boolean {
  if (err instanceof QueekSdkError) {
    if (err.code === 'unauthenticated') return true;
    if (err.status === 401) return true;
  }
  return false;
}

/**
 * Reset local user state and open the auth modal. Safe to call
 * repeatedly (idempotent). Called by the SDK's onUnauthenticated
 * callback (configured in queek-client.ts).
 */
export function triggerReauth(reason?: string): void {
  if (isReauthSuppressed()) {
     
    console.warn(`[queek-sdk] unauthenticated (${reason ?? 'unknown'}) — suppressed, an auth exchange is in flight`);
    return;
  }
  if (reason) {
     
    console.warn(`[queek-sdk] unauthenticated → reauth (${reason})`);
  }
  useUserStore.getState().logout();
  useAuthModalStore.getState().open('login');
}
