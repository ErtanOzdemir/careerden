/**
 * Characters that render as nothing (or reorder the text around them) but still reach an AI model.
 * Job postings are untrusted input, so they are a hiding place for instructions the user never
 * sees: zero-width and filler characters, bidirectional controls, Unicode tag characters (which
 * can spell out ASCII text invisibly), and control characters other than tab and line breaks.
 */
const invisibleCharacters = new RegExp(
  [
    "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]", // C0/C1 controls except \t \n \r
    "\\u00AD", // soft hyphen
    "\\u034F", // combining grapheme joiner
    "\\u061C", // Arabic letter mark
    "[\\u115F\\u1160\\u3164\\uFFA0]", // Hangul fillers
    "\\u180E", // Mongolian vowel separator
    "[\\u200B-\\u200F]", // zero-width space/non-joiner/joiner, LRM, RLM
    "[\\u202A-\\u202E]", // bidi embeddings and overrides
    "[\\u2060-\\u2064]", // word joiner, invisible math operators
    "[\\u2066-\\u206F]", // bidi isolates and deprecated format characters
    "\\uFEFF", // zero-width no-break space / byte order mark
    "[\\u{E0000}-\\u{E007F}]", // tag characters
    "[\\u{E0100}-\\u{E01EF}]", // variation selectors supplement
  ].join("|"),
  "gu",
);

/** Removes characters that are invisible when rendered; keeps tabs, line breaks, and all visible text. */
export function stripInvisibleCharacters(text: string): string {
  return text.replace(invisibleCharacters, "");
}
