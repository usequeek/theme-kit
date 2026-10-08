'use client';

import type { JSX } from 'react';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { QueekSdkError, type EmailVerifyOtpResponse } from '@queekai/client-sdk';
import { useStorefront, useThemeStrings } from '../provider';
import { getQueekClient, setAuthTokens, QUEEK_AUTH_URL } from '../sdk/queek-client';
import { useAuthModalStore } from '../stores/auth-modal-store';
import { useUserStore } from '../stores/user-store';

export type AuthStep =
  | 'email-otp'
  | 'email-otp-verify'
  | 'signup'
  | 'email-login'
  | 'email-register';

export interface AuthFlowState {
  step: AuthStep;
  otp: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
}

export interface AuthFlowActions {
  setOtp: (value: string) => void;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  submitEmailRequestOtp: () => Promise<void>;
  submitEmailVerifyOtp: () => Promise<void>;
  submitRegister: () => Promise<void>;
  submitEmailLogin: () => Promise<void>;
  submitEmailRegister: () => Promise<void>;
  initiateGoogleAuth: () => Promise<void>;
  reset: () => void;
  goToEmailOtp: () => void;
  goToEmailLogin: () => void;
  goToEmailRegister: () => void;
}

export type AuthFlowValue = AuthFlowState & AuthFlowActions;

const EMAIL_OTP_LENGTH = 6;

interface PasswordAuthData {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    email: string | null;
    phone?: string | null;
    avatar: string | null;
    profile_complete?: boolean;
  };
}

export function mapEmailError(err: unknown, t: (key: string) => string): string {
  if (err instanceof QueekSdkError) {
    switch (err.code) {
      case 'invalid_credentials':
        return t('auth.error.credentials');
      case 'login_mode_mismatch':
        return t('auth.error.method');
      case 'account_already_exists':
        return t('auth.error.exists');
      case 'phone_already_exists':
        return t('auth.error.phone');
      case 'otp_resend_too_soon':
        return t('auth.error.resend');
      case 'invalid_otp':
        return t('auth.error.code');
      default:
        return err.message || t('auth.error.generic');
    }
  }
  return t('auth.error.generic');
}

const AuthFlowContext = createContext<AuthFlowValue | null>(null);

