'use client';

import type { JSX } from 'react';
import { createContext, useContext, type ReactNode } from 'react';
import type { ThemeModule } from './types/theme';

const ThemeContext = createContext<ThemeModule | null>(null);

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

export function useTheme(): ThemeModule {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
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
