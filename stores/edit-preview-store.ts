'use client';

import { create } from 'zustand';
import type { Block } from '../types/block';

interface EditPreviewState {
  /** Draft sections streamed from the merchant editor. `null` = render what the server sent. */
  blocks: Block[] | null;
  /** Order of the newest draft. */
  streamedSeq: number;
  /** Order of the last refresh request — a payload can only carry what was
   *  already saved at that moment. */
  refreshSeq: number;
  setBlocks: (blocks: Block[]) => void;
  markRefreshRequested: () => void;
  /** Yield to the server, unless the draft is newer than the refresh that produced it. */
  reconcile: () => void;
}

/**
 * Draft page content streamed live from the merchant editor, so a section edit
 * renders immediately instead of waiting for a network round trip.
 *
 * Without it, every field change would take the long way: 900ms debounce → PUT
 * the draft → postMessage 'refresh' → router.refresh() → RSC fetch → API render,
 * and the preview would show the OLD content the whole time. The merchant
 * already holds the edited section in its own state; sending it costs nothing
 * and removes both network hops from the interactive path.
 *
 * Design tokens work the same way (design-token-preview.tsx) — this applies the
 * idea to section content, which is what merchants spend their time editing.
 *
 * The server stays authoritative: PageRenderer drops this override the moment a
 * fresh server payload arrives, so the debounced save still reconciles and a
 * drifted preview cannot outlive one refresh.
 */
/**
 * A monotonic counter, not a clock. Two events in the same millisecond are
 * indistinguishable by Date.now(), and "typed at the same moment the refresh
 * was requested" is precisely the case that has to resolve correctly.
 */
let sequence = 0;
const nextSeq = (): number => (sequence += 1);

export const useEditPreviewStore = create<EditPreviewState>()((set, get) => ({
  blocks: null,
  streamedSeq: 0,
  refreshSeq: 0,
  setBlocks: (blocks) => set({ blocks, streamedSeq: nextSeq() }),
  markRefreshRequested: () => set({ refreshSeq: nextSeq() }),
  reconcile: () => {
    // Typing DURING the save round trip is the case this protects: the payload
    // was rendered from what had been saved when the refresh was requested, so
    // a draft streamed after that point is strictly newer. Clearing it there
    // would flash the vendor's screen back to older content until their next
    // keystroke re-streamed it.
    if (get().streamedSeq > get().refreshSeq) return;
    set({ blocks: null });
  },
}));