export function AuthFlowProvider({ children }: { children: ReactNode }): JSX.Element {
  const { vendor } = useStorefront();
  const t = useThemeStrings();
  const closeModal = useAuthModalStore((s) => s.close);
  const setUser = useUserStore((s) => s.setUser);

  const [step, setStep] = useState<AuthStep>('email-otp');
  const [otp, setOtp] = useState('');
  const [verifiedToken, setVerifiedToken] = useState(''); // email OTP flow: server-issued token
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyUser(u: { id: string; name: string; first_name?: string | null; last_name?: string | null; email: string | null; phone?: string | null; avatar: string | null; profile_complete?: boolean }): void {
    setUser({
      id: u.id,
      name: u.name,
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      email: u.email,
      phone: u.phone ?? '',
      avatar: u.avatar,
      profile_complete: u.profile_complete ?? Boolean(u.phone),
    });
  }

  // OAuth round-trip handling lives in core-modal-layer's GoogleCallbackHandler
  // — it must stay mounted whether or not the auth modal is open.

  // ── Email OTP flow (primary) ──────────────────────────────────────────────

  const submitEmailRequestOtp = async (): Promise<void> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setError(null);
    setLoading(true);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      await client.auth.emailRequestOtp({ email: trimmedEmail });
      setOtp('');
      setStep('email-otp-verify');
    } catch (err) {
      setError(mapEmailError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const submitEmailVerifyOtp = async (): Promise<void> => {
    if (otp.length < EMAIL_OTP_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      const data: EmailVerifyOtpResponse = await client.auth.emailVerifyOtp({
        email: email.trim(),
        otpCode: otp,
      });
      if (data.needs_registration) {
        setVerifiedToken(data.verified_token);
        setStep('signup');
        return;
      }
      // tokens already persisted by SDK
      applyUser(data.user);
      closeModal();
    } catch (err) {
      setError(mapEmailError(err, t));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // ── Signup (email OTP flow) ───────────────────────────────────────────────

  const submitRegister = async (): Promise<void> => {
    if (!firstName.trim()) {
      setError(t('auth.error.firstname'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      const res = await client.auth.emailRegisterOtp({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        verifiedToken,
      });
      // tokens already persisted by SDK
      applyUser(res.user);
      closeModal();
    } catch (err) {
      setError(err instanceof QueekSdkError ? err.message : t('auth.error.register'));
    } finally {
      setLoading(false);
    }
  };

  // ── Email password flow ───────────────────────────────────────────────────

  const submitEmailLogin = async (): Promise<void> => {
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      const res = await client.post<PasswordAuthData>('/client/auth/email/login', {
        email: email.trim(),
        password,
        platform: 'client_web',
      });
      setAuthTokens(res.data.access_token, res.data.refresh_token);
      applyUser(res.data.user);
      closeModal();
    } catch (err) {
      setError(mapEmailError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const submitEmailRegister = async (): Promise<void> => {
    if (!firstName.trim() || !email.trim() || password.length < 8) return;
    setError(null);
    setLoading(true);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      const res = await client.post<PasswordAuthData>('/client/auth/email/register-password', {
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        email: email.trim(),
        password,
        phone: '',
        platform: 'client_web',
      });
      setAuthTokens(res.data.access_token, res.data.refresh_token);
      applyUser(res.data.user);
      closeModal();
    } catch (err) {
      setError(mapEmailError(err, t));
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────

  const initiateGoogleAuth = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const returnTo = typeof window !== 'undefined' ? window.location.href : '';
      const slug = vendor.slug ?? '';
      const url = `${QUEEK_AUTH_URL}/oauth/google/start?channel=storefront&vendor_slug=${encodeURIComponent(slug)}&return_to=${encodeURIComponent(returnTo)}`;
      // eslint-disable-next-line no-console
      console.info('[google-auth] requesting redirect URL from', url);
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // eslint-disable-next-line no-console
        console.warn('[google-auth] redirect endpoint returned non-2xx', res.status, text);
        throw new Error(`Failed to initiate Google auth (HTTP ${res.status}).`);
      }
      // Response envelope: { status, message, data: { url } }
      const body = (await res.json()) as {
        data?: { url?: string; redirect_url?: string };
        url?: string;
        redirect_url?: string;
      };
      const redirectUrl =
        body.data?.url ?? body.data?.redirect_url ?? body.url ?? body.redirect_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        // eslint-disable-next-line no-console
        console.warn('[google-auth] no redirect URL in response body', body);
        throw new Error('No redirect URL returned.');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[google-auth] initiate failed', err);
      setError(t('auth.error.google'));
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const reset = (): void => {
    setStep('email-otp');
    setOtp('');
    setVerifiedToken('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setError(null);
    setLoading(false);
  };

  const goToEmailOtp = (): void => {
    setStep('email-otp');
    setOtp('');
    setVerifiedToken('');
    setError(null);
  };

  const goToEmailLogin = (): void => {
    setStep('email-login');
    setError(null);
  };

  const goToEmailRegister = (): void => {
    setStep('email-register');
    setError(null);
  };

  const value: AuthFlowValue = {
    step,
    otp,
    firstName,
    lastName,
    email,
    password,
    loading,
    error,
    setOtp,
    setFirstName,
    setLastName,
    setEmail,
    setPassword,
    submitEmailRequestOtp,
    submitEmailVerifyOtp,
    submitRegister,
    submitEmailLogin,
    submitEmailRegister,
    initiateGoogleAuth,
    reset,
    goToEmailOtp,
    goToEmailLogin,
    goToEmailRegister,
  };

  return <AuthFlowContext.Provider value={value}>{children}</AuthFlowContext.Provider>;
}

export function useAuthFlow(): AuthFlowValue {
  const ctx = useContext(AuthFlowContext);
  if (!ctx) {
    throw new Error('useAuthFlow must be used within an AuthFlowProvider');
  }
  return ctx;
}
