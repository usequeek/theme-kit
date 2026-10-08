import { useCallback, useEffect, useState } from 'react';
import type { HeaderProps } from '../types/theme';
import { splitAnnouncement } from '../utils/announcement';

const ROTATE_EVERY_MS = 6000;

/**
 * Turns the stored announcement into the rotating one every header receives:
 * `text` is the message currently showing (so a header that only ever read
 * `text` rotates with no change), `messages`/`index`/`next`/`prev` let a
 * header draw its own pager. Auto-advances while there is more than
 * one message; a manual step restarts the clock so the message just chosen
 * gets its full turn.
 */
export function useRotatingAnnouncement(announcement: HeaderProps['announcement']): HeaderProps['announcement'] {
  const messages = announcement?.enabled ? splitAnnouncement(announcement.text) : [];
  const count = messages.length;
  const [index, setIndex] = useState(0);

  const next = useCallback(() => setIndex((i) => (count > 0 ? (i + 1) % count : 0)), [count]);
  const prev = useCallback(() => setIndex((i) => (count > 0 ? (i - 1 + count) % count : 0)), [count]);

  useEffect(() => {
    if (count < 2) return undefined;
    const timer = window.setInterval(next, ROTATE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [count, index, next]);

  if (!announcement) return announcement;

  const current = count > 0 ? index % count : 0;

  return {
    ...announcement,
    text: messages[current] ?? '',
    messages,
    index: current,
    next,
    prev,
  };
}
