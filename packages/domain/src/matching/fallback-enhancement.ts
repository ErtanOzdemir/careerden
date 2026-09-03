/**
 * Compresses free-form text down to its leading sentences, stripping bullet markers. Used to build
 * the deterministic fallback cover letter body (see fallback-cover-letter.ts) when the AI's cover
 * letter comes back empty.
 */
const MAX_FALLBACK_SENTENCES = 2;

export function compressToProse(text: string, maxSentences = MAX_FALLBACK_SENTENCES): string {
  const sentences = text
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/^[\s*•·▪◦\-–—]+/, "").split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.replaceAll(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, maxSentences)
    .map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`));

  return sentences.join(" ");
}
