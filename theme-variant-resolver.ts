import type { FC } from 'react';

type VariantComponent = FC<any>;

export type ThemeVariantImplementations = Record<string, Record<string, VariantComponent>>;
export type LegacyBlockImplementations = Record<string, Record<string, VariantComponent>>;

function resolveVariant<T extends VariantComponent>(
  implementations: ThemeVariantImplementations,
  scope: string,
  variant: string | undefined,
  fallback: T,
): T {
  if (!variant) return fallback;
  return (implementations[scope]?.[variant] as T | undefined) ?? fallback;
}

export function resolveThemeHeader<T extends VariantComponent>(
  implementations: ThemeVariantImplementations,
  variant: string | undefined,
  fallback: T,
): T {
  return resolveVariant(implementations, 'header', variant, fallback);
}

export function resolveThemeFooter<T extends VariantComponent>(
  implementations: ThemeVariantImplementations,
  variant: string | undefined,
  fallback: T,
): T {
  return resolveVariant(implementations, 'footer', variant, fallback);
}

export function resolveThemeBlock<T extends VariantComponent>(
  implementations: ThemeVariantImplementations,
  type: string,
  variant: string | undefined,
  fallback: T,
  legacyImplementations?: LegacyBlockImplementations,
): T {
  if (!variant) return fallback;
  const implementation = implementations[type]?.[variant] ?? legacyImplementations?.[type]?.[variant];
  return (implementation as T | undefined) ?? fallback;
}
