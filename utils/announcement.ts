/**
 * The announcement bar is ONE text field on the API
 * (`header.announcement.text`). A vendor writes several messages into it
 * separated by `|` or a line break and the bar rotates them; a single
 * message renders static. The merchant editor and Qee teach this convention.
 * Split here, once, so every theme rotates the same
 * list — a theme-local split meant the other themes showed the literal pipes
 * after a switch.
 */
export function splitAnnouncement(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\s*(?:\||\n)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}
