/**
 * Whether text is blank: empty, or made only of whitespace, separator and format
 * characters (zero-width spaces and joiners, directional marks, the word joiner,
 * the byte order mark, the soft hyphen, tag characters). Matches the server's
 * whitespace, separator and format-character rule. Internal: not part of the
 * public barrels. It only classifies text and never edits it: any character
 * outside that class (letters, digits, punctuation, emoji) makes the text
 * non-blank, and emoji sequences that use a zero-width joiner stay intact.
 */
const BLANK_CHARACTERS = new RegExp('[\\s\\p{Cf}]', 'gu');

export function isBlankText(text: unknown): boolean {
  return typeof text !== 'string' || text.replace(BLANK_CHARACTERS, '') === '';
}
