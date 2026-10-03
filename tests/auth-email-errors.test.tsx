/**
 * Auth error English pins (checkout / auth slice) — S4 drift guard.
 *
 * `mapEmailError` maps SDK failure codes to `t('auth.error.*')` strings, and
 * three more error keys are set directly in the provider. Every English value
 * below is resolved through the REAL default dictionary, so renaming a key or
 * changing any English value fails here. S7 proof included.
 */
import { describe, expect, it } from 'vitest';
import { QueekSdkError } from '@queekai/client-sdk';
import { t, defaultThemeStrings } from '../strings/theme-strings';
import { mapEmailError } from '../hooks/use-auth-flow';

const tt = (key: string): string => t(defaultThemeStrings, key);

function sdkError(code: string, message: string): QueekSdkError {
  return new QueekSdkError(message, code, 400);
}

describe('mapEmailError code -> English pins', () => {
  it.each([
    ['invalid_credentials', 'Wrong email or password. Please try again.'],
    ['login_mode_mismatch', 'This account uses a different sign-in method (Google or phone).'],
    ['account_already_exists', 'Email already registered. Please sign in instead.'],
    ['phone_already_exists', 'Phone number already in use.'],
    ['otp_resend_too_soon', 'Please wait before requesting another code.'],
    ['invalid_otp', 'Incorrect code. Please try again.'],
  ] as Array<[string, string]>)('code %s maps to its exact English', (code, english) => {
    expect(mapEmailError(sdkError(code, 'server message'), tt)).toBe(english);
  });

  it('passes an unknown-code server message through untouched', () => {
    expect(mapEmailError(sdkError('something_else', 'Server says no.'), tt)).toBe('Server says no.');
  });

  it('falls back to generic English when the server message is empty', () => {
    expect(mapEmailError(sdkError('something_else', ''), tt)).toBe('Something went wrong. Please try again.');
  });

  it('falls back to generic English for non-SDK failures', () => {
    expect(mapEmailError(new Error('boom'), tt)).toBe('Something went wrong. Please try again.');
    expect(mapEmailError('boom', tt)).toBe('Something went wrong. Please try again.');
  });
});

describe('direct-set auth.error.* English pins', () => {
  it.each([
    ['auth.error.firstname', 'Please enter your first name.'],
    ['auth.error.register', 'Registration failed. Try again.'],
    ['auth.error.google', 'Could not connect to Google sign-in. Please try again.'],
    ['auth.error.generic', 'Something went wrong. Please try again.'],
  ] as Array<[string, string]>)('%s resolves to its exact English', (key, english) => {
    expect(tt(key)).toBe(english);
  });
});
