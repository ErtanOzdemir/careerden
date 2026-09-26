import type { ApiDocumentContent, ApiProfile } from "../api/types.js";
import { containsTerm, draftCvSearchText } from "./cv-text.js";

export interface KeywordCoverage {
  matched: string[];
  missing: string[];
}

/** Longer "skills" are really requirement sentences; they never appear verbatim, so skip them. */
const MAX_KEYWORD_WORDS = 4;

/** Which of the job's keywords the current draft CV actually contains, recomputed on every edit. */
export function computeKeywordCoverage(
  keywords: string[],
  content: ApiDocumentContent,
  profile?: ApiProfile,
): KeywordCoverage {
  const text = draftCvSearchText(content, profile);
  const coverage: KeywordCoverage = { matched: [], missing: [] };

  for (const keyword of keywords) {
    if (keyword.split(/\s+/).length > MAX_KEYWORD_WORDS) continue;
    (containsTerm(text, keyword) ? coverage.matched : coverage.missing).push(keyword);
  }

  return coverage;
}
