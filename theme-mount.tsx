'use client';

import { Component, createElement, type ErrorInfo, type JSX, type ReactNode } from 'react';
import type { FooterProps, HeaderProps, ThemeModule } from './types/theme';
import { ThemeProvider } from './theme-context';

/**
 * Renders a theme. THE MINIMUM A THEME NEEDS TO BE SEEN.
 *
 * It mounts a theme's header, page and footer inside the kit's provider, so a
 * theme written and typechecked outside a Queek storefront can still be rendered.
 *
 * DELIBERATELY SMALL. It leaves out the Queek storefront's own chrome — checkout
 * header, cart and auth modals, toasts, WhatsApp chat, analytics, the merchant
 * edit-mode bridge. None of that is a theme's concern. What is left is the
 * actual contract: a Layout wrapping a header, the page, and a footer.
 *
 * Themes render inside a boundary because a theme's header and footer are
 * SIBLINGS of the page, so a crash in either escapes any boundary the page sets
 * up and blanks the whole screen. A theme developer should see which part broke,
 * not an empty document.
 */

class ThemeBoundary extends Component<
  { part: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[theme-kit] the theme's ${this.props.part} threw`, error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    // Visible on purpose. A silent fallback during theme development means
    // staring at a missing header wondering whether it is CSS.
    return (
      <div role="alert" style={{ padding: '1rem', border: '2px solid #e0492f', background: '#fff5f3', color: '#211711', font: '14px/1.5 ui-monospace, monospace' }}>
        <strong>Theme {this.props.part} crashed.</strong>
        <pre style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
      </div>
    );
  }
}

export interface ThemeMountProps {
  theme: ThemeModule;
  headerProps: HeaderProps;
  footerProps: FooterProps;
  /** Variant ids from the store's config; omit to render the theme's default. */
  headerVariant?: string;
  footerVariant?: string;
  children: ReactNode;
}

export function ThemeMount({
  theme,
  headerProps,
  footerProps,
  headerVariant,
  footerVariant,
  children,
}: ThemeMountProps): JSX.Element {
  return (
    <ThemeProvider theme={theme}>
      <theme.Layout>
        <ThemeBoundary part="header">
          {createElement(theme.getHeader(headerVariant), headerProps)}
        </ThemeBoundary>
        <main className="storefront-main">{children}</main>
        <ThemeBoundary part="footer">
          {createElement(theme.getFooter(footerVariant), footerProps)}
        </ThemeBoundary>
      </theme.Layout>
    </ThemeProvider>
  );
}
