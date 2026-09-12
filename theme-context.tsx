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
