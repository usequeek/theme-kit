/**
 * Whether text is blank: empty, or made only of whitespace and invisible format
 * characters (zero-width spaces and joiners, directional marks, the word joiner,
 * the byte order mark). Mirrors the server rule. Internal: not part of the public
 * barrels. It only classifies text; it never edits it, so emoji sequences that use
 * a zero-width joiner stay intact.
 */
const BLANK_CHARACTERS = /[\s\u00A0\u200B-\u200F\u2060\uFEFF]/g;

export function isBlankText(text: unknown): boolean {
  return typeof text !== 'string' || text.replace(BLANK_CHARACTERS, '') === '';
}
