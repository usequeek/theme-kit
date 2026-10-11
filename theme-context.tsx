'use client';

import type { JSX } from 'react';
import { createContext, useContext, type ReactNode } from 'react';
import type { ThemeModule } from './types/theme';

const ThemeContext = createContext<ThemeModule | null>(null);

/**
 * Makes a theme module available to `useTheme()`. `ThemeMount` renders it for
 * you; use it directly only when you mount a theme yourself.
 */
export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeModule;
  children: ReactNode;
}): JSX.Element {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/**
 * The mounted theme module (manifest, pages, header and footer variants).
 *
 * @throws {Error} when called outside `ThemeMount` or `ThemeProvider`. Use
 * `useOptionalTheme()` where a theme may be absent.
 */
export function useTheme(): ThemeModule {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useTheme() was called outside <ThemeProvider>. Render the component inside <ThemeMount> (or <ThemeProvider theme={...}>).');
  }

  return theme;
}

/**
 * Null outside a theme provider (kit chrome such as the cart shell renders
 * under `StorefrontProvider` with no theme mounted). `useThemeStrings`
 * reads the mounted theme's `manifest.strings` through this, so a missing
 * theme simply contributes no dictionary instead of throwing.
 */
export function useOptionalTheme(): ThemeModule | null {
  return useContext(ThemeContext);
}
