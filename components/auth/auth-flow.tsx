'use client';

import type { JSX } from 'react';
import { AuthFlowProvider, useAuthFlow } from '../../hooks/use-auth-flow';
import { AuthEmailOtpStep } from './auth-email-otp-step';
import { AuthEmailOtpVerifyStep } from './auth-email-otp-verify-step';
import { AuthSignupStep } from './auth-signup-step';
import { AuthEmailLoginStep } from './auth-email-login-step';
import { AuthEmailRegisterStep } from './auth-email-register-step';

function AuthFlowInner(): JSX.Element | null {
  const { step } = useAuthFlow();
  if (step === 'email-otp') return <AuthEmailOtpStep />;
  if (step === 'email-otp-verify') return <AuthEmailOtpVerifyStep />;
  if (step === 'signup') return <AuthSignupStep />;
  if (step === 'email-login') return <AuthEmailLoginStep />;
  if (step === 'email-register') return <AuthEmailRegisterStep />;
  return null;
}

/**
 * The kit's customer sign-in and sign-up flow (email code, email and password,
 * and Google), rendered step by step. A theme that wants its own sign-in
 * layout provides `AuthRenderer` in its module and renders this inside it. Its
 * markup carries `core-auth*` classes for your CSS, and every string goes
 * through the theme strings (`auth.*`).
 *
 * @example
 * export function AuthRenderer() {
 *   return <div className="my-auth-card"><AuthFlow /></div>;
 * }
 */
export function AuthFlow(): JSX.Element {
  return (
    <AuthFlowProvider>
      <AuthFlowInner />
    </AuthFlowProvider>
  );
}
