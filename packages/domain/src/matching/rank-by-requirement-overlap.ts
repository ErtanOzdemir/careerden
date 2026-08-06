/**
 * Orders profile strings (skills, certifications) by how well they answer the job's requirements.
 * Deterministic and AI-free: used to fill the tailored lists when the model returns none, so the
 * "AI" panel shows a job-relevant ordering instead of falling through to the raw profile order.
 */
export function rankByRequirementOverlap(values: string[], requirements: string[]): string[] {
  const requirementTokens = new Set(requirements.flatMap(tokenize));

  return values
    .map((value, index) => ({ index, score: overlapScore(value, requirementTokens), value }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ value }) => value);
}

function overlapScore(value: string, requirementTokens: Set<string>): number {
  const tokens = tokenize(value);
  if (tokens.length === 0) return 0;

  const matched = tokens.filter((token) => requirementTokens.has(token)).length;

  return matched / tokens.length;
}

function tokenize(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .filter((token) => token.length > 1);
}
