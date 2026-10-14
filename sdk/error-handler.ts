'use client';

import { QueekSdkError } from '@usequeek/client-sdk';
import { useAuthModalStore } from '../stores/auth-modal-store';
import { useUserStore } from '../stores/user-store';
import { isReauthSuppressed } from './reauth-guard';

/**
 * True when the error is an unauthenticated (401) failure from the API or the
 * SDK token layer: the customer session is missing, expired or revoked.
 *
 * @example
 * try {
 *   await client.get('/client/orders');
 * } catch (error) {
 *   if (isUnauthenticatedError(error)) triggerReauth('orders');
 * }
 */
export function isUnauthenticatedError(err: unknown): boolean {
  if (err instanceof QueekSdkError) {
    if (err.code === 'unauthenticated') return true;
    if (err.status === 401) return true;
  }
  return false;
}

/**
 * Clear the local customer session and open the sign-in modal. Safe to call
 * repeatedly. The SDK's `onUnauthenticated` callback (configured in
 * `queek-client.ts`) calls it, so most code never needs to.
 *
 * `reason` (usually the request path) is logged to help trace which call
 * lost the session. It must not contain tokens.
 */
export function triggerReauth(reason?: string): void {
  if (isReauthSuppressed()) {
    console.warn(`[theme-kit] a request lost its session (${reason ?? 'unknown request'}), but sign-in is in progress, so the customer was not signed out.`);
    return;
  }
  if (reason) {
    console.warn(`[theme-kit] session expired on ${reason}: signing the customer out and opening sign-in.`);
  }
  useUserStore.getState().logout();
  useAuthModalStore.getState().open('login');
}
