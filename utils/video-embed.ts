/**
 * Resolves a YouTube/Vimeo URL to its embeddable iframe src. Returns null for
 * a direct video file URL (caller falls back to an HTML5 `<video>` tag) or
 * an unrecognized host.
 */
export function resolveVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    // YouTube
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === 'youtube.com' && parsed.pathname.startsWith('/embed/')) {
      return url;
    }

    // Vimeo
    if (host === 'vimeo.com') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id && /^\d+$/.test(id)) {
        return `https://player.vimeo.com/video/${id}`;
      }
    }
    if (host === 'player.vimeo.com') {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}
