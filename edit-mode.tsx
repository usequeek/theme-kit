'use client';

import type { JSX } from 'react';
import { useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

const QK_EDIT_FLAG = 'edit';

// Lightweight: reads `?edit=1` once on mount. Always shipped to the
// storefront bundle, but cheap (one URLSearchParams parse) and adds no
// runtime overhead for public visitors.
export function useEditMode(): boolean {
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsEdit(new URLSearchParams(window.location.search).get(QK_EDIT_FLAG) === '1');
  }, []);

  return isEdit;
}

// The heavy edit-mode chunk (postMessage bridge, scroll-into-view, link
// suppression, router.refresh) is split into edit-mode-active.tsx and only
// loaded for users with `?edit=1`. Public visitors never download it.
const ActiveBlock = dynamic(
  () => import('./edit-mode-active').then((m) => m.ActiveBlock),
  { ssr: false, loading: () => null },
);

const ActiveBridge = dynamic(
  () => import('./edit-mode-active').then((m) => m.ActiveBridge),
  { ssr: false, loading: () => null },
);

const ActiveRegion = dynamic(
  () => import('./edit-mode-active').then((m) => m.ActiveRegion),
  { ssr: false, loading: () => null },
);

export function EditableBlock({
  index,
  type,
  variant,
  enabled,
  children,
}: {
  index: number;
  type: string;
  variant?: string;
  enabled: boolean;
  children: ReactNode;
}): JSX.Element {
  if (!enabled) return <>{children}</>;
  return (
    <ActiveBlock index={index} type={type} variant={variant}>
      {children}
    </ActiveBlock>
  );
}

// Static-region click-to-edit (header / footer). Self-gates on `?edit=1` like
// EditModeBridge, so public visitors render children untouched and never load
// the active chunk.
export function EditableRegion({
  region,
  children,
}: {
  region: string;
  children: ReactNode;
}): JSX.Element {
  const isEdit = useEditMode();
  if (!isEdit) return <>{children}</>;
  return <ActiveRegion region={region}>{children}</ActiveRegion>;
}

export function EditModeBridge(): JSX.Element | null {
  const isEdit = useEditMode();
  if (!isEdit) return null;
  return <ActiveBridge />;
}
